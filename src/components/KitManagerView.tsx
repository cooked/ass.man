import React, { useState } from "react";
import { Boxes, Plus, Building2, X, ArrowRight } from "lucide-react";
import { KitAsset, SensorAsset, CustomerAsset } from "../types/schema";

interface KitManagerViewProps {
  kits: KitAsset[];
  sensors: SensorAsset[];
  customers: CustomerAsset[];
  onUpdateSensor: (sensor: SensorAsset) => Promise<void>;
  onSaveKit: (kit: KitAsset) => Promise<void>;
  onRefresh: () => void;
}

export const KitManagerView: React.FC<KitManagerViewProps> = ({
  kits,
  sensors,
  customers,
  onUpdateSensor,
  onSaveKit,
  onRefresh
}) => {
  const [selectedKitCode, setSelectedKitCode] = useState<string | null>(null);
  const [isCreatingKit, setIsCreatingKit] = useState(false);
  const [newKitCode, setNewKitCode] = useState("");
  const [newKitName, setNewKitName] = useState("");
  const [newKitMachine, setNewKitMachine] = useState("Industrial Gearbox");
  const [newKitCustomerId, setNewKitCustomerId] = useState("");
  const [newKitSpec, setNewKitSpec] = useState("1x Z, 2x TP, 1x Sigma");

  const availableSensors = sensors.filter(s => !s.kit_id || s.status === "in_stock" || s.status === "magazzino");

  const handleAddSensorToKit = async (sensor: SensorAsset, kitCode: string) => {
    const updated: SensorAsset = {
      ...sensor,
      kit_id: kitCode,
      status: "in_kit"
    };
    await onUpdateSensor(updated);
    onRefresh();
  };

  const handleRemoveSensorFromKit = async (sensor: SensorAsset) => {
    const updated: SensorAsset = {
      ...sensor,
      kit_id: "",
      status: "in_stock"
    };
    await onUpdateSensor(updated);
    onRefresh();
  };

  const handleCreateKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKitCode.trim() || !newKitName.trim()) return;

    const newKit: KitAsset = {
      kit_code: newKitCode.toUpperCase().trim(),
      kit_name: newKitName.trim(),
      target_machine: newKitMachine.trim(),
      customer_id: newKitCustomerId || "",
      status: "draft",
      expected_spec: newKitSpec.trim(),
      creation_date: new Date().toISOString().slice(0, 10),
      notes: "Created via Kit Manager"
    };

    await onSaveKit(newKit);
    setIsCreatingKit(false);
    setNewKitCode("");
    setNewKitName("");
    onRefresh();
  };

  const handleUpdateKitStatus = async (kit: KitAsset, newStatus: KitAsset["status"]) => {
    const updated: KitAsset = {
      ...kit,
      status: newStatus
    };
    await onSaveKit(updated);
    onRefresh();
  };

  const statusLabels: Record<string, { label: string; style: string }> = {
    draft: { label: "Draft / Assembly", style: "bg-amber-50 text-amber-700 border-amber-200" },
    ready_in_stock: { label: "Ready in Stock", style: "bg-blue-50 text-blue-700 border-blue-200" },
    shipped: { label: "Shipped", style: "bg-purple-50 text-purple-700 border-purple-200" },
    installed: { label: "Installed at Client", style: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden space-y-3">
      {/* Top Banner */}
      <div className="bg-white border border-slate-300 rounded p-2.5 shadow-xs flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Boxes className="w-4 h-4 text-rose-600 shrink-0" />
          <div>
            <h2 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">Kit Composition & Telemetry Bundles</h2>
            <p className="text-[10px] text-slate-500 whitespace-nowrap">Group sensors into modular packages, verify specs, and dispatch to client plants.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="text-[11px] text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
            <span>Free Sensors in Stock: </span>
            <span className="font-bold text-emerald-700 font-mono">{availableSensors.length}</span>
          </div>
          <button
            onClick={() => setIsCreatingKit(true)}
            className="flex items-center space-x-1 text-[11px] font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Kit</span>
          </button>
        </div>
      </div>

      {/* Grid of Kits */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pr-1">
        {kits.map((kit) => {
          const assignedSensors = sensors.filter(s => s.kit_id === kit.kit_code);
          const customer = customers.find(c => c.code === kit.customer_id);
          const statusInfo = statusLabels[kit.status] || { label: kit.status, style: "bg-slate-100 text-slate-700 border-slate-200" };

          return (
            <div
              key={kit.kit_code}
              className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden flex flex-col hover:border-slate-400 transition-colors"
            >
              {/* Header */}
              <div className="p-2.5 border-b border-slate-200 bg-slate-50/60 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5 whitespace-nowrap">
                    <span className="font-mono text-[11px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      {kit.kit_code}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 truncate">{kit.kit_name}</h3>
                  </div>
                  <div className="text-[10.5px] text-slate-500 flex items-center space-x-1 mt-1 truncate">
                    <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{customer ? `${customer.company_name} (${customer.city})` : "Unassigned Customer"}</span>
                  </div>
                </div>

                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${statusInfo.style}`}>
                  {statusInfo.label}
                </span>
              </div>

              {/* Spec & count */}
              <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-100 text-[10.5px] text-slate-600 flex items-center justify-between whitespace-nowrap">
                <span>Spec: <strong className="text-slate-800">{kit.expected_spec || "Custom"}</strong></span>
                <span className="font-bold text-rose-600 font-mono">{assignedSensors.length} sensors</span>
              </div>

              {/* Assigned Sensors List */}
              <div className="p-2.5 flex-1 space-y-1 overflow-y-auto max-h-40">
                {assignedSensors.length === 0 ? (
                  <div className="py-4 text-center border border-dashed border-slate-200 rounded text-[11px] text-slate-400">
                    No sensors assigned yet. Click "Add Sensor" below.
                  </div>
                ) : (
                  assignedSensors.map((sensor) => (
                    <div
                      key={sensor.serial_number}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 px-2 py-1 rounded text-[11px] whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1.5 overflow-hidden">
                        <span className="font-mono font-bold text-rose-700 text-[10.5px]">{sensor.sensor_type}</span>
                        <span className="font-mono text-slate-700">{sensor.serial_number}</span>
                        <span className="text-[9.5px] text-slate-400 font-mono">{sensor.fw_version}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveSensorFromKit(sensor)}
                        title="Remove from kit"
                        className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Actions Footer */}
              <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <select
                  value={kit.status}
                  onChange={(e) => handleUpdateKitStatus(kit, e.target.value as any)}
                  className="bg-white border border-slate-300 text-[10.5px] text-slate-700 rounded px-2 py-1 focus:outline-none focus:border-rose-600"
                >
                  <option value="draft">Draft / Assembly</option>
                  <option value="ready_in_stock">Ready in Stock</option>
                  <option value="shipped">Shipped</option>
                  <option value="installed">Installed at Client</option>
                </select>

                <button
                  onClick={() => setSelectedKitCode(kit.kit_code)}
                  className="text-[10.5px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded transition-colors flex items-center space-x-1 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Sensor</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sensor Assignment Side Drawer */}
      {selectedKitCode && (
        <>
          <div
            onClick={() => setSelectedKitCode(null)}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-200">
            <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5 whitespace-nowrap">
                <Boxes className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Assign Sensor to {selectedKitCode}</span>
              </h3>
              <button onClick={() => setSelectedKitCode(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {availableSensors.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-12">
                  No unassigned sensors available in warehouse.
                </p>
              ) : (
                availableSensors.map((s) => (
                  <div
                    key={s.serial_number}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded hover:border-rose-400 transition-colors whitespace-nowrap"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10.5px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                          {s.sensor_type}
                        </span>
                        <span className="font-mono text-xs text-slate-800 font-semibold">{s.serial_number}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        HW: {s.hw_version} | FW: {s.fw_version}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await handleAddSensorToKit(s, selectedKitCode);
                        setSelectedKitCode(null);
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <span>Assign</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedKitCode(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* New Kit Side Drawer */}
      {isCreatingKit && (
        <>
          <div
            onClick={() => setIsCreatingKit(false)}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-200">
            <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5 whitespace-nowrap">
                <Boxes className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Create New Sensor Kit</span>
              </h3>
              <button type="button" onClick={() => setIsCreatingKit(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKit} className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Kit Code</label>
                  <input
                    type="text"
                    placeholder="e.g. KIT-BFG-004"
                    value={newKitCode}
                    onChange={(e) => setNewKitCode(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 uppercase font-mono focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Kit Name / Application</label>
                  <input
                    type="text"
                    placeholder="e.g. HD Gearbox Vibration Kit"
                    value={newKitName}
                    onChange={(e) => setNewKitName(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Target Machine</label>
                  <input
                    type="text"
                    placeholder="e.g. Planetary Gearbox 300L"
                    value={newKitMachine}
                    onChange={(e) => setNewKitMachine(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Customer Facility</label>
                  <select
                    value={newKitCustomerId}
                    onChange={(e) => setNewKitCustomerId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
                  >
                    <option value="">— Unassigned (In Warehouse Stock) —</option>
                    {customers.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.company_name} ({c.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Composition Specification</label>
                  <input
                    type="text"
                    placeholder="e.g. 1x Z, 2x TP, 1x Sigma"
                    value={newKitSpec}
                    onChange={(e) => setNewKitSpec(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreatingKit(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded shadow-2xs cursor-pointer"
                >
                  Save Kit
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
