import React, { useState, useEffect } from 'react';
import { X, TrendingUp, RefreshCw, Download } from 'lucide-react';
import type { SensorPoint, PointReading } from '../types/bms';
import { fetchPointReadings } from '../lib/supabase';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { formatPointReading } from './PointsGrid';
import { exportToCsv } from '../lib/exportCsv';

interface PointTrendModalProps {
  point: SensorPoint | null;
  onClose: () => void;
}

export const PointTrendModal: React.FC<PointTrendModalProps> = ({ point, onClose }) => {
  const [readings, setReadings] = useState<PointReading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!point?.point_name) return;

    loadData(true);

    // Auto-poll historical trend readings every 3 seconds to keep chart live
    const interval = setInterval(() => {
      loadData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [point?.point_name]);

  const loadData = async (showLoading = false) => {
    if (!point) return;
    if (showLoading) setIsLoading(true);
    const data = await fetchPointReadings(point.point_name, 50);
    setReadings(data);
    setIsLoading(false);
  };

  if (!point) return null;

  const reading = formatPointReading(point);

  // Check if this point is an Enum or Boolean Point
  const nameLower = point.point_name.toLowerCase();
  const displayLower = (point.display_value || '').toLowerCase();

  const isEnum =
    nameLower.includes('smoke') ||
    nameLower.includes('status') ||
    nameLower.includes('alarm') ||
    nameLower.includes('fault') ||
    displayLower.includes('normal') ||
    displayLower.includes('alarm') ||
    displayLower.includes('fault') ||
    displayLower.includes('disable');

  const isBool = !reading.isTemp && !isEnum;

  // Enum Y-Axis Tick Label Formatter
  const enumYFormatter = (val: number) => {
    switch (Math.round(val)) {
      case 1:
        return 'Normal';
      case 2:
        return 'Alarm';
      case 3:
        return 'Fault';
      case 4:
        return 'Disable';
      default:
        return String(val);
    }
  };

  // Boolean Y-Axis Tick Label Formatter (1 = Energized, 0 = De-Energized)
  const boolYFormatter = (val: number) => {
    return Math.round(val) === 1 ? 'Energized' : 'De-Energized';
  };

  // Export readings to CSV file for Excel
  const handleExportExcel = () => {
    if (!point || readings.length === 0) return;

    const headers = ['Timestamp', 'Device Name', 'Point Name', 'Numeric Value', 'Formatted Status'];
    const rows = readings.map((r) => {
      const timeStr = new Date(r.recorded_at).toLocaleString();
      const statusText = reading.isTemp
        ? `${r.value.toFixed(1)} °C`
        : isEnum
        ? enumYFormatter(r.value)
        : boolYFormatter(r.value);

      return [timeStr, point.device_name || 'Niagara Controller', point.point_name, r.value, statusText];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToCsv(`${point.point_name}_trend_${dateStr}.csv`, headers, rows);
  };

  // Dynamic calculation of High and Low Limits for Temperature points
  const nameNorm = point.point_name.toLowerCase().replace(/[\s_]+/g, '');
  let lowLimit = point.low_limit;
  let highLimit = point.high_limit || point.alert_threshold || 30.0;

  if (lowLimit === undefined) {
    if (nameNorm.includes('room1')) lowLimit = 18.0;
    else if (nameNorm.includes('room2')) lowLimit = 12.0;
    else if (nameNorm.includes('room3')) lowLimit = 20.0;
    else lowLimit = 20.0; // Default Low Limit
  }

  const chartData = readings.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: r.value,
  }));

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
              <p className="text-xs text-slate-400">Historical Time-Series Telemetry Trend</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export to Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={readings.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition disabled:opacity-50 cursor-pointer"
              title="Export trend telemetry data to Excel (.csv)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Metric Display (Dynamic Real-Time Text Status) */}
        <div className="mb-6">
          <div className="p-4 rounded-xl bg-[#0d131f] border border-[#1f293d] flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">Live Reading</div>
              <div className={`text-2xl font-bold font-mono ${reading.statusClass}`}>
                {reading.displayText}{reading.isTemp ? ' °C' : ''}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 font-mono">
              Last Sync: {point.updated_at ? new Date(point.updated_at).toLocaleTimeString() : 'Live'}
            </div>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-64 w-full bg-[#0d131f] rounded-xl p-4 border border-[#1f293d] relative">
          {isLoading && chartData.length === 0 ? (
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
                
                {/* Y-Axis: Format ticks dynamically for Enum vs Boolean vs Temperature */}
                {isEnum ? (
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    ticks={[1, 2, 3, 4]}
                    domain={[0.5, 4.5]}
                    tickFormatter={enumYFormatter}
                  />
                ) : isBool ? (
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    ticks={[0, 1]}
                    domain={[-0.25, 1.25]}
                    tickFormatter={boolYFormatter}
                  />
                ) : (
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                )}

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#1f293d',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => {
                    if (isEnum) return [enumYFormatter(Number(value)), 'Status'];
                    if (isBool) return [boolYFormatter(Number(value)), 'Status'];
                    return [reading.isTemp ? `${value} °C` : value, 'Value'];
                  }}
                />

                {reading.isTemp && (
                  <>
                    {/* High Limit Reference Line (Red Dashed) */}
                    <ReferenceLine
                      y={highLimit}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      label={{ value: `High Limit (${highLimit}°C)`, fill: '#ef4444', fontSize: 10, position: 'top' }}
                    />
                    {/* Low Limit Reference Line (Amber/Orange Dashed) */}
                    <ReferenceLine
                      y={lowLimit}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      label={{ value: `Low Limit (${lowLimit}°C)`, fill: '#f59e0b', fontSize: 10, position: 'bottom' }}
                    />
                  </>
                )}

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
