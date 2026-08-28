import React, { useState, useEffect } from 'react';
import { X, TrendingUp, RefreshCw } from 'lucide-react';
import type { SensorPoint, PointReading } from '../types/bms';
import { fetchPointReadings } from '../lib/supabase';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';

interface PointTrendModalProps {
  point: SensorPoint | null;
  onClose: () => void;
}

export const PointTrendModal: React.FC<PointTrendModalProps> = ({ point, onClose }) => {
  const [readings, setReadings] = useState<PointReading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (point) {
      loadData();
    }
  }, [point]);

  const loadData = async () => {
    if (!point) return;
    setIsLoading(true);
    const data = await fetchPointReadings(point.point_name, 35);
    setReadings(data);
    setIsLoading(false);
  };

  if (!point) return null;

  const chartData = readings.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: r.value,
    threshold: point.alert_threshold,
  }));

  const isAlarm = point.is_alarm || point.current_value >= point.alert_threshold;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bms-panel w-full max-w-3xl rounded-2xl border border-[#23314a] p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1f293d] mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-mono font-semibold text-white">{point.point_name}</h3>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300">
                  {point.device_name || 'Niagara Controller'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Historical Time-Series Log Trend</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Metric Statistics Bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-3.5 rounded-xl bg-[#0d131f] border border-[#1f293d] text-center">
            <div className="text-xs text-slate-400 font-medium">Current Value</div>
            <div className={`text-2xl font-bold font-mono mt-1 ${isAlarm ? 'text-red-400' : 'text-white'}`}>
              {point.display_value || point.current_value.toFixed(1)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d131f] border border-[#1f293d] text-center">
            <div className="text-xs text-slate-400 font-medium">Alert Threshold</div>
            <div className="text-2xl font-bold font-mono text-red-400 mt-1">
              &ge; {point.alert_threshold}&deg;C
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d131f] border border-[#1f293d] text-center">
            <div className="text-xs text-slate-400 font-medium">Logged Samples</div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
              {readings.length}
            </div>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-64 w-full bg-[#0d131f] rounded-xl p-4 border border-[#1f293d] relative">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span>Loading trend data...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
              No historical log samples recorded yet for this point.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cleanBlueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#1f293d',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <ReferenceLine y={point.alert_threshold} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Limit', fill: '#ef4444', fontSize: 10 }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#cleanBlueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
};
