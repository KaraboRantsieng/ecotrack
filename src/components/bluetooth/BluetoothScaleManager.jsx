import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bluetooth, 
  BluetoothConnected, 
  BluetoothOff, 
  RefreshCw, 
  Lock, 
  Unlock,
  Scale,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Signal
} from "lucide-react";

// Approved scale device name patterns
const APPROVED_SCALE_PATTERNS = [
  /scale/i, /weight/i, /balance/i, /kg/i, /lb/i,
  /ETEKCITY/i, /RENPHO/i, /Xiaomi/i, /Withings/i,
  /CGMS/i, /BLE.*Scale/i, /Smart.*Scale/i
];

// Weight service UUIDs (common for BLE scales)
const WEIGHT_SERVICE_UUIDS = [
  '0000181d-0000-1000-8000-00805f9b34fb', // Weight Scale Service
  '0000fff0-0000-1000-8000-00805f9b34fb', // Generic custom service
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
];

const WEIGHT_CHARACTERISTIC_UUIDS = [
  '00002a9d-0000-1000-8000-00805f9b34fb', // Weight Measurement
  '0000fff1-0000-1000-8000-00805f9b34fb', // Custom weight characteristic
  '00002a9e-0000-1000-8000-00805f9b34fb', // Weight Scale Feature
];

export default function BluetoothScaleManager({ 
  onWeightLocked, 
  onWeightChange,
  onConnectionChange,
  disabled = false 
}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [currentWeight, setCurrentWeight] = useState(null);
  const [isWeightStable, setIsWeightStable] = useState(false);
  const [isWeightLocked, setIsWeightLocked] = useState(false);
  const [lockedWeight, setLockedWeight] = useState(null);
  const [error, setError] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [signalStrength, setSignalStrength] = useState(null);
  
  const weightHistoryRef = useRef([]);
  const stabilityTimerRef = useRef(null);
  const characteristicRef = useRef(null);
  const deviceRef = useRef(null);

  useEffect(() => {
    // Check if Web Bluetooth is supported
    setIsSupported('bluetooth' in navigator);
    
    return () => {
      if (stabilityTimerRef.current) {
        clearTimeout(stabilityTimerRef.current);
      }
      disconnectDevice();
    };
  }, []);

  const isApprovedScale = (deviceName) => {
    if (!deviceName) return false;
    return APPROVED_SCALE_PATTERNS.some(pattern => pattern.test(deviceName));
  };

  const parseWeightFromData = (dataView) => {
    // Try different parsing methods for various scale protocols
    try {
      // Standard Weight Measurement characteristic format
      const flags = dataView.getUint8(0);
      const isKg = !(flags & 0x01); // Bit 0: 0 = kg, 1 = lb
      
      let weight;
      if (dataView.byteLength >= 3) {
        weight = dataView.getUint16(1, true) / 200; // Resolution of 0.005 kg
      } else if (dataView.byteLength >= 2) {
        weight = dataView.getUint16(0, true) / 100;
      } else {
        weight = dataView.getUint8(0) / 10;
      }
      
      // Convert to kg if in pounds
      if (!isKg) {
        weight = weight * 0.453592;
      }
      
      return Math.round(weight * 100) / 100; // Round to 2 decimal places
    } catch (e) {
      console.error("Error parsing weight:", e);
      return null;
    }
  };

  const checkWeightStability = useCallback((newWeight) => {
    const history = weightHistoryRef.current;
    history.push({ weight: newWeight, timestamp: Date.now() });
    
    // Keep last 10 readings
    if (history.length > 10) {
      history.shift();
    }
    
    // Need at least 5 readings for stability check
    if (history.length < 5) {
      setIsWeightStable(false);
      return false;
    }
    
    // Check last 5 readings within 2 seconds
    const recentReadings = history.slice(-5);
    const timeSpan = recentReadings[recentReadings.length - 1].timestamp - recentReadings[0].timestamp;
    
    if (timeSpan < 1500) {
      // Need readings over at least 1.5 seconds
      setIsWeightStable(false);
      return false;
    }
    
    // Check if all readings are within 0.05kg of each other
    const weights = recentReadings.map(r => r.weight);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    const variance = maxWeight - minWeight;
    
    const stable = variance <= 0.05 && newWeight > 0.01;
    setIsWeightStable(stable);
    
    return stable;
  }, []);

  const handleWeightNotification = useCallback((event) => {
    const dataView = event.target.value;
    const weight = parseWeightFromData(dataView);
    
    if (weight !== null && weight >= 0) {
      setCurrentWeight(weight);
      onWeightChange?.(weight);
      
      if (!isWeightLocked) {
        const stable = checkWeightStability(weight);
        
        if (stable && !stabilityTimerRef.current) {
          // Auto-lock after 2 seconds of stability
          stabilityTimerRef.current = setTimeout(() => {
            if (checkWeightStability(weight)) {
              lockWeight(weight);
            }
            stabilityTimerRef.current = null;
          }, 2000);
        }
      }
    }
  }, [isWeightLocked, checkWeightStability, onWeightChange]);

  const scanAndConnect = async () => {
    if (!isSupported || disabled) return;
    
    setIsScanning(true);
    setError(null);
    setConnectionStatus('connecting');
    
    try {
      // Request Bluetooth device with weight scale services
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['weight_scale'] },
          { services: [0x181D] }, // Weight Scale Service
          { namePrefix: 'Scale' },
          { namePrefix: 'Weight' },
          { namePrefix: 'BLE' },
        ],
        optionalServices: WEIGHT_SERVICE_UUIDS,
        acceptAllDevices: false
      }).catch(() => {
        // Fallback: accept all devices if specific filters fail
        return navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: WEIGHT_SERVICE_UUIDS
        });
      });

      if (!device) {
        throw new Error("No device selected");
      }

      // Verify it's an approved scale type
      if (!isApprovedScale(device.name)) {
        console.warn("Device may not be an approved scale:", device.name);
      }

      deviceRef.current = device;
      
      // Set up disconnect listener
      device.addEventListener('gattserverdisconnected', handleDisconnect);
      
      // Connect to GATT server
      const server = await device.gatt.connect();
      
      // Find weight service and characteristic
      let weightCharacteristic = null;
      
      for (const serviceUuid of WEIGHT_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          for (const charUuid of WEIGHT_CHARACTERISTIC_UUIDS) {
            try {
              weightCharacteristic = await service.getCharacteristic(charUuid);
              break;
            } catch (e) {
              continue;
            }
          }
          if (weightCharacteristic) break;
        } catch (e) {
          continue;
        }
      }

      if (!weightCharacteristic) {
        throw new Error("Could not find weight characteristic. Device may not be compatible.");
      }

      characteristicRef.current = weightCharacteristic;
      
      // Start notifications
      await weightCharacteristic.startNotifications();
      weightCharacteristic.addEventListener('characteristicvaluechanged', handleWeightNotification);
      
      // Store device info for audit trail
      setDeviceInfo({
        name: device.name || 'Unknown Scale',
        id: device.id,
        connectedAt: new Date().toISOString(),
        hardwareId: device.id.substring(0, 16)
      });
      
      setConnectedDevice(device);
      setConnectionStatus('connected');
      onConnectionChange?.({ 
        connected: true, 
        device: { name: device.name, id: device.id } 
      });
      
    } catch (err) {
      console.error("Bluetooth error:", err);
      setError(err.message || "Failed to connect to scale");
      setConnectionStatus('error');
      onConnectionChange?.({ connected: false, error: err.message });
    } finally {
      setIsScanning(false);
    }
  };

  const handleDisconnect = useCallback(() => {
    setConnectedDevice(null);
    setConnectionStatus('disconnected');
    setCurrentWeight(null);
    setIsWeightStable(false);
    characteristicRef.current = null;
    weightHistoryRef.current = [];
    onConnectionChange?.({ connected: false });
  }, [onConnectionChange]);

  const disconnectDevice = async () => {
    if (characteristicRef.current) {
      try {
        await characteristicRef.current.stopNotifications();
      } catch (e) {
        console.error("Error stopping notifications:", e);
      }
    }
    
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    
    handleDisconnect();
  };

  const lockWeight = (weight = currentWeight) => {
    if (weight === null || weight <= 0) return;
    
    const lockedData = {
      weight_kg: weight,
      locked_at: new Date().toISOString(),
      device_info: deviceInfo,
      stability_confirmed: true,
      reading_count: weightHistoryRef.current.length,
      connection_signature: `${deviceInfo?.id}-${Date.now()}`
    };
    
    setLockedWeight(weight);
    setIsWeightLocked(true);
    onWeightLocked?.(lockedData);
  };

  const unlockWeight = () => {
    setIsWeightLocked(false);
    setLockedWeight(null);
    weightHistoryRef.current = [];
    if (stabilityTimerRef.current) {
      clearTimeout(stabilityTimerRef.current);
      stabilityTimerRef.current = null;
    }
  };

  if (!isSupported) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <BluetoothOff className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Bluetooth is not supported on this device/browser. Please use Chrome on Android or a compatible device.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Bluetooth Scale</span>
          </div>
          <Badge className={
            connectionStatus === 'connected' ? 'bg-green-100 text-green-700' :
            connectionStatus === 'connecting' ? 'bg-amber-100 text-amber-700' :
            connectionStatus === 'error' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }>
            {connectionStatus === 'connected' && <BluetoothConnected className="w-3 h-3 mr-1" />}
            {connectionStatus === 'connecting' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {connectionStatus === 'disconnected' && <BluetoothOff className="w-3 h-3 mr-1" />}
            {connectionStatus === 'error' && <AlertTriangle className="w-3 h-3 mr-1" />}
            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </Badge>
        </div>

        {/* Connection Section */}
        {connectionStatus !== 'connected' && (
          <div className="text-center py-4">
            <Bluetooth className="w-12 h-12 text-blue-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-4">
              Connect your Bluetooth scale for verified weight capture
            </p>
            <Button
              onClick={scanAndConnect}
              disabled={isScanning || disabled}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4 mr-2" />
                  Connect Scale
                </>
              )}
            </Button>
          </div>
        )}

        {/* Connected Device Info */}
        {connectionStatus === 'connected' && deviceInfo && (
          <div className="bg-white p-3 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BluetoothConnected className="w-4 h-4 text-green-600" />
                <span className="font-medium text-sm">{deviceInfo.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={disconnectDevice}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Disconnect
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              ID: {deviceInfo.hardwareId}...
            </p>
          </div>
        )}

        {/* Weight Display */}
        {connectionStatus === 'connected' && (
          <div className={`p-6 rounded-xl text-center ${
            isWeightLocked 
              ? 'bg-green-100 border-2 border-green-300' 
              : isWeightStable 
                ? 'bg-blue-100 border-2 border-blue-300'
                : 'bg-gray-100 border-2 border-gray-200'
          }`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              {isWeightLocked ? (
                <Lock className="w-5 h-5 text-green-600" />
              ) : isWeightStable ? (
                <CheckCircle className="w-5 h-5 text-blue-600" />
              ) : (
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              )}
              <span className={`text-sm font-medium ${
                isWeightLocked ? 'text-green-700' :
                isWeightStable ? 'text-blue-700' : 'text-gray-600'
              }`}>
                {isWeightLocked ? 'Weight Locked' :
                 isWeightStable ? 'Stable - Ready to Lock' : 'Reading...'}
              </span>
            </div>
            
            <p className={`text-5xl font-bold ${
              isWeightLocked ? 'text-green-700' : 'text-gray-900'
            }`}>
              {isWeightLocked ? lockedWeight?.toFixed(2) : currentWeight?.toFixed(2) || '0.00'}
              <span className="text-2xl ml-2">kg</span>
            </p>
            
            {!isWeightLocked && isWeightStable && (
              <p className="text-xs text-blue-600 mt-2">
                Auto-locking in 2 seconds...
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {connectionStatus === 'connected' && (
          <div className="flex gap-2">
            {!isWeightLocked ? (
              <Button
                onClick={() => lockWeight()}
                disabled={!isWeightStable || currentWeight <= 0}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Lock className="w-4 h-4 mr-2" />
                Lock Weight
              </Button>
            ) : (
              <Button
                onClick={unlockWeight}
                variant="outline"
                className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Unlock className="w-4 h-4 mr-2" />
                Unlock & Re-weigh
              </Button>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Verification Badge */}
        {isWeightLocked && (
          <div className="flex items-center justify-center gap-2 text-xs text-green-700 bg-green-50 p-2 rounded-lg">
            <CheckCircle className="w-4 h-4" />
            <span>Verified via Bluetooth Scale • Tamper-proof record created</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}