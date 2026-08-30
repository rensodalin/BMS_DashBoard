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
        
        if (data.current) {
          setCurrentTemp(data.current.temperature_2m);
          setCurrentHumidity(data.current.relative_humidity_2m);
        }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-3xl rounded p-5 relative"
        style={{ backgroundColor: '#202227', border: '1px solid #2d3038' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4" style={{ borderBottom: '1px solid #282a32' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded" style={{ backgroundColor: 'rgba(250, 140, 22, 0.15)', color: '#fa8c16' }}>
              <CloudSun className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Phnom Penh Weather Telemetry</h3>
                <span
                  className="px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-300"
                  style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
                >
                  AccuWeather 49785
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Live Outdoor Temperature & Humidity</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={hourlyData.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-emerald-400 hover:text-emerald-300 transition cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={fetchWeatherTrend}
              disabled={isLoading}
              className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
              style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div
            className="p-3 rounded flex items-center justify-between"
            style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
          >
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-0.5 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-amber-500" /> Outdoor Temperature
              </div>
              <div className="text-xl font-bold font-mono text-amber-500">
                {currentTemp.toFixed(1)} °C
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              <div>Phnom Penh</div>
              <div className="text-amber-500 mt-0.5">Sync: {lastSyncTime}</div>
            </div>
          </div>

          <div
            className="p-3 rounded flex items-center justify-between"
            style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
          >
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-0.5 flex items-center gap-1">
                <Droplets className="w-3 h-3 text-cyan-400" /> Relative Humidity
              </div>
              <div className="text-xl font-bold font-mono text-cyan-400">
                {currentHumidity.toFixed(0)} % RH
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              <div>Phnom Penh</div>
              <div className="text-cyan-400 mt-0.5">Sync: {lastSyncTime}</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div
          className="h-64 w-full rounded p-3 relative"
          style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
        >
          {isLoading && hourlyData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              <span>Loading weather telemetry...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="amberWeatherGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fa8c16" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fa8c16" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="cyanWeatherGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00a4e4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00a4e4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#282a32" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#8b929e' }} />
                <YAxis yAxisId="left" stroke="#fa8c16" tick={{ fontSize: 10, fill: '#fa8c16' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#00a4e4" tick={{ fontSize: 10, fill: '#00a4e4' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121316',
                    borderColor: '#2d3038',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontSize: '11px',
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === 'temp') return [`${value} °C`, 'Temperature'];
                    if (name === 'humidity') return [`${value} % RH`, 'Humidity'];
                    return [value, name];
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="temp"
                  name="temp"
                  stroke="#fa8c16"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#amberWeatherGradient)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="humidity"
                  name="humidity"
                  stroke="#00a4e4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#cyanWeatherGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
};
