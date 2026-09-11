import React, { useEffect, useState, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Download,
  Calendar,
  Search,
  Bell,
  LogOut,
  ChevronDown,
  Settings,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenAddModal: () => void;
  onOpenAddInvoice?: () => void;
  onRefresh: () => void;
  onExportAll?: () => void;
  isRefreshing: boolean;
  activeTab?: string;
  onNavigateTab?: (tab: string) => void;
  availableFloors?: string[];
  selectedFloor?: string;
  onSelectFloor?: (floor: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onOpenAddInvoice,
  onRefresh,
  onExportAll,
  isRefreshing,
  activeTab = 'dashboard',
  onNavigateTab,
  availableFloors = [],
  selectedFloor = 'ALL',
  onSelectFloor,
}) => {
  const { user, logout } = useAuth();
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [liveTimeStr, setLiveTimeStr] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setLiveTimeStr(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      const day = String(now.getDate()).padStart(2, '0');
      const month = now.toLocaleDateString('en-US', { month: 'short' });
      const year = now.getFullYear();
      setCurrentDateStr(`${day} ${month} ${year}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#f8f9fb]/90 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-4 border-b border-slate-200/60 select-none">
      {/* Left: Intersys Corporate Logo & Search Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="flex items-center gap-2 pr-3 sm:border-r sm:border-slate-200 shrink-0">

        </div>
        <div className="relative flex items-center w-full max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search telemetry points, meters, tenants..."
            className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-md pl-9 pr-4 py-2 placeholder:text-slate-400 focus:outline-none focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/15 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all"
          />
        </div>
      </div>

      {/* Right Controls: Date Pill + Floor Pill + Actions + Icons + Profile */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Floor Scope Selector */}
        {onSelectFloor && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-md shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-xs text-slate-700">
            <Layers className="w-3.5 h-3.5 text-[#001F3F]" />
            <select
              value={selectedFloor}
              onChange={(e) => onSelectFloor(e.target.value)}
              className="bg-transparent text-slate-800 font-medium text-xs outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Floors</option>
              {availableFloors.map((fl) => (
                <option key={fl} value={fl}>
                  {fl}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Display Box */}
        <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-md shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-xs font-medium text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentDateStr || 'Today'}</span>
          <span className="text-[10px] text-slate-400 font-mono">({liveTimeStr || 'Live'})</span>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#001F3F] hover:bg-slate-50 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.03)] cursor-pointer disabled:opacity-50"
          title="Refresh Telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#001F3F]' : ''}`} />
        </button>

        {/* Notification Bell with Red Dot */}
        <div className="relative">
          <button
            type="button"
            className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#001F3F] hover:bg-slate-50 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.03)] cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#FF3523] ring-2 ring-white" />
        </div>

        {/* Export CSV Report */}
        {onExportAll && (
          <button
            type="button"
            onClick={onExportAll}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-colors cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        )}

        {/* Add Actions - Intersys Navy */}
        {activeTab === 'billing' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#001F3F] hover:bg-[#001428] text-white font-bold text-xs shadow-md shadow-[#001F3F]/20 transition-all cursor-pointer"
              title="Add or discover oBIX points"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Point</span>
            </button>
            {onOpenAddInvoice && (
              <button
                type="button"
                onClick={onOpenAddInvoice}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-xs transition-colors cursor-pointer"
                title="Add manual tenant invoice"
              >
                <Plus className="w-3.5 h-3.5 text-[#001F3F]" />
                <span>Add Invoice</span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#001F3F] hover:bg-[#001428] text-white font-bold text-xs shadow-md shadow-[#001F3F]/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Point</span>
          </button>
        )}

        {/* User Profile Avatar with Online Status Indicator */}
        <div className="relative pl-1" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-200/50 transition-colors cursor-pointer"
            title="User Profile"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-md bg-[#001F3F] text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-[#001F3F]/30">
                {user?.name
                  ? user.name
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                  : 'AD'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
          </button>

          {/* Profile Popover */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-md shadow-xl p-2 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 bg-slate-50 rounded mb-1.5">
                <div className="font-bold text-xs text-slate-900">{user?.name || 'Administrator'}</div>
                <div className="text-[11px] text-slate-500">{user?.email || 'admin@intersys.com'}</div>
                <div className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded bg-[#e6edf5] text-[#001F3F] font-bold">
                  {user?.role || 'Administrator'}
                </div>
              </div>

              {user?.role === 'admin' && onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onNavigateTab('settings');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Settings & Accounts</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-bold text-[#FF3523] hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4 text-[#FF3523]" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};