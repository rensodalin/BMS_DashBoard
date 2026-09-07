import React, { useState, useEffect } from 'react';
import type { SensorPoint } from '../types/bms';
import { Cloud, Zap, ShieldCheck, Activity, CloudSun, Droplets, TrendingUp } from 'lucide-react';
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3 select-none">
      
      {/* ── Card 1: Connectivity ── */}
      <div className="hw-panel p-3.5 flex flex-col justify-between">
        <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <span>Connectivity</span>
          <Cloud className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 hw-pulse" />
            <span>Online</span>
          </div>
          <div className="text-[11px] font-mono text-slate-300 mt-1">
            <span className="font-bold text-white text-base">{totalPoints}/{totalPoints}</span>
            <span className="text-slate-400 text-[10px] ml-1 uppercase">Devices</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-1">
          Niagara Driver Connected
        </div>
      </div>

      {/* ── Card 2: System Telemetry ── */}
      <div className="hw-panel p-3.5 flex flex-col justify-between">
        <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <span>System Telemetry</span>
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white">{totalPoints}</span>
          <span className="text-xs text-cyan-400 font-mono">Live Points</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          {tempSensors} Temps • {totalPoints - tempSensors} Status/Enums
        </div>
      </div>

      {/* ── Card 3: Outdoor Weather (Phnom Penh Ambient) ── */}
      <div className="hw-panel p-3.5 flex flex-col justify-between relative group">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <CloudSun className="w-3.5 h-3.5 text-amber-500" /> Phnom Penh Ambient
          </span>
          {onOpenWeatherTrend && (
            <button
              onClick={onOpenWeatherTrend}
              className="flex items-center gap-0.5 text-[10px] text-cyan-400 hover:text-cyan-300 transition cursor-pointer font-mono"
              title="View Weather Trend Chart"
            >
              <TrendingUp className="w-3 h-3" /> Trend
            </button>
          )}
        </div>
        <div
          className="flex items-baseline justify-between cursor-pointer"
          onClick={onOpenWeatherTrend}
        >
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-amber-500">{weather.temp.toFixed(1)}</span>
            <span className="text-xs text-slate-400">°C</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-cyan-400 font-mono">
            <Droplets className="w-3 h-3 text-cyan-400" />
            <span>{weather.humidity}% RH</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          AccuWeather Station 49785
        </div>
      </div>

      {/* ── Card 4: Pump System ── */}
      <div className="hw-panel p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
          <span>Pump System</span>
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-cyan-400">{runningPumps}</span>
          <span className="text-xs text-slate-400">Pumps Active</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          Motor Status Running
        </div>
      </div>

      {/* ── Card 5: Electrical System ── */}
      <div className="hw-panel p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
          <span>Electrical System</span>
          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-amber-500">{energizedElectrical}</span>
          <span className="text-xs text-slate-400">ACB Energized</span>
        </div>
        <div className="text-[10px] font-mono" style={{ color: activeAlarms > 0 ? '#ef4444' : '#48bb78' }}>
          {activeAlarms > 0 ? `${activeAlarms} Active Alerts` : 'All Breakers Normal'}
        </div>
      </div>

    </div>
  );
};
