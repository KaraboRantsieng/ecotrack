import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, CheckCircle, ArrowLeft, QrCode, X, Sparkles, Loader2, AlertTriangle, Shield, Bluetooth, Scale, MapPin, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import BluetoothScaleManager from "@/components/bluetooth/BluetoothScaleManager";
import { runFraudChecks, FraudCheckDisplay } from "@/components/bluetooth/FraudDetectionEngine";
import SerialNumberScanner from "@/components/fraud/SerialNumberScanner";

// Auto-verify threshold
const AUTO_VERIFY_CONFIDENCE = 80;

// Payment rate (R per kg)
const PAYMENT_RATE_PER_KG = 1.50;

// Environmental impact factors (kg CO₂ / kg waste and kg hazardous / kg waste)
const ENVIRONMENTAL_IMPACT = {
  mobile_phones: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
  computers_laptops: { co2_per_kg: 14, hazardous_per_kg: 1.0 },
  televisions: { co2_per_kg: 10, hazardous_per_kg: 0.5 },
  batteries: { co2_per_kg: 5, hazardous_per_kg: 1.0 },
  chargers: { co2_per_kg: 1, hazardous_per_kg: 0.05 },
  cables: { co2_per_kg: 1, hazardous_per_kg: 0.05 },
  keyboards: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
  screens: { co2_per_kg: 8, hazardous_per_kg: 0.4 },
  printers: { co2_per_kg: 6, hazardous_per_kg: 0.3 },
  routers: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
  hard_drives: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
  speakers: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
  circuit_boards: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
  power_supplies: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
  laptop_ram: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
  other: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 }
};

// Typical weight ranges for fraud detection (in kg)
const WEIGHT_RANGES = {
  mobile_phones: { min: 0.1, max: 0.3, typical: 0.15 },
  computers_laptops: { min: 1.0, max: 4.0, typical: 2.0 },
  televisions: { min: 5.0, max: 40.0, typical: 15.0 },
  batteries: { min: 0.05, max: 2.0, typical: 0.5 },
  chargers: { min: 0.05, max: 0.3, typical: 0.1 },
  cables: { min: 0.02, max: 0.5, typical: 0.08 },
  keyboards: { min: 0.3, max: 1.5, typical: 0.6 },
  screens: { min: 2.0, max: 15.0, typical: 5.0 },
  printers: { min: 3.0, max: 25.0, typical: 8.0 },
  routers: { min: 0.2, max: 1.5, typical: 0.5 },
  hard_drives: { min: 0.1, max: 1.0, typical: 0.3 },
  speakers: { min: 0.3, max: 3.0, typical: 1.0 },
  circuit_boards: { min: 0.05, max: 0.5, typical: 0.2 },
  power_supplies: { min: 0.3, max: 2.0, typical: 0.8 },
  laptop_ram: { min: 0.01, max: 0.1, typical: 0.03 },
  other: { min: 0.1, max: 50.0, typical: 5.0 }
};

export default function ScanItem() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [success, setSuccess] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [scanningQR, setScanningQR] = useState(false);
  const [qrError, setQrError] = useState(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [fraudWarnings, setFraudWarnings] = useState([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [activeTab, setActiveTab] = useState("ai");
  
  // PSN / Serial number fraud state
  const [psnResult, setPsnResult] = useState(null); // { valid, no_serial, photo_url, serial_number, duplicate }
  const [photoSerialDuplicate, setPhotoSerialDuplicate] = useState(null); // { serial, existingItemCode }

  // Bluetooth scale state
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [bluetoothDeviceInfo, setBluetoothDeviceInfo] = useState(null);
  const [bluetoothWeight, setBluetoothWeight] = useState(null);
  const [isWeightLocked, setIsWeightLocked] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsAddress, setGpsAddress] = useState(null); // full reverse-geocoded address
  const [gpsLoading, setGpsLoading] = useState(false);
  const [advancedFraudResult, setAdvancedFraudResult] = useState(null);

  const [formData, setFormData] = useState({
    item_name: '',
    item_specs: '',
    category: '',
    weight_kg: '',
    quantity: 1,
    condition: 'not_working',
    location: '',
    photo_urls: [],
    notes: ''
  });

  useEffect(() => {
    loadUser();
    getGPSLocation();
    return () => {
      stopQRScanner();
    };
  }, []);

  const getGPSLocation = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGpsLocation({ latitude, longitude, accuracy });

        // Reverse geocode to full address using OpenStreetMap Nominatim
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          if (data && data.address) {
            const a = data.address;
            // Build a structured full address
            const parts = [
              a.house_number,
              a.road || a.pedestrian || a.footway,
              a.suburb || a.neighbourhood || a.quarter,
              a.city || a.town || a.village || a.municipality,
              a.state_district || a.county,
              a.state,
              a.postcode,
              a.country
            ].filter(Boolean);
            const fullAddress = parts.join(', ');
            setGpsAddress(fullAddress);
            setFormData(prev => ({ ...prev, location: fullAddress }));
          }
        } catch (e) {
          console.error("Reverse geocode failed:", e);
        } finally {
          setGpsLoading(false);
        }
      },
      (error) => {
        console.error("GPS error:", error);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleBluetoothConnection = (status) => {
    setBluetoothConnected(status.connected);
    if (status.device) {
      setBluetoothDeviceInfo(status.device);
    }
    if (!status.connected) {
      setBluetoothWeight(null);
      setIsWeightLocked(false);
    }
  };

  const handleBluetoothWeightLocked = (weightData) => {
    setBluetoothWeight(weightData.weight_kg);
    setIsWeightLocked(true);
    setFormData(prev => ({ ...prev, weight_kg: weightData.weight_kg.toString() }));
    setBluetoothDeviceInfo({
      ...bluetoothDeviceInfo,
      ...weightData.device_info,
      connection_signature: weightData.connection_signature
    });

    // Run advanced fraud checks
    const result = runFraudChecks({
      weight_kg: weightData.weight_kg,
      category: formData.category,
      aiEstimatedWeight: aiAnalysis?.weight_kg,
      aiConfidence: aiAnalysis?.confidence,
      photoUrl: formData.photo_urls?.[0],
      recentItems,
      collectorLocation: gpsLocation,
      assignedArea: user?.area,
      bluetoothDeviceInfo: weightData.device_info,
      isManualEntry: false,
      bluetoothConnected: true
    });

    setAdvancedFraudResult(result);
    if (!result.passed) {
      setFraudWarnings(result.warnings);
    }
  };

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  // Fetch recent items for duplicate detection
  const { data: recentItems = [] } = useQuery({
    queryKey: ['recentItems', user?.email],
    queryFn: () => base44.entities.EWasteItem.filter({ collector_email: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
  });

  const generateItemCode = () => {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `EW-${year}-${random}`;
  };

  const getSATime = () => {
    // South African Standard Time (UTC+2)
    return new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });
  };

  const generatePhotoHash = async (photoUrl) => {
    // Simple hash for duplicate detection
    if (!photoUrl) return null;
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error("Error generating photo hash:", error);
      return null;
    }
  };

  const detectFraud = async (photoUrl, category, weight, aiConfidence) => {
    const warnings = [];
    
    // Check 1: Weight vs Category mismatch
    const range = WEIGHT_RANGES[category];
    if (range && weight) {
      if (weight < range.min * 0.5) {
        warnings.push(`Weight suspiciously low for ${category.replace(/_/g, ' ')} (expected ${range.min}-${range.max}kg)`);
      } else if (weight > range.max * 1.5) {
        warnings.push(`Weight suspiciously high for ${category.replace(/_/g, ' ')} (expected ${range.min}-${range.max}kg)`);
      }
    }

    // Check 2: Low AI confidence
    if (aiConfidence !== null && aiConfidence < 60) {
      warnings.push('Low AI confidence - item classification may be incorrect');
    }

    // Check 3: Duplicate photo detection
    if (photoUrl) {
      const photoHash = await generatePhotoHash(photoUrl);
      const duplicates = recentItems.filter(item => 
        item.photo_hash === photoHash && 
        item.photo_hash !== null &&
        new Date(new Date().getTime() - new Date(item.created_date).getTime()) < 24 * 60 * 60 * 1000 // Within 24 hours
      );
      
      if (duplicates.length > 0) {
        warnings.push('Possible duplicate: Similar item photo found in recent submissions');
      }
    }

    // Check 4: Rapid submission detection (same collector)
    const recentSubmissions = recentItems.filter(item => {
      const timeDiff = new Date().getTime() - new Date(item.created_date).getTime();
      return timeDiff < 60000; // Within 1 minute
    });
    
    if (recentSubmissions.length >= 3) {
      warnings.push('Multiple rapid submissions detected');
    }

    return {
      passed: warnings.length === 0,
      warnings
    };
  };

  const startQRScanner = async () => {
    setScanningQR(true);
    setQrError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // The actual QR code detection logic would go here,
        // typically involving a library that processes video frames.
        // For this outline, we'll keep the self-calling timeout as a placeholder
        // and rely on manual QR input or external scanning.
        scanQRCode(); 
      }
    } catch (err) {
      setQrError("Unable to access camera. Please check permissions.");
      setScanningQR(false);
    }
  };

  const stopQRScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanningQR(false);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !scanningQR) return;
    
    // In a real application, a QR scanning library (e.g., jsQR)
    // would process videoRef.current frames here to detect QR codes.
    // For now, it's a placeholder.
    
    setTimeout(() => {
      if (scanningQR) {
        scanQRCode();
      }
    }, 500);
  };

  const handleQRCodeInput = async (qrCodeText) => {
    try {
      let qrData;
      try {
        qrData = JSON.parse(qrCodeText);
      } catch {
        const qrRecords = await base44.entities.QRCode.filter({ code: qrCodeText });
        if (qrRecords.length > 0) {
          const qrRecord = qrRecords[0];
          if (!qrRecord.is_active) {
            setQrError("This QR code is no longer active");
            return;
          }
          qrData = {
            category: qrRecord.category,
            weight_kg: qrRecord.estimated_weight_kg,
            location: qrRecord.location,
            notes: qrRecord.description,
            ...qrRecord.data
          };
          await base44.entities.QRCode.update(qrRecord.id, {
            scan_count: (qrRecord.scan_count || 0) + 1
          });
        } else {
          setQrError("QR code not found in system");
          return;
        }
      }

      setFormData(prev => ({
        ...prev,
        category: qrData.category || prev.category,
        weight_kg: qrData.weight_kg || qrData.estimated_weight_kg || prev.weight_kg,
        location: qrData.location || prev.location,
        notes: qrData.notes || qrData.description || prev.notes,
        condition: qrData.condition || prev.condition,
        quantity: qrData.quantity || prev.quantity
      }));

      stopQRScanner();
      setActiveTab("manual");
      setQrError(null);
    } catch (error) {
      setQrError("Error processing QR code. Please try again.");
      console.error("QR code error:", error);
    }
  };

  const analyzeImageWithAI = async (imageUrl) => {
    setAnalyzingImage(true);
    setAiAnalysis(null);
    setFraudWarnings([]);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert e-waste classifier with knowledge of typical electronic device weights and dimensions.

Analyze this image and identify the electronic waste item with ACCURATE weight estimation.

IMPORTANT: Also identify the specific item name/model if visible (e.g., "iPhone 12", "Samsung Galaxy S21", "Dell Latitude 5520") and any specifications you can determine.

CRITICAL: Provide realistic weight estimates based on actual device specifications and visual cues:
- Mobile phone: 0.1-0.3 kg (typically 0.15 kg)
- Small speaker/earbuds: 0.2-0.5 kg
- Laptop: 1.5-3.0 kg (typically 2.0 kg)
- Desktop computer: 8-15 kg
- Television (LED/LCD): 5-15 kg, (CRT): 15-40 kg
- Refrigerator: 40-80 kg
- Air conditioner: 25-60 kg
- Washing machine: 50-80 kg
- Batteries (small): 0.05-0.2 kg, (car): 10-20 kg
- Cables/chargers: 0.05-0.3 kg per item

Provide accurate classification with the following details:

1. CATEGORY: Classify the item into one of these exact categories:
   - mobile_phones
   - computers_laptops
   - televisions
   - batteries
   - chargers
   - cables
   - keyboards
   - screens
   - printers
   - routers
   - hard_drives
   - speakers
   - circuit_boards
   - power_supplies
   - laptop_ram
   - other

2. WEIGHT: Estimate weight in kilograms REALISTICALLY based on the item type and visible size. Consider:
   - Material composition (plastic, metal, glass)
   - Size relative to known objects (e.g., hand, coin, furniture)
   - Device type specifications (e.g., smartphone vs. feature phone, laptop vs. netbook)
   - Modern vs old technology (e.g., old CRT TVs are much heavier than LED TVs of the same screen size)

3. CONDITION: Assess the physical condition:
   - working: Item appears functional and in good condition
   - partially_working: Shows some damage but may have working components
   - not_working: Clearly damaged, broken, or non-functional

4. CONFIDENCE: Rate your classification confidence (0-100)

5. DESCRIPTION: Brief description including estimated dimensions (if inferable) and material composition (if visible)

6. QUANTITY: Count visible items in the image. Assume 1 if only one main item is visible.

7. ITEM_NAME: If you can identify the specific brand/model, provide it (e.g., "iPhone 12 Pro", "Samsung 55 inch TV"). If not identifiable, provide a generic name.

8. ITEM_SPECS: Any visible specifications like storage, screen size, model number, etc.

9. SERIAL_NUMBER: Scan the image for ANY visible serial number, PSN, IMEI, SSID, or MAC address printed on the device, label, or sticker. Return the exact characters if found, or null if none is visible. This is used for duplicate/fraud detection.

Be specific and accurate. Weight estimation is CRITICAL for fraud prevention.`,
        file_urls: [imageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["mobile_phones", "computers_laptops", "televisions", "batteries", "chargers",
                     "cables", "keyboards", "screens", "printers", "routers", "hard_drives", 
                     "speakers", "circuit_boards", "power_supplies", "laptop_ram", "other"]
            },
            weight_kg: {
              type: "number",
              description: "Realistic estimated weight in kilograms"
            },
            condition: {
              type: "string",
              enum: ["working", "partially_working", "not_working"]
            },
            confidence: {
              type: "number",
              description: "Confidence score 0-100"
            },
            description: {
              type: "string",
              description: "Detailed description including size and materials"
            },
            quantity: {
              type: "number",
              description: "Number of items visible"
            },
            item_name: {
              type: "string",
              description: "Specific brand/model name if identifiable"
            },
            item_specs: {
              type: "string",
              description: "Specifications like storage, screen size, etc."
            },
            serial_number: {
              type: "string",
              description: "Any visible serial/PSN/IMEI/SSID/MAC on the device or label, or null"
            },
            identifier_type: {
              type: "string",
              description: "Type of identifier found: IMEI, Serial Number, PSN, SSID, MAC, or null"
            }
            },
            required: ["category", "weight_kg", "condition", "confidence", "description"]
        }
      });

      setAiAnalysis(result);

      // Run fraud detection (use first photo for analysis)
      const fraudCheck = await detectFraud(
        imageUrl,
        result.category,
        result.weight_kg,
        result.confidence
      );
      
      if (!fraudCheck.passed) {
        setFraudWarnings(fraudCheck.warnings);
      }
      
      // Cross-check any serial/PSN/IMEI found in the main item photo against ALL system records
      if (result.serial_number && result.serial_number.trim().length >= 4) {
        const cleanSerial = result.serial_number.trim().replace(/\s+/g, ' ').toUpperCase();
        try {
          const existing = await base44.entities.EWasteItem.filter({ serial_number: cleanSerial });
          if (existing.length > 0) {
            setPhotoSerialDuplicate({ serial: cleanSerial, existingItemCode: existing[0].item_code });
            setFraudWarnings(prev => [
              ...prev,
              `🚨 DUPLICATE SERIAL DETECTED: "${cleanSerial}" already logged (item ${existing[0].item_code}). Submission blocked.`
            ]);
            // Fire admin notification
            base44.entities.FraudAlert.create({
              alert_type: "duplicate_serial_ai_photo",
              serial_number: cleanSerial,
              identifier_type: result.identifier_type || "Serial Number",
              collector_email: user?.email || "",
              collector_name: user?.full_name || "",
              existing_item_code: existing[0].item_code,
              photo_url: imageUrl,
              location: formData.location || "",
              read: false
            }).catch(e => console.error("Failed to create fraud alert:", e));
          } else {
            setPhotoSerialDuplicate(null);
            setFormData(prev => ({ ...prev, _ai_serial_number: cleanSerial, _ai_identifier_type: result.identifier_type }));
          }
        } catch (e) {
          console.error("Serial duplicate check failed:", e);
        }
      }

      // Pre-fill form with AI results
      setFormData(prev => ({
        ...prev,
        item_name: result.item_name || '',
        item_specs: result.item_specs || '',
        category: result.category,
        weight_kg: result.weight_kg.toString(),
        condition: result.condition,
        quantity: result.quantity || 1,
        notes: `AI Analysis: ${result.description}`
      }));

      // Switch to manual tab so user can review and submit
      setActiveTab("manual");
      
    } catch (error) {
      console.error("AI analysis error:", error);
      setAiAnalysis({ 
        error: "Unable to analyze image. Please try manual entry or take a clearer photo." 
      });
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleAIPhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Please choose an image under 5MB.");
      return;
    }

    setUploadingPhoto(true);
    setFraudWarnings([]);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const preview = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, photo_urls: [file_url, ...(prev.photo_urls || [])] }));
      setPhotoPreviews(prev => [preview, ...prev]);
      
      // Start AI analysis but don't block on it
      analyzeImageWithAI(file_url).catch(err => {
        console.error("AI analysis failed:", err);
      });
      
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const createItemMutation = useMutation({
    mutationFn: async (itemData) => {
      try {
        const itemCode = generateItemCode();
        
        // Calculate environmental impact using weight-based factors
        const impact = ENVIRONMENTAL_IMPACT[itemData.category] || ENVIRONMENTAL_IMPACT.other;
        const quantity = parseInt(itemData.quantity) || 1;
        const weightKg = parseFloat(itemData.weight_kg) || 0;

        console.log("Creating item with data:", {
          itemCode,
          category: itemData.category,
          weight_kg: weightKg,
          quantity: quantity,
          collector_email: user.email
        });

        // Check if should auto-verify
        const confidence = aiAnalysis?.confidence || 0;
        const shouldAutoVerify = confidence >= AUTO_VERIFY_CONFIDENCE && fraudWarnings.length === 0;

        // Determine verification status
        const isBluetoothVerified = isWeightLocked && bluetoothDeviceInfo;
        const shouldVerify = (shouldAutoVerify && isBluetoothVerified) || (confidence >= AUTO_VERIFY_CONFIDENCE && isBluetoothVerified && fraudWarnings.length === 0);

        const item = await base44.entities.EWasteItem.create({
          item_code: itemCode,
          item_name: itemData.item_name || '',
          item_specs: itemData.item_specs || '',
          category: itemData.category,
          weight_kg: weightKg,
          quantity: quantity,
          condition: itemData.condition || 'not_working',
          collector_email: user.email,
          location: itemData.location || '',
          photo_urls: itemData.photo_urls || [],
          notes: itemData.notes || '',
          verified: shouldVerify,
          rejected: false,
          auto_verified: shouldVerify,
          ai_confidence: confidence,
          co2_saved_kg: weightKg * impact.co2_per_kg,
          hazardous_waste_kg: weightKg * impact.hazardous_per_kg,
          geo_verified: !!gpsLocation,
          gps_latitude: gpsLocation?.latitude,
          gps_longitude: gpsLocation?.longitude,
          gps_accuracy: gpsLocation?.accuracy,
          // Bluetooth verification data
          bluetooth_verified: isBluetoothVerified,
          bluetooth_device_id: bluetoothDeviceInfo?.id,
          bluetooth_device_name: bluetoothDeviceInfo?.name,
          weight_verification_method: isBluetoothVerified ? 'bluetooth' : 'manual',
          scan_timestamp: new Date().toISOString(),
          serial_number: psnResult?.serial_number || formData._ai_serial_number || null,
          serial_number_photo_url: psnResult?.photo_url || null,
          psn_verified: !!(psnResult?.serial_number && !psnResult?.duplicate) && !photoSerialDuplicate,
          has_psn_photo: !!psnResult?.photo_url,
          psn_identifier_type: psnResult?.identifier_type || formData._ai_identifier_type || null,
          fraud_flags: photoSerialDuplicate
            ? [...(fraudWarnings || []), `Duplicate serial from item photo: ${photoSerialDuplicate.serial}`]
            : (fraudWarnings.length > 0 ? fraudWarnings : [])
        });

        console.log("Item created successfully:", item);

        // Update user stats
        try {
          await base44.auth.updateMe({
            total_collections: (user.total_collections || 0) + quantity,
            total_weight_kg: (user.total_weight_kg || 0) + weightKg
          });
        } catch (error) {
          console.error("Failed to update user stats:", error);
        }

        return { item, autoVerified: shouldVerify, bluetoothVerified: isBluetoothVerified };
      } catch (error) {
        console.error("Item creation error:", error);
        alert(`Failed to log item: ${error.message || 'Unknown error'}. Please try again.`);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['myCollections']);
      queryClient.invalidateQueries(['recentItems']); // Invalidate to update duplicate detection pool
      queryClient.invalidateQueries(['me']); // Invalidate user data to reflect new points/earnings
      setSuccess(data);
      setTimeout(() => {
        navigate(createPageUrl("CollectorDashboard"));
      }, 3000);
    }
  });

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate file sizes (max 5MB each)
    const oversized = files.filter(f => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      alert("Some files are too large. Please choose images under 5MB each.");
      return;
    }

    setUploadingPhoto(true);
    setFraudWarnings([]);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const fileUrls = results.map(r => r.file_url);
      const previews = files.map(file => URL.createObjectURL(file));
      
      setFormData(prev => ({ 
        ...prev, 
        photo_urls: [...(prev.photo_urls || []), ...fileUrls] 
      }));
      setPhotoPreviews(prev => [...prev, ...previews]);
    } catch (error) {
      console.error("Error uploading photos:", error);
      alert("Failed to upload photos. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photo_urls: prev.photo_urls.filter((_, i) => i !== index)
    }));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.category) {
      alert("Please select a category");
      return;
    }
    
    if (!formData.weight_kg || parseFloat(formData.weight_kg) <= 0) {
      alert("Please enter a valid weight");
      return;
    }

    if (!psnResult?.photo_url) {
      alert("A photo of the device's serial number / PSN badge is required before submitting.");
      return;
    }

    if (psnResult?.duplicate) {
      alert("This device serial number already exists on the system. Duplicate submissions are not allowed.");
      return;
    }

    if (photoSerialDuplicate) {
      alert(`Duplicate serial detected from item photo: "${photoSerialDuplicate.serial}" already exists (item ${photoSerialDuplicate.existingItemCode}). This submission is blocked.`);
      return;
    }
    
    createItemMutation.mutate(formData);
  };

  const estimatedImpact = formData.category && ENVIRONMENTAL_IMPACT[formData.category] 
    ? {
        co2: ENVIRONMENTAL_IMPACT[formData.category].co2_kg * formData.quantity,
        hazardous: ENVIRONMENTAL_IMPACT[formData.category].hazardous_kg * formData.quantity
      }
    : null;

  // Calculate payout based on weight
  const calculatedPayout = formData.weight_kg 
    ? (parseFloat(formData.weight_kg) * PAYMENT_RATE_PER_KG).toFixed(2)
    : '0.00';

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-2xl bg-white">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600 mb-1">Item logged successfully</p>
            <p className="text-sm text-gray-500 mb-4">Code: {success.item?.item_code}</p>
            <div className="bg-emerald-50 p-4 rounded-lg mb-4">
              <p className="text-2xl font-bold text-emerald-600 mb-1">Environmental Impact Recorded</p>
              <p className="text-sm text-gray-600">Collection verified and tracked</p>
              {success.item?.weight_kg && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-sm text-gray-600">Weight: {success.item.weight_kg}kg</p>
                  <p className="text-xl font-bold text-emerald-700">
                    Payout: R{(success.item.weight_kg * PAYMENT_RATE_PER_KG).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">@ R{PAYMENT_RATE_PER_KG.toFixed(2)}/kg</p>
                </div>
              )}
            </div>
            {success.autoVerified ? (
              <Alert className="bg-green-50 border-green-200 mb-4">
                <Shield className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  ✓ Auto-verified {success.bluetoothVerified ? 'via Bluetooth scale' : 'by AI'} - Impact tracked!
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-amber-50 border-amber-200 mb-4">
                 <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                 Item is pending manual verification. {!success.bluetoothVerified && 'Connect a Bluetooth scale for instant verification.'}
                </AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("CollectorDashboard"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Log E-Waste Item</h1>
            <p className="text-gray-500">AI scan with fraud protection</p>
          </div>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
            <CardTitle>Item Details</CardTitle>
            {estimatedImpact && (
              <Alert className="mt-4 bg-emerald-50 border-emerald-200">
                <AlertDescription className="text-emerald-800">
                  Environmental Impact: <span className="font-bold">{estimatedImpact.co2}kg CO₂ saved</span> • <span className="font-bold">{estimatedImpact.hazardous}kg hazardous waste prevented</span>
                </AlertDescription>
              </Alert>
            )}
            {aiAnalysis && !aiAnalysis.error && (
              <Alert className="mt-4 bg-purple-50 border-purple-200">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <AlertDescription className="text-purple-800">
                  <div className="flex items-center justify-between">
                    <span>AI: <span className="font-bold">{aiAnalysis.category.replace(/_/g, ' ')}</span> • {aiAnalysis.weight_kg}kg</span>
                    <Badge className={aiAnalysis.confidence >= AUTO_VERIFY_CONFIDENCE ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      {aiAnalysis.confidence}% {aiAnalysis.confidence >= AUTO_VERIFY_CONFIDENCE ? '✓ Auto-verify' : ''}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {fraudWarnings.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <p className="font-semibold mb-1">⚠️ Fraud Detection Warnings:</p>
                  <ul className="text-sm space-y-1">
                    {fraudWarnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ai" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Scan
                </TabsTrigger>
                <TabsTrigger value="qr" className="flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  QR Code
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="mt-4">
                <Card className="border-2 border-dashed border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50">
                  <CardContent className="p-6">
                    {analyzingImage ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-spin" />
                        <h3 className="text-lg font-semibold mb-2">Analyzing Image...</h3>
                        <p className="text-sm text-gray-600">
                          AI is identifying item, estimating weight, and checking for fraud
                        </p>
                      </div>
                    ) : photoPreviews.length > 0 && aiAnalysis ? (
                      <div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {photoPreviews.map((preview, idx) => (
                            <img
                              key={idx}
                              src={preview}
                              alt={`Item photo ${idx + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          ))}
                        </div>
                        {aiAnalysis.error ? (
                          <Alert variant="destructive">
                            <AlertDescription>{aiAnalysis.error}</AlertDescription>
                          </Alert>
                        ) : (
                          <div className="space-y-4">
                            <div className="bg-white p-4 rounded-lg">
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                                AI Analysis Results
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Category:</span>
                                  <span className="font-semibold capitalize">
                                    {aiAnalysis.category.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Weight:</span>
                                  <span className="font-semibold">{aiAnalysis.weight_kg} kg</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Condition:</span>
                                  <span className="font-semibold capitalize">
                                    {aiAnalysis.condition.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Confidence:</span>
                                  <Badge className={aiAnalysis.confidence >= AUTO_VERIFY_CONFIDENCE ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                                        {aiAnalysis.confidence}% {aiAnalysis.confidence >= AUTO_VERIFY_CONFIDENCE ? '✓' : ''}
                                      </Badge>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">CO₂ Saved:</span>
                                  <span className="font-bold text-emerald-600">{(ENVIRONMENTAL_IMPACT[aiAnalysis.category]?.co2_per_kg * aiAnalysis.weight_kg).toFixed(1)}kg</span>
                                </div>
                                <div className="flex justify-between border-t pt-2 mt-2">
                                  <span className="text-gray-600 font-semibold">Estimated Payout:</span>
                                  <span className="font-bold text-green-600">R{(aiAnalysis.weight_kg * PAYMENT_RATE_PER_KG).toFixed(2)}</span>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm text-gray-600">{aiAnalysis.description}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  setPhotoPreviews([]);
                                  setAiAnalysis(null);
                                  setFraudWarnings([]);
                                  setFormData(prev => ({ ...prev, photo_urls: [] }));
                                }}
                                variant="outline"
                                className="flex-1"
                              >
                                Clear Photos
                              </Button>
                              <Button
                                onClick={() => setActiveTab("manual")}
                                className="flex-1 bg-purple-600 hover:bg-purple-700"
                              >
                                Review & Submit
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <Sparkles className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">AI-Powered Recognition</h3>
                        <p className="text-sm text-gray-600 mb-6">
                          Advanced AI with fraud detection and accurate weight estimation
                        </p>
                        <label className="cursor-pointer">
                          <div className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                            <Camera className="w-5 h-5" />
                            {uploadingPhoto ? "Uploading..." : "Take Photo with AI"}
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            capture="environment"
                            onChange={handleAIPhotoCapture}
                            disabled={uploadingPhoto || analyzingImage}
                          />
                        </label>
                        <div className="mt-6 p-4 bg-white rounded-lg">
                          <p className="text-xs text-gray-500 mb-2">✨ AI Features:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Accurate weight estimation</li>
                            <li>• Auto-verification (85%+ confidence & no fraud)</li>
                            <li>• Duplicate detection</li>
                            <li>• Fraud prevention checks</li>
                            <li>• Environmental impact tracking</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="qr" className="mt-4">
                <Card className="border-2 border-dashed border-emerald-300 bg-emerald-50">
                  <CardContent className="p-6">
                    {!scanningQR ? (
                      <div className="text-center">
                        <QrCode className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Scan QR Code</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Point your camera at a QR code to automatically fill item details
                        </p>
                        <Button
                          onClick={startQRScanner}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Start Camera
                        </Button>

                        <div className="mt-6 pt-6 border-t border-emerald-200">
                          <p className="text-sm text-gray-600 mb-3">Or enter QR code manually:</p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter QR code"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleQRCodeInput(e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              onClick={(e) => {
                                const input = e.target.parentElement.querySelector('input');
                                if (input.value) {
                                  handleQRCodeInput(input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              Submit
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-64 object-cover"
                          />
                          <div className="absolute inset-0 border-4 border-emerald-400 m-12 rounded-lg pointer-events-none"></div>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-600">
                            Position QR code within the frame
                          </p>
                          <Button
                            variant="outline"
                            onClick={stopQRScanner}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {qrError && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertDescription>{qrError}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Bluetooth Scale Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-blue-600" />
                        Weight Verification
                      </Label>
                      {gpsLocation && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          GPS: {gpsLocation.latitude.toFixed(4)}, {gpsLocation.longitude.toFixed(4)}
                        </Badge>
                      )}
                    </div>
                    
                    <BluetoothScaleManager
                      onWeightLocked={handleBluetoothWeightLocked}
                      onWeightChange={(w) => setBluetoothWeight(w)}
                      onConnectionChange={handleBluetoothConnection}
                    />

                    {advancedFraudResult && !advancedFraudResult.passed && (
                      <FraudCheckDisplay fraudResult={advancedFraudResult} />
                    )}

                    {isWeightLocked && (
                      <Alert className="bg-green-50 border-green-200">
                        <Lock className="w-4 h-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold">Weight locked: {bluetoothWeight?.toFixed(2)}kg</span>
                              <p className="text-xs mt-1">Verified via Bluetooth scale • Tamper-proof record</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-700">R{(bluetoothWeight * PAYMENT_RATE_PER_KG).toFixed(2)}</p>
                              <p className="text-xs text-gray-600">Payout</p>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Item Name & Specs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="item_name">Item Name/Model (Optional)</Label>
                      <Input
                        id="item_name"
                        value={formData.item_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                        placeholder="e.g., iPhone 12, Samsung TV"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="item_specs">Specs (Optional)</Label>
                      <Input
                        id="item_specs"
                        value={formData.item_specs}
                        onChange={(e) => setFormData(prev => ({ ...prev, item_specs: e.target.value }))}
                        placeholder="e.g., 128GB, 55 inch"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  {/* Photo Upload */}
                  <div>
                    <Label>Item Photos (Recommended - Multiple allowed)</Label>
                    <div className="mt-2 space-y-3">
                      {photoPreviews.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {photoPreviews.map((preview, idx) => (
                            <div key={idx} className="relative group">
                              <img
                                src={preview}
                                alt={`Preview ${idx + 1}`}
                                className="w-full h-24 object-cover rounded-lg"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removePhoto(idx)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {photoPreviews.length < 10 && (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-emerald-300 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors bg-emerald-50/50">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {uploadingPhoto ? (
                              <>
                                <Loader2 className="w-8 h-8 text-emerald-600 mb-2 animate-spin" />
                                <p className="text-sm text-emerald-600 font-semibold">Uploading...</p>
                              </>
                            ) : (
                              <>
                                <Camera className="w-8 h-8 text-emerald-600 mb-2" />
                                <p className="text-sm text-emerald-600 font-semibold">Add {photoPreviews.length > 0 ? 'more' : ''} photos</p>
                                <p className="text-xs text-gray-500 mt-1">Max 10 photos • 5MB each</p>
                              </>
                            )}
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/png,image/jpg"
                            capture="environment"
                            onChange={handlePhotoUpload}
                            disabled={uploadingPhoto}
                            multiple
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                      required
                    >
                      <SelectTrigger id="category" className="mt-2">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile_phones">Mobile Phones</SelectItem>
                        <SelectItem value="computers_laptops">Computers/Laptops</SelectItem>
                        <SelectItem value="televisions">TVs</SelectItem>
                        <SelectItem value="batteries">Batteries</SelectItem>
                        <SelectItem value="chargers">Chargers</SelectItem>
                        <SelectItem value="cables">Cables</SelectItem>
                        <SelectItem value="keyboards">Keyboards</SelectItem>
                        <SelectItem value="screens">Screens</SelectItem>
                        <SelectItem value="printers">Printers</SelectItem>
                        <SelectItem value="routers">Routers</SelectItem>
                        <SelectItem value="hard_drives">Hard Drives</SelectItem>
                        <SelectItem value="speakers">Speakers</SelectItem>
                        <SelectItem value="circuit_boards">Circuit Boards</SelectItem>
                        <SelectItem value="power_supplies">Power Supplies</SelectItem>
                        <SelectItem value="laptop_ram">Laptop RAM</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Quantity */}
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        className="mt-2"
                      />
                    </div>

                    {/* Weight */}
                    <div>
                      <Label htmlFor="weight" className="flex items-center gap-2">
                        Weight (kg) *
                        {isWeightLocked && (
                          <Badge className="bg-green-100 text-green-700 text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Bluetooth
                          </Badge>
                        )}
                      </Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.weight_kg}
                        onChange={(e) => {
                          if (!bluetoothConnected) {
                            setFormData(prev => ({ ...prev, weight_kg: e.target.value }));
                          }
                        }}
                        placeholder={bluetoothConnected ? "Use Bluetooth scale" : "e.g., 2.5"}
                        className={`mt-2 ${isWeightLocked ? 'bg-green-50 border-green-300' : ''}`}
                        disabled={bluetoothConnected}
                        required
                      />
                      {bluetoothConnected && !isWeightLocked && (
                        <p className="text-xs text-amber-600 mt-1">
                          Manual entry disabled - use connected scale
                        </p>
                      )}
                      {formData.weight_kg && parseFloat(formData.weight_kg) > 0 && (
                        <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Payout:</span>
                            <span className="text-lg font-bold text-green-700">R{calculatedPayout}</span>
                          </div>
                          <p className="text-xs text-gray-500 text-right">@ R{PAYMENT_RATE_PER_KG.toFixed(2)}/kg</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Condition */}
                  <div>
                    <Label htmlFor="condition">Condition</Label>
                    <Select
                      value={formData.condition}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
                    >
                      <SelectTrigger id="condition" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="working">Working</SelectItem>
                        <SelectItem value="partially_working">Partially Working</SelectItem>
                        <SelectItem value="not_working">Not Working</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location — auto-filled from GPS reverse geocode */}
                  <div>
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      Collection Location
                      {gpsLoading && <span className="text-xs text-blue-500 font-normal flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Getting address...</span>}
                      {gpsAddress && !gpsLoading && <span className="text-xs text-green-600 font-normal">📍 GPS auto-filled</span>}
                    </Label>
                    <Textarea
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder={gpsLoading ? "Fetching your exact address..." : "e.g., 12 Mandela Street, Sebokeng, Emfuleni, Gauteng, 1983"}
                      className="mt-2"
                      rows={2}
                    />
                    {gpsLocation && !gpsLoading && (
                      <p className="text-xs text-gray-400 mt-1">
                        GPS: {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)} ±{gpsLocation.accuracy?.toFixed(0)}m
                        {!gpsAddress && (
                          <button type="button" onClick={getGPSLocation} className="ml-2 text-blue-500 underline">Retry</button>
                        )}
                      </p>
                    )}
                    {!gpsLocation && !gpsLoading && (
                      <button type="button" onClick={getGPSLocation} className="text-xs text-blue-500 underline mt-1">
                        📍 Auto-fill from GPS
                      </button>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes">Additional Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any additional information..."
                      className="mt-2"
                      rows={3}
                    />
                  </div>

                  {/* PSN / Serial Number Fraud Check */}
                  <SerialNumberScanner
                    onResult={setPsnResult}
                    disabled={uploadingPhoto}
                  />

                  {psnResult?.photo_url && !psnResult?.duplicate && !psnResult?.no_serial && (
                    <Alert className="bg-green-50 border-green-200">
                      <AlertDescription className="text-green-800 text-sm">
                        ✓ Serial number verified — this device is unique and cleared for submission.
                      </AlertDescription>
                    </Alert>
                  )}

                  {createItemMutation.isError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>
                        Failed to log item. Please check all fields and try again.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg py-6"
                    disabled={createItemMutation.isPending || !formData.category || !formData.weight_kg || uploadingPhoto || !psnResult?.photo_url || psnResult?.duplicate}
                  >
                    {createItemMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Logging Item...
                      </>
                    ) : uploadingPhoto ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Uploading Photo...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-2" />
                        Log Item & Track Impact
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}