import React from "react";
import { Cpu, Boxes, MapPin, QrCode, Lock, RefreshCw, Layers, Smartphone, Settings2, Users } from "lucide-react";
import { ViewDefinition } from "../types/schema";

interface NavbarProps {
  views: ViewDefinition[];
  activeViewId: string;
  onSelectView: (viewId: string) => void;
  onRefresh: () => void;
  onOpenImporter: () => void;
  onOpenPairing: () => void;
  onOpenSettings: () => void;
  isSettingsActive: boolean;
  activeLocksCount: number;
  currentUser: string;
  userRole: string;
}

const iconMap: Record<string, React.ReactNode> = {
  Cpu: <Cpu className="w-4 h-4" />,
  Boxes: <Boxes className="w-4 h-4" />,
  MapPin: <MapPin className="w-4 h-4" />,
  QrCode: <QrCode className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />
};

export const Navbar: React.FC<NavbarProps> = ({
  views,
  activeViewId,
  onSelectView,
  onRefresh,
  onOpenImporter,
  onOpenPairing,
  onOpenSettings,
  isSettingsActive,
  activeLocksCount,
  currentUser,
  userRole
}) => {
  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2.5">
              <span className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white font-mono font-black text-base px-2.5 py-1 rounded-lg tracking-wider shadow-md shadow-indigo-950/50 border border-indigo-400/20">
                ass.man
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-sm font-bold text-white tracking-tight">Asset Manager</h1>
                  <span className="text-[10px] font-mono uppercase bg-slate-800 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">
                    Engine
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Schema-Driven Orchestration & Field Terminal</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Driven by View Definitions) */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80">
            {views.map((v) => {
              const isActive = !isSettingsActive && v.id === activeViewId;
              const icon = (v.icon && iconMap[v.icon]) || <Layers className="w-4 h-4" />;
              return (
                <button
                  key={v.id}
                  onClick={() => onSelectView(v.id)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/50"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                  }`}
                >
                  {icon}
                  <span>{v.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Actions & Status */}
          <div className="flex items-center space-x-2.5">
            {/* Active Locks */}
            {activeLocksCount > 0 && (
              <div className="hidden sm:flex items-center space-x-1.5 text-xs bg-amber-950/40 text-amber-300 border border-amber-800/40 px-2 py-1 rounded">
                <Lock className="w-3.5 h-3.5" />
                <span>{activeLocksCount} Locked</span>
              </div>
            )}

            {/* User Badge */}
            <div className="hidden lg:flex items-center space-x-1.5 bg-slate-950/50 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="text-slate-200 font-medium">{currentUser}</span>
              <span className="text-[10px] text-slate-400 uppercase font-mono">({userRole})</span>
            </div>

            {/* Mobile Companion Pairing */}
            <button
              onClick={onOpenPairing}
              title="Pair Companion Phone"
              className="flex items-center space-x-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Pair Phone</span>
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              title="Refresh Workspace"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              title="Workspace Settings"
              className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
                isSettingsActive
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent hover:border-slate-700"
              }`}
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {/* Primary Action: Quick Ingestion */}
            <button
              onClick={onOpenImporter}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md shadow-indigo-950/50 transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Import Data</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
