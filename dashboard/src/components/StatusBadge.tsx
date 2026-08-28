import React from 'react';
import { AlertTriangle, Flame, Zap, Power, CheckCircle2 } from 'lucide-react';
import type { SensorPoint } from '../types/bms';

interface StatusBadgeProps {
  point: SensorPoint;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ point }) => {
  const { is_alarm, current_value, alert_threshold, point_name } = point;
  const nameLower = point_name.toLowerCase();

  // 1. SMOKE / FIRE DETECTORS
  if (nameLower.includes('smoke') || nameLower.includes('fire')) {
    if (current_value > 0 || is_alarm) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
          <Flame className="w-3.5 h-3.5 text-red-400" /> Smoke Alarm
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Smoke Normal
      </span>
    );
  }

  // 2. HIGH TEMPERATURE / CRITICAL ALARMS
  if (is_alarm || current_value >= alert_threshold) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
        <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> High Alarm (&ge; {alert_threshold}&deg;C)
      </span>
    );
  }

  // 3. EQUIPMENT RUNNING (ON / RUN)
  if (nameLower.includes('pump') || nameLower.includes('fan') || nameLower.includes('status')) {
    if (current_value === 1 || current_value > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Zap className="w-3.5 h-3.5 text-cyan-400" /> Running (ON)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
        <Power className="w-3.5 h-3.5 text-slate-500" /> Stopped (OFF)
      </span>
    );
  }

  // 4. NORMAL TEMPERATURE / REGULAR SENSORS
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Normal
    </span>
  );
};
