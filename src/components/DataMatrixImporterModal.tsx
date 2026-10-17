import React, { useState } from "react";
import { QrCode, Upload, CheckCircle2, X, Boxes, Warehouse, ArrowRight } from "lucide-react";
import { KitAsset } from "../types/schema";

interface DataMatrixImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  kits: KitAsset[];
  onIngestSuccess: () => void;
}

export const DataMatrixImporterModal: React.FC<DataMatrixImporterModalProps> = ({
  isOpen,
  onClose,
  kits,
  onIngestSuccess
}) => {
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedSerials, setParsedSerials] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Batch options
  const [sensorType, setSensorType] = useState<"Z" | "TP" | "Sigma" | "Omega">("TP");
  const [hwVersion, setHwVersion] = useState("v1.2");
  const [fwVersion, setFwVersion] = useState("1.4.0");
  const [targetMode, setTargetMode] = useState<"in_stock" | "in_kit">("in_stock");
  const [targetKitId, setTargetKitId] = useState<string>(kits[0]?.kit_code || "");

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      await parseContent(text);
    };
    reader.readAsText(file);
  };

  const parseContent = async (text: string) => {
    if (!text.trim()) {
      setParsedSerials([]);
      return;
    }
    setIsParsing(true);
    try {
      const res = await fetch("/api/scanner/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileContent: text })
      });
      const data = await res.json();
      setParsedSerials(data.preview || []);
    } catch (err) {
      console.error("Parse error:", err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleLoadSample = async () => {
    const sample = `# Bonfiglioli Android Scanner App Export
# Timestamp: 2026-10-16 14:22:10
# Device: Zebra TC26 Android Barcode/DataMatrix
BFG-TP-50010
BFG-TP-50011
BFG-TP-50012
BFG-Z-88410
BFG-Z-88411
BFG-SIGMA-12910
BFG-OMEGA-77130`;
    setFileName("android_scan_arrived_batch_oct16.txt");
    setRawText(sample);
    await parseContent(sample);
  };

  const handleCommitIngest = async () => {
    if (parsedSerials.length === 0) return;
    setIsIngesting(true);
    setResultMessage(null);

    try {
      const serials = parsedSerials.map(p => p.serial_number);
      const res = await fetch("/api/scanner/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serials,
          sensorType,
          hwVersion,
          fwVersion,
          targetMode,
          targetKitId: targetMode === "in_kit" ? targetKitId : undefined
        })
      });

      const data = await res.json();
      setResultMessage(`Ingestion successful! New sensors: ${data.importedCount}, Updated: ${data.updatedCount}`);
      onIngestSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Ingest error:", err);
      setResultMessage("Error during batch ingestion.");
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
      />

      {/* Full-Height Right-Side Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden border-l border-slate-300 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded border border-rose-200 shrink-0">
              <QrCode className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-slate-900 whitespace-nowrap truncate">
                Android DataMatrix Scanner Importer
              </h2>
              <p className="text-[10px] text-slate-500 whitespace-nowrap">
                Process camera barcode scanner exports (.txt, .csv) and ingest serial numbers in bulk.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* File Picker & Sample */}
          <div className="flex items-stretch gap-2">
            <label className="flex-1 border border-dashed border-slate-300 hover:border-rose-400 rounded p-2.5 bg-slate-50 hover:bg-white cursor-pointer transition-all flex items-center justify-center space-x-2">
              <Upload className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-700 whitespace-nowrap">Upload Scanner File (.txt, .csv)</span>
              {fileName && <span className="text-[10px] font-mono text-rose-600 font-bold ml-1">({fileName})</span>}
              <input type="file" accept=".txt,.csv,.json" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleLoadSample}
              className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1 rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              Load Sample (7 Serials)
            </button>
          </div>

          {/* Text Area */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-700">Scanned Raw Text:</label>
              {parsedSerials.length > 0 && (
                <span className="text-[10.5px] text-emerald-700 font-bold whitespace-nowrap">{parsedSerials.length} serials detected</span>
              )}
            </div>
            <textarea
              rows={4}
              placeholder="Paste serial numbers lines here or load a file..."
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                parseContent(e.target.value);
              }}
              className="w-full font-mono text-[11px] bg-white border border-slate-300 rounded p-2 text-slate-800 focus:outline-none focus:border-rose-600"
            />
          </div>

          {/* Preview list */}
          {parsedSerials.length > 0 && (
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="px-2.5 py-1.5 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 flex justify-between">
                <span>Validation Preview ({parsedSerials.length})</span>
                <span className="text-slate-400 normal-case font-normal">Auto-detected types</span>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
                {parsedSerials.map((s, idx) => (
                  <div key={idx} className="px-2.5 py-1 text-[11px] flex items-center justify-between whitespace-nowrap">
                    <span className="font-mono text-slate-800 font-medium">{s.serial_number}</span>
                    <div>
                      {s.alreadyExists ? (
                        <span className="text-[9.5px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                          Existing ({s.currentStatus})
                        </span>
                      ) : (
                        <span className="text-[9.5px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
                          New Sensor
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Batch Ingestion Settings
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Default Type</label>
                <select
                  value={sensorType}
                  onChange={(e) => setSensorType(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 text-[11px] text-slate-800 rounded p-1.5 focus:border-rose-600 focus:outline-none"
                >
                  <option value="Z">Z (Vibration)</option>
                  <option value="TP">TP (Temp/Pressure)</option>
                  <option value="Sigma">Sigma (Torsion/Strain)</option>
                  <option value="Omega">Omega (Triaxial Accel)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">HW Version</label>
                <input
                  type="text"
                  value={hwVersion}
                  onChange={(e) => setHwVersion(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-[11px] font-mono text-slate-800 rounded p-1.5 focus:border-rose-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">FW Version</label>
                <input
                  type="text"
                  value={fwVersion}
                  onChange={(e) => setFwVersion(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-[11px] font-mono text-slate-800 rounded p-1.5 focus:border-rose-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Target Destination:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetMode("in_stock")}
                  className={`p-2.5 rounded border text-left flex items-center space-x-2 transition-colors cursor-pointer whitespace-nowrap ${
                    targetMode === "in_stock"
                      ? "bg-rose-50 border-rose-400 text-rose-900"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Warehouse className="w-4 h-4 text-rose-600 shrink-0" />
                  <div className="text-[11px] font-bold">Receive to Warehouse</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetMode("in_kit")}
                  className={`p-2.5 rounded border text-left flex items-center space-x-2 transition-colors cursor-pointer whitespace-nowrap ${
                    targetMode === "in_kit"
                      ? "bg-rose-50 border-rose-400 text-rose-900"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Boxes className="w-4 h-4 text-rose-600 shrink-0" />
                  <div className="text-[11px] font-bold">Assign Directly to Kit</div>
                </button>
              </div>

              {targetMode === "in_kit" && (
                <div className="mt-2">
                  <select
                    value={targetKitId}
                    onChange={(e) => setTargetKitId(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-[11px] text-slate-800 rounded p-1.5 focus:border-rose-600 focus:outline-none"
                  >
                    {kits.map((k) => (
                      <option key={k.kit_code} value={k.kit_code}>
                        {k.kit_code} — {k.kit_name} ({k.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {resultMessage && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-[11px] flex items-center space-x-1.5 whitespace-nowrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resultMessage}</span>
            </div>
          )}
        </div>

        {/* Sticky Drawer Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">
            Close
          </button>
          <button
            disabled={parsedSerials.length === 0 || isIngesting}
            onClick={handleCommitIngest}
            className={`flex items-center space-x-1 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded shadow-2xs transition-all whitespace-nowrap ${
              parsedSerials.length === 0 || isIngesting
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            }`}
          >
            <span>{isIngesting ? "Ingesting..." : `Confirm Ingestion (${parsedSerials.length})`}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
