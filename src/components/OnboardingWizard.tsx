import React, { useState } from "react";
import { Sparkles, Users, Cpu, Server, PlusCircle, CheckCircle, ArrowRight, Loader2 } from "lucide-react";

interface OnboardingWizardProps {
  onTemplateInstalled: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onTemplateInstalled }) => {
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const handleInstallTemplate = async (templateId: string) => {
    setLoadingTemplate(templateId);
    setStatusMsg(`Injecting ${templateId} schema pack...`);
    try {
      const res = await fetch("/api/templates/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg("Template activated! Reloading workspace...");
        setTimeout(() => {
          onTemplateInstalled();
        }, 800);
      } else {
        setStatusMsg(`Failed: ${data.error || "Unknown error"}`);
        setLoadingTemplate(null);
      }
    } catch (err: any) {
      setStatusMsg(`Connection error: ${err.message}`);
      setLoadingTemplate(null);
    }
  };

  const templates = [
    {
      id: "friends-gear",
      title: "Friends, Places & Gear",
      badge: "Community & Outdoor",
      description: "Manage crew members, hangout destinations on Leaflet maps, shared gear with DataMatrix tags, and pack slot checklists.",
      icon: <Users className="w-6 h-6 text-indigo-400" />,
      color: "from-indigo-900/40 to-slate-900/80 border-indigo-700/50 hover:border-indigo-500",
      accent: "bg-indigo-600 hover:bg-indigo-500 text-white",
      schemas: ["person.schema.json", "place.schema.json", "gear.schema.json", "adventure.schema.json"],
      views: ["gear-inventory", "adventure-packs", "places-map", "crew-roster"]
    },
    {
      id: "industrial-iot",
      title: "Industrial IoT & Hardware BOM",
      badge: "Manufacturing & Field",
      description: "Track vibration/temp sensors, assembled modular kits, customer plant telemetry maps, and firmware releases.",
      icon: <Cpu className="w-6 h-6 text-rose-400" />,
      color: "from-rose-900/40 to-slate-900/80 border-rose-700/50 hover:border-rose-500",
      accent: "bg-rose-600 hover:bg-rose-500 text-white",
      schemas: ["sensor.schema.json", "kit.schema.json", "customer.schema.json", "firmware.schema.json"],
      views: ["sensors_grid", "kits_management", "customers_map", "firmware_management"]
    },
    {
      id: "it-assets",
      title: "IT & Datacenter Infrastructure",
      badge: "Enterprise IT",
      description: "Catalog servers, switches, workstations, rack slots, and peripheral allocations across office locations.",
      icon: <Server className="w-6 h-6 text-emerald-400" />,
      color: "from-emerald-900/40 to-slate-900/80 border-emerald-700/50 hover:border-emerald-500",
      accent: "bg-emerald-600 hover:bg-emerald-500 text-white",
      schemas: ["server.schema.json", "device.schema.json", "location.schema.json"],
      views: ["devices_grid", "datacenter_map", "servers_rack"]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        {/* Hero Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center space-x-2 bg-indigo-950/80 border border-indigo-500/30 px-3.5 py-1.5 rounded-full text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4 shadow-inner">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>First-Boot Metamodel Wizard</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-3">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">ass.man</span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            The schema-driven, zero-database asset orchestration engine. Your workspace currently has no active schemas. Select a domain pack below to get started in seconds.
          </p>
        </div>

        {statusMsg && (
          <div className="mb-6 p-4 rounded-xl bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-center space-x-3 text-indigo-200 text-sm">
            {loadingTemplate ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />}
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`rounded-2xl border bg-gradient-to-b ${tpl.color} p-6 flex flex-col justify-between transition-all duration-200 shadow-xl backdrop-blur-sm`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-md">
                    {tpl.icon}
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {tpl.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{tpl.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {tpl.description}
                </p>

                <div className="space-y-1.5 border-t border-slate-800/80 pt-3 mb-6">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Schemas Included:</div>
                  <div className="flex flex-wrap gap-1">
                    {tpl.schemas.map(s => (
                      <span key={s} className="text-[10px] font-mono bg-slate-900/90 text-slate-300 px-1.5 py-0.5 rounded border border-slate-800">
                        {s.replace(".schema.json", "")}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                disabled={!!loadingTemplate}
                onClick={() => handleInstallTemplate(tpl.id)}
                className={`w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-lg ${tpl.accent} disabled:opacity-50 cursor-pointer`}
              >
                {loadingTemplate === tpl.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activating...</span>
                  </>
                ) : (
                  <>
                    <span>Install Starter Pack</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Blank Slate Option */}
        <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center bg-slate-900/40">
          <p className="text-xs text-slate-400 mb-2">
            Prefer to define your own JSON Schemas manually?
          </p>
          <div className="text-xs font-mono text-slate-300">
            Create any <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">*.schema.json</code> file in your <code className="text-slate-200">./schemas</code> folder.
          </div>
        </div>
      </div>
    </div>
  );
};
