import React, { useEffect, useState, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Download,
  Calendar,
  Info,
  LogOut,
  ChevronDown,
  Settings,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenAddModal: () => void;
  onRefresh: () => void;
  onExportAll?: () => void;
  isRefreshing: boolean;
  activeTab?: string;
  onNavigateTab?: (tab: string) => void;
  availableBuildings?: string[];
  selectedBuilding?: string;
  onSelectBuilding?: (building: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onRefresh,
  onExportAll,
  isRefreshing,
  activeTab = 'dashboard',
  onNavigateTab,
  availableBuildings = [],
  selectedBuilding = 'ALL',
  onSelectBuilding,
}) => {
  const { user, logout, isAdmin } = useAuth();
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
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();

      setCurrentDateStr(`${day}-${month}-${year}`);
    };

    updateClock();

    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 select-none"
      style={{
        backgroundColor: '#0f1014',
        borderBottom: '1px solid #1a1c22',
      }}
    >
      {/* Top bar */}
      <div
        className="h-[60px] px-5 flex items-center justify-between"
        style={{
          borderBottom: '1px solid #1a1c22',
        }}
      >
        {/* Brand */}
        <div className="flex items-center">
          <img
            src="/intersys_logo.png"
            alt="Intersys Solutions"
            className="w-[100px] h-auto object-contain"
            onError={(e) => {
              e.currentTarget.src = '/intersys_logo.avif';
            }}
          />

          <div
            className="mx-4 h-5 w-px"
            style={{
              backgroundColor: '#35373c',
            }}
          />

          <span
            className="text-[13px]"
            style={{
              color: '#c8cacf',
            }}
          >
            Remote Building Manager
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <span
            className="hidden sm:block text-[10px]"
            style={{
              color: '#777a80',
              letterSpacing: '0.08em',
            }}
          >

          </span>

          <div
            className="h-5 w-px hidden sm:block"
            style={{
              backgroundColor: '#303238',
            }}
          />

          {/* Interactive Profile Pill with Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className={`group flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-all duration-150 cursor-pointer border ${isProfileMenuOpen
                ? 'bg-[#181a22] border-[#2e3240] shadow-sm'
                : 'bg-[#121318]/90 hover:bg-[#181a22] border-[#1e2029] hover:border-[#2a2d39]'
                }`}
              title="Account & Settings"
            >
              {/* Avatar with subtle gradient and status indicator */}
              <div className="relative shrink-0">
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center font-semibold text-xs transition-shadow shadow-sm ${user?.role === 'admin'
                    ? 'bg-gradient-to-br from-[#0080c8] to-[#00a4e4] text-white shadow-sky-950/40'
                    : user?.role === 'tenant'
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-500 text-white shadow-purple-950/40'
                      : 'bg-gradient-to-br from-slate-700 to-slate-600 text-slate-100'
                    }`}
                >
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
                {/* Active indicator dot */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#0f1014]" />
              </div>

              {/* User Name & Role Tag */}
              <div className="hidden md:flex flex-col text-left leading-none">
                <span className="text-[12px] font-medium text-slate-200 group-hover:text-white transition-colors truncate max-w-[125px]">
                  {user?.name || 'Administrator'}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 font-normal capitalize">
                  {user?.role === 'admin' ? 'Administrator' : user?.role ? `${user.role} Account` : 'Client'}
                </span>
              </div>

              {/* Smooth rotating chevron */}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180 text-slate-300' : ''
                  }`}
              />
            </button>

            {/* Profile Dropdown Popover */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-11 w-72 bg-[#121319] border border-[#232632] rounded-xl shadow-2xl shadow-black/90 p-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                {/* User Identity Section */}
                <div className="p-3 bg-[#171922]/80 border border-[#202330] rounded-lg mb-1.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-md ${user?.role === 'admin'
                        ? 'bg-gradient-to-br from-[#0080c8] to-[#00a4e4] text-white shadow-sky-950/50'
                        : user?.role === 'tenant'
                          ? 'bg-gradient-to-br from-purple-600 to-indigo-500 text-white shadow-purple-950/50'
                          : 'bg-gradient-to-br from-slate-700 to-slate-600 text-white'
                        }`}
                    >
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

                    <div className="overflow-hidden flex-1">
                      <div className="text-xs font-semibold text-white truncate tracking-tight">
                        {user?.name || 'System Administrator'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {user?.email || 'admin@intersys.com'}
                      </div>
                    </div>
                  </div>



                  {user?.assignedTenant && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1.5 font-normal">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Facility</span>
                      </span>
                      <span className="text-slate-300 font-medium truncate max-w-[140px]">
                        {user.assignedTenant}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions & Links */}
                <div className="space-y-0.5">
                  {user?.role === 'admin' && onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onNavigateTab('settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-[#1a1c24] transition-colors cursor-pointer group"
                    >
                      <Settings className="w-4 h-4 text-slate-400 group-hover:text-[#00a4e4] transition-colors" />
                      <div className="flex flex-col text-left">
                        <span className="leading-tight">Settings & Accounts</span>

                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer group"
                  >
                    <LogOut className="w-4 h-4 text-red-400/80 group-hover:text-red-300 transition-colors" />
                    <div className="flex flex-col text-left">
                      <span className="leading-tight">Sign Out</span>

                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div
        className="px-5 py-2.5 flex items-center justify-end gap-2.5 flex-wrap"
        style={{
          backgroundColor: '#131418',
          borderBottom: '1px solid #1a1c22',
        }}
      >
        {/* Building / Facility Scope Selector */}
        {isAdmin && onSelectBuilding ? (
          <div className="flex items-center gap-1.5 mr-auto sm:mr-2">
            <Building2 className="w-3.5 h-3.5 text-[#00a4e4] shrink-0" />
            <span className="text-[11px] text-slate-400 font-medium hidden md:inline">Scope:</span>
            <select
              value={selectedBuilding}
              onChange={(e) => onSelectBuilding(e.target.value)}
              className="h-7 px-2.5 rounded text-[11px] font-medium bg-[#18191f] border border-[#252830] text-slate-200 hover:border-[#353842] focus:outline-none focus:border-[#00a4e4] transition-colors cursor-pointer"
              title="Admin facility filter (view all client points or individual facility)"
            >
              <option value="ALL">🏢 All Facilities (All Points)</option>
              {availableBuildings.map((b) => (
                <option key={b} value={b}>
                  🏢 {b}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 h-7 px-2.5 rounded bg-[#18191f] border border-[#252830] text-slate-300 text-[11px] font-medium mr-auto sm:mr-2" title="Your assigned facility">
            <Building2 className="w-3.5 h-3.5 text-[#00a4e4] shrink-0" />
            <span className="text-slate-400 hidden sm:inline">Facility:</span>
            <span className="font-semibold text-white truncate max-w-[160px]">{user?.assignedTenant || 'Assigned Facility'}</span>
          </div>
        )}
        {/* Date */}
        <div className="flex items-center gap-2 mr-1">
          <span
            className="text-[11px]"
            style={{
              color: '#777a80',
            }}
          >
            Date from
          </span>

          <Info
            className="w-3 h-3"
            style={{
              color: '#55585e',
            }}
          />

          <div
            className="h-7 px-2.5 flex items-center gap-2 rounded"
            style={{
              backgroundColor: '#18191f',
              border: '1px solid #252830',
            }}
          >
            <span
              className="text-[11px] font-mono"
              style={{
                color: '#d3d5d8',
              }}
            >
              {currentDateStr || 'Today'}
            </span>

            <Calendar
              className="w-3.5 h-3.5"
              style={{
                color: '#ffffff',
              }}
            />
          </div>
        </div>

        {/* Clock */}
        <div
          className="hidden sm:flex items-center h-7 px-2.5 rounded"
          style={{
            backgroundColor: '#18191f',
            border: '1px solid #252830',
          }}
        >
          <span
            className="text-[11px] font-mono"
            style={{
              color: '#aeb2b7',
            }}
          >
            {liveTimeStr || '--:--:--'}
          </span>
        </div>

        {/* Export */}
        {onExportAll && (
          <button
            onClick={onExportAll}
            className="h-7 px-2.5 flex items-center gap-1.5 rounded transition-colors cursor-pointer"
            style={{
              backgroundColor: '#202227',
              border: '1px solid #303239',
              color: '#9da1a7',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#d5d7da';
              e.currentTarget.style.backgroundColor = '#25272c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9da1a7';
              e.currentTarget.style.backgroundColor = '#202227';
            }}
            title="Export report"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-[11px]">Export</span>
          </button>
        )}

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: '#202227',
            border: '1px solid #303239',
            color: '#8a8e95',
          }}
          onMouseEnter={(e) => {
            if (!isRefreshing) {
              e.currentTarget.style.color = '#d5d7da';
              e.currentTarget.style.backgroundColor = '#25272c';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRefreshing) {
              e.currentTarget.style.color = '#8a8e95';
              e.currentTarget.style.backgroundColor = '#202227';
            }
          }}
          title="Refresh"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''
              }`}
          />
        </button>

        {/* Add Button (Point on Dashboard, Invoice on Billing) */}
        <button
          onClick={onOpenAddModal}
          className="h-7 px-3 flex items-center gap-1.5 rounded font-medium transition-colors cursor-pointer"
          style={{
            backgroundColor: '#0098d1',
            color: '#ffffff',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#00a4e4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#0098d1';
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px]">
            {activeTab === 'billing' ? 'Add Invoice' : 'Add Point'}
          </span>
        </button>
      </div>
    </header>
  );
};