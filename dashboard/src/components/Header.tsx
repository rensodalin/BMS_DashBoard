import React, { useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Download,
  Calendar,
  Info,
} from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
  onRefresh: () => void;
  onExportAll?: () => void;
  isRefreshing: boolean;
  activeTab?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onRefresh,
  onExportAll,
  isRefreshing,
  activeTab = 'dashboard',
}) => {
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [liveTimeStr, setLiveTimeStr] = useState('');

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

          <div
            className="w-8 h-8 rounded-full overflow-hidden"
            style={{
              backgroundColor: '#202227',
              border: '1px solid #35373d',
            }}
          >
            <img
              src="/user_avatar.jpg"
              alt="Operations Manager"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
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