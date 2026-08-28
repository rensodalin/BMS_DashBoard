import React from 'react';
import { Home, Bell, LayoutGrid, Activity, Settings, Leaf, CreditCard } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'alarms', label: 'Alarms', icon: Bell },
    { id: 'points', label: 'Points Workspace', icon: LayoutGrid },
    { id: 'equipment', label: 'Equipment Health', icon: Activity },
    { id: 'energy', label: 'Energy & Optimization', icon: Leaf },
    { id: 'billing', label: 'Billing & Metering', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-16 bg-[#0f141d] border-r border-[#1e2638] flex flex-col items-center py-4 justify-between min-h-screen shrink-0 z-40">
      
      {/* Navigation Icons */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-3 rounded-xl transition-all duration-200 cursor-pointer relative group ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#182030]'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* System Indicator */}
      <div className="p-2 rounded-xl bg-slate-900 border border-[#1e2638] text-center" title="Niagara Engine Connected">
        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
      </div>

    </aside>
  );
};
