import React, { useState, useEffect, useCallback } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Navbar } from "./components/Navbar";
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
import { ViewDefinition, AssetSchema } from "./types/schema";

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
  const [errorMsg, setErrorMsg] = useState("");

  const [currentUser, setCurrentUser] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("assman_currentUser");
      if (saved && saved.trim()) return saved.trim();
    }
    return "Alex Rivers";
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

      setViews(viewsData);
      setSchemas(schemasData);
      setAppConfig(configData);

      if (viewsData.length > 0 && (!activeTab || !viewsData.some(v => v.id === activeTab))) {
        setActiveTab(viewsData[0].id);
      }

      if (configData.defaultUser && !localStorage.getItem("assman_currentUser")) {
        setCurrentUser(configData.defaultUser);
      }

      if (Array.isArray(usersData)) {
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

  // Handle active user change
  const handleUserChange = (newUser: string) => {
    setCurrentUser(newUser);
    if (typeof window !== "undefined") {
      localStorage.setItem("assman_currentUser", newUser);
    }
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
      />
    );
  }

  // First-Boot Onboarding Wizard when no schemas are detected
  if (!isLoading && schemas.length === 0) {
    return <OnboardingWizard onTemplateInstalled={fetchMetadata} />;
  }

  const currentView = views.find(v => v.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navigation Header */}
      <Navbar
        views={views}
        activeViewId={activeTab}
        onSelectView={(id) => {
          setIsSettingsActive(false);
          setActiveTab(id);
        }}
        onRefresh={loadData}
        onOpenImporter={() => setIsImporterOpen(true)}
        onOpenPairing={() => setIsMobilePairingOpen(true)}
        onOpenSettings={() => setIsSettingsActive(prev => !prev)}
        isSettingsActive={isSettingsActive}
        activeLocksCount={activeLocks.length}
        currentUser={currentUser}
        userRole={userRole}
        appConfig={appConfig}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {isLoading && views.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm font-medium">Booting ass.man workspace engine...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center space-x-3 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : isSettingsActive ? (
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
          />
        ) : currentView ? (
          <div className="flex-1 flex flex-col">
            {/* View Sub-Header */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">{currentView.title}</h2>
                {currentView.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{currentView.description}</p>
                )}
              </div>
              <div className="text-xs font-mono text-slate-500 bg-slate-900/60 px-2.5 py-1 rounded border border-slate-800">
                target: <span className="text-indigo-400 font-semibold">{currentView.targetAsset}</span>
              </div>
            </div>

            {/* Dynamic View Component Dispatcher */}
            {currentView.renderer === "spreadsheet-grid" && (
              <SpreadsheetGrid
                view={currentView}
                data={assetsByType[currentView.targetAsset] || []}
                onSelectRow={(item) => setSelectedAsset({ entityType: currentView.targetAsset, item })}
              />
            )}

            {currentView.renderer === "kit-manager" && (
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
            )}

            
            {currentView.renderer === "firmware-manager" && (
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
            )}

            {currentView.renderer === "customers-map" && (
              <CustomersMapView
                customers={assetsByType[currentView.targetAsset] || []}
                kits={assetsByType["adventure"] || assetsByType["kit"] || []}
                sensors={assetsByType["gear"] || assetsByType["sensor"] || []}
              />
            )}

            {(currentView.renderer === "users-manager" || (currentView as any).renderer === "users_and_customers") && (
              <UsersAndCustomersView
                customers={assetsByType[currentView.targetAsset] || []}
                kits={assetsByType["adventure"] || assetsByType["kit"] || []}
                sensors={assetsByType["gear"] || assetsByType["sensor"] || []}
                onRefresh={loadData}
              />
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">No view selected.</div>
        )}
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
        />
      )}
    </div>
  );
}
