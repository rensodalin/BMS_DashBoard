import React from 'react';
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
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
          <span className="w-2 h-2 rounded-full bg-red-500 hw-pulse shrink-0" />
          <span>Smoke Alarm</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span>Smoke Normal</span>
      </div>
    );
  }

  // 2. HIGH TEMPERATURE / CRITICAL ALARMS
  if (is_alarm || current_value >= alert_threshold) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
        <span className="w-2 h-2 rounded-full bg-red-500 hw-pulse shrink-0" />
        <span>High Alarm (&ge;{alert_threshold}°C)</span>
      </div>
    );
  }

  // 3. EQUIPMENT RUNNING (ON / RUN)
  if (nameLower.includes('pump') || nameLower.includes('fan') || nameLower.includes('status')) {
    if (current_value === 1 || current_value > 0) {
      return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
          <span>Running</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
        <span>Stopped</span>
      </div>
    );
  }

  // 4. NORMAL TEMPERATURE / REGULAR SENSORS
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>Normal</span>
    </div>
  );
};
