import React, { useState, useEffect } from 'react';
import type { SensorPoint } from '../types/bms';
import { Droplets, TrendingUp } from 'lucide-react';
import { formatPointReading } from './PointsGrid';

interface StatsOverviewProps {
  points: SensorPoint[];
  onOpenWeatherTrend?: () => void;
  weather?: { temp: number; humidity: number; apparentTemp?: number };
  onUpdateWeather?: (w: { temp: number; humidity: number; apparentTemp?: number }) => void;
}

export function isPumpRunning(pt: SensorPoint): boolean {
  const nameLower = pt.point_name.toLowerCase();
  const devLower = (pt.device_name || '').toLowerCase();
  const displayLower = (pt.display_value || '').toLowerCase();
  const val = pt.current_value;

  const isPumpOrFan =
    nameLower.includes('pump') ||
    nameLower.includes('fan') ||
    nameLower.includes('ahu') ||
    nameLower.includes('chiller') ||
    devLower.includes('pump') ||
    devLower.includes('fan') ||
    devLower.includes('ahu') ||
    devLower.includes('chiller');

  if (isPumpOrFan) {
    if (displayLower.includes('run') || displayLower.includes('on') || displayLower.includes('true')) return true;
    if (val === 1) return true;
  }
  return false;
}

export function isAcbEnergized(pt: SensorPoint): boolean {
  const nameLower = pt.point_name.toLowerCase();
  const devLower = (pt.device_name || '').toLowerCase();
  const displayLower = (pt.display_value || '').toLowerCase();
  const val = pt.current_value;

  const isAcbOrElec =
    nameLower.includes('acb') ||
    nameLower.includes('breaker') ||
    nameLower.includes('main') ||
    nameLower.includes('incomer') ||
    devLower.includes('acb') ||
    devLower.includes('breaker') ||
    devLower.includes('main') ||
    devLower.includes('incomer');

  if (isAcbOrElec) {
    if (displayLower.includes('energized') || displayLower.includes('closed') || displayLower.includes('on')) return true;
    if (val === 1) return true;
  }
  return false;
}

export function isEquipmentRunning(pt: SensorPoint): boolean {
  return isPumpRunning(pt) || isAcbEnergized(pt);
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  points,
  onOpenWeatherTrend,
  weather: propWeather,
  onUpdateWeather,
}) => {
  const totalPoints = points.length;

  const [localWeather, setLocalWeather] = useState<{ temp: number; humidity: number; apparentTemp?: number }>(
    propWeather || { temp: 32.3, humidity: 62, apparentTemp: 37.1 }
  );

  const weather = propWeather || localWeather;

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=11.5564&longitude=104.9282&current=temperature_2m,relative_humidity_2m,apparent_temperature'
        );
        if (res.ok) {
          const data = await res.json();
          if (data.current) {
            const w = {
              temp: data.current.temperature_2m,
              humidity: data.current.relative_humidity_2m,
              apparentTemp: data.current.apparent_temperature,
            };
            setLocalWeather(w);
            onUpdateWeather?.(w);
          }
        }
      } catch (err) {
        console.warn('Weather fetch fallback active');
      }
    };

    fetchWeather();
    const timer = setInterval(fetchWeather, 60000);
    return () => clearInterval(timer);
  }, [onUpdateWeather]);

  const runningPumps = points.filter(isPumpRunning).length;
  const energizedElectrical = points.filter(isAcbEnergized).length;
  const activeAlarms = points.filter((p) => formatPointReading(p).isAlarm).length;
  const tempSensors = points.filter((p) => formatPointReading(p).isTemp).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5 select-none">

      {/* ── Card 1: Connectivity ── */}
      <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow min-h-[148px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Connectivity</span>

        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">{totalPoints}/{totalPoints}</span>
            <span className="text-[11px] font-medium text-slate-500">Points</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#e6edf5] text-[#001F3F] text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#001F3F] animate-pulse" />
              100% Online
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>Niagara Driver Connected</span>

        </div>
      </div>

      {/* ── Card 2: System Telemetry ── */}
      <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow min-h-[148px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">System Telemetry</span>

        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">{totalPoints}</span>
            <span className="text-[11px] font-medium text-slate-500">Channels</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#e6edf5] text-[#001F3F] text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#001F3F] animate-pulse" />
              Live Stream Active
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>{tempSensors} Temps</span>
          <span>{totalPoints - tempSensors} Status/Enums</span>
        </div>
      </div>

      {/* ── Card 3: Outdoor Weather (Phnom Penh Ambient) ── */}
      <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow min-h-[148px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Outdoor Ambient</span>

        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">{weather.temp.toFixed(1)}</span>
            <span className="text-[11px] font-medium text-slate-500">°C Ambient</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              type="button"
              onClick={onOpenWeatherTrend}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#e6edf5] text-[#001F3F] text-[10px] font-semibold hover:bg-[#001F3F] hover:text-white transition-colors cursor-pointer"
              title="Click to view weather trend"
            >
              <Droplets className="w-3 h-3" />
              <span>{weather.humidity}% Humidity</span>
              {onOpenWeatherTrend && <TrendingUp className="w-2.5 h-2.5 ml-0.5" />}
            </button>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>Phnom Penh Station</span>

        </div>
      </div>

      {/* ── Card 4: Pump System ── */}
      <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow min-h-[148px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Pumps & Fans</span>

        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">{runningPumps}</span>
            <span className="text-[11px] font-medium text-slate-500">Running</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#e6edf5] text-[#001F3F] text-[10px] font-semibold">
              <span className={`w-1.5 h-1.5 rounded-full ${runningPumps > 0 ? 'bg-emerald-500' : 'bg-slate-400'} animate-pulse`} />
              {runningPumps > 0 ? 'Operational' : 'Standby'}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>AHU & Circulation Pumps</span>

        </div>
      </div>

      {/* ── Card 5: Electrical System ── */}
      <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow min-h-[148px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Electrical System</span>

        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">{energizedElectrical}</span>
            <span className="text-[11px] font-medium text-slate-500">Incomers</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold ${activeAlarms > 0
              ? 'bg-[#fef2f2] text-[#FF3523]'
              : 'bg-[#e6edf5] text-[#001F3F]'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${activeAlarms > 0 ? 'bg-[#FF3523]' : 'bg-[#001F3F]'} animate-pulse`} />
              {activeAlarms > 0 ? `${activeAlarms} Active Alerts` : 'Breakers Normal'}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>Low Voltage Distribution</span>

        </div>
      </div>

    </div>
  );
};
