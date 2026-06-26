import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Shield, 
  ShieldAlert, 
  ShieldCheck,
  MapPin,
  Image,
  Scale,
  Clock,
  Fingerprint,
  Ban
} from "lucide-react";

// Weight ranges for fraud detection (kg)
const WEIGHT_RANGES = {
  mobile_phones: { min: 0.08, max: 0.35, typical: 0.15 },
  computers_laptops: { min: 1.0, max: 4.5, typical: 2.2 },
  televisions: { min: 3.0, max: 45.0, typical: 12.0 },
  batteries: { min: 0.02, max: 25.0, typical: 0.5 },
  chargers: { min: 0.03, max: 0.4, typical: 0.12 },
  cables: { min: 0.01, max: 0.6, typical: 0.08 },
  keyboards: { min: 0.2, max: 1.8, typical: 0.7 },
  screens: { min: 1.5, max: 20.0, typical: 5.0 },
  printers: { min: 2.5, max: 30.0, typical: 8.0 },
  routers: { min: 0.15, max: 2.0, typical: 0.5 },
  hard_drives: { min: 0.08, max: 1.2, typical: 0.35 },
  speakers: { min: 0.2, max: 8.0, typical: 1.5 },
  circuit_boards: { min: 0.03, max: 0.8, typical: 0.2 },
  power_supplies: { min: 0.2, max: 3.0, typical: 0.9 },
  laptop_ram: { min: 0.005, max: 0.15, typical: 0.03 },
  other: { min: 0.05, max: 50.0, typical: 3.0 }
};

// Fraud detection thresholds
const FRAUD_THRESHOLDS = {
  WEIGHT_VARIANCE_TOLERANCE: 0.25, // 25% variance from AI estimate allowed
  DUPLICATE_TIME_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
  RAPID_SUBMISSION_WINDOW_MS: 60 * 1000, // 1 minute
  RAPID_SUBMISSION_COUNT: 5, // Max submissions in rapid window
  GPS_MAX_DISTANCE_KM: 50, // Max distance from assigned area
  WEIGHT_REPEAT_THRESHOLD: 3, // Same weight repeated too many times
  MIN_AI_CONFIDENCE: 50, // Minimum AI confidence score
};

export function runFraudChecks({
  weight_kg,
  category,
  aiEstimatedWeight,
  aiConfidence,
  photoUrl,
  photoHash,
  recentItems = [],
  collectorLocation,
  assignedArea,
  assignedAreaCoords,
  bluetoothDeviceInfo,
  isManualEntry,
  bluetoothConnected
}) {
  const warnings = [];
  const flags = [];
  let riskScore = 0;
  let shouldBlock = false;

  // 1. Check if manual entry attempted while Bluetooth is connected
  if (isManualEntry && bluetoothConnected) {
    flags.push({
      type: 'MANUAL_ENTRY_BLOCKED',
      severity: 'high',
      message: 'Manual weight entry attempted while Bluetooth scale is connected',
      icon: Ban
    });
    riskScore += 40;
    shouldBlock = true;
  }

  // 2. Check for impossible weight vs category
  if (weight_kg && category) {
    const range = WEIGHT_RANGES[category];
    if (range) {
      if (weight_kg < range.min * 0.5) {
        flags.push({
          type: 'WEIGHT_TOO_LOW',
          severity: 'high',
          message: `Weight ${weight_kg}kg is suspiciously low for ${category.replace(/_/g, ' ')} (expected min: ${range.min}kg)`,
          icon: Scale
        });
        riskScore += 30;
      } else if (weight_kg > range.max * 1.5) {
        flags.push({
          type: 'WEIGHT_TOO_HIGH',
          severity: 'high',
          message: `Weight ${weight_kg}kg is suspiciously high for ${category.replace(/_/g, ' ')} (expected max: ${range.max}kg)`,
          icon: Scale
        });
        riskScore += 30;
      }
    }
  }

  // 3. AI weight vs actual weight mismatch
  if (aiEstimatedWeight && weight_kg) {
    const variance = Math.abs(weight_kg - aiEstimatedWeight) / aiEstimatedWeight;
    if (variance > FRAUD_THRESHOLDS.WEIGHT_VARIANCE_TOLERANCE) {
      flags.push({
        type: 'AI_WEIGHT_MISMATCH',
        severity: 'medium',
        message: `Scale weight (${weight_kg}kg) differs significantly from AI estimate (${aiEstimatedWeight}kg)`,
        icon: AlertTriangle
      });
      riskScore += 20;
    }
  }

  // 4. Low AI confidence
  if (aiConfidence !== null && aiConfidence < FRAUD_THRESHOLDS.MIN_AI_CONFIDENCE) {
    flags.push({
      type: 'LOW_AI_CONFIDENCE',
      severity: 'low',
      message: `AI confidence is low (${aiConfidence}%) - item may be misclassified`,
      icon: Image
    });
    riskScore += 10;
  }

  // 5. Duplicate photo detection
  if (photoHash && recentItems.length > 0) {
    const duplicates = recentItems.filter(item => 
      item.photo_hash === photoHash &&
      (Date.now() - new Date(item.created_date).getTime()) < FRAUD_THRESHOLDS.DUPLICATE_TIME_WINDOW_MS
    );
    
    if (duplicates.length > 0) {
      flags.push({
        type: 'DUPLICATE_IMAGE',
        severity: 'high',
        message: 'This image was already submitted in the last 24 hours',
        icon: Image
      });
      riskScore += 50;
      shouldBlock = true;
    }
  }

  // 6. Rapid submission detection
  const rapidSubmissions = recentItems.filter(item => 
    (Date.now() - new Date(item.created_date).getTime()) < FRAUD_THRESHOLDS.RAPID_SUBMISSION_WINDOW_MS
  );
  
  if (rapidSubmissions.length >= FRAUD_THRESHOLDS.RAPID_SUBMISSION_COUNT) {
    flags.push({
      type: 'RAPID_SUBMISSIONS',
      severity: 'medium',
      message: `${rapidSubmissions.length} items submitted in the last minute - unusual activity`,
      icon: Clock
    });
    riskScore += 25;
  }

  // 7. Weight repeated too often (scale spoofing detection)
  if (weight_kg && recentItems.length > 0) {
    const sameWeightCount = recentItems.filter(item => 
      Math.abs((item.weight_kg || 0) - weight_kg) < 0.01 &&
      (Date.now() - new Date(item.created_date).getTime()) < FRAUD_THRESHOLDS.DUPLICATE_TIME_WINDOW_MS
    ).length;
    
    if (sameWeightCount >= FRAUD_THRESHOLDS.WEIGHT_REPEAT_THRESHOLD) {
      flags.push({
        type: 'WEIGHT_REPEATED',
        severity: 'medium',
        message: `Same weight (${weight_kg}kg) recorded ${sameWeightCount} times recently - possible scale spoofing`,
        icon: Scale
      });
      riskScore += 30;
    }
  }

  // 8. GPS location mismatch
  if (collectorLocation && assignedAreaCoords) {
    const distance = calculateDistance(
      collectorLocation.latitude,
      collectorLocation.longitude,
      assignedAreaCoords.latitude,
      assignedAreaCoords.longitude
    );
    
    if (distance > FRAUD_THRESHOLDS.GPS_MAX_DISTANCE_KM) {
      flags.push({
        type: 'GPS_MISMATCH',
        severity: 'high',
        message: `Collection location is ${distance.toFixed(1)}km from assigned area`,
        icon: MapPin
      });
      riskScore += 35;
    }
  }

  // 9. No Bluetooth device verification (if expected)
  if (!bluetoothDeviceInfo && !isManualEntry) {
    flags.push({
      type: 'NO_DEVICE_VERIFICATION',
      severity: 'low',
      message: 'Weight not verified via Bluetooth scale',
      icon: Fingerprint
    });
    riskScore += 5;
  }

  // Determine overall risk level
  let riskLevel = 'low';
  if (riskScore >= 60) {
    riskLevel = 'critical';
    shouldBlock = true;
  } else if (riskScore >= 40) {
    riskLevel = 'high';
  } else if (riskScore >= 20) {
    riskLevel = 'medium';
  }

  return {
    passed: flags.length === 0,
    riskScore,
    riskLevel,
    flags,
    warnings: flags.map(f => f.message),
    shouldBlock,
    requiresManualReview: riskLevel === 'high' || riskLevel === 'critical',
    verificationStatus: flags.length === 0 ? 'verified' : shouldBlock ? 'blocked' : 'flagged'
  };
}

// Haversine formula for GPS distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// React component for displaying fraud check results
export function FraudCheckDisplay({ fraudResult }) {
  if (!fraudResult) return null;

  const { riskLevel, riskScore, flags, passed, shouldBlock } = fraudResult;

  if (passed) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <ShieldCheck className="w-4 h-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <span className="font-semibold">✓ All verification checks passed</span>
          <p className="text-sm mt-1">Item is ready for submission with verified data.</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert className={
        shouldBlock ? 'bg-red-50 border-red-200' :
        riskLevel === 'high' ? 'bg-orange-50 border-orange-200' :
        'bg-amber-50 border-amber-200'
      }>
        <ShieldAlert className={`w-4 h-4 ${
          shouldBlock ? 'text-red-600' :
          riskLevel === 'high' ? 'text-orange-600' :
          'text-amber-600'
        }`} />
        <AlertDescription className={
          shouldBlock ? 'text-red-800' :
          riskLevel === 'high' ? 'text-orange-800' :
          'text-amber-800'
        }>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">
              {shouldBlock ? '⛔ Submission Blocked' : '⚠️ Verification Warnings'}
            </span>
            <Badge className={
              riskLevel === 'critical' ? 'bg-red-100 text-red-700' :
              riskLevel === 'high' ? 'bg-orange-100 text-orange-700' :
              riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-700'
            }>
              Risk: {riskScore}/100
            </Badge>
          </div>
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        {flags.map((flag, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              flag.severity === 'high' ? 'bg-red-50 border border-red-200' :
              flag.severity === 'medium' ? 'bg-amber-50 border border-amber-200' :
              'bg-gray-50 border border-gray-200'
            }`}
          >
            {flag.icon && <flag.icon className={`w-4 h-4 mt-0.5 ${
              flag.severity === 'high' ? 'text-red-600' :
              flag.severity === 'medium' ? 'text-amber-600' :
              'text-gray-600'
            }`} />}
            <div className="flex-1">
              <p className={`text-sm ${
                flag.severity === 'high' ? 'text-red-800' :
                flag.severity === 'medium' ? 'text-amber-800' :
                'text-gray-800'
              }`}>
                {flag.message}
              </p>
              <Badge variant="outline" className="mt-1 text-xs">
                {flag.type.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {shouldBlock && (
        <Alert variant="destructive">
          <AlertDescription>
            This submission has been blocked due to verification failures. 
            Please contact an administrator if you believe this is an error.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default { runFraudChecks, FraudCheckDisplay };