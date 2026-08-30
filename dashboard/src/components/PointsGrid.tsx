import React from 'react';
import type { SensorPoint } from '../types/bms';
import { StatusBadge } from './StatusBadge';
import { TrendingUp, Clock, HardDrive, Thermometer, Trash2 } from 'lucide-react';

interface PointsGridProps {
  points: SensorPoint[];
  onSelectPointTrend: (point: SensorPoint) => void;
  onDeletePoint: (pointName: string) => void;
}

export function formatPointReading(pt: SensorPoint): {
  displayText: string;
  isTemp: boolean;
  isAlarm: boolean;
  statusClass: string;
} {
  const nameLower = pt.point_name.toLowerCase();
  const devLower = (pt.device_name || '').toLowerCase();
  const displayLower = (pt.display_value || '').toLowerCase();
  const stateStr = pt.state || '';
  const val = pt.current_value;

  const isSmoke = nameLower.includes('smoke') || nameLower.includes('fire');
  const isAcb = nameLower.includes('acb') || devLower.includes('acb');
  const isPumpOrFan =
    nameLower.includes('pump') ||
    nameLower.includes('fan') ||
    nameLower.includes('status') ||
    nameLower.includes('motor') ||
    nameLower.includes('breaker');

  const isTrueTemp = (nameLower.includes('temp') || nameLower.includes('temperature')) && !isPumpOrFan && !isSmoke;

  // 1. ENUM / MULTI-STATE STATUS POINTS (Fault 3, Disabled 4, Alarm 2)
  if (stateStr === 'ENUM_FAULT' || displayLower.includes('fault') || val === 3) {
    return { displayText: '⚠️ FAULT', isTemp: false, isAlarm: true, statusClass: 'text-amber-400' };
  }
  if (stateStr === 'ENUM_DISABLE' || displayLower.includes('disable') || displayLower.includes('disabled') || val === 4) {
    return { displayText: '🔴 DISABLED', isTemp: false, isAlarm: false, statusClass: 'text-slate-400' };
  }
  if (stateStr === 'ENUM_ALARM' || (displayLower.includes('alarm') && !isSmoke) || val === 2) {
    return { displayText: '🚨 ALARM', isTemp: false, isAlarm: true, statusClass: 'text-red-400' };
  }

  // 2. NUMERIC TEMPERATURE POINT
  if (isTrueTemp) {
    const isAlarm = pt.is_alarm || stateStr === 'HIGH' || stateStr === 'LOW' || val >= pt.alert_threshold;
    const textVal = pt.display_value
      ? pt.display_value.replace(/°c/gi, '').trim()
      : val.toFixed(1);

    return {
      displayText: textVal,
      isTemp: true,
      isAlarm,
      statusClass: isAlarm ? 'text-red-400' : 'text-white',
    };
  }

  // 3. SMOKE / FIRE ALARM POINT
  if (isSmoke || stateStr === 'SMOKE_ALARM' || stateStr === 'SMOKE_NORMAL') {
    const isFireAlarm = pt.is_alarm || stateStr === 'SMOKE_ALARM' || (val > 0 && !displayLower.includes('normal')) || displayLower.includes('alarm') || displayLower.includes('fire');
    return {
      displayText: isFireAlarm ? '🔥 SMOKE ALARM' : '✅ NORMAL',
      isTemp: false,
      isAlarm: isFireAlarm,
      statusClass: isFireAlarm ? 'text-red-400' : 'text-emerald-400',
    };
  }

  // 4. ACB BREAKER POINT
  if (isAcb) {
    const isOn = stateStr === 'BOOL_ON' || val > 0 || displayLower.includes('true') || displayLower.includes('on') || displayLower.includes('energized');
    return {
      displayText: isOn ? '⚡ ENERGIZED (ON)' : '🔴 DE-ENERGIZED (OFF)',
      isTemp: false,
      isAlarm: false,
      statusClass: isOn ? 'text-cyan-400' : 'text-slate-400',
    };
  }

  // 5. BOOLEAN PUMP / FAN / MOTOR / STATUS POINT
  const isBoolValue = displayLower === 'true' || displayLower === 'false' || displayLower === '1.0' || displayLower === '0.0' || val === 0 || val === 1;

  if (isPumpOrFan || isBoolValue || stateStr === 'BOOL_ON' || stateStr === 'BOOL_OFF') {
    const isRunText = displayLower.includes('run') || displayLower.includes('running');
    const isStopText = displayLower.includes('stop') || displayLower.includes('stopped');
    const isOn = stateStr === 'BOOL_ON' || val > 0 || displayLower.includes('true') || displayLower.includes('on') || isRunText;

    if (isOn) {
      return {
        displayText: isRunText ? '⚡ RUNNING' : '⚡ ON',
        isTemp: false,
        isAlarm: false,
        statusClass: 'text-cyan-400',
      };
    }
    return {
      displayText: isStopText ? '🔴 STOPPED' : '🔴 OFF',
      isTemp: false,
      isAlarm: false,
      statusClass: 'text-slate-400',
    };
  }

  const isKwh = nameLower.includes('kwh') || displayLower.includes('kwh') || displayLower.includes('kw-hr');
  if (isKwh) {
    const valText = pt.display_value
      ? pt.display_value.includes('kWh') || pt.display_value.includes('kW-hr')
        ? pt.display_value
        : `${pt.display_value} kWh`
      : `${val.toFixed(1)} kWh`;
    return {
      displayText: valText,
      isTemp: false,
      isAlarm: pt.is_alarm,
      statusClass: 'text-amber-400',
    };
  }

  if (stateStr === 'ENUM_NORMAL' || displayLower.includes('normal') || val === 1) {
    return { displayText: '✅ NORMAL', isTemp: false, isAlarm: false, statusClass: 'text-emerald-400' };
  }

  // Fallback
  return {
    displayText: pt.display_value ? pt.display_value : val.toFixed(1),
    isTemp: false,
    isAlarm: pt.is_alarm,
    statusClass: 'text-white',
  };
}

export const PointsGrid: React.FC<PointsGridProps> = ({
  points,
  onSelectPointTrend,
  onDeletePoint,
}) => {
  if (points.length === 0) {
    return (
      <div className="hw-panel p-12 text-center text-slate-400">
        <Thermometer className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white mb-1">No Sensor Points Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Start your Niagara telemetry poller worker or click <strong className="text-white">"Add Point"</strong> to add points.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {points.map((pt) => {
        const reading = formatPointReading(pt);

        const pct = reading.isTemp
          ? Math.min(100, Math.max(0, (pt.current_value / (pt.alert_threshold || 40)) * 100))
          : 50;

        return (
          <div
            key={pt.point_name}
            className="hw-panel p-4 flex flex-col justify-between relative select-none"
            style={{
              borderLeft: reading.isAlarm ? '3px solid #e52b20' : '1px solid #2d3038',
              backgroundColor: reading.isAlarm ? 'rgba(229, 43, 32, 0.05)' : '#202227',
            }}
          >
            {/* Top Bar */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mb-0.5">
                    <HardDrive className="w-3 h-3 text-cyan-400" />
                    <span>{pt.device_name || 'Niagara Controller'}</span>
                  </div>
                  <h3
                    onClick={() => onSelectPointTrend(pt)}
                    className="text-sm font-semibold font-mono text-cyan-400 hover:underline cursor-pointer"
                  >
                    {pt.point_name}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <StatusBadge point={pt} />
                  <button
                    onClick={() => onDeletePoint(pt.point_name)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 transition cursor-pointer"
                    title={`Delete ${pt.point_name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Central Value */}
              <div
                className="my-3 p-3 rounded"
                style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
              >
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-0.5">
                  Live Telemetry
                </div>
                <div className="flex items-baseline justify-between">
                  <span className={`text-xl font-bold font-mono ${reading.statusClass}`}>
                    {reading.displayText}{reading.isTemp ? ' °C' : ''}
                  </span>
                  {reading.isTemp && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Limit: &ge;{pt.alert_threshold}°C
                    </span>
                  )}
                </div>
              </div>

              {/* Capacity Progress Bar */}
              {reading.isTemp && (
                <div className="space-y-1 mb-3">
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        reading.isAlarm ? 'bg-red-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer */}
            <div className="flex items-center justify-between pt-2.5 border-t border-[#282a32] text-xs text-slate-400">
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                <Clock className="w-3 h-3" />
                <span>{new Date(pt.updated_at).toLocaleTimeString()}</span>
              </div>

              <button
                onClick={() => onSelectPointTrend(pt)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
                style={{ backgroundColor: '#17181c', border: '1px solid #2d3038' }}
              >
                <TrendingUp className="w-3 h-3 text-cyan-400" />
                <span>Trend</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
