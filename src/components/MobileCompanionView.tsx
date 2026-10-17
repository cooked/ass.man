import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone, QrCode, Camera, Check, X, AlertCircle,
  CheckCircle2, RefreshCw, Boxes, Cpu, Binary, ArrowLeft,
  ChevronRight, ChevronUp, ChevronDown, Volume2, ShieldCheck,
  Sparkles, Layers, CheckCircle, Play, Square, Eye, ShieldAlert,
  Lock, Image as ImageIcon, Plus, Upload, Wifi, PackageCheck,
  Scan, Video, Focus, Crosshair, Maximize2, Trash2
} from "lucide-react";
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library";

interface MobileCompanionViewProps {
  onBackToDesktop?: () => void;
  currentUser: string;
}

interface DetectedMarker {
  id: string;
  serial: string;
  raw: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cornerPoints?: Array<{ x: number; y: number }>;
  sourceWidth: number;
  sourceHeight: number;
  matchedSlot?: number | null;
  status: "matched" | "surplus" | "valid";
  timestamp: number;
}

export const MobileCompanionView: React.FC<MobileCompanionViewProps> = ({
  onBackToDesktop,
  currentUser
}) => {
  const [scanTarget, setScanTarget] = useState<"kit" | "stock">("kit");

  const [kits, setKits] = useState<any[]>([]);
  const [selectedKitCode, setSelectedKitCode] = useState<string>("");
  const [activeKit, setActiveKit] = useState<any | null>(null);

  // Scanned serials
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<any | null>(null);

  // Visual AR Tracking Markers
  const [detectedMarkers, setDetectedMarkers] = useState<DetectedMarker[]>([]);
  const [markerSourceDim, setMarkerSourceDim] = useState({ width: 1280, height: 720 });

  // Status & feedback
  const [isAssembling, setIsAssembling] = useState(false);
  const [assemblySuccess, setAssemblySuccess] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeFeedback, setDecodeFeedback] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Camera & Stream States
  const [cameraActive, setCameraActive] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [hasMediaDevices, setHasMediaDevices] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  // Immersive UI Drawer & Panel toggles
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  const [showTestTrays, setShowTestTrays] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualSerialInput, setManualSerialInput] = useState("");

  // Last captured photo preview
  const [lastPhotoUrl, setLastPhotoUrl] = useState<string | null>(null);

  // Check Secure Context & MediaDevices availability
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const secure = window.isSecureContext || isHttps || isLocal;
      const media = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function");
      setIsSecureContext(secure);
      setHasMediaDevices(media);
    }
  }, []);

  // Auto-register companion device
  useEffect(() => {
    let devId = localStorage.getItem("bom_companion_device_id");
    if (!devId) {
      devId = "phone-" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem("bom_companion_device_id", devId);
    }

    const ua = navigator.userAgent;
    let model = "Android Smartphone";
    if (ua.includes("Pixel")) model = "Google Pixel";
    else if (ua.includes("SM-") || ua.includes("Samsung")) model = "Samsung Galaxy";
    else if (ua.includes("TC26") || ua.includes("TC57") || ua.includes("Zebra")) model = "Zebra TC Handheld";
    else if (ua.includes("Xiaomi") || ua.includes("Redmi")) model = "Xiaomi Redmi";
    else if (ua.includes("iPhone")) model = "Apple iPhone";

    const width = window.screen.width;
    const height = window.screen.height;

    fetch("/api/companion/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: devId,
        deviceName: model,
        platform: navigator.platform || "Android",
        browser: ua.includes("Chrome") ? "Chrome Mobile" : "Mobile Browser",
        screenResolution: `${width} x ${height}`,
        operator: currentUser || "Operator"
      })
    }).catch(() => {});
  }, [currentUser]);

  // Fetch Kits
  const loadKits = async () => {
    try {
      const res = await fetch("/api/companion/kits");
      const data = await res.json();
      setKits(data || []);
      if (data && data.length > 0 && !selectedKitCode) {
        const defaultKit = data.find((k: any) => k.kit_code === "KIT-BFG-002") || data[0];
        setSelectedKitCode(defaultKit.kit_code);
        setActiveKit(defaultKit);
      }
    } catch {}
  };

  useEffect(() => {
    loadKits();
  }, []);

  useEffect(() => {
    const found = kits.find(k => k.kit_code === selectedKitCode);
    setActiveKit(found || null);
    setScannedSerials([]);
    setDetectedMarkers([]);
    setValidationResult(null);
    setAssemblySuccess(null);
    setDecodeFeedback(null);
  }, [selectedKitCode, kits]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopLiveStream();
    };
  }, []);

  const stopLiveStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setCameraActive(false);
    setDetectedMarkers([]);
  };

  // Synchronize video element srcObject when cameraActive or stream changes
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.play().catch(e => console.warn("Video play error in useEffect:", e));
    }
  }, [cameraActive]);

  // Validate serials against active kit
  const validateBatch = async (serials: string[]) => {
    if (!selectedKitCode || serials.length === 0) return;
    try {
      const res = await fetch("/api/companion/kit-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kitCode: selectedKitCode,
          serials
        })
      });
      const data = await res.json();
      setValidationResult(data);

      if (data.isComplete) {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([100, 50, 150]);
        }
        setIsDrawerExpanded(true); // Automatically expand drawer when kit is fully matched
      }
    } catch {}
  };

  const extractSerial = (raw: string): string => {
    const parts = raw.split(":");
    const match = parts.find(p => p.startsWith("BFG-"));
    return (match || raw).trim();
  };

  // Match marker against active kit definition
  const evaluateMarkerStatus = (serial: string): { status: "matched" | "surplus" | "valid"; matchedSlot: number | null } => {
    if (scanTarget !== "kit" || !activeKit?.slots) {
      return { status: "valid", matchedSlot: null };
    }
    const slot = activeKit.slots.find((s: any) => {
      if (s.filledWithSerial === serial) return true;
      if (serial.includes("SIGMA") && s.requiredType === "SIGMA") return true;
      if (serial.includes("OMEGA") && s.requiredType === "OMEGA") return true;
      if (serial.includes("TP") && s.requiredType === "TP") return true;
      return false;
    });
    if (slot) {
      return { status: "matched", matchedSlot: slot.slotId };
    }
    return { status: "surplus", matchedSlot: null };
  };

  // High-performance downscaler and multi-barcode decoder
  const processImageFile = async (file: File) => {
    setIsDecoding(true);
    setCameraError(null);
    setDecodeFeedback("Processing photo frame...");

    try {
      const rawUrl = URL.createObjectURL(file);
      setLastPhotoUrl(rawUrl);

      // Load into HTMLImageElement
      const img = new Image();
      img.src = rawUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Downscale to max 1600px width for fast mobile barcode analysis
      const maxDim = 1600;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize 2D canvas");
      ctx.drawImage(img, 0, 0, width, height);

      const found: string[] = [];
      const markers: DetectedMarker[] = [];

      // Step 1: Use Native BarcodeDetector (Chrome on Android)
      if ("BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ["data_matrix", "qr_code", "code_128", "code_39"]
          });
          const results = await detector.detect(canvas);
          for (let i = 0; i < results.length; i++) {
            const item = results[i];
            if (item.rawValue) {
              const cleaned = extractSerial(item.rawValue);
              if (!found.includes(cleaned)) found.push(cleaned);
              const { status, matchedSlot } = evaluateMarkerStatus(cleaned);
              markers.push({
                id: `${cleaned}-${i}`,
                serial: cleaned,
                raw: item.rawValue,
                boundingBox: item.boundingBox ? {
                  x: item.boundingBox.x,
                  y: item.boundingBox.y,
                  width: item.boundingBox.width,
                  height: item.boundingBox.height
                } : undefined,
                cornerPoints: item.cornerPoints || [],
                sourceWidth: width,
                sourceHeight: height,
                matchedSlot,
                status,
                timestamp: Date.now()
              });
            }
          }
        } catch (e) {
          console.warn("Native BarcodeDetector error", e);
        }
      }

      // Step 2: Use ZXing MultiFormat Reader on Canvas if needed
      if (found.length === 0) {
        try {
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints);
          const result = await reader.decodeFromImageUrl(canvas.toDataURL("image/png"));
          if (result && result.getText()) {
            const cleaned = extractSerial(result.getText());
            if (!found.includes(cleaned)) found.push(cleaned);
            const { status, matchedSlot } = evaluateMarkerStatus(cleaned);
            markers.push({
              id: `${cleaned}-0`,
              serial: cleaned,
              raw: result.getText(),
              boundingBox: {
                x: width * 0.25,
                y: height * 0.25,
                width: width * 0.5,
                height: height * 0.5
              },
              sourceWidth: width,
              sourceHeight: height,
              matchedSlot,
              status,
              timestamp: Date.now()
            });
          }
        } catch {}
      }

      if (found.length > 0) {
        setDetectedMarkers(markers);
        setMarkerSourceDim({ width, height });
        const merged = Array.from(new Set([...scannedSerials, ...found]));
        setScannedSerials(merged);
        if (scanTarget === "kit") {
          validateBatch(merged);
        }
        setDecodeFeedback(`Identified ${found.length} DataMatrix barcode(s)!`);
        setTimeout(() => setDecodeFeedback(null), 3500);
      } else {
        setDecodeFeedback("No DataMatrix detected. Hold camera steady 10-15cm away, or tap 'Test'.");
      }
    } catch (err: any) {
      setCameraError("Camera capture could not be processed: " + (err.message || "Unknown error"));
    } finally {
      setIsDecoding(false);
    }
  };

  // Setup continuous barcode scanner (Native BarcodeDetector + ZXing Canvas fallback)
  const setupContinuousScanner = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if ("BarcodeDetector" in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ["data_matrix", "qr_code", "code_128"]
        });
        scanIntervalRef.current = setInterval(async () => {
          const video = videoRef.current;
          if (video && video.readyState >= 2 && !video.paused) {
            try {
              const barcodes = await detector.detect(video);
              if (barcodes && barcodes.length > 0) {
                const videoW = video.videoWidth || 1280;
                const videoH = video.videoHeight || 720;
                setMarkerSourceDim({ width: videoW, height: videoH });

                const detectedList: string[] = [];
                const markers: DetectedMarker[] = barcodes.map((b: any, idx: number) => {
                  const raw = b.rawValue || "";
                  const serial = extractSerial(raw);
                  detectedList.push(serial);
                  const { status, matchedSlot } = evaluateMarkerStatus(serial);

                  return {
                    id: `${serial}-${idx}`,
                    serial,
                    raw,
                    boundingBox: b.boundingBox ? {
                      x: b.boundingBox.x,
                      y: b.boundingBox.y,
                      width: b.boundingBox.width,
                      height: b.boundingBox.height
                    } : undefined,
                    cornerPoints: b.cornerPoints || [],
                    sourceWidth: videoW,
                    sourceHeight: videoH,
                    matchedSlot,
                    status,
                    timestamp: Date.now()
                  };
                });

                setDetectedMarkers(markers);

                setScannedSerials(prev => {
                  const merged = Array.from(new Set([...prev, ...detectedList]));
                  if (merged.length !== prev.length && scanTarget === "kit") {
                    validateBatch(merged);
                  }
                  return merged;
                });
              } else {
                // Decay markers after 1200ms of non-detection to prevent flicker
                setDetectedMarkers(prev => {
                  const now = Date.now();
                  return prev.filter(m => now - m.timestamp < 1200);
                });
              }
            } catch {}
          }
        }, 320);
        return;
      } catch (e) {
        console.warn("Native BarcodeDetector failed, falling back to canvas ZXing", e);
      }
    }

    // Canvas + ZXing fallback continuous scanner
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE]);
    const zxingReader = new BrowserMultiFormatReader(hints);

    let isScanning = false;
    scanIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused || isScanning || !ctx) return;
      isScanning = true;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const res = await zxingReader.decodeFromImageUrl(canvas.toDataURL("image/jpeg", 0.7));
        if (res && res.getText()) {
          const sn = extractSerial(res.getText());
          const { status, matchedSlot } = evaluateMarkerStatus(sn);
          setMarkerSourceDim({ width: 480, height: 360 });
          setDetectedMarkers([{
            id: `${sn}-0`,
            serial: sn,
            raw: res.getText(),
            boundingBox: { x: 120, y: 90, width: 240, height: 180 },
            sourceWidth: 480,
            sourceHeight: 360,
            matchedSlot,
            status,
            timestamp: Date.now()
          }]);
          setScannedSerials(prev => {
            if (!prev.includes(sn)) {
              const merged = [...prev, sn];
              if (scanTarget === "kit") validateBatch(merged);
              return merged;
            }
            return prev;
          });
        }
      } catch {
        setDetectedMarkers(prev => {
          const now = Date.now();
          return prev.filter(m => now - m.timestamp < 1200);
        });
      } finally {
        isScanning = false;
      }
    }, 600);
  };

  // Start Live Continuous Camera Stream (for HTTPS or Supported Secure Contexts)
  const startLiveStream = async () => {
    setCameraError(null);
    setDecodeFeedback("Connecting camera video feed...");

    if (!isSecureContext && window.location.protocol === "http:") {
      setCameraError(
        "Android Mobile Chrome blocks continuous live video over plain HTTP. Tap \"Switch to HTTPS\" below, or use the \"Snap Camera Photo\" button."
      );
      setDecodeFeedback(null);
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        console.warn("Retrying with simple facingMode environment...", err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
          });
        } catch (err2) {
          console.warn("Retrying with basic video: true...", err2);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      streamRef.current = stream;

      // Ensure video element receives stream and begins playback
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.setAttribute("autoplay", "true");

        // Wait for loadedmetadata to guarantee frame rendering in Android Chrome
        video.onloadedmetadata = () => {
          const w = video.videoWidth || 1280;
          const h = video.videoHeight || 720;
          setMarkerSourceDim({ width: w, height: h });
          video.play().catch(err => console.warn("Video play error on loadedmetadata:", err));
        };
        try {
          await video.play();
        } catch (playErr) {
          console.warn("Immediate video.play() note:", playErr);
        }
      }

      setCameraActive(true);
      setDecodeFeedback("Live AR Viewfinder active! Point at sensors.");

      setupContinuousScanner();
    } catch (err: any) {
      setCameraActive(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission blocked by Chrome. Tap the lock icon in the Chrome URL bar and select Allow for Camera.");
      } else {
        setCameraError(`Could not start live stream: ${err.message || err.name}. Use the native camera button instead.`);
      }
      setDecodeFeedback(null);
    }
  };

  // Capture still frame from running live video stream
  const captureFrameFromLiveVideo = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    setIsDecoding(true);
    setDecodeFeedback("Scanning video frame...");

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, width, height);

      const found: string[] = [];
      const markers: DetectedMarker[] = [];

      if ("BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ["data_matrix", "qr_code"] });
          const barcodes = await detector.detect(canvas);
          for (let i = 0; i < barcodes.length; i++) {
            const b = barcodes[i];
            if (b.rawValue) {
              const sn = extractSerial(b.rawValue);
              found.push(sn);
              const { status, matchedSlot } = evaluateMarkerStatus(sn);
              markers.push({
                id: `${sn}-${i}`,
                serial: sn,
                raw: b.rawValue,
                boundingBox: b.boundingBox ? {
                  x: b.boundingBox.x,
                  y: b.boundingBox.y,
                  width: b.boundingBox.width,
                  height: b.boundingBox.height
                } : undefined,
                cornerPoints: b.cornerPoints || [],
                sourceWidth: width,
                sourceHeight: height,
                matchedSlot,
                status,
                timestamp: Date.now()
              });
            }
          }
        } catch {}
      }

      if (found.length === 0) {
        try {
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE]);
          const reader = new BrowserMultiFormatReader(hints);
          const result = await reader.decodeFromImageUrl(canvas.toDataURL("image/png"));
          if (result && result.getText()) {
            const sn = extractSerial(result.getText());
            found.push(sn);
            const { status, matchedSlot } = evaluateMarkerStatus(sn);
            markers.push({
              id: `${sn}-0`,
              serial: sn,
              raw: result.getText(),
              boundingBox: { x: width * 0.25, y: height * 0.25, width: width * 0.5, height: height * 0.5 },
              sourceWidth: width,
              sourceHeight: height,
              matchedSlot,
              status,
              timestamp: Date.now()
            });
          }
        } catch {}
      }

      if (found.length > 0) {
        setDetectedMarkers(markers);
        setMarkerSourceDim({ width, height });
        const merged = Array.from(new Set([...scannedSerials, ...found]));
        setScannedSerials(merged);
        if (scanTarget === "kit") validateBatch(merged);
        setDecodeFeedback(`Identified ${found.length} barcode(s) in frame!`);
        setTimeout(() => setDecodeFeedback(null), 3500);
      } else {
        setDecodeFeedback("No DataMatrix recognized in frame. Hold closer to sensor.");
      }
    } finally {
      setIsDecoding(false);
    }
  };

  // Commit Kit Assembly to Central BOM Server
  const handleCommitKit = async () => {
    if (!validationResult || !validationResult.isComplete) return;
    setIsAssembling(true);
    setAssemblySuccess(null);
    try {
      const devId = localStorage.getItem("bom_companion_device_id");
      const res = await fetch("/api/companion/kit-assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kitCode: selectedKitCode,
          serials: validationResult.matchedSerials,
          operator: currentUser,
          deviceId: devId
        })
      });
      const data = await res.json();
      if (data.success) {
        setAssemblySuccess(`Kit ${selectedKitCode} successfully sealed with ${data.assignedCount} sensors!`);
        loadKits();
      }
    } catch {
      alert("Failed to commit kit to central station.");
    } finally {
      setIsAssembling(false);
    }
  };

  // Ingest Scanned Sensors into Stock
  const handleIngestStock = async () => {
    if (scannedSerials.length === 0) return;
    try {
      const res = await fetch("/api/scanner/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serials: scannedSerials,
          targetMode: "in_stock"
        })
      });
      const data = await res.json();
      alert(`Successfully registered ${data.importedCount + data.updatedCount} sensors into warehouse stock!`);
      setScannedSerials([]);
      setDetectedMarkers([]);
    } catch {
      alert("Ingest failed.");
    }
  };

  // Quick Preset Simulation
  const simulateScan = (serials: string[]) => {
    const merged = Array.from(new Set([...scannedSerials, ...serials]));
    setScannedSerials(merged);

    // Mock AR markers across the frame
    const width = 1280;
    const height = 720;
    setMarkerSourceDim({ width, height });
    const mockMarkers: DetectedMarker[] = serials.map((s, idx) => {
      const { status, matchedSlot } = evaluateMarkerStatus(s);
      const cols = serials.length;
      const x = (width / (cols + 1)) * (idx + 1) - 100;
      const y = height / 2 - 100;
      return {
        id: `mock-${s}-${idx}`,
        serial: s,
        raw: s,
        boundingBox: { x, y, width: 200, height: 200 },
        sourceWidth: width,
        sourceHeight: height,
        matchedSlot,
        status,
        timestamp: Date.now()
      };
    });
    setDetectedMarkers(mockMarkers);

    if (scanTarget === "kit") {
      validateBatch(merged);
    }
    setAssemblySuccess(null);
  };

  const handleManualAddSerial = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualSerialInput.trim().toUpperCase();
    if (!clean) return;
    const merged = Array.from(new Set([...scannedSerials, clean]));
    setScannedSerials(merged);
    if (scanTarget === "kit") {
      validateBatch(merged);
    }
    setManualSerialInput("");
    setShowManualInput(false);
  };

  const switchToHttps = () => {
    const host = window.location.hostname;
    window.location.href = `https://${host}:3101/mobile`;
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden antialiased">
      {/* ============================================================ */}
      {/* LAYER 0: IMMERSIVE FULL-FRAME CAMERA BACKGROUND & AR OVERLAY  */}
      {/* ============================================================ */}
      <div className="absolute inset-0 w-full h-full overflow-hidden z-0 bg-slate-950 flex items-center justify-center">
        {/* Always-mounted full-bleed HTML5 Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            cameraActive ? "opacity-100 z-0 block" : "opacity-0 pointer-events-none hidden"
          }`}
          onClick={() => {
            // Tap to unfreeze if Android Chrome paused stream
            if (videoRef.current && videoRef.current.paused) {
              videoRef.current.play().catch(console.error);
            }
          }}
        />

        {/* AR Tracking Markers SVG Layer (Exact Pixel Map with preserveAspectRatio="xMidYMid slice") */}
        {cameraActive && detectedMarkers.length > 0 && (
          <svg
            viewBox={`0 0 ${markerSourceDim.width} ${markerSourceDim.height}`}
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          >
            <defs>
              <filter id="ar-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {detectedMarkers.map((m) => {
              const b = m.boundingBox;
              if (!b) return null;
              const isMatched = m.status === "matched";
              const isSurplus = m.status === "surplus";
              const strokeColor = isMatched ? "#10b981" : isSurplus ? "#f59e0b" : "#06b6d4";
              const fillColor = isMatched
                ? "rgba(16, 185, 129, 0.22)"
                : isSurplus
                ? "rgba(245, 158, 11, 0.22)"
                : "rgba(6, 182, 212, 0.22)";
              const cornerLen = Math.max(16, Math.min(b.width, b.height) * 0.28);

              // Position of the floating HUD tag
              const tagY = Math.max(34, b.y - 32);
              const tagWidth = Math.max(180, Math.min(260, b.width * 1.1));

              return (
                <g key={m.id} className="transition-all duration-200">
                  {/* Glowing translucent bounding box */}
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.width}
                    height={b.height}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />

                  {/* High-tech 4 Corner Reticle Brackets */}
                  {/* Top-Left */}
                  <path
                    d={`M ${b.x} ${b.y + cornerLen} L ${b.x} ${b.y} L ${b.x + cornerLen} ${b.y}`}
                    stroke={strokeColor}
                    strokeWidth="3.5"
                    fill="none"
                    filter="url(#ar-glow)"
                  />
                  {/* Top-Right */}
                  <path
                    d={`M ${b.x + b.width - cornerLen} ${b.y} L ${b.x + b.width} ${b.y} L ${b.x + b.width} ${b.y + cornerLen}`}
                    stroke={strokeColor}
                    strokeWidth="3.5"
                    fill="none"
                    filter="url(#ar-glow)"
                  />
                  {/* Bottom-Right */}
                  <path
                    d={`M ${b.x + b.width} ${b.y + b.height - cornerLen} L ${b.x + b.width} ${b.y + b.height} L ${b.x + b.width - cornerLen} ${b.y + b.height}`}
                    stroke={strokeColor}
                    strokeWidth="3.5"
                    fill="none"
                    filter="url(#ar-glow)"
                  />
                  {/* Bottom-Left */}
                  <path
                    d={`M ${b.x + cornerLen} ${b.y + b.height} L ${b.x} ${b.y + b.height} L ${b.x} ${b.y + b.height - cornerLen}`}
                    stroke={strokeColor}
                    strokeWidth="3.5"
                    fill="none"
                    filter="url(#ar-glow)"
                  />

                  {/* Center Target Point */}
                  <circle cx={b.x + b.width / 2} cy={b.y + b.height / 2} r="3.5" fill={strokeColor} />

                  {/* Floating Holographic Tag above Box */}
                  <g transform={`translate(${b.x}, ${tagY})`}>
                    <rect
                      x="0"
                      y="0"
                      width={tagWidth}
                      height="28"
                      rx="6"
                      fill="#090d16"
                      fillOpacity="0.88"
                      stroke={strokeColor}
                      strokeWidth="1.5"
                    />
                    {/* Glowing status indicator dot */}
                    <circle cx="12" cy="14" r="4" fill={strokeColor} />
                    {/* Decoded Serial Number */}
                    <text
                      x="22"
                      y="18"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      {m.serial}
                    </text>
                    {/* Slot badge indicator */}
                    {m.matchedSlot && (
                      <text
                        x={tagWidth - 8}
                        y="18"
                        textAnchor="end"
                        fill={strokeColor}
                        fontSize="11"
                        fontWeight="bold"
                      >
                        Slot {m.matchedSlot} ✓
                      </text>
                    )}
                    {isSurplus && (
                      <text
                        x={tagWidth - 8}
                        y="18"
                        textAnchor="end"
                        fill={strokeColor}
                        fontSize="10"
                        fontWeight="bold"
                      >
                        Surplus
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </svg>
        )}

        {/* Center Subtle Viewfinder Reticle (active in live stream) */}
        {cameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 opacity-40">
            <div className="w-56 h-56 border border-white/20 rounded-2xl relative">
              <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-rose-500"></div>
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-rose-500"></div>
              <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-rose-500"></div>
              <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-rose-500"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-0.5 bg-rose-500/70"></div>
                <div className="h-3 w-0.5 bg-rose-500/70 absolute"></div>
              </div>
            </div>
          </div>
        )}

        {/* Standby State (When camera is inactive) */}
        {!cameraActive && (
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-900 via-slate-950 to-black">
            <div className="relative w-32 h-32 rounded-full border border-rose-500/30 flex items-center justify-center mb-5">
              <div className="absolute inset-2 rounded-full border border-rose-500/20 animate-ping"></div>
              <div className="w-20 h-20 rounded-full bg-rose-600/15 border-2 border-rose-500 flex items-center justify-center shadow-lg shadow-rose-950">
                <Camera className="w-9 h-9 text-rose-400" />
              </div>
            </div>

            <h2 className="text-base font-bold text-white tracking-tight">
              BOM Optical Terminal
            </h2>
            <p className="text-[11.5px] text-slate-400 max-w-xs mt-1 leading-relaxed">
              Full-frame live AR scanner. Point at sensor DataMatrix codes for multi-slot verification.
            </p>

            {/* Standby Main Triggers */}
            <div className="mt-6 flex flex-col space-y-2.5 w-full max-w-xs">
              {isSecureContext ? (
                <button
                  onClick={startLiveStream}
                  className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-900/60 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>Start Live AR Stream</span>
                </button>
              ) : (
                <button
                  onClick={switchToHttps}
                  className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Switch to HTTPS (Port 3101)</span>
                </button>
              )}

              <label
                htmlFor="standby-native-camera-input"
                className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center space-x-2 cursor-pointer select-none text-center"
              >
                <input
                  id="standby-native-camera-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processImageFile(file);
                  }}
                />
                <Camera className="w-4 h-4 text-rose-400" />
                <span>Snap Camera Photo</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* LAYER 1: TOP FLOATING HUD (Header, Modes, Kit Picker, Toast) */}
      {/* ============================================================ */}
      <div className="absolute top-0 inset-x-0 p-3 pt-safe flex flex-col space-y-2 pointer-events-none z-30">
        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          {/* Left: Desktop back & App badge */}
          <div className="flex items-center space-x-1.5">
            {onBackToDesktop && (
              <button
                onClick={onBackToDesktop}
                className="p-2 bg-slate-900/75 hover:bg-slate-900 backdrop-blur-md border border-white/10 rounded-xl text-slate-300 hover:text-white cursor-pointer shadow-lg"
                title="Desktop View"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-900/75 backdrop-blur-md border border-white/10 rounded-xl shadow-lg">
              <div className="w-5 h-5 rounded bg-rose-600 flex items-center justify-center font-bold text-white text-[10px]">
                BOM
              </div>
              <span className="text-xs font-bold text-white">Scanner</span>
              {cameraActive && (
                <span className="flex items-center space-x-1 ml-1 text-[9px] font-mono text-emerald-400 font-bold bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>LIVE AR</span>
                </span>
              )}
            </div>
          </div>

          {/* Center: Mode Switcher Pills */}
          <div className="flex items-center bg-slate-900/75 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-lg">
            <button
              onClick={() => { setScanTarget("kit"); setScannedSerials([]); setDetectedMarkers([]); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                scanTarget === "kit"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Kit</span>
            </button>
            <button
              onClick={() => { setScanTarget("stock"); setScannedSerials([]); setDetectedMarkers([]); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                scanTarget === "stock"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Stock</span>
            </button>
          </div>

          {/* Right: Quick actions (Test Trays Demo) */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowTestTrays(!showTestTrays)}
              className={`px-2.5 py-1.5 backdrop-blur-md border rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg flex items-center space-x-1 ${
                showTestTrays
                  ? "bg-rose-600 text-white border-rose-500"
                  : "bg-slate-900/75 border-white/10 text-slate-300 hover:text-white"
              }`}
              title="Factory Test Trays"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px]">Test</span>
            </button>
          </div>
        </div>

        {/* Secondary Row: Kit Selector (when in Kit mode) */}
        {scanTarget === "kit" && (
          <div className="flex items-center space-x-2 pointer-events-auto">
            <div className="flex-1 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1.5 flex items-center justify-between shadow-lg">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Kit:</span>
                <select
                  value={selectedKitCode}
                  onChange={(e) => setSelectedKitCode(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer truncate max-w-[200px]"
                >
                  {kits.map(k => (
                    <option key={k.kit_code} value={k.kit_code} className="bg-slate-900 text-white">
                      {k.kit_code} ({k.expected_spec})
                    </option>
                  ))}
                </select>
              </div>
              <span className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                validationResult?.isComplete
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                  : "bg-white/10 text-slate-300 border-white/15"
              }`}>
                {validationResult ? `${validationResult.filledCount}/${validationResult.totalRequired} Slots` : "0/3"}
              </span>
            </div>
          </div>
        )}

        {/* Toast / Feedback Banner */}
        {decodeFeedback && (
          <div className="p-2.5 bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-xl text-cyan-200 text-xs font-bold flex items-center space-x-2 shadow-xl pointer-events-auto">
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 shrink-0 ${isDecoding ? "animate-spin" : ""}`} />
            <span className="truncate">{decodeFeedback}</span>
          </div>
        )}

        {/* Camera Error Notice */}
        {cameraError && (
          <div className="p-2.5 bg-red-950/90 backdrop-blur-md border border-red-500/50 rounded-xl text-red-200 text-xs font-medium space-y-1 shadow-xl pointer-events-auto">
            <div className="flex items-center space-x-1.5 font-bold text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Camera Notice</span>
            </div>
            <p className="text-[11px] leading-tight">{cameraError}</p>
          </div>
        )}

        {/* Quick Test Trays Menu (Floating) */}
        {showTestTrays && (
          <div className="p-2.5 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-xl space-y-2 shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <span>Simulate Multi-Scan Tray:</span>
              <button onClick={() => setShowTestTrays(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  simulateScan(["BFG-SIGMA-12904", "BFG-OMEGA-77120", "BFG-TP-49104"]);
                  setShowTestTrays(false);
                }}
                className="px-2 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/50 text-emerald-300 rounded-lg text-[10.5px] font-bold cursor-pointer text-left"
              >
                ✓ Complete 3-Sensor Tray
              </button>
              <button
                onClick={() => {
                  simulateScan(["BFG-SIGMA-12904", "BFG-OMEGA-77120"]);
                  setShowTestTrays(false);
                }}
                className="px-2 py-1.5 bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/50 text-amber-300 rounded-lg text-[10.5px] font-bold cursor-pointer text-left"
              >
                2/3 Partial Tray
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* LAYER 2: BOTTOM FLOATING CONTROLS & EXPANDABLE HUD DRAWER     */}
      {/* ============================================================ */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none z-30 flex flex-col justify-end">
        {/* Floating Quick Action Shutter Bar (Floats right above the drawer) */}
        <div className="p-3 pb-2 flex items-center justify-center space-x-3 pointer-events-auto">
          {cameraActive ? (
            <>
              {/* Stop Live Stream */}
              <button
                onClick={stopLiveStream}
                className="p-3.5 bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md border border-slate-700 text-white rounded-full shadow-xl cursor-pointer active:scale-95 transition-all"
                title="Stop Live Stream"
              >
                <Square className="w-5 h-5 text-red-400" />
              </button>

              {/* Primary Central Trigger: Instant Frame Scan */}
              <button
                onClick={captureFrameFromLiveVideo}
                className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-full shadow-2xl shadow-rose-900/80 font-bold text-xs uppercase tracking-wider flex items-center space-x-2 border-2 border-rose-400 animate-pulse active:scale-95 transition-all cursor-pointer"
              >
                <Focus className="w-5 h-5" />
                <span>Scan Frame</span>
              </button>

              {/* High-res Native Shutter Fallback */}
              <label
                htmlFor="immersive-live-native-shutter"
                className="p-3.5 bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md border border-slate-700 text-white rounded-full shadow-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center"
                title="Snap High-Res Photo"
              >
                <input
                  id="immersive-live-native-shutter"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processImageFile(file);
                  }}
                />
                <Camera className="w-5 h-5 text-rose-400" />
              </label>
            </>
          ) : (
            <div className="flex items-center space-x-2 w-full max-w-sm">
              <label
                htmlFor="immersive-docked-photo-shutter"
                className="flex-1 py-3.5 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl shadow-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 cursor-pointer active:scale-98 transition-all text-center"
              >
                <input
                  id="immersive-docked-photo-shutter"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processImageFile(file);
                  }}
                />
                <Camera className="w-4 h-4 mr-1" />
                <span>Snap Camera Photo</span>
              </label>

              {isSecureContext && (
                <button
                  onClick={startLiveStream}
                  className="py-3.5 px-4 bg-slate-900/85 hover:bg-slate-900 backdrop-blur-md border border-white/20 text-white rounded-xl shadow-xl font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98 transition-all"
                >
                  <Video className="w-4 h-4 text-emerald-400" />
                  <span>Live Stream</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Expandable Glass Bottom Drawer */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-2xl border-t border-white/15 rounded-t-3xl shadow-2xl transition-all duration-300 max-h-[72vh] flex flex-col">
          {/* Drawer Handle & Summary Header */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="px-4 py-3 flex items-center justify-between cursor-pointer border-b border-white/10 select-none relative"
          >
            <div className="w-8 h-1 bg-white/30 rounded-full mx-auto absolute top-1.5 inset-x-0"></div>

            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {scanTarget === "kit" ? "Kit Assembly Status" : "Stock Ingest Buffer"}
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                validationResult?.isComplete
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                  : "bg-white/10 text-slate-300 border-white/15"
              }`}>
                {scanTarget === "kit"
                  ? (validationResult ? `${validationResult.filledCount} / ${validationResult.totalRequired} Slots` : "0 Slots")
                  : `${scannedSerials.length} Scanned`
                }
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {validationResult?.isComplete && scanTarget === "kit" && !isDrawerExpanded && (
                <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 animate-pulse">
                  Ready to Seal
                </span>
              )}
              <button className="p-1 text-slate-400 hover:text-white">
                {isDrawerExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className={`overflow-y-auto px-4 py-3 space-y-3 transition-all duration-300 ${
            isDrawerExpanded ? "max-h-[60vh]" : "max-h-24"
          }`}>
            {/* COLLAPSED VIEW: Quick Horizontal Summary */}
            {!isDrawerExpanded && (
              <div className="flex items-center justify-between gap-2">
                {scanTarget === "kit" ? (
                  validationResult?.isComplete ? (
                    <button
                      onClick={handleCommitKit}
                      disabled={isAssembling}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isAssembling ? "Sealing..." : "Seal & Register Kit (100% Ready)"}</span>
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center space-x-2 overflow-x-auto py-1">
                      {validationResult?.slots ? (
                        validationResult.slots.map((slot: any) => (
                          <span
                            key={slot.slotId}
                            className={`text-[10px] font-mono px-2 py-1 rounded-lg border shrink-0 flex items-center space-x-1 ${
                              slot.isFilled
                                ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/50"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            <span>Slot {slot.slotId}:</span>
                            <span className="font-bold">{slot.isFilled ? "✓ Matched" : "Waiting"}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 truncate">
                          Point camera at sensors or tap "Test" to verify slots.
                        </span>
                      )}
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs text-slate-300">
                      {scannedSerials.length > 0 ? `${scannedSerials.length} sensors ready for stock ingest` : "No sensors captured yet."}
                    </span>
                    {scannedSerials.length > 0 && (
                      <button
                        onClick={handleIngestStock}
                        className="py-1.5 px-3 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Ingest Stock
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* EXPANDED VIEW: Detailed Cards & Controls */}
            {isDrawerExpanded && (
              <>
                {scanTarget === "kit" ? (
                  <div className="space-y-2">
                    {/* Slots List */}
                    {validationResult?.slots ? (
                      validationResult.slots.map((slot: any) => (
                        <div
                          key={slot.slotId}
                          className={`p-2.5 rounded-xl border flex items-center justify-between ${
                            slot.isFilled
                              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
                              : "bg-slate-800/60 border-slate-700 text-slate-400 border-dashed"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              slot.isFilled ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"
                            }`}>
                              {slot.slotId}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-xs block text-white truncate">
                                Slot {slot.slotId}: {slot.requiredType} Sensor
                              </span>
                              {slot.filledWithSerial ? (
                                <span className="font-mono text-[11px] text-emerald-400 font-bold block truncate">
                                  {slot.filledWithSerial}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 block truncate">
                                  Awaiting {slot.requiredType} DataMatrix scan...
                                </span>
                              )}
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 ml-2 ${
                            slot.isFilled
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-slate-700 text-slate-400"
                          }`}>
                            {slot.isFilled ? "Verified" : "Empty"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-slate-400 text-xs border border-dashed border-slate-700 rounded-xl">
                        Point camera at sensors or tap "Scan Frame" to verify slots.
                      </div>
                    )}

                    {/* Surplus sensors */}
                    {validationResult?.surplusSerials?.length > 0 && (
                      <div className="p-2.5 bg-amber-950/50 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="font-bold block">Surplus Sensors in View:</span>
                          <span className="font-mono text-[10.5px] text-amber-300 block truncate">
                            {validationResult.surplusSerials.join(", ")}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Seal Kit Button */}
                    {validationResult?.isComplete && !assemblySuccess && (
                      <button
                        onClick={handleCommitKit}
                        disabled={isAssembling}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2 cursor-pointer mt-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>{isAssembling ? "Sealing..." : "Seal & Register Kit (100% Ready)"}</span>
                      </button>
                    )}

                    {assemblySuccess && (
                      <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-bold flex items-center space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>{assemblySuccess}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Stock Mode List */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="font-bold">Scanned Sensors Buffer:</span>
                      {scannedSerials.length > 0 && (
                        <button
                          onClick={() => { setScannedSerials([]); setDetectedMarkers([]); }}
                          className="text-[10.5px] text-slate-400 hover:text-rose-400 font-bold cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {scannedSerials.length === 0 ? (
                        <div className="py-4 text-center text-slate-400 text-xs border border-dashed border-slate-700 rounded-xl">
                          No sensors scanned yet.
                        </div>
                      ) : (
                        scannedSerials.map((s, idx) => (
                          <div key={idx} className="p-2 bg-slate-800/70 border border-slate-700 rounded-lg flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-white truncate">{s}</span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0 ml-2">
                              DataMatrix ✓
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {scannedSerials.length > 0 && (
                      <button
                        onClick={handleIngestStock}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Ingest {scannedSerials.length} Sensors to Stock</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Secondary manual input toggle & reset */}
                <div className="pt-2 flex items-center justify-between border-t border-white/10 text-xs text-slate-400">
                  <button
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="hover:text-rose-400 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showManualInput ? "Hide Keyboard Input" : "Type Serial Manually"}</span>
                  </button>

                  {scannedSerials.length > 0 && (
                    <button
                      onClick={() => {
                        setScannedSerials([]);
                        setDetectedMarkers([]);
                        setValidationResult(null);
                        setAssemblySuccess(null);
                      }}
                      className="hover:text-rose-400 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Manual Serial Input Form */}
                {showManualInput && (
                  <form onSubmit={handleManualAddSerial} className="pt-2 flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="e.g. BFG-TP-49104"
                      value={manualSerialInput}
                      onChange={(e) => setManualSerialInput(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="submit"
                      className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Add
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
