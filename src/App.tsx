import React, { useState, useEffect, useCallback } from "react";
import {
  AlertCircle, Loader2, Cpu, Boxes, MapPin, QrCode, Binary,
  FileSpreadsheet, Layers, Settings2, Smartphone, RefreshCw,
  Users, History, BarChart3, Database
} from "lucide-react";
import { SpreadsheetGrid } from "./components/SpreadsheetGrid";
import { KitManagerView } from "./components/KitManagerView";
import { CustomersMapView } from "./components/CustomersMapView";
import { UsersAndCustomersView } from "./components/UsersAndCustomersView";
import { FirmwareManagerView } from "./components/FirmwareManagerView";
import { SettingsView } from "./components/SettingsView";
import { MobilePairingModal } from "./components/MobilePairingModal";
import { MobileCompanionView } from "./components/MobileCompanionView";
import { DataMatrixImporterModal } from "./components/DataMatrixImporterModal";
import { AssetDetailModal } from "./components/AssetDetailModal";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { UserBadge } from "./components/UserBadge";
import { ViewDefinition, AssetSchema } from "./types/schema";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Cpu,
  Boxes,
  MapPin,
  QrCode,
  Users,
  Binary,
  FileSpreadsheet,
  Layers,
  Settings2,
  Smartphone,
  BarChart3,
  Database,
  History,
};

export default function App() {
  const [views, setViews] = useState<ViewDefinition[]>([]);
  const [schemas, setSchemas] = useState<AssetSchema[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [isSettingsActive, setIsSettingsActive] = useState<boolean>(false);
  const [appConfig, setAppConfig] = useState<any>(null);

  // Dynamic Assets Map: entityType -> array of assets
  const [assetsByType, setAssetsByType] = useState<Record<string, any[]>>({});
  const [activeLocks, setActiveLocks] = useState<any[]>([]);

  // Modals & UI States
  const [selectedAsset, setSelectedAsset] = useState<{ entityType: string; item: any } | null>(null);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isMobilePairingOpen, setIsMobilePairingOpen] = useState(false);
  const [isMobileViewActive, setIsMobileViewActive] = useState(() =>
    typeof window !== "undefined" &&
    (window.location.pathname === "/mobile" || window.location.search.includes("mobile"))
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("assman_currentUser");
      if (saved && saved.trim()) return saved.trim();
    }
    return "Stefano Cottafavi";
  });
  const [userRole, setUserRole] = useState<string>("Admin");

  // Fetch Metadata: Views, Schemas, App Config, Users
  const fetchMetadata = useCallback(async () => {
    try {
      setIsLoading(true);
      const [viewsRes, schemasRes, configRes, usersRes] = await Promise.all([
        fetch("/api/views"),
        fetch("/api/schemas"),
        fetch("/api/config"),
        fetch("/api/users")
      ]);
      const viewsData: ViewDefinition[] = await viewsRes.json();
      const schemasData: AssetSchema[] = await schemasRes.json();
      const configData = await configRes.json();
      const usersData = await usersRes.json();

      const orderKeys: string[] = configData?.viewsOrder || [
        "sensors_grid", "sensor", "sensors", "gear",
        "kits_management", "kit", "kits", "adventure",
        "firmware_management", "firmware",
        "customers_map", "customer", "customers", "map", "places_map", "place"
      ];

      const sortedViews = [...viewsData].sort((a, b) => {
        const getIdx = (v: ViewDefinition) => {
          const idx = orderKeys.findIndex(
            (o: string) => o.toLowerCase() === v.id?.toLowerCase() ||
                   o.toLowerCase() === v.targetAsset?.toLowerCase() ||
                   v.id?.toLowerCase().includes(o.toLowerCase())
          );
          return idx !== -1 ? idx : 999;
        };
        return getIdx(a) - getIdx(b);
      });

      setViews(sortedViews);
      setSchemas(schemasData);
      setAppConfig(configData);

      if (sortedViews.length > 0 && (!activeTab || !sortedViews.some(v => v.id === activeTab))) {
        setActiveTab(sortedViews[0].id);
      }

      if (configData.defaultUser && !localStorage.getItem("assman_currentUser")) {
        setCurrentUser(configData.defaultUser);
      }

      if (Array.isArray(usersData)) {
        setAllUsers(usersData);
        const matched = usersData.find((u: any) => u.username?.toLowerCase() === currentUser.toLowerCase());
        if (matched) setUserRole(matched.role);
      }
      setErrorMsg("");
    } catch (err: any) {
      setErrorMsg("Failed to connect to ass.man backend server.");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentUser]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // Load Data for all entities referenced by views
  const loadData = useCallback(async () => {
    if (schemas.length === 0) return;
    try {
      const targetEntities = Array.from(new Set(views.map(v => v.targetAsset).filter(Boolean)));
      // Also include any schemas that might not have a direct view
      schemas.forEach(s => {
        const ent = s.entity || s.id;
        if (ent && !targetEntities.includes(ent)) {
          targetEntities.push(ent);
        }
      });

      const promises = targetEntities.map(async ent => {
        try {
          const res = await fetch(`/api/assets/${ent}`);
          const data = await res.json();
          return { entity: ent, data: Array.isArray(data) ? data : [] };
        } catch {
          return { entity: ent, data: [] };
        }
      });

      const [assetsResults, locksRes] = await Promise.all([
        Promise.all(promises),
        fetch("/api/locks").catch(() => null)
      ]);

      const newMap: Record<string, any[]> = {};
      assetsResults.forEach(r => {
        newMap[r.entity] = r.data;
      });
      setAssetsByType(newMap);

      if (locksRes && locksRes.ok) {
        const locksData = await locksRes.json();
        setActiveLocks(Array.isArray(locksData) ? locksData : []);
      }
    } catch (err: any) {
      console.error("Error loading asset data:", err);
    }
  }, [schemas, views]);

  useEffect(() => {
    if (views.length > 0) {
      loadData();
    }
  }, [views, loadData]);

  // Periodic poll for collaborative locks (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const locksRes = await fetch("/api/locks");
        if (locksRes.ok) {
          const locksData = await locksRes.json();
          setActiveLocks(Array.isArray(locksData) ? locksData : []);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle active user change
  const handleUserChange = (newUser: string) => {
    setCurrentUser(newUser);
    if (typeof window !== "undefined") {
      localStorage.setItem("assman_currentUser", newUser);
    }
    const matched = allUsers.find((u: any) => u.username?.toLowerCase() === newUser.toLowerCase());
    if (matched) setUserRole(matched.role);

    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultUser: newUser })
    }).catch(() => {});
  };

  // If Mobile Companion URL is detected, render mobile-first AR scanner view
  if (isMobileViewActive) {
    return (
      <MobileCompanionView
        onClose={() => {
          setIsMobileViewActive(false);
          if (window.history && window.history.pushState) {
            window.history.pushState({}, "", "/");
          }
        }}
        currentUser={currentUser}
      />
    );
  }

  // First-Boot Onboarding Wizard when no schemas are detected
  if (!isLoading && schemas.length === 0) {
    return <OnboardingWizard onTemplateInstalled={fetchMetadata} />;
  }

  const currentView = views.find(v => v.id === activeTab);

  const shortName = appConfig?.appShortName || (appConfig?.appName?.toUpperCase().includes("BONFIGLIOLI") ? "BOM" : "ass.man");
  const appName = appConfig?.appName || "Bonfiglioli Object Manager";
  const brandColor = appConfig?.brandColor || (shortName === "BOM" ? "rose" : "indigo");
  const isRose = brandColor === "rose" || shortName === "BOM";

  // Calculate live asset statistics for the left sidebar
  const sensorsList = assetsByType["sensor"] || assetsByType["gear"] || [];
  const totalSensors = sensorsList.length;
  const inStockSensors = sensorsList.filter(
    (s) => s.status === "in_stock" || s.status === "magazzino" || !s.status
  ).length;
  const inKitSensors = sensorsList.filter((s) => s.status === "in_kit").length;
  const installedSensors = sensorsList.filter(
    (s) => s.status === "installed" || s.status === "installato_cliente"
  ).length;

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900 selection:bg-indigo-100 overflow-hidden">
      {/* Main Content Body */}
      <main className="flex-1 w-full px-6 py-4 min-h-0 overflow-hidden flex flex-col">
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-900 text-[11px] font-bold flex items-start space-x-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block uppercase tracking-wider text-[10px]">Server Connection Offline</span>
              {errorMsg}
            </div>
          </div>
        )}

        <div className="flex gap-3 items-stretch flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Switcher & Side controls (matching sal.vo) */}
          <div className="shrink-0 w-36 gap-3 h-full flex flex-col justify-start">
            {/* View Tab Switcher */}
            <div className="bg-white border border-slate-300 rounded p-1.5 shadow-xs space-y-1">
              <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider px-1.5 pt-1 pb-1">
                Navigation View
              </span>

              {views.map((v) => {
                const isActive = !isSettingsActive && activeTab === v.id;
                const IconComponent = iconMap[v.icon || ""] || Cpu;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setIsSettingsActive(false);
                      setActiveTab(v.id);
                    }}
                    className={`w-full flex items-center space-x-2 px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                      isActive
                        ? isRose
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap truncate">{v.shortTitle || v.title}</span>
                  </button>
                );
              })}

              <button
                onClick={() => setIsSettingsActive(true)}
                className={`w-full flex items-center space-x-2 px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                  isSettingsActive
                    ? isRose
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Settings</span>
              </button>
            </div>

            {/* Asset Status Overview Box */}
            <div className="bg-white border border-slate-300 rounded p-2 shadow-xs space-y-1.5">
              <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
                Asset Status
              </span>

              <div className="space-y-1.5 text-[10px] font-bold uppercase text-slate-600">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    Sensors
                  </span>
                  <span className="font-mono text-slate-900 font-extrabold">{totalSensors}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    In Stock
                  </span>
                  <span className="font-mono text-emerald-700 font-extrabold">{inStockSensors}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    In Kit
                  </span>
                  <span className="font-mono text-amber-700 font-extrabold">{inKitSensors}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    At Client
                  </span>
                  <span className="font-mono text-blue-700 font-extrabold">{installedSensors}</span>
                </div>

                {activeLocks.length > 0 && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isRose ? "bg-rose-600" : "bg-indigo-600"} animate-pulse`}></span>
                      Locked
                    </span>
                    <span className="font-mono text-rose-700 font-extrabold">{activeLocks.length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Operations / Quick Controls Box */}
            <div className="bg-white border border-slate-300 rounded p-1.5 shadow-xs space-y-1">
              <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider px-1.5 pt-1 pb-1">
                Operations
              </span>

              <button
                onClick={() => setIsImporterOpen(true)}
                className="w-full flex items-center space-x-2 px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-all cursor-pointer"
                title="Import DataMatrix Scanner Scans"
              >
                <QrCode className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="whitespace-nowrap">Import Scans</span>
              </button>

              <button
                onClick={() => setIsMobilePairingOpen(true)}
                className="w-full flex items-center space-x-2 px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-all cursor-pointer"
                title="Pair Companion Camera Scanner"
              >
                <Smartphone className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="whitespace-nowrap">Pair Phone</span>
              </button>

              <button
                onClick={() => {
                  setIsRefreshing(true);
                  loadData().finally(() => setTimeout(() => setIsRefreshing(false), 500));
                }}
                className="w-full flex items-center space-x-2 px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-all cursor-pointer"
                title="Refresh All Asset Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="whitespace-nowrap">Refresh</span>
              </button>
            </div>

            {/* Bottom Section: Current User & Unified Brand/Revision Badge */}
            <div className="mt-auto flex flex-col gap-1.5 shrink-0">
              <UserBadge
                currentUser={currentUser}
                userRole={userRole}
                allUsers={allUsers}
                brandColor={brandColor}
              />

              {/* Unified Brand & Revision Badge */}
              <div className="w-full flex items-center justify-center" title={`${appName}`}>
                <div className="inline-flex items-center rounded border border-slate-300 overflow-hidden shadow-2xs text-[9px] w-full">
                  <span className={`${isRose ? "bg-rose-600" : "bg-slate-700"} text-white font-bold px-1.5 py-0.5 tracking-tight shrink-0`}>
                    {shortName}
                  </span>
                  <span className="bg-slate-100 text-slate-600 font-mono font-medium px-1.5 py-0.5 border-l border-slate-300 truncate flex-1 text-right">
                    v1.2.0
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Main Content Area */}
          <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
            {isLoading && views.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                <Loader2 className={`w-8 h-8 animate-spin ${isRose ? "text-rose-500" : "text-indigo-500"} mb-3`} />
                <p className="text-sm font-medium">Booting {shortName} workspace engine...</p>
              </div>
            ) : isSettingsActive ? (
              <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                <SettingsView
                  activeLocks={activeLocks}
                  onForceUnlock={async (assetType: string, assetId: string) => {
                    await fetch("/api/locks/force-unlock", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ assetType, assetId })
                    });
                    loadData();
                  }}
                  currentUser={currentUser}
                  onUserChange={handleUserChange}
                  onRefresh={loadData}
                />
              </div>
            ) : currentView ? (
              <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                {currentView.renderer === "spreadsheet-grid" && (
                  <div className="flex-1 overflow-hidden min-h-0">
                    <SpreadsheetGrid
                      view={currentView}
                      data={assetsByType[currentView.targetAsset] || []}
                      onSelectRow={(item) => setSelectedAsset({ entityType: currentView.targetAsset, item })}
                      onNewItem={() => setIsImporterOpen(true)}
                    />
                  </div>
                )}

                {currentView.renderer === "kit-manager" && (
                  <div className="flex-1 overflow-hidden min-h-0">
                    <KitManagerView
                      kits={assetsByType[currentView.targetAsset] || []}
                      sensors={assetsByType["gear"] || assetsByType["sensor"] || []}
                      customers={assetsByType["place"] || assetsByType["customer"] || []}
                      onUpdateSensor={async (updated) => {
                        const ent = updated.code ? "gear" : "sensor";
                        const id = updated.code || updated.serial_number;
                        await fetch(`/api/assets/${ent}/${id}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(updated)
                        });
                      }}
                      onSaveKit={async (kit) => {
                        const ent = currentView.targetAsset;
                        const id = kit.adventure_code || kit.kit_code;
                        await fetch(`/api/assets/${ent}/${id}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(kit)
                        });
                      }}
                      onRefresh={loadData}
                    />
                  </div>
                )}

                {currentView.renderer === "firmware-manager" && (
                  <div className="flex-1 overflow-hidden min-h-0">
                    <FirmwareManagerView
                      firmwares={assetsByType["firmware"] || []}
                      sensors={assetsByType["sensor"] || assetsByType["gear"] || []}
                      onSaveFirmware={async (fw) => {
                        await fetch(`/api/assets/firmware/${fw.fw_code}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(fw)
                        });
                        loadData();
                      }}
                      onBatchUpgradeSensors={async (sensorType, fromVersion, toVersion) => {
                        const targetSensors = (assetsByType["sensor"] || []).filter(
                          s => s.sensor_type === sensorType && s.fw_version === fromVersion
                        );
                        for (const s of targetSensors) {
                          await fetch(`/api/assets/sensor/${s.serial_number}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ...s, fw_version: toVersion })
                          });
                        }
                        loadData();
                      }}
                      onRefresh={loadData}
                    />
                  </div>
                )}

                {currentView.renderer === "customers-map" && (
                  <div className="flex-1 overflow-hidden min-h-0">
                    <CustomersMapView
                      customers={assetsByType[currentView.targetAsset] || []}
                      kits={assetsByType["adventure"] || assetsByType["kit"] || []}
                      sensors={assetsByType["gear"] || assetsByType["sensor"] || []}
                    />
                  </div>
                )}

                {(currentView.renderer === "users-manager" || (currentView as any).renderer === "users_and_customers") && (
                  <div className="flex-1 overflow-hidden min-h-0">
                    <UsersAndCustomersView
                      currentUser={currentUser}
                      onUserChange={handleUserChange}
                      customers={assetsByType[currentView.targetAsset] || []}
                      kits={assetsByType["adventure"] || assetsByType["kit"] || []}
                      sensors={assetsByType["gear"] || assetsByType["sensor"] || []}
                      onRefresh={loadData}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">No view selected.</div>
            )}
          </div>
        </div>
      </main>

      {/* Asset Detail & Edit Modal */}
      {selectedAsset && (
        <AssetDetailModal
          sensor={selectedAsset.item}
          schema={schemas.find(s => (s.entity || s.id) === selectedAsset.entityType) as any}
          currentUser={currentUser}
          onClose={() => setSelectedAsset(null)}
          onSave={async (updated) => {
            const id = updated.code || updated.serial_number || updated.id;
            await fetch(`/api/assets/${selectedAsset.entityType}/${id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updated)
            });
            setSelectedAsset(null);
            loadData();
          }}
          onDelete={async (id) => {
            await fetch(`/api/assets/${selectedAsset.entityType}/${id}`, {
              method: "DELETE"
            });
            setSelectedAsset(null);
            loadData();
          }}
        />
      )}

      {/* DataMatrix Importer Modal */}
      {isImporterOpen && (
        <DataMatrixImporterModal
          isOpen={isImporterOpen}
          onClose={() => setIsImporterOpen(false)}
          onImportSuccess={loadData}
          kits={assetsByType["adventure"] || assetsByType["kit"] || []}
        />
      )}

      {/* Companion Phone QR Pairing Modal */}
      {isMobilePairingOpen && (
        <MobilePairingModal
          isOpen={isMobilePairingOpen}
          onClose={() => setIsMobilePairingOpen(false)}
          currentUser={currentUser}
          onOpenMobileView={() => {
            setIsMobilePairingOpen(false);
            setIsMobileViewActive(true);
          }}
        />
      )}
    </div>
  );
}
