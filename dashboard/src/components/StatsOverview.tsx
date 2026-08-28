import React from 'react';
import type { SensorPoint } from '../types/bms';
import { Activity, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

interface StatsOverviewProps {
  points: SensorPoint[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ points }) => {
  const totalPoints = points.length;
  
  const activeAlarms = points.filter(
    (pt) => pt.is_alarm || pt.current_value >= pt.alert_threshold
  ).length;

  const runningEquipment = points.filter((pt) => {
    const nameLower = pt.point_name.toLowerCase();
    return (
      (nameLower.includes('pump') || nameLower.includes('fan') || nameLower.includes('status')) &&
      pt.current_value > 0
    );
  }).length;

  const normalPoints = totalPoints - activeAlarms;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      
      {/* 1. Monitored Points */}
      <div className="bms-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Monitored Points</span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="text-3xl font-bold font-mono text-white mb-1">{totalPoints}</div>
        <p className="text-xs text-slate-400">Live Niagara Points</p>
      </div>

      {/* 2. Active Alarms Counter */}
      <div className={`bms-card p-5 ${activeAlarms > 0 ? 'bms-card-alarm' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Active Alarms</span>
          <div className={`p-2 rounded-lg ${activeAlarms > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className={`text-3xl font-bold font-mono ${activeAlarms > 0 ? 'text-red-400' : 'text-slate-200'} mb-1`}>
          {activeAlarms}
        </div>
        <p className="text-xs text-slate-400">
          {activeAlarms > 0 ? <span className="text-red-400 font-medium">Action Required</span> : 'Normal Operations'}
        </p>
      </div>

      {/* 3. Running Equipment */}
      <div className="bms-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Equipment Running</span>
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="text-3xl font-bold font-mono text-cyan-400 mb-1">{runningEquipment}</div>
        <p className="text-xs text-slate-400">Pumps & Fans Active</p>
      </div>

      {/* 4. Normal Status Points */}
      <div className="bms-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Normal Status</span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-3xl font-bold font-mono text-emerald-400 mb-1">{normalPoints}</div>
        <p className="text-xs text-slate-400">Operating Within Limits</p>
      </div>

    </div>
  );
};
