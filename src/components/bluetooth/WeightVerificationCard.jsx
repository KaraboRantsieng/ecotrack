import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Scale,
  Bluetooth,
  Keyboard,
  CheckCircle,
  AlertTriangle,
  Lock,
  MapPin,
  Clock,
  Shield,
  Info
} from "lucide-react";
import BluetoothScaleManager from "./BluetoothScaleManager";
import { runFraudChecks, FraudCheckDisplay } from "./FraudDetectionEngine";

export default function WeightVerificationCard({
  category,
  aiEstimatedWeight,
  aiConfidence,
  photoUrl,
  photoHash,
  recentItems = [],
  collectorLocation,
  assignedArea,
  onWeightVerified,
  onFraudDetected,
  disabled = false
}) {
  const [activeMethod, setActiveMethod] = useState("bluetooth");
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [bluetoothWeight, setBluetoothWeight] = useState(null);
  const [bluetoothDeviceInfo, setBluetoothDeviceInfo] = useState(null);
  const [manualWeight, setManualWeight] = useState("");
  const [verifiedWeight, setVerifiedWeight] = useState(null);
  const [verificationMethod, setVerificationMethod] = useState(null);
  const [fraudResult, setFraudResult] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  // Get GPS location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          setGpsError("Unable to get GPS location");
          console.error("GPS error:", error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const handleBluetoothConnectionChange = (status) => {
    setBluetoothConnected(status.connected);
    if (status.device) {
      setBluetoothDeviceInfo(status.device);
    }
    if (!status.connected) {
      setBluetoothWeight(null);
    }
  };

  const handleBluetoothWeightLocked = (weightData) => {
    setBluetoothWeight(weightData.weight_kg);
    setBluetoothDeviceInfo({
      ...bluetoothDeviceInfo,
      ...weightData.device_info,
      connection_signature: weightData.connection_signature
    });
    
    // Run fraud checks
    const result = runFraudChecks({
      weight_kg: weightData.weight_kg,
      category,
      aiEstimatedWeight,
      aiConfidence,
      photoUrl,
      photoHash,
      recentItems,
      collectorLocation: gpsLocation,
      assignedArea,
      bluetoothDeviceInfo: weightData.device_info,
      isManualEntry: false,
      bluetoothConnected: true
    });
    
    setFraudResult(result);
    
    if (result.shouldBlock) {
      onFraudDetected?.(result);
    } else {
      setVerifiedWeight(weightData.weight_kg);
      setVerificationMethod('bluetooth');
      onWeightVerified?.({
        weight_kg: weightData.weight_kg,
        method: 'bluetooth',
        device_info: weightData.device_info,
        gps_location: gpsLocation,
        timestamp: new Date().toISOString(),
        fraud_check: result,
        verified: !result.requiresManualReview
      });
    }
  };

  const handleManualWeightSubmit = () => {
    const weight = parseFloat(manualWeight);
    if (isNaN(weight) || weight <= 0) {
      return;
    }

    // Run fraud checks for manual entry
    const result = runFraudChecks({
      weight_kg: weight,
      category,
      aiEstimatedWeight,
      aiConfidence,
      photoUrl,
      photoHash,
      recentItems,
      collectorLocation: gpsLocation,
      assignedArea,
      bluetoothDeviceInfo: null,
      isManualEntry: true,
      bluetoothConnected
    });

    setFraudResult(result);

    if (result.shouldBlock) {
      onFraudDetected?.(result);
    } else {
      setVerifiedWeight(weight);
      setVerificationMethod('manual');
      onWeightVerified?.({
        weight_kg: weight,
        method: 'manual',
        device_info: null,
        gps_location: gpsLocation,
        timestamp: new Date().toISOString(),
        fraud_check: result,
        verified: false // Manual entries always need review
      });
    }
  };

  const resetVerification = () => {
    setVerifiedWeight(null);
    setVerificationMethod(null);
    setFraudResult(null);
    setManualWeight("");
    setBluetoothWeight(null);
  };

  return (
    <Card className="border-none shadow-xl">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            Weight Verification
          </div>
          {verifiedWeight && (
            <Badge className={verificationMethod === 'bluetooth' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
              {verificationMethod === 'bluetooth' ? (
                <><CheckCircle className="w-3 h-3 mr-1" /> Bluetooth Verified</>
              ) : (
                <><AlertTriangle className="w-3 h-3 mr-1" /> Manual Entry</>
              )}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* GPS Status */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className={`w-4 h-4 ${gpsLocation ? 'text-green-600' : 'text-amber-600'}`} />
          <span className={gpsLocation ? 'text-green-700' : 'text-amber-700'}>
            {gpsLocation ? `GPS: ${gpsLocation.latitude.toFixed(4)}, ${gpsLocation.longitude.toFixed(4)} (±${gpsLocation.accuracy.toFixed(0)}m)` : gpsError || 'Getting GPS...'}
          </span>
        </div>

        {/* AI Estimate Display */}
        {aiEstimatedWeight && (
          <Alert className="bg-purple-50 border-purple-200">
            <Info className="w-4 h-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              AI estimated weight: <span className="font-bold">{aiEstimatedWeight}kg</span>
              {aiConfidence && <span className="text-sm ml-2">({aiConfidence}% confidence)</span>}
            </AlertDescription>
          </Alert>
        )}

        {/* Verified Weight Display */}
        {verifiedWeight && (
          <div className={`p-6 rounded-xl text-center ${
            verificationMethod === 'bluetooth' ? 'bg-green-100 border-2 border-green-300' : 'bg-amber-100 border-2 border-amber-300'
          }`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Lock className={`w-5 h-5 ${verificationMethod === 'bluetooth' ? 'text-green-600' : 'text-amber-600'}`} />
              <span className={`font-medium ${verificationMethod === 'bluetooth' ? 'text-green-700' : 'text-amber-700'}`}>
                Weight Locked
              </span>
            </div>
            <p className={`text-5xl font-bold ${verificationMethod === 'bluetooth' ? 'text-green-700' : 'text-amber-700'}`}>
              {verifiedWeight.toFixed(2)}
              <span className="text-2xl ml-2">kg</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={resetVerification}
              className="mt-4"
            >
              Re-weigh Item
            </Button>
          </div>
        )}

        {/* Fraud Check Results */}
        {fraudResult && <FraudCheckDisplay fraudResult={fraudResult} />}

        {/* Weight Entry Methods */}
        {!verifiedWeight && (
          <Tabs value={activeMethod} onValueChange={setActiveMethod}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bluetooth" className="flex items-center gap-2">
                <Bluetooth className="w-4 h-4" />
                Bluetooth Scale
              </TabsTrigger>
              <TabsTrigger 
                value="manual" 
                className="flex items-center gap-2"
                disabled={bluetoothConnected}
              >
                <Keyboard className="w-4 h-4" />
                Manual Entry
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bluetooth" className="mt-4">
              <BluetoothScaleManager
                onWeightLocked={handleBluetoothWeightLocked}
                onWeightChange={(w) => setBluetoothWeight(w)}
                onConnectionChange={handleBluetoothConnectionChange}
                disabled={disabled}
              />
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              {bluetoothConnected ? (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Manual entry is disabled while Bluetooth scale is connected. 
                    Please use the connected scale or disconnect it first.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <p className="font-semibold">Manual entries require admin verification</p>
                      <p className="text-sm mt-1">For instant verification, please connect a Bluetooth scale.</p>
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <Label htmlFor="manual-weight">Weight (kg)</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="manual-weight"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={manualWeight}
                        onChange={(e) => setManualWeight(e.target.value)}
                        placeholder="Enter weight in kg"
                        className="flex-1"
                      />
                      <Button
                        onClick={handleManualWeightSubmit}
                        disabled={!manualWeight || parseFloat(manualWeight) <= 0}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Lock Weight
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Verification Status Footer */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Shield className="w-4 h-4" />
            <span>
              {verificationMethod === 'bluetooth' 
                ? 'Tamper-proof weight verification via certified Bluetooth scale'
                : 'All weight entries are logged with GPS coordinates and timestamps'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
            <Clock className="w-4 h-4" />
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}