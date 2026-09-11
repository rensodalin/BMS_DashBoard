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

  const boolYFormatter = (val: number) => {
    return Math.round(val) === 1 ? 'Energized' : 'De-Energized';
  };

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

  const nameNorm = point.point_name.toLowerCase().replace(/[\s_]+/g, '');
  let lowLimit = point.low_limit;
  let highLimit = point.high_limit || point.alert_threshold || 30.0;

  if (lowLimit === undefined) {
    if (nameNorm.includes('room1')) lowLimit = 18.0;
    else if (nameNorm.includes('room2')) lowLimit = 12.0;
    else if (nameNorm.includes('room3')) lowLimit = 20.0;
    else lowLimit = 20.0;
  }

  const chartData = readings.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: r.value,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl rounded-md p-6 relative bg-white border border-slate-100 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#e6edf5] flex items-center justify-center text-[#001F3F]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{point.point_name}</h3>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#e6edf5] text-[#001F3F]">
                  {point.device_name || 'Niagara Controller'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Historical Time-Series Telemetry Trend</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={readings.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-[#001F3F] bg-[#e6edf5] hover:bg-[#001F3F] hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={isLoading}
              className="p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#001F3F]' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Metric */}
        <div className="p-3.5 rounded-md bg-slate-50 border border-slate-100 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 mb-0.5">Live Telemetry</div>
            <div className={`text-xl font-bold font-mono ${reading.statusClass}`}>
              {reading.displayText}{reading.isTemp ? ' °C' : ''}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 font-mono">
            Last Sync: {point.updated_at ? new Date(point.updated_at).toLocaleTimeString() : 'Live'}
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-64 w-full rounded-md p-3 relative bg-white border border-slate-100">
          {isLoading && chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#001F3F]" />
              <span>Loading trend readings...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
              No historical samples recorded yet for this point.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="intersysBlueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#001F3F" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#001F3F" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} />

                {isEnum ? (
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    ticks={[1, 2, 3, 4]}
                    domain={[0.5, 4.5]}
                    tickFormatter={enumYFormatter}
                  />
                ) : isBool ? (
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    ticks={[0, 1]}
                    domain={[-0.25, 1.25]}
                    tickFormatter={boolYFormatter}
                  />
                ) : (
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} />
                )}

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#f1f5f9',
                    borderRadius: '4px',
                    color: '#0f172a',
                    fontSize: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                  }}
                  formatter={(value: any) => {
                    if (isEnum) return [enumYFormatter(Number(value)), 'Status'];
                    if (isBool) return [boolYFormatter(Number(value)), 'Status'];
                    return [reading.isTemp ? `${value} °C` : value, 'Value'];
                  }}
                />

                {reading.isTemp && (
                  <>
                    <ReferenceLine
                      y={highLimit}
                      stroke="#FF3523"
                      strokeDasharray="3 3"
                      label={{ value: `High Limit (${highLimit}°C)`, fill: '#FF3523', fontSize: 10, position: 'top' }}
                    />
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
                  stroke="#001F3F"
                  strokeWidth={2.2}
                  fillOpacity={1}
                  fill="url(#intersysBlueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
};
