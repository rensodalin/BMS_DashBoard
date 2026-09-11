import React, { useState, useEffect } from 'react';
import { X, CloudSun, RefreshCw, Download, Droplets, Thermometer } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { exportToCsv } from '../lib/exportCsv';

interface WeatherTrendModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeather?: { temp: number; humidity: number; apparentTemp?: number };
  onUpdateWeather?: (w: { temp: number; humidity: number; apparentTemp?: number }) => void;
}

interface HourlyData {
  time: string;
  temp: number;
  humidity: number;
}

export const WeatherTrendModal: React.FC<WeatherTrendModalProps> = ({
  isOpen,
  onClose,
  currentWeather,
  onUpdateWeather,
}) => {
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [currentTemp, setCurrentTemp] = useState<number>(currentWeather?.temp ?? 32.3);
  const [currentHumidity, setCurrentHumidity] = useState<number>(currentWeather?.humidity ?? 62);
  const [apparentTemp, setApparentTemp] = useState<number | undefined>(currentWeather?.apparentTemp ?? 37.1);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync state whenever currentWeather changes
  useEffect(() => {
    if (currentWeather) {
      setCurrentTemp(currentWeather.temp);
      setCurrentHumidity(currentWeather.humidity);
      if (currentWeather.apparentTemp) setApparentTemp(currentWeather.apparentTemp);
    }
  }, [currentWeather]);

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
        'https://api.open-meteo.com/v1/forecast?latitude=11.5564&longitude=104.9282&current=temperature_2m,relative_humidity_2m,apparent_temperature&hourly=temperature_2m,relative_humidity_2m&forecast_days=1'
      );

      if (res.ok) {
        const data = await res.json();

        if (data.current) {
          const newTemp = data.current.temperature_2m;
          const newHum = data.current.relative_humidity_2m;
          const newApparent = data.current.apparent_temperature;
          setCurrentTemp(newTemp);
          setCurrentHumidity(newHum);
          setApparentTemp(newApparent);
          onUpdateWeather?.({ temp: newTemp, humidity: newHum, apparentTemp: newApparent });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
      <div className="w-full max-w-3xl rounded-md p-6 relative bg-white border border-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-50 flex items-center justify-center text-amber-600">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Phnom Penh Weather Telemetry</h3>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 text-amber-700">
                  AccuWeather 49785
                </span>
              </div>
              <p className="text-xs text-slate-400">Live Outdoor Temperature & Humidity</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={hourlyData.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-[#001F3F] bg-[#e6edf5] hover:bg-[#001F3F] hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={fetchWeatherTrend}
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

        {/* Live Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3.5 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 mb-0.5 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-amber-500" /> Outdoor Temperature
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-amber-600">
                  {currentTemp.toFixed(1)} °C
                </span>
                {apparentTemp !== undefined && (
                  <span className="text-xs text-slate-400 font-medium">
                    (Feels {apparentTemp.toFixed(1)}°C)
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 font-mono">
              <div>Phnom Penh</div>
              <div className="text-amber-600 mt-0.5 font-semibold">Sync: {lastSyncTime}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 mb-0.5 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-[#001F3F]" /> Relative Humidity
              </div>
              <div className="text-2xl font-bold font-mono text-[#001F3F]">
                {currentHumidity.toFixed(0)} % RH
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 font-mono">
              <div>Phnom Penh</div>
              <div className="text-[#001F3F] mt-0.5 font-semibold">Sync: {lastSyncTime}</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64 w-full rounded-md p-4 relative bg-white border border-slate-100">
          {isLoading && hourlyData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#001F3F]" />
              <span>Loading weather telemetry...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="amberWeatherGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fa8c16" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#fa8c16" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="intersysBlueWeatherGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#001F3F" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#001F3F" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="left" stroke="#f59e0b" tick={{ fontSize: 10, fill: '#d97706' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#001F3F" tick={{ fontSize: 10, fill: '#001F3F' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#f1f5f9',
                    borderRadius: '4px',
                    color: '#0f172a',
                    fontSize: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
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
                  stroke="#f59e0b"
                  strokeWidth={2.2}
                  fillOpacity={1}
                  fill="url(#amberWeatherGradient)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="humidity"
                  name="humidity"
                  stroke="#001F3F"
                  strokeWidth={2.2}
                  fillOpacity={1}
                  fill="url(#intersysBlueWeatherGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
};
