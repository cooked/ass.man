import React, { useState, useEffect } from "react";
import { QrCode, Lock, Save, Trash2, X } from "lucide-react";
import { SensorAsset, KitAsset, CustomerAsset } from "../types/schema";

interface AssetDetailModalProps {
  sensor: SensorAsset | null;
  isOpen?: boolean;
  onClose: () => void;
  kits?: KitAsset[];
  customers?: CustomerAsset[];
  schema?: any;
  currentUser?: string;
  onSave: (updated: SensorAsset) => Promise<void>;
  onDelete: (serialNumber: string) => Promise<void>;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  sensor,
  isOpen = true,
  onClose,
  kits = [],
  customers = [],
  onSave,
  onDelete
}) => {
  if (!isOpen || !sensor) return null;

  return (
    <AssetDetailModalContent
      sensor={sensor}
      onClose={onClose}
      kits={kits}
      customers={customers}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
};

const AssetDetailModalContent: React.FC<Omit<AssetDetailModalProps, "isOpen"> & { sensor: SensorAsset }> = ({
  sensor,
  onClose,
  kits,
  customers,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<SensorAsset>({ ...sensor });
  const [isSaving, setIsSaving] = useState(false);
  const [lockStatus, setLockStatus] = useState<{ acquired: boolean; message?: string }>({ acquired: true });

  useEffect(() => {
    let isMounted = true;
    const acquire = async () => {
      try {
        const res = await fetch(`/api/assets/sensor/${sensor.serial_number}/lock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "operator-ui", userName: "You (Operator)" })
        });
        const data = await res.json();
        if (isMounted) {
          setLockStatus({ acquired: data.success, message: data.message });
        }
      } catch {}
    };

    acquire();

    return () => {
      isMounted = false;
      fetch(`/api/assets/sensor/${sensor.serial_number}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "operator-ui" })
      }).catch(() => {});
    };
  }, [sensor.serial_number]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete sensor ${sensor.serial_number}?`)) {
      await onDelete(sensor.serial_number);
      onClose();
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
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden border-l border-slate-300 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded border border-rose-200 shrink-0">
              <QrCode className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <h3 className="text-xs font-bold text-slate-900 font-mono truncate">{sensor.serial_number}</h3>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 uppercase shrink-0">
                  {formData.sensor_type}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 whitespace-nowrap">Bonfiglioli IoT Sensor Asset Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lock Warning */}
        {!lockStatus.acquired && (
          <div className="mx-4 mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[10.5px] flex items-center space-x-1.5 whitespace-nowrap shrink-0">
            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{lockStatus.message || "Asset currently locked by another operator."}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Sensor Type</label>
                <select
                  value={formData.sensor_type}
                  onChange={(e) => setFormData({ ...formData, sensor_type: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
                >
                  <option value="Z">Z (Vibration)</option>
                  <option value="TP">TP (Temp/Pressure)</option>
                  <option value="Sigma">Sigma (Torsion/Strain)</option>
                  <option value="Omega">Omega (Triaxial Accel)</option>
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
                >
                  <option value="in_stock">In Warehouse (Free)</option>
                  <option value="in_kit">In Kit</option>
                  <option value="installed">Installed at Client</option>
                  <option value="faulty">Faulty / RMA</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">HW Version</label>
                <input
                  type="text"
                  value={formData.hw_version}
                  onChange={(e) => setFormData({ ...formData, hw_version: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 font-mono focus:border-rose-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">FW Version</label>
                <input
                  type="text"
                  value={formData.fw_version}
                  onChange={(e) => setFormData({ ...formData, fw_version: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 font-mono focus:border-rose-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Kit Assignment</label>
              <select
                value={formData.kit_id || ""}
                onChange={(e) => {
                  const newKitId = e.target.value;
                  setFormData({
                    ...formData,
                    kit_id: newKitId,
                    status: newKitId ? "in_kit" : (formData.status === "in_kit" ? "in_stock" : formData.status)
                  });
                }}
                className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
              >
                <option value="">— Unassigned (Free Sensor in Warehouse) —</option>
                {kits.map((k) => (
                  <option key={k.kit_code} value={k.kit_code}>
                    {k.kit_code} — {k.kit_name} ({k.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Scan Date</label>
              <input
                type="date"
                value={formData.scan_date || ""}
                onChange={(e) => setFormData({ ...formData, scan_date: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Technical Notes</label>
              <textarea
                rows={4}
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded p-2 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Sticky Drawer Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-red-600 hover:text-red-700 flex items-center space-x-1 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !lockStatus.acquired}
                className="flex items-center space-x-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};
