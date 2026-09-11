import React from 'react';
import {
  LayoutDashboard,
  Bell,
  Layers,
  Activity,
  Zap,
  CreditCard,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INTERSYS_LOGO_BASE64 } from '../assets/logoBase64';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  alarmCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, alarmCount = 0 }) => {
  const { logout, isAdmin } = useAuth();

  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'alarms', label: 'Alarms', icon: Bell, badge: alarmCount > 0 ? alarmCount : undefined, badgeColor: 'bg-[#FF3523]' },
    { id: 'points', label: 'Spaces & Points', icon: Layers },
    { id: 'equipment', label: 'Equipment Health', icon: Activity },
    { id: 'energy', label: 'Energy & Carbon', icon: Zap },
    { id: 'billing', label: 'Billing & Quotes', icon: CreditCard, adminOnly: true },
  ];

  const secondaryNavItems = [
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
  ];

  const filteredMain = mainNavItems.filter((item) => !item.adminOnly || isAdmin);
  const filteredSecondary = secondaryNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="w-60 shrink-0 sticky top-0 h-screen flex flex-col justify-between py-5 px-4 bg-white border-r border-slate-100 select-none z-40 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      {/* Top Company Branding */}
      <div>
        <div className="px-3 mb-6">
          <div className="flex items-center">
            <img
              src={INTERSYS_LOGO_BASE64}
              alt="Intersys Solutions"
              className="h-10 w-auto max-w-[155px] object-contain"
              onError={(e) => {
                e.currentTarget.src = '/intersys_logo.png';
              }}
            />
          </div>

        </div>

        {/* Main Navigation Items - Subtle rounded-md */}
        <nav className="space-y-1">
          {filteredMain.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${isActive
                  ? 'bg-[#001F3F] text-white shadow-md shadow-[#001F3F]/20 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 min-w-4 h-4 rounded-sm text-[10px] font-bold text-white flex items-center justify-center ${item.badgeColor || 'bg-[#FF3523]'
                      }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="my-5 border-t border-slate-100" />

        {/* Secondary Navigation */}
        <div className="space-y-1">
          {filteredSecondary.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${isActive
                  ? 'bg-[#001F3F] text-white shadow-md shadow-[#001F3F]/20 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold text-slate-500 hover:text-[#FF3523] hover:bg-red-50/70 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Bottom Intersys Corporate CTA Card */}
      <div className="rounded-md p-4 text-white bg-gradient-to-br from-[#001428] to-[#001F3F] shadow-lg shadow-[#001F3F]/15 relative overflow-hidden">
        {/* Subtle decorative circle */}
        <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-blue-100 flex items-left">
            <span className="w-2 h-2 rounded-full " />
            Niagara oBIX
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-white/20 text-white font-mono font-medium backdrop-blur-xs">
            Live
          </span>
        </div>

        <h4 className="text-xs font-bold text-white mb-1">Station Telemetry</h4>
        <p className="text-[10px] text-blue-100/80 mb-3 leading-relaxed">
          15 Smart Sub-Meters connected and auto-syncing
        </p>

        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className="w-full py-2 rounded-md bg-white hover:bg-blue-50 text-[#001F3F] font-bold text-xs transition-colors shadow-xs cursor-pointer text-center"
        >
          View Billing Ledger
        </button>
      </div>
    </aside>
  );
};
