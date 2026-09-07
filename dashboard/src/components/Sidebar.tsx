import React from 'react';
import { Home, Bell, LayoutGrid, Activity, Leaf, CreditCard, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { logout, isAdmin } = useAuth();

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'alarms', label: 'Alarms', icon: Bell },
    { id: 'points', label: 'Spaces & Points', icon: LayoutGrid },
    { id: 'equipment', label: 'Equipment Health', icon: Activity },
    { id: 'energy', label: 'Energy & Carbon', icon: Leaf },
    { id: 'billing', label: 'Billing & Metering', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
  ];

  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside
      className="w-12 shrink-0 sticky top-0 h-screen flex flex-col items-center justify-between py-2.5 select-none z-40"
      style={{
        backgroundColor: '#0a0b0e',
        borderRight: '1px solid #1a1c22',
      }}
    >
      {/* Navigation Rail Buttons */}
      <div className="flex flex-col items-center gap-0.5 w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="relative w-full flex items-center justify-center py-3 text-slate-400 hover:text-white transition cursor-pointer group"
              style={{
                color: isActive ? '#00a4e4' : undefined,
                backgroundColor: isActive ? 'rgba(0, 164, 228, 0.08)' : 'transparent',
              }}
              title={item.label}
            >
              {/* Active Blue Left Indicator Bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                  style={{ backgroundColor: '#00a4e4' }}
                />
              )}
              <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />

              {/* Hover Tooltip */}
              <span
                className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg"
                style={{
                  backgroundColor: '#15161b',
                  color: '#ffffff',
                  border: '1px solid #202228',
                  fontSize: '11px',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom section: Online Status & Sign Out */}
      <div className="flex flex-col items-center gap-2 mb-1">
        <button
          onClick={() => logout()}
          className="w-8 h-8 rounded flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer relative group"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          <span
            className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg"
            style={{
              backgroundColor: '#15161b',
              color: '#ef4444',
              border: '1px solid #202228',
              fontSize: '11px',
            }}
          >
            Sign Out
          </span>
        </button>

        {/* System Online Status Dot */}
        <div
          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#101115', border: '1px solid #1c1d23' }}
          title="BMS Controller Online"
        >
          <span
            className="w-2 h-2 rounded-full hw-pulse"
            style={{ backgroundColor: '#22c55e' }}
          />
        </div>
      </div>
    </aside>
  );
};
