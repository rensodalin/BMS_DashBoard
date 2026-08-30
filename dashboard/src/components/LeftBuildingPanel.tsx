import React from 'react';
import type { SensorPoint } from '../types/bms';
import { Star, MapPin, Bell, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
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

  // Rating calculation: 5 stars if 0 alarms, 4 if 1-2 alarms, 3 if <=5 alarms, etc.
  const buildingRating = activeAlarmsCount === 0 ? 5 : activeAlarmsCount <= 2 ? 4 : activeAlarmsCount <= 5 ? 3 : 2;
  const ratingLabel = buildingRating >= 4 ? 'Good' : buildingRating === 3 ? 'Fair' : 'Poor';

  const totalZones = points.length;

  return (
    <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3 select-none lg:sticky lg:top-[88px] lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto pr-0.5">
      
      {/* ── 1. Building Site Photo Card ── */}
      <div className="hw-panel overflow-hidden">
        <div className="h-36 relative bg-slate-900 overflow-hidden">
          <img
            src="/building_hq.jpg"
            alt="Corporate Facility"
            className="w-full h-full object-cover"
          />
          {/* Subtle gradient scrim */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(23,24,28,0.7) 0%, transparent 60%)',
            }}
          />
          {/* Location badge overlay */}
          <div
            className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
            style={{
              background: 'rgba(18, 19, 22, 0.75)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
            }}
          >
            <MapPin className="w-3 h-3 text-cyan-400" />
            <span>Station HQ</span>
          </div>
        </div>
      </div>

      {/* ── 2. Healthy Building Rating Card ── */}
      <div className="hw-panel p-3.5">
        <div className="flex items-center gap-1 mb-1">
          <span className="font-semibold text-xs text-white">Healthy Building</span>
          <Info className="w-3 h-3 text-slate-400" />
        </div>

        <div className="text-[11px] text-slate-400 mb-2">
          Overall Rating (Total {totalZones} zones)
        </div>

        {/* Large Rating Number & Stars */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-bold text-white text-3xl leading-none">
            {buildingRating}
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="w-3 h-3"
                  style={{
                    color: s <= buildingRating ? '#fa8c16' : '#4a4e5a',
                    fill: s <= buildingRating ? '#fa8c16' : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] font-medium text-slate-400">{ratingLabel}</span>
          </div>
        </div>

        {/* Intelligent Optimization Badge */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            backgroundColor: '#16181c',
            border: '1px solid #2d3038',
            color: '#d1d5db',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>INTELLIGENT OPTIMIZATION ON</span>
        </div>
      </div>

      {/* ── 3. Alarm Summary Card ── */}
      <div className="hw-panel p-3.5">
        <div className="text-xs font-semibold text-white mb-2.5">
          Alarm
        </div>

        {/* Alarm 3-Column Stats Grid */}
        <div className="grid grid-cols-3 gap-2 pb-3 mb-3" style={{ borderBottom: '1px solid #282a32' }}>
          
          {/* Total reported */}
          <div className="flex flex-col">
            <Bell className="w-3.5 h-3.5 text-cyan-400 mb-1" />
            <span className="font-bold font-mono text-white text-xl leading-tight">
              {totalZones}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase leading-tight mt-0.5">
              REPORTED<br />HIGH ALARM
            </span>
          </div>

          {/* Active alarms */}
          <div className="flex flex-col">
            <Bell className={`w-3.5 h-3.5 mb-1 ${activeAlarmsCount > 0 ? 'text-red-500' : 'text-slate-500'}`} />
            <span className={`font-bold font-mono text-xl leading-tight ${activeAlarmsCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {activeAlarmsCount}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase leading-tight mt-0.5">
              ACTIVE<br />HIGH ALARM
            </span>
          </div>

          {/* Severity breakdown */}
          <div className="flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="font-bold font-mono text-white text-xs">{Math.ceil(activeAlarmsCount * 0.35)}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">MEDIUM</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-emerald-400" />
              <span className="font-bold font-mono text-white text-xs">{Math.ceil(activeAlarmsCount * 0.65)}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">LOW</span>
            </div>
          </div>

        </div>

        {/* ── Active High Alarm Feed ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Bell className={`w-3.5 h-3.5 ${activeAlarmsCount > 0 ? 'text-red-500' : 'text-slate-500'}`} />
              <span>Active High Alarm</span>
            </div>
            <span className="font-mono text-xs text-slate-400 font-bold">
              {String(activeAlarmsCount).padStart(2, '0')}
            </span>
          </div>

          {/* Alarm Items List */}
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
            {activeAlarmsList.length > 0 ? (
              activeAlarmsList.map((pt) => {
                const reading = formatPointReading(pt);
                return (
                  <div
                    key={pt.point_name}
                    className="p-2.5 rounded text-xs"
                    style={{
                      backgroundColor: '#16181c',
                      border: '1px solid #282a32',
                    }}
                  >
                    <div className="font-medium font-mono text-white text-xs mb-0.5">
                      {pt.point_name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {pt.device_name || 'ObixTest'} — <span className={`font-medium ${reading.statusClass}`}>{reading.displayText}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      {pt.updated_at ? new Date(pt.updated_at).toLocaleTimeString() : 'Live'}
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className="p-3 rounded text-xs text-center flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: '#16181c',
                  border: '1px solid #282a32',
                  color: '#9ca3af',
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>All Points Normal</span>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
