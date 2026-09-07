import React, { useEffect, useState, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Download,
  Calendar,
  Info,
  LogOut,
  Shield,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenAddModal: () => void;
  onRefresh: () => void;
  onExportAll?: () => void;
  isRefreshing: boolean;
  activeTab?: string;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onRefresh,
  onExportAll,
  isRefreshing,
  activeTab = 'dashboard',
  onNavigateTab,
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
            POWERED BY HONEYWELL FORGE
          </span>

          <div
            className="h-5 w-px hidden sm:block"
            style={{
              backgroundColor: '#303238',
            }}
          />

          {/* Interactive Admin Profile Button with Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-[#1a1c23] transition cursor-pointer border border-transparent hover:border-[#282b35]"
              title="Profile & Settings"
            >
              <div
                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs bg-[#00a4e4]/15 border border-[#00a4e4]/40 text-[#00a4e4]"
              >
                {user?.name
                  ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  : 'AD'}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-[11px] font-semibold text-slate-200 leading-tight truncate max-w-[110px]">
                  {user?.name || 'Administrator'}
                </span>
                <span className="text-[9px] text-[#00a4e4] font-mono leading-tight uppercase">
                  {user?.role === 'admin' ? 'ADMIN' : user?.role || 'CLIENT'}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-10 w-64 bg-[#15161b] border border-[#202228] rounded-lg shadow-2xl shadow-black p-3 z-50 text-left">
                <div className="pb-2.5 mb-2 border-b border-[#202228]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#00a4e4]/15 border border-[#00a4e4]/30 flex items-center justify-center text-[#00a4e4] font-bold text-xs shrink-0">
                      {user?.name
                        ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                        : 'AD'}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-semibold text-white truncate">
                        {user?.name || 'System Administrator'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {user?.email || 'admin@intersys.com'}
                      </div>
                      {user?.assignedTenant && (
                        <div className="text-[9px] text-[#00a4e4] font-mono truncate mt-0.5">
                          Scope: {user.assignedTenant}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between px-2 py-1 rounded bg-[#0d0e12] border border-[#202228] text-[10px] font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#00a4e4]" /> Role:
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {user?.role === 'admin' ? 'SUPER ADMIN' : user?.role || 'CLIENT USER'}
                    </span>
                  </div>
                </div>

                {/* Edit Admin Account Page Link (Admins Only) */}
                {user?.role === 'admin' && onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onNavigateTab('settings');
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-[#202228] transition cursor-pointer mb-1"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#00a4e4]" />
                    <span>Admin Settings Page</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-red-400 hover:text-white hover:bg-red-500/15 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div
        className="px-5 py-2.5 flex items-center justify-end gap-2.5"
        style={{
          backgroundColor: '#131418',
          borderBottom: '1px solid #1a1c22',
        }}
      >
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