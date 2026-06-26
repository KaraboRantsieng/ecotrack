import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Camera, Loader2, CheckCircle, AlertTriangle, Hash, X, ShieldAlert, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// onResult({ valid, photo_url, serial_number, duplicate, no_serial })
export default function SerialNumberScanner({ onResult, disabled }) {
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [serialNumber, setSerialNumber] = useState(null);
  const [identifierType, setIdentifierType] = useState(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [noSerial, setNoSerial] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSerialNumber(null);
    setIsDuplicate(false);
    setNoSerial(false);
    setDone(false);

    try {
      const preview = URL.createObjectURL(file);
      setPhotoPreview(preview);

      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setUploading(false);
      setScanning(true);

      // AI extracts serial number / PSN / IMEI from the sticker photo
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are analyzing a photo of an electronic device's identification sticker, PSN badge, IMEI label, or serial number plate.

Extract the PRIMARY unique identifier from this image. Priority order:
1. IMEI number (15 digits)
2. Serial Number (S/N)
3. Product Serial Number (PSN)
4. MAC Address
5. Model + Serial combination

Rules:
- Return the EXACT characters shown — include dashes, slashes, and spaces as printed
- Prefer longer, more unique identifiers over short model numbers
- If multiple identifiers exist, pick the one most likely to be device-unique (IMEI > Serial > Model)
- Set found=false if the image is blurry, the sticker is not visible, or no identifier exists

Be precise. This is used for fraud prevention.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            found: { type: "boolean", description: "Whether a valid identifier was found" },
            serial_number: { type: "string", description: "The extracted identifier exactly as shown" },
            identifier_type: { type: "string", description: "IMEI, Serial Number, PSN, MAC, etc." },
            confidence: { type: "number", description: "0-100 confidence in the reading" }
          },
          required: ["found"]
        }
      });

      if (!result.found || !result.serial_number || result.confidence < 55) {
        setNoSerial(true);
        setDone(true);
        onResult({ valid: false, no_serial: true, photo_url: file_url, serial_number: null, duplicate: false });
        return;
      }

      const clean = result.serial_number.trim().replace(/\s+/g, ' ').toUpperCase();
      setSerialNumber(clean);
      setIdentifierType(result.identifier_type);

      // Duplicate check against all existing items
      const existing = await base44.entities.EWasteItem.filter({ serial_number: clean });
      const dup = existing.length > 0;
      setIsDuplicate(dup);
      setDone(true);

      // Fire admin fraud alert for duplicate PSN badge scan
      if (dup) {
        try {
          const me = await base44.auth.me();
          await base44.entities.FraudAlert.create({
            alert_type: "duplicate_serial_psn_badge",
            serial_number: clean,
            identifier_type: result.identifier_type || "Serial Number",
            collector_email: me?.email || "",
            collector_name: me?.full_name || "",
            existing_item_code: existing[0]?.item_code || "",
            photo_url: file_url,
            read: false
          });
        } catch (e) {
          console.error("Failed to create PSN fraud alert:", e);
        }
      }

      onResult({
        valid: !dup,
        no_serial: false,
        photo_url: file_url,
        serial_number: clean,
        duplicate: dup,
        identifier_type: result.identifier_type
      });

    } catch (err) {
      setError("Failed to process photo. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
      setScanning(false);
    }
  };

  const reset = () => {
    setPhotoPreview(null);
    setSerialNumber(null);
    setIdentifierType(null);
    setIsDuplicate(false);
    setNoSerial(false);
    setError(null);
    setDone(false);
    onResult({ valid: false, no_serial: false, photo_url: null, serial_number: null, duplicate: false });
  };

  const isLoading = uploading || scanning;

  return (
    <div className="border-2 border-blue-300 bg-blue-50/40 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Hash className="w-5 h-5 text-blue-600" />
        <div>
          <h4 className="font-semibold text-gray-900 text-sm">
            Serial / PSN / IMEI Photo
            <span className="ml-2 text-red-500 text-xs font-normal">* Required for approval</span>
          </h4>
          <p className="text-xs text-gray-500">Photograph the device's serial number sticker or PSN badge</p>
        </div>
      </div>

      {!photoPreview ? (
        <label className={`block ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium">
            <Camera className="w-4 h-4" />
            Take Photo of Serial/PSN Badge
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            disabled={disabled}
          />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="relative flex-shrink-0">
              <img
                src={photoPreview}
                alt="Serial number badge"
                className="w-28 h-24 object-cover rounded-lg border-2 border-gray-300"
              />
              {isLoading && (
                <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {scanning && (
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI reading serial number...
                </div>
              )}
              {uploading && (
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading photo...
                </div>
              )}

              {done && !noSerial && serialNumber && (
                <div className="space-y-2">
                  {isDuplicate ? (
                    <Badge className="bg-red-100 text-red-800 border border-red-300">
                      <ShieldAlert className="w-3 h-3 mr-1" />
                      DUPLICATE — Already on system
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800 border border-green-300">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Unique — Not previously submitted
                    </Badge>
                  )}
                  <div className="bg-white border border-gray-200 rounded-lg p-2">
                    <p className="text-xs text-gray-400">{identifierType || 'Serial Number'}</p>
                    <p className="font-mono font-bold text-gray-900 text-sm tracking-wide">{serialNumber}</p>
                  </div>
                  {isDuplicate && (
                    <Alert variant="destructive" className="py-2">
                      <AlertDescription className="text-xs">
                        This device has already been submitted. Duplicate submissions are blocked.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {done && noSerial && (
                <Alert className="bg-amber-50 border-amber-300 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800">
                    No serial number could be read from this photo. The item will require manual admin verification and cannot be auto-approved.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {!isLoading && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Retake photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}