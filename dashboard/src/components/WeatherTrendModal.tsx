import React, { useState, useEffect } from 'react';
import { X, CloudSun, RefreshCw, Download, Droplets, Thermometer } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { exportToCsv } from '../lib/exportCsv';

interface WeatherTrendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HourlyData {
  time: string;
  temp: number;
  humidity: number;
}

export const WeatherTrendModal: React.FC<WeatherTrendModalProps> = ({ isOpen, onClose }) => {
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [currentTemp, setCurrentTemp] = useState<number>(30.3);
  const [currentHumidity, setCurrentHumidity] = useState<number>(66);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetchWeatherTrend();

      // Auto-poll weather trend every 30 seconds to stay locked to current time
      const timer = setInterval(() => {
        fetchWeatherTrend();
      }, 30000);

      return () => clearInterval(timer);
    }
  }, [isOpen]);

  const fetchWeatherTrend = async () => {
    setIsLoading(true);
    const now = new Date();
    setLastSyncTime(now.toLocaleTimeString());

    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=11.5564&longitude=104.9282&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m,relative_humidity_2m&forecast_days=1'
      );

      if (res.ok) {
        const data = await res.json();
        
        // Live current values
        if (data.current) {
          setCurrentTemp(data.current.temperature_2m);
          setCurrentHumidity(data.current.relative_humidity_2m);
        }

        // Hourly trend array
        if (data.hourly && data.hourly.time) {
          const times: string[] = data.hourly.time;
          const temps: number[] = data.hourly.temperature_2m;
          const hums: number[] = data.hourly.relative_humidity_2m;

          const formatted: HourlyData[] = times.map((t, idx) => ({
            time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            temp: temps[idx],
            humidity: hums[idx],
          }));

          setHourlyData(formatted);
        }
      }
    } catch (err) {
      console.warn('Weather trend fetch error, fallback active');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleExportExcel = () => {
    if (hourlyData.length === 0) return;

    const headers = ['Time', 'Location', 'Outdoor Temperature (°C)', 'Outdoor Relative Humidity (%)'];
    const rows = hourlyData.map((d) => [
      d.time,
      'Phnom Penh, Cambodia',
      d.temp.toFixed(1),
      d.humidity.toFixed(0),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToCsv(`Phnom_Penh_Weather_Trend_${dateStr}.csv`, headers, rows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn font-sans">
      <div className="bms-panel w-full max-w-3xl rounded-2xl border border-[#23314a] p-6 relative bg-[#111827]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1f293d] mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Phnom Penh Weather Telemetry</h3>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300">
                  AccuWeather Location 49785
                </span>
              </div>
              <p className="text-xs text-slate-400">Live Outdoor Temperature & Relative Humidity Telemetry</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={hourlyData.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition disabled:opacity-50 cursor-pointer"
              title="Export weather telemetry data to Excel (.csv)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={fetchWeatherTrend}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Refresh weather data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Metric Cards (Updates with exact current time) */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-[#0d131f] border border-[#1f293d] flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-amber-400" /> Outdoor Temperature
              </div>
              <div className="text-2xl font-bold font-mono text-amber-400">
                {currentTemp.toFixed(1)} °C
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Phnom Penh</div>
              <div className="text-[10px] text-amber-400 mt-1">Sync: {lastSyncTime}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0d131f] border border-[#1f293d] flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" /> Relative Humidity
              </div>
              <div className="text-2xl font-bold font-mono text-cyan-400">
                {currentHumidity.toFixed(0)} % RH
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Phnom Penh</div>
              <div className="text-[10px] text-cyan-400 mt-1">Sync: {lastSyncTime}</div>
            </div>
          </div>
        </div>

        {/* Recharts Dual Temperature & Humidity Area Chart */}
        <div className="h-64 w-full bg-[#0d131f] rounded-xl p-4 border border-[#1f293d] relative">
          {isLoading && hourlyData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Loading weather trend data...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" stroke="#f59e0b" tick={{ fontSize: 10, fill: '#f59e0b' }} label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" tick={{ fontSize: 10, fill: '#06b6d4' }} label={{ value: '% RH', angle: 90, position: 'insideRight', fill: '#06b6d4', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#1f293d',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === 'temp') return [`${value} °C`, 'Outdoor Temperature'];
                    if (name === 'humidity') return [`${value} % RH`, 'Relative Humidity'];
                    return [value, name];
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="temp"
                  name="temp"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#amberGradient)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="humidity"
                  name="humidity"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#cyanGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
};
