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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-3xl rounded p-5 relative"
        style={{ backgroundColor: '#202227', border: '1px solid #2d3038' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4" style={{ borderBottom: '1px solid #282a32' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded" style={{ backgroundColor: 'rgba(0, 164, 228, 0.15)', color: '#00a4e4' }}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-mono font-bold text-white">{point.point_name}</h3>
                <span
                  className="px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-300"
                  style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
                >
                  {point.device_name || 'Niagara Controller'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Historical Time-Series Telemetry Trend</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={readings.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-emerald-400 hover:text-emerald-300 transition cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={isLoading}
              className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
              style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Metric */}
        <div
          className="p-3 rounded mb-4 flex items-center justify-between"
          style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
        >
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-0.5">Live Telemetry</div>
            <div className={`text-xl font-bold font-mono ${reading.statusClass}`}>
              {reading.displayText}{reading.isTemp ? ' °C' : ''}
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500 font-mono">
            Last Sync: {point.updated_at ? new Date(point.updated_at).toLocaleTimeString() : 'Live'}
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div
          className="h-64 w-full rounded p-3 relative"
          style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
        >
          {isLoading && chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading trend readings...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
              No historical samples recorded yet for this point.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="honeywellCyanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00a4e4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00a4e4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#282a32" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#8b929e' }} />
                
                {isEnum ? (
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#8b929e' }}
                    ticks={[1, 2, 3, 4]}
                    domain={[0.5, 4.5]}
                    tickFormatter={enumYFormatter}
                  />
                ) : isBool ? (
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#8b929e' }}
                    ticks={[0, 1]}
                    domain={[-0.25, 1.25]}
                    tickFormatter={boolYFormatter}
                  />
                ) : (
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#8b929e' }} />
                )}

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121316',
                    borderColor: '#2d3038',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontSize: '11px',
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
                      stroke="#e52b20"
                      strokeDasharray="3 3"
                      label={{ value: `High Limit (${highLimit}°C)`, fill: '#e52b20', fontSize: 10, position: 'top' }}
                    />
                    <ReferenceLine
                      y={lowLimit}
                      stroke="#fa8c16"
                      strokeDasharray="3 3"
                      label={{ value: `Low Limit (${lowLimit}°C)`, fill: '#fa8c16', fontSize: 10, position: 'bottom' }}
                    />
                  </>
                )}

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00a4e4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#honeywellCyanGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
};
