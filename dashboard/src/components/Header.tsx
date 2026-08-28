import React, { useState, useEffect } from 'react';
import { Menu, Plus, RefreshCw, Download, MapPin, Calendar, User } from 'lucide-react';

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
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString());
      setCurrentDateStr(
        now.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-[#0f141d] border-b border-[#1e2638] sticky top-0 z-30 font-sans">
      
      {/* Top Honeywell Brand Bar */}
      <div className="px-6 py-2.5 border-b border-[#1a2233] flex items-center justify-between">
        
        {/* Left: Hamburger & Brand Name */}
        <div className="flex items-center gap-4">
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-wider text-base">Honeywell</span>
            <span className="text-slate-500 font-light">|</span>
            <span className="text-slate-300 font-medium text-sm">Remote Building Manager</span>
          </div>
        </div>

        {/* Right: Powered By Tag & Profile Avatar */}
        <div className="flex items-center gap-4">
          <div className="text-[11px] font-semibold text-slate-400 tracking-wider">
            POWERED BY <span className="text-blue-400">NIAGARA FORGE</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
        </div>

      </div>

      {/* Sub-Header / Breadcrumb & Controls Bar */}
      <div className="px-6 py-3 bg-[#131924] flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Breadcrumb Location */}
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <div className="p-1.5 rounded bg-slate-800/80 text-slate-400">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <span className="text-slate-400">Honeywell &gt;</span>
          <span className="font-medium text-white">ObixTest Station HQ</span>
        </div>

        {/* Action Controls & Date/Time Filter */}
        <div className="flex items-center gap-3">
          
          {/* Live Date Filter Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c1018] border border-[#1e2638] text-xs text-slate-300 font-mono">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentDateStr}</span>
            <span className="text-slate-500">|</span>
            <span className="text-blue-400">{timeStr}</span>
          </div>

          {/* Export Report Button */}
          {onExportAll && (
            <button
              onClick={onExportAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-medium text-xs transition cursor-pointer"
              title="Export report to Excel (.csv)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
          )}

          {/* Manual Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-[#1a2233] border border-[#26324a] hover:border-slate-500 text-slate-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
            title="Refresh Niagara telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Add New Sensor Point Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Point
          </button>

        </div>

      </div>

    </header>
  );
};
