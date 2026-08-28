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
  // Evaluated FIRST so enum points like SmokeRoom1 showing Fault (3) display FAULT (3)!
  if (stateStr === 'ENUM_FAULT' || displayLower.includes('fault') || val === 3) {
    return { displayText: '⚠️ FAULT ', isTemp: false, isAlarm: true, statusClass: 'text-amber-400' };
  }
  if (stateStr === 'ENUM_DISABLE' || displayLower.includes('disable') || displayLower.includes('disabled') || val === 4) {
    return { displayText: '🔴 DISABLED ', isTemp: false, isAlarm: false, statusClass: 'text-slate-400' };
  }
  if (stateStr === 'ENUM_ALARM' || (displayLower.includes('alarm') && !isSmoke) || val === 2) {
    return { displayText: '🚨 ALARM ', isTemp: false, isAlarm: true, statusClass: 'text-red-400' };
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

  // 3. SMOKE / FIRE ALARM POINT (Boolean Smoke/Fire)
  if (isSmoke || stateStr === 'SMOKE_ALARM' || stateStr === 'SMOKE_NORMAL') {
    const isAlarm = pt.is_alarm || stateStr === 'SMOKE_ALARM' || val === 1 || displayLower.includes('true');
    return {
      displayText: isAlarm ? '✅ NORMAL' : '✅ CLEAR (NORMAL)',
      isTemp: false,
      isAlarm,
      statusClass: isAlarm ? 'text-green-400' : 'text-emerald-400',
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
    return { displayText: '✅ NORMAL (1)', isTemp: false, isAlarm: false, statusClass: 'text-emerald-400' };
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
      <div className="bms-panel p-12 rounded-xl text-center text-slate-400">
        <Thermometer className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white mb-1">No Sensor Points Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Start your Node.js poller worker (<code className="text-blue-400">npm start</code>) or click <strong className="text-white">"Add Sensor Point"</strong> to add points.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
      {points.map((pt) => {
        const reading = formatPointReading(pt);

        // Gauge percentage calculation
        const pct = reading.isTemp
          ? Math.min(100, Math.max(0, (pt.current_value / (pt.alert_threshold || 40)) * 100))
          : 50;

        return (
          <div
            key={pt.point_name}
            className={`bms-card p-5 flex flex-col justify-between relative group ${reading.isAlarm ? 'bms-card-alarm' : ''
              }`}
          >
            {/* Top Bar */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mb-1">
                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                    <span>{pt.device_name || 'Niagara Controller'}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white font-mono">{pt.point_name}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge point={pt} />

                  {/* Delete Card Button */}
                  <button
                    onClick={() => onDeletePoint(pt.point_name)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition cursor-pointer"
                    title={`Delete ${pt.point_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Central Value */}
              <div className="my-4 p-3.5 rounded-lg bg-[#0d131f] border border-[#1f293d] flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400 font-medium mb-0.5">Live Reading</div>
                  <div className="flex items-baseline">
                    <span className={`text-2xl font-bold font-mono tracking-tight ${reading.statusClass}`}>
                      {reading.displayText}
                    </span>
                    {reading.isTemp && <span className="text-xs font-medium text-slate-400 ml-1.5">&deg;C</span>}
                  </div>
                </div>

                {reading.isTemp && (
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400 font-medium mb-0.5">Limit Threshold</div>
                    <div className="text-xs font-mono font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 inline-block">
                      &ge; {pt.alert_threshold}&deg;C
                    </div>
                  </div>
                )}
              </div>

              {/* Capacity Progress Bar */}
              {reading.isTemp && (
                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>0&deg;C</span>
                    <span className="text-slate-300">{pct.toFixed(0)}% Limit Capacity</span>
                    <span>{pt.alert_threshold}&deg;C</span>
                  </div>
                  <div className="w-full bg-[#0d131f] rounded-full h-2 overflow-hidden border border-[#1f293d]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${reading.isAlarm ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#1f293d] text-xs text-slate-400 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{new Date(pt.updated_at).toLocaleTimeString()}</span>
              </div>

              <button
                onClick={() => onSelectPointTrend(pt)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> View Trend
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
