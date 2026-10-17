import React, { useState, useEffect } from "react";
import {
  Settings, FolderOpen, Clock, User, Lock, Unlock,
  CheckCircle2, Save, RefreshCw, AlertCircle, Database,
  Cpu, Boxes, Binary, Building2, Shield, Loader2,
  Smartphone, Wifi, Trash2, Check, ExternalLink, Activity
} from "lucide-react";

interface SettingsViewProps {
  currentUser: string;
  onUserChange?: (username: string) => void;
  onRefresh: () => void;
  activeLocks: any[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onUserChange,
  onRefresh,
  activeLocks
}) => {
  const [dataPath, setDataPath] = useState("./data");
  const [lockTimeoutMinutes, setLockTimeoutMinutes] = useState(10);
  const [selectedUser, setSelectedUser] = useState(currentUser);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Paired Companion Devices state
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);

  const loadPairedDevices = async () => {
    setIsRefreshingDevices(true);
    try {
      const res = await fetch("/api/companion/devices");
      const data = await res.json();
      setPairedDevices(data || []);
    } catch {}
    finally {
      setIsRefreshingDevices(false);
    }
  };

  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(cfg => {
        if (cfg.dataPath) setDataPath(cfg.dataPath);
        if (cfg.lockTimeoutMinutes) setLockTimeoutMinutes(cfg.lockTimeoutMinutes);
        if (cfg.defaultUser) setSelectedUser(cfg.defaultUser);
      })
      .catch(() => {});

    fetch("/api/users")
      .then(res => res.json())
      .then(users => setAllUsers(users || []))
      .catch(() => {});

    loadPairedDevices();
  }, []);

  useEffect(() => {
    setSelectedUser(currentUser);
  }, [currentUser]);

  const handleBrowseFolder = async () => {
    setIsBrowsing(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/browse-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startPath: dataPath || undefined })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.path) {
          setDataPath(data.path);
        }
      }
    } catch {
      setErrorMessage("Could not launch native folder picker. You can edit the path manually.");
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataPath: dataPath.trim(),
          lockTimeoutMinutes: Number(lockTimeoutMinutes),
          defaultUser: selectedUser
        })
      });

      if (res.ok) {
        if (onUserChange && selectedUser !== currentUser) {
          onUserChange(selectedUser);
        }
        setSavedMessage("System settings and operator profile updated successfully.");
        setTimeout(() => setSavedMessage(null), 3500);
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Failed to persist configuration.");
      }
    } catch {
      setErrorMessage("Network error while saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleForceUnlock = async (lock: any) => {
    if (confirm(`Force release lock on ${lock.assetType} ${lock.assetId} held by ${lock.userName}?`)) {
      await fetch("/api/locks/force-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType: lock.assetType, assetId: lock.assetId })
      });
      onRefresh();
    }
  };

  const handleUnpairDevice = async (deviceId: string, deviceName: string) => {
    if (confirm(`Forget and unpair companion device "${deviceName}"?`)) {
      await fetch(`/api/companion/devices/${encodeURIComponent(deviceId)}`, {
        method: "DELETE"
      });
      loadPairedDevices();
    }
  };

  return (
    <div className="h-full flex flex-col space-y-2.5 overflow-hidden font-sans">
      {savedMessage && (
        <div className="p-2 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 text-xs font-bold flex items-center space-x-1.5 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-2 bg-red-50 border border-red-300 rounded text-red-800 text-xs font-bold flex items-center space-x-1.5 shrink-0">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {/* Workspace Form Card (Compact Single-Row Fields) */}
        <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>Storage & Runtime Environment</span>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                Local filesystem or cloud-synced storage directory
              </span>
              <button
                type="button"
                onClick={() => { onRefresh(); loadPairedDevices(); }}
                className="flex items-center space-x-1 text-[10.5px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-2 py-0.5 rounded transition-colors cursor-pointer"
                title="Refresh All Settings & Devices"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveConfig} className="p-3">
            <div className="flex items-end gap-3 flex-wrap lg:flex-nowrap">
              {/* Field 1: Storage Path */}
              <div className="flex-1 min-w-[240px]">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Data Storage Directory Path
                </label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={dataPath}
                    onChange={(e) => setDataPath(e.target.value)}
                    placeholder="./data"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:bg-white focus:border-rose-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    disabled={isBrowsing}
                    className="flex items-center space-x-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-1.5 rounded transition-colors cursor-pointer shrink-0"
                  >
                    {isBrowsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                    <span>Browse...</span>
                  </button>
                </div>
              </div>

              {/* Field 2: Lock Expiration Timeout */}
              <div className="w-36 shrink-0">
                <label className="text-[11px] font-bold text-slate-700 block mb-1 truncate" title="Lock Expiration Timeout (Minutes)">
                  Lock Timeout (min)
                </label>
                <div className="relative flex items-center">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={lockTimeoutMinutes}
                    onChange={(e) => setLockTimeoutMinutes(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded pl-8 pr-2 py-1.5 text-xs text-slate-800 font-mono focus:bg-white focus:border-rose-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Field 3: Active Operator Account */}
              <div className="w-64 shrink-0">
                <label className="text-[11px] font-bold text-slate-700 block mb-1 truncate">
                  Active Operator Account
                </label>
                <div className="relative flex items-center">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-800 font-bold focus:bg-white focus:border-rose-600 focus:outline-none truncate"
                  >
                    {allUsers.map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.name ? `${u.name} ${u.surname || ""}` : u.username} ({u.role})
                      </option>
                    ))}
                    {!allUsers.some(u => u.username === selectedUser) && (
                      <option value={selectedUser}>{selectedUser}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Action Button: Save Configuration */}
              <div className="shrink-0">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded shadow-2xs transition-colors cursor-pointer h-[32px] whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Saving..." : "Save Config"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

                {/* PAIRED COMPANION PHONES & MOBILE TERMINALS CARD */}
        <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
          <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-3.5 h-3.5 text-rose-600" />
              <span>Paired Companion Phones & Mobile Terminals ({pairedDevices.length})</span>
            </div>
            <button
              onClick={loadPairedDevices}
              className="text-[10.5px] text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshingDevices ? "animate-spin" : ""}`} />
              <span>Refresh Terminals</span>
            </button>
          </div>

          <div className="p-3 bg-slate-50/50 border-b border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              Smartphones and handheld Android terminals authorized to scan DataMatrix codes into BOM via local Wi-Fi.
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Auto-registers when phone opens mobile scanner
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-2 whitespace-nowrap">Device Model / Name</th>
                <th className="px-3.5 py-2 whitespace-nowrap">IP & Viewport</th>
                <th className="px-3.5 py-2 whitespace-nowrap">Operator</th>
                <th className="px-3.5 py-2 whitespace-nowrap">Status & Last Seen</th>
                <th className="px-3.5 py-2 whitespace-nowrap text-center">Scans Synced</th>
                <th className="px-3.5 py-2 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pairedDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                    No companion phones paired yet. Click "Pair Phone" in the left sidebar to connect an Android device.
                  </td>
                </tr>
              ) : (
                pairedDevices.map((dev) => {
                  const isOnline = dev.status === "online";
                  const lastSeenTime = dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleTimeString() : "-";
                  const firstDate = dev.firstPairedAt ? new Date(dev.firstPairedAt).toLocaleDateString() : "-";

                  return (
                    <tr key={dev.deviceId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                            isOnline ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-slate-100 text-slate-500 border-slate-300"
                          }`}>
                            <Smartphone className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5 whitespace-nowrap">
                              <span>{dev.deviceName}</span>
                              {isOnline && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              {dev.platform || "Android"} • {dev.browser || "Mobile Browser"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {dev.ipAddress || "Wi-Fi LAN"}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                          {dev.screenResolution || "Mobile Viewport"}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-slate-800">
                        {dev.operator || "Operator"}
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {isOnline ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Active Now ({lastSeenTime})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>Offline (Last: {lastSeenTime})</span>
                          </span>
                        )}
                        <span className="text-[9.5px] text-slate-400 block mt-0.5">
                          Paired: {firstDate}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                        <span className="inline-flex items-center space-x-1 font-mono text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <Activity className="w-3 h-3 text-rose-600" />
                          <span>{dev.scansCount || 0} Scans</span>
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleUnpairDevice(dev.deviceId, dev.deviceName)}
                          title="Forget and unpair this phone"
                          className="text-[10px] font-bold uppercase text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded transition-colors cursor-pointer inline-flex items-center space-x-1"
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                          <span>Unpair</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Active Collaborative Locks Table Card */}
        <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
          <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Active Collaborative Locks ({activeLocks.length})</span>
            </div>
            <span className="text-[10.5px] text-slate-400 font-normal">
              Collision prevention locks currently held on shared assets
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-1.5 whitespace-nowrap">Asset Type</th>
                <th className="px-3.5 py-1.5 whitespace-nowrap">Asset ID</th>
                <th className="px-3.5 py-1.5 whitespace-nowrap">Locked By Operator</th>
                <th className="px-3.5 py-1.5 whitespace-nowrap">Acquired Time</th>
                <th className="px-3.5 py-1.5 whitespace-nowrap">Last Heartbeat</th>
                <th className="px-3.5 py-1.5 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeLocks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                    No active locks held. All asset records are free for editing.
                  </td>
                </tr>
              ) : (
                activeLocks.map((lock, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3.5 py-2 whitespace-nowrap font-bold text-slate-700 uppercase text-[10.5px]">
                      {lock.assetType}
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap font-mono font-bold text-rose-700 text-[11px]">
                      {lock.assetId}
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap text-slate-800 font-medium">
                      {lock.userName} ({lock.userId})
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap text-slate-500 text-[11px]">
                      {new Date(lock.acquiredAt).toLocaleTimeString()}
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap text-slate-500 text-[11px]">
                      {new Date(lock.heartbeatAt).toLocaleTimeString()}
                    </td>
                    <td className="px-3.5 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleForceUnlock(lock)}
                        className="text-[10px] font-bold uppercase text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded transition-colors cursor-pointer inline-flex items-center space-x-1"
                      >
                        <Unlock className="w-3 h-3 text-red-600" />
                        <span>Force Unlock</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* System Architecture & Engine Diagnostics Card */}
        <div className="bg-white border border-slate-300 rounded shadow-xs p-4 space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            <Database className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              System Architecture & Diagnostics
            </h3>
          </div>

          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Metamodel Schemas</div>
              <div className="font-bold text-slate-800 mt-1 flex items-center space-x-1">
                <Boxes className="w-3.5 h-3.5 text-rose-600" />
                <span>4 Asset Entities</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Sensor, Kit, Customer, Firmware</div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Storage Engine</div>
              <div className="font-bold text-slate-800 mt-1 flex items-center space-x-1">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>File-based JSON Atomic</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Zero external DB dependency</div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Scanner Parser</div>
              <div className="font-bold text-slate-800 mt-1 flex items-center space-x-1">
                <Binary className="w-3.5 h-3.5 text-blue-600" />
                <span>ISO/IEC 16022 Ingestion</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Android camera batch files</div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lock Manager</div>
              <div className="font-bold text-slate-800 mt-1 flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Distributed Heartbeat TTL</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Prevents editing collisions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
