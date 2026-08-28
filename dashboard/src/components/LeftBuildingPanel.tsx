import React from 'react';
import type { SensorPoint } from '../types/bms';
import { Star, ShieldAlert, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react';
import { formatPointReading } from './PointsGrid';

interface LeftBuildingPanelProps {
  points: SensorPoint[];
}

export const LeftBuildingPanel: React.FC<LeftBuildingPanelProps> = ({ points }) => {
  const activeAlarmsList = points.filter((pt) => {
    const reading = formatPointReading(pt);
    return reading.isAlarm;
  });

  const activeAlarmsCount = activeAlarmsList.length;

  return (
    <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
      
      {/* 1. Building Site Photo Preview Card */}
      <div className="bms-panel rounded-xl overflow-hidden border border-[#1e2638] bg-[#131924]">
        <div className="h-32 relative bg-slate-900 overflow-hidden">
          <img
            src="/bms_building_preview_1787903801701.png"
            alt="Corporate Facility"
            className="w-full h-full object-cover opacity-85 hover:scale-105 transition-all duration-500"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#131924] via-transparent to-black/40"></div>
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[11px] text-white font-medium">
            <MapPin className="w-3 h-3 text-blue-400" />
            <span>ObixTest Station HQ</span>
          </div>
        </div>

        <div className="p-4 pt-2">
          <h4 className="text-sm font-semibold text-white">Main Controller Facility</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Tridium Niagara oBIX Drivers Station</p>
        </div>
      </div>

      {/* 2. Healthy Building Status Card */}
      <div className="bms-panel p-4 rounded-xl border border-[#1e2638] bg-[#131924]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">Healthy Building</span>
          <span className="text-[10px] text-slate-500 font-mono">Total {points.length} points</span>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold font-mono text-white">5</span>
          <span className="text-sm text-emerald-400 font-semibold">Good Operations</span>
        </div>

        {/* 5 Rating Stars */}
        <div className="flex items-center gap-1 mb-3 text-amber-400">
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          <Star className="w-3.5 h-3.5 fill-amber-400" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          INTELLIGENT OPTIMIZATION ON
        </div>
      </div>

      {/* 3. Alarm Summary Panel */}
      <div className="bms-panel p-4 rounded-xl border border-[#1e2638] bg-[#131924]">
        <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
          <span>System Alarms</span>
          <ShieldAlert className="w-4 h-4 text-slate-400" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-[#0c1018] border border-[#1a2233]">
            <div className="text-xl font-bold font-mono text-white mb-0.5">{points.length}</div>
            <div className="text-[10px] text-slate-400">Total Telemetry</div>
          </div>

          <div className={`p-3 rounded-lg border ${activeAlarmsCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-[#0c1018] border-[#1a2233]'}`}>
            <div className={`text-xl font-bold font-mono ${activeAlarmsCount > 0 ? 'text-red-400' : 'text-slate-300'} mb-0.5`}>
              {activeAlarmsCount}
            </div>
            <div className="text-[10px] text-slate-400">Active High Alarms</div>
          </div>
        </div>

        {/* 4. Active High Alarm Feed */}
        <div className="border-t border-[#1e2638] pt-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-2">
            <span className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Active High Alarms
            </span>
            <span className="font-mono">{String(activeAlarmsCount).padStart(2, '0')}</span>
          </div>

          {activeAlarmsList.length === 0 ? (
            <div className="p-3 rounded-lg bg-[#0c1018] border border-[#1a2233] text-center text-[11px] text-emerald-400 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>All Niagara Points Normal</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {activeAlarmsList.map((pt) => {
                const reading = formatPointReading(pt);
                return (
                  <div key={pt.point_name} className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                    <div className="font-mono font-semibold text-red-400 flex items-center justify-between">
                      <span>{pt.point_name}</span>
                      <span className="text-[10px] text-slate-400">{pt.device_name || 'ObixTest'}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Status: <strong className="text-red-400">{reading.displayText}</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
