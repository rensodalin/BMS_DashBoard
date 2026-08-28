import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Cpu } from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onRefresh,
  isRefreshing,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString() + ' · ' + now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bms-panel sticky top-0 z-30 px-6 py-4 border-b border-[#1f293d] mb-8 bg-[#111827]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & Logo */}
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">
              Niagara oBIX BMS Dashboard
            </h1>
            <p className="text-xs text-slate-400">Live Building Management System Control</p>
          </div>
        </div>

        {/* Action Bar & Clock */}
        <div className="flex items-center gap-3">
          
          {/* Live Clock Display */}
          <div className="text-xs font-mono text-slate-300 px-3.5 py-2 rounded-lg bg-[#0d131f] border border-[#23314a]">
            {currentTime || 'Loading clock...'}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-[#162032] border border-[#23314a] hover:border-slate-500 text-slate-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
            title="Refresh sensor data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Add New Sensor Point Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Sensor Point
          </button>
        </div>

      </div>
    </header>
  );
};
