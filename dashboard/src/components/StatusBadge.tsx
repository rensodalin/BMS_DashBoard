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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#fef2f2] text-[#FF3523] border border-[#FF3523]/25">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF3523] animate-ping" />
          <span>Smoke Alarm</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#e6edf5] text-[#001F3F] border border-[#001F3F]/25">
        <span className="w-1.5 h-1.5 rounded-full bg-[#001F3F]" />
        <span>Smoke Normal</span>
      </span>
    );
  }

  // 2. HIGH TEMPERATURE / CRITICAL ALARMS
  if (is_alarm || current_value >= alert_threshold) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#fef2f2] text-[#FF3523] border border-[#FF3523]/25">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF3523] animate-pulse" />
        <span>High Alarm (&ge;{alert_threshold}°C)</span>
      </span>
    );
  }

  // 3. EQUIPMENT RUNNING (ON / RUN)
  if (nameLower.includes('pump') || nameLower.includes('fan') || nameLower.includes('status')) {
    if (current_value === 1 || current_value > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#e6edf5] text-[#001F3F] border border-[#001F3F]/25">
          <span className="w-1.5 h-1.5 rounded-full bg-[#001F3F]" />
          <span>Running</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span>Stopped</span>
      </span>
    );
  }

  // 4. NORMAL TEMPERATURE / REGULAR SENSORS
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#e6edf5] text-[#001F3F] border border-[#001F3F]/25">
      <span className="w-1.5 h-1.5 rounded-full bg-[#001F3F]" />
      <span>Normal</span>
    </span>
  );
};
