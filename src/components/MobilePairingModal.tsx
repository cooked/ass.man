import QRCode from "qrcode";
import React, { useState, useEffect } from "react";
import {
  QrCode, Smartphone, X, Copy, Check, ExternalLink,
  Wifi, ShieldCheck, RefreshCw, AlertCircle, Sparkles,
  Boxes, Cpu, CheckCircle2, Lock, Globe
} from "lucide-react";

interface MobilePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
  onOpenMobileView: () => void;
}

export const MobilePairingModal: React.FC<MobilePairingModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenMobileView
}) => {
  const [pairingData, setPairingData] = useState<{
    localIp: string;
    port: number;
    httpsPort: number;
    httpUrl: string;
    httpsUrl: string;
    hasHttps: boolean;
    qrCodeDataUrl: string;
  } | null>(null);
  const [useHttps, setUseHttps] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrCodeImg, setQrCodeImg] = useState<string>("");

  const fetchPairingInfo = async () => {
    try {
      const res = await fetch("/api/companion/qr-pair");
      const data = await res.json();
      if (data.success) {
        setPairingData(data);
        setQrCodeImg(data.qrCodeDataUrl);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchPairingInfo();
    }
  }, [isOpen]);

  const currentUrl = (useHttps && pairingData?.hasHttps)
    ? (pairingData?.httpsUrl || "")
    : (pairingData?.httpUrl || "");

  useEffect(() => {
    if (isOpen && currentUrl) {
      QRCode.toDataURL(currentUrl, {
        margin: 2,
        width: 320,
        color: { dark: "#0f172a", light: "#ffffff" }
      }).then(url => setQrCodeImg(url)).catch(() => {});
    }
  }, [isOpen, currentUrl]);

  if (!isOpen) return null;


  const handleCopyUrl = () => {
    if (currentUrl) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Semi-transparent backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-300 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded bg-rose-100 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
                  Pair Android Companion Phone
                </h3>
                <p className="text-[10px] text-slate-500 whitespace-nowrap">
                  Multi-DataMatrix optical scanner & kit assembly terminal
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Protocol Selector Pill */}
            <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center space-x-1">
              <button
                onClick={() => setUseHttps(true)}
                className={`flex-1 py-1 px-2 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition-colors cursor-pointer ${
                  useHttps ? "bg-white text-rose-700 shadow-2xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>HTTPS Live Stream (Recommended)</span>
              </button>
              <button
                onClick={() => setUseHttps(false)}
                className={`flex-1 py-1 px-2 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition-colors cursor-pointer ${
                  !useHttps ? "bg-white text-rose-700 shadow-2xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>HTTP Shutter Mode</span>
              </button>
            </div>

            {/* Pairing QR Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col items-center text-center shadow-xs">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 mb-2">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Local Wi-Fi Network Link</span>
              </div>

              {qrCodeImg ? (
                <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-xs mb-2">
                  <img
                    src={qrCodeImg}
                    alt="Pairing QR Code"
                    className="w-56 h-56 object-contain"
                  />
                </div>
              ) : (
                <div className="w-56 h-56 bg-slate-200 animate-pulse rounded-lg flex items-center justify-center text-slate-400 text-xs">
                  Loading QR Code...
                </div>
              )}

              <p className="text-[11px] text-slate-600 max-w-xs mt-1">
                Scan with your Android smartphone camera to open the scanner terminal.
              </p>
            </div>

            {/* Direct URL Box */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Direct Mobile Access URL
              </label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  readOnly
                  value={currentUrl}
                  className="flex-1 bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-mono font-medium focus:outline-none"
                />
                <button
                  onClick={handleCopyUrl}
                  title="Copy URL"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 block">
                {useHttps
                  ? "Uses HTTPS to unlock the phone camera for real-time video stream (accept the local self-signed cert on first visit)."
                  : "Uses standard HTTP with native camera shutter button (works without any SSL prompt)."}
              </span>
            </div>

            {/* Launch in desktop view */}
            <div className="pt-2">
              <button
                onClick={() => { onClose(); onOpenMobileView(); }}
                className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-800 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                <span>Launch Mobile Companion Simulator Here</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-[10.5px] text-slate-400 font-mono">
              Active Operator: {currentUser}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded shadow-2xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
