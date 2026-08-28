import React from 'react';
import type { SensorPoint } from '../types/bms';
import { StatusBadge } from './StatusBadge';
import { TrendingUp, Clock, HardDrive, Thermometer } from 'lucide-react';

interface PointsGridProps {
  points: SensorPoint[];
  onSelectPointTrend: (point: SensorPoint) => void;
}

export const PointsGrid: React.FC<PointsGridProps> = ({ points, onSelectPointTrend }) => {
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
        const isAlarm = pt.is_alarm || pt.current_value >= pt.alert_threshold;
        const nameLower = pt.point_name.toLowerCase();
        const isTemp = nameLower.includes('temp') || nameLower.includes('room');

        // Gauge percentage calculation
        const pct = isTemp
          ? Math.min(100, Math.max(0, (pt.current_value / (pt.alert_threshold || 40)) * 100))
          : 50;

        return (
          <div
            key={pt.point_name}
            className={`bms-card p-5 flex flex-col justify-between ${
              isAlarm ? 'bms-card-alarm' : ''
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
                <StatusBadge point={pt} />
              </div>

              {/* Central Value */}
              <div className="my-4 p-3.5 rounded-lg bg-[#0d131f] border border-[#1f293d] flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400 font-medium mb-0.5">Live Reading</div>
                  <div className="flex items-baseline">
                    <span className={`text-3xl font-bold font-mono tracking-tight ${isAlarm ? 'text-red-400' : 'text-white'}`}>
                      {pt.display_value ? pt.display_value : pt.current_value.toFixed(1)}
                    </span>
                    {isTemp && <span className="text-xs font-medium text-slate-400 ml-1.5">&deg;C</span>}
                  </div>
                </div>

                {isTemp && (
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400 font-medium mb-0.5">Limit Threshold</div>
                    <div className="text-xs font-mono font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 inline-block">
                      &ge; {pt.alert_threshold}&deg;C
                    </div>
                  </div>
                )}
              </div>

              {/* Capacity Progress Bar */}
              {isTemp && (
                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>0&deg;C</span>
                    <span className="text-slate-300">{pct.toFixed(0)}% Limit Capacity</span>
                    <span>{pt.alert_threshold}&deg;C</span>
                  </div>
                  <div className="w-full bg-[#0d131f] rounded-full h-2 overflow-hidden border border-[#1f293d]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isAlarm ? 'bg-red-500' : 'bg-blue-500'
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
