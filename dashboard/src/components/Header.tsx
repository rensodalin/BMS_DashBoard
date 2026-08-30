import React, { useState, useEffect } from 'react';
import { Menu, Plus, RefreshCw, Download, MapPin, Calendar, Info } from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
  onRefresh: () => void;
  onExportAll?: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onRefresh,
  onExportAll,
  isRefreshing,
}) => {
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [liveTimeStr, setLiveTimeStr] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setLiveTimeStr(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      setCurrentDateStr(`${d}-${m}-${y}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 select-none" style={{ backgroundColor: '#121316' }}>
      
      {/* ── 1. Top Brand Navigation Bar ── */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid #23252b' }}
      >
        {/* Left: Hamburger & Honeywell Brand Title */}
        <div className="flex items-center gap-3.5">
          <button
            className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <span
              className="font-bold tracking-tight text-white"
              style={{ fontSize: '1.125rem', letterSpacing: '-0.02em' }}
            >
              Honeywell
            </span>
            <span className="text-slate-600 font-light text-sm">|</span>
            <span
              className="font-medium text-slate-300"
              style={{ fontSize: '0.875rem', letterSpacing: '0.01em' }}
            >
              Remote Building Manager
            </span>
          </div>
        </div>

        {/* Right: POWERED BY HONEYWELL FORGE + Avatar Profile */}
        <div className="flex items-center gap-3.5">
          <div
            className="text-[11px] font-bold tracking-widest uppercase text-slate-300"
            style={{ letterSpacing: '0.08em' }}
          >
            POWERED BY HONEYWELL FORGE
          </div>

          <div
            className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 shadow-sm"
            style={{ backgroundColor: '#202227' }}
          >
            <img
              src="/user_avatar.jpg"
              alt="Operations Manager"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      </div>

      {/* ── 2. Breadcrumb & Date Selection Sub-bar ── */}
      <div
        className="px-4 py-2 flex flex-wrap items-center justify-between gap-3"
        style={{ backgroundColor: '#17181c', borderBottom: '1px solid #26282f' }}
      >
        {/* Left Breadcrumb Location */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ backgroundColor: '#202227', border: '1px solid #2d3038' }}
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-slate-400">Honeywell</span>
          <span className="text-slate-600">›</span>
          <span className="font-semibold text-white">ObixTest Station HQ</span>
        </div>

        {/* Right: Date picker & Action Controls */}
        <div className="flex items-center gap-3">
          
          {/* Date from label and date picker box */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              Date from <Info className="w-3 h-3 text-slate-500" />
            </span>
            <div
              className="flex items-center gap-2 px-2.5 py-1 rounded text-xs font-mono"
              style={{ backgroundColor: '#202227', border: '1px solid #2d3038', color: '#ffffff' }}
            >
              <span>{currentDateStr || 'Today'}</span>
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Live Sync Clock Badge */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono text-cyan-400"
            style={{ backgroundColor: '#16181c', border: '1px solid #26282f' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 hw-pulse" />
            <span>{liveTimeStr || 'LIVE'}</span>
          </div>

          {/* Export Report CSV */}
          {onExportAll && (
            <button
              onClick={onExportAll}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer text-emerald-400 hover:text-emerald-300"
              style={{ backgroundColor: '#202227', border: '1px solid #2d3038' }}
              title="Export report (.csv)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          )}

          {/* Refresh Telemetry */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: '#202227', border: '1px solid #2d3038' }}
            title="Refresh live points"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Add Point */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold text-white transition cursor-pointer"
            style={{ backgroundColor: '#00a4e4' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Point
          </button>
        </div>
      </div>
    </header>
  );
};
