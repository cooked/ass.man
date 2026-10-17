import React, { useState } from "react";
import { Binary, Plus, CheckCircle2, AlertTriangle, Cpu, X, ArrowUpCircle, ShieldCheck, Calendar, FileText } from "lucide-react";
import { FirmwareAsset, SensorAsset } from "../types/schema";

interface FirmwareManagerViewProps {
  firmwares: FirmwareAsset[];
  sensors: SensorAsset[];
  onSaveFirmware: (fw: FirmwareAsset) => Promise<void>;
  onBatchUpgradeSensors: (sensorType: string, fromVersion: string, toVersion: string) => Promise<void>;
  onRefresh: () => void;
}

export const FirmwareManagerView: React.FC<FirmwareManagerViewProps> = ({
  firmwares,
  sensors,
  onSaveFirmware,
  onBatchUpgradeSensors,
  onRefresh
}) => {
  const [selectedSensorType, setSelectedSensorType] = useState<string>("ALL");
  const [isReleasingFw, setIsReleasingFw] = useState(false);
  const [targetUpgrade, setTargetUpgrade] = useState<{ sensorType: string; fromVersion: string; toVersion: string; count: number } | null>(null);

  // Form State for New Release
  const [newFwType, setNewFwType] = useState<"Z" | "TP" | "Sigma" | "Omega">("TP");
  const [newFwVersion, setNewFwVersion] = useState("");
  const [newFwStatus, setNewFwStatus] = useState<"latest" | "stable" | "beta">("latest");
  const [newMinHw, setNewMinHw] = useState("v1.2");
  const [newChangelog, setNewChangelog] = useState("");

  const sensorTypes = ["Z", "TP", "Sigma", "Omega"] as const;

  const filteredFirmwares = firmwares.filter(f =>
    selectedSensorType === "ALL" ? true : f.sensor_type === selectedSensorType
  );

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFwVersion.trim()) return;

    const fwCode = `FW-${newFwType}-${newFwVersion.trim()}`;
    const newFw: FirmwareAsset = {
      fw_code: fwCode,
      version: newFwVersion.trim(),
      sensor_type: newFwType,
      status: newFwStatus,
      min_hw_version: newMinHw.trim(),
      release_date: new Date().toISOString().slice(0, 10),
      changelog: newChangelog.trim()
    };

    await onSaveFirmware(newFw);
    setIsReleasingFw(false);
    setNewFwVersion("");
    setNewChangelog("");
    onRefresh();
  };

  const handleExecuteUpgrade = async () => {
    if (!targetUpgrade) return;
    await onBatchUpgradeSensors(targetUpgrade.sensorType, targetUpgrade.fromVersion, targetUpgrade.toVersion);
    setTargetUpgrade(null);
    onRefresh();
  };

  const statusBadges: Record<string, { label: string; style: string }> = {
    latest: { label: "Latest Release", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    stable: { label: "Stable", style: "bg-blue-50 text-blue-700 border-blue-200" },
    deprecated: { label: "Deprecated", style: "bg-amber-50 text-amber-700 border-amber-200" },
    beta: { label: "Beta Testing", style: "bg-purple-50 text-purple-700 border-purple-200" },
  };

  const typeColors: Record<string, string> = {
    Z: "bg-purple-50 text-purple-700 border-purple-200",
    TP: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Sigma: "bg-amber-50 text-amber-700 border-amber-200",
    Omega: "bg-cyan-50 text-cyan-700 border-cyan-200",
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden space-y-3">
      {/* Top Banner */}
      <div className="bg-white border border-slate-300 rounded p-2.5 shadow-xs flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Binary className="w-4 h-4 text-rose-600 shrink-0" />
          <div>
            <h2 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
              Sensor Firmware Releases & Version Management
            </h2>
            <p className="text-[10px] text-slate-500 whitespace-nowrap">
              Track versions specific to each sensor type, monitor deployment distribution, and roll out upgrades.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {/* Sensor Type Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded border border-slate-200">
            <button
              onClick={() => setSelectedSensorType("ALL")}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors whitespace-nowrap cursor-pointer ${
                selectedSensorType === "ALL" ? "bg-white text-rose-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Types
            </button>
            {sensorTypes.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedSensorType(t)}
                className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors whitespace-nowrap cursor-pointer ${
                  selectedSensorType === t ? "bg-white text-rose-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsReleasingFw(true)}
            className="flex items-center space-x-1 text-[11px] font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Release Firmware</span>
          </button>
        </div>
      </div>

      {/* Firmware Releases Grid */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {sensorTypes
          .filter(st => selectedSensorType === "ALL" || selectedSensorType === st)
          .map((st) => {
            const typeFws = firmwares
              .filter(f => f.sensor_type === st)
              .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));

            const typeSensors = sensors.filter(s => s.sensor_type === st);
            const latestFw = typeFws.find(f => f.status === "latest") || typeFws[0];

            return (
              <div key={st} className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
                {/* Header per Sensor Type */}
                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${typeColors[st]}`}>
                      Type {st}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {st === "Z" && "Vibration & Dynamic Monitoring"}
                      {st === "TP" && "Temperature & Pressure Sockets"}
                      {st === "Sigma" && "Torsional Strain & Torque Bridges"}
                      {st === "Omega" && "Triaxial High-G Accelerometers"}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-[10.5px]">
                    <span className="text-slate-500">
                      Total Active Sensors: <strong className="text-slate-900 font-mono">{typeSensors.length}</strong>
                    </span>
                    {latestFw && (
                      <span className="text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        Latest Target: <strong className="font-mono">{latestFw.version}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Table of Firmwares */}
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-1.5 whitespace-nowrap">Release Code</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Version</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Status</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Release Date</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Min HW</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Deployed Sensors</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Changelog Summary</th>
                      <th className="px-3 py-1.5 whitespace-nowrap text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {typeFws.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-slate-400 text-xs">
                          No firmware versions registered for Type {st}.
                        </td>
                      </tr>
                    ) : (
                      typeFws.map((fw) => {
                        const deployedCount = typeSensors.filter(s => s.fw_version === fw.version).length;
                        const statusBadge = statusBadges[fw.status] || { label: fw.status, style: "bg-slate-100 text-slate-700" };
                        const canUpgradeFromHere = fw.status !== "latest" && latestFw && deployedCount > 0 && fw.version !== latestFw.version;

                        return (
                          <tr key={fw.fw_code} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-3 py-2 whitespace-nowrap font-mono font-bold text-rose-700 text-[11px]">
                              {fw.fw_code}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono font-bold text-slate-900 text-[11px]">
                              {fw.version}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusBadge.style}`}>
                                {statusBadge.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-600">
                              {fw.release_date}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-slate-600">
                              {fw.min_hw_version}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                                deployedCount > 0
                                  ? fw.status === "latest"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-400 border-slate-200"
                              }`}>
                                {deployedCount} sensor{deployedCount === 1 ? "" : "s"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-600 max-w-xs truncate" title={fw.changelog}>
                              {fw.changelog || "—"}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {canUpgradeFromHere && (
                                <button
                                  onClick={() => setTargetUpgrade({
                                    sensorType: st,
                                    fromVersion: fw.version,
                                    toVersion: latestFw.version,
                                    count: deployedCount
                                  })}
                                  className="text-[10.5px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded inline-flex items-center space-x-1 transition-colors cursor-pointer"
                                  title={`Upgrade ${deployedCount} sensors from ${fw.version} to ${latestFw.version}`}
                                >
                                  <ArrowUpCircle className="w-3 h-3 text-rose-600" />
                                  <span>Upgrade to {latestFw.version}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
      </div>

      {/* Release New Firmware Side Drawer */}
      {isReleasingFw && (
        <>
          <div
            onClick={() => setIsReleasingFw(false)}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-200">
            <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5 whitespace-nowrap">
                <Binary className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Release Sensor Firmware Version</span>
              </h3>
              <button onClick={() => setIsReleasingFw(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRelease} className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Target Sensor Type</label>
                  <select
                    value={newFwType}
                    onChange={(e) => setNewFwType(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
                  >
                    <option value="Z">Z (Vibration/Dynamic)</option>
                    <option value="TP">TP (Temp/Pressure)</option>
                    <option value="Sigma">Sigma (Torsion/Strain)</option>
                    <option value="Omega">Omega (Triaxial Accel)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Version String (SemVer)</label>
                  <input
                    type="text"
                    placeholder="e.g. 1.4.3 or 2.2.0"
                    value={newFwVersion}
                    onChange={(e) => setNewFwVersion(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Release Status</label>
                    <select
                      value={newFwStatus}
                      onChange={(e) => setNewFwStatus(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
                    >
                      <option value="latest">Latest Target</option>
                      <option value="stable">Stable</option>
                      <option value="beta">Beta Testing</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Min HW Compatibility</label>
                    <input
                      type="text"
                      placeholder="e.g. v1.2"
                      value={newMinHw}
                      onChange={(e) => setNewMinHw(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Changelog & Release Notes</label>
                  <textarea
                    rows={4}
                    placeholder="Describe fixes, filter tuning, or new telemetry features..."
                    value={newChangelog}
                    onChange={(e) => setNewChangelog(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReleasingFw(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded shadow-2xs cursor-pointer"
                >
                  Publish Release
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Batch Upgrade Confirmation Side Drawer */}
      {targetUpgrade && (
        <>
          <div
            onClick={() => setTargetUpgrade(null)}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-200">
            <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5 whitespace-nowrap">
                <ArrowUpCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Confirm Sensor Firmware Upgrade</span>
              </h3>
              <button onClick={() => setTargetUpgrade(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-3 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Batch Firmware Flash Operation</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  You are about to upgrade <strong>{targetUpgrade.count}</strong> sensor(s) of Type <strong>{targetUpgrade.sensorType}</strong> from firmware version <strong className="font-mono">{targetUpgrade.fromVersion}</strong> to target release <strong className="font-mono">{targetUpgrade.toVersion}</strong>.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Affected Sensor Type:</span>
                  <span className="font-bold text-slate-800">{targetUpgrade.sensorType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Devices to Update:</span>
                  <span className="font-mono font-bold text-slate-800">{targetUpgrade.count} sensors</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Firmware:</span>
                  <span className="font-mono font-bold text-emerald-700">{targetUpgrade.toVersion}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setTargetUpgrade(null)}
                className="px-3 py-1.5 rounded text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteUpgrade}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded shadow-2xs cursor-pointer flex items-center space-x-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm & Upgrade</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
