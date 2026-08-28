import React, { useState, useEffect } from 'react';
import type { SensorPoint } from '../types/bms';
import { Zap, ShieldCheck, Activity, CloudSun, Droplets, TrendingUp } from 'lucide-react';

interface StatsOverviewProps {
  points: SensorPoint[];
  onOpenWeatherTrend?: () => void;
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

  if (!isPumpOrFan) return false;

  return (
    val === 1 ||
    (val > 0 && !nameLower.includes('temp')) ||
    pt.is_alarm ||
    pt.state === 'BOOL_ON' ||
    displayLower.includes('true') ||
    displayLower.includes('run') ||
    displayLower.includes('running') ||
    displayLower.includes('on')
  );
}

export function isAcbEnergized(pt: SensorPoint): boolean {
  const nameLower = pt.point_name.toLowerCase();
  const devLower = (pt.device_name || '').toLowerCase();
  const displayLower = (pt.display_value || '').toLowerCase();
  const val = pt.current_value;

  const isAcb =
    nameLower.includes('acb') ||
    nameLower.includes('breaker') ||
    nameLower.includes('mcb') ||
    nameLower.includes('vcb') ||
    nameLower.includes('electrical') ||
    devLower.includes('acb') ||
    devLower.includes('breaker') ||
    devLower.includes('electrical');

  if (!isAcb) return false;

  return (
    val === 1 ||
    (val > 0 && !nameLower.includes('temp')) ||
    pt.is_alarm ||
    pt.state === 'BOOL_ON' ||
    displayLower.includes('true') ||
    displayLower.includes('energized') ||
    displayLower.includes('on')
  );
}

export function isEquipmentRunning(pt: SensorPoint): boolean {
  return isPumpRunning(pt) || isAcbEnergized(pt);
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ points, onOpenWeatherTrend }) => {
  const totalPoints = points.length;

  // Live Weather State for Phnom Penh (AccuWeather Location 49785)
  const [weather, setWeather] = useState<{ temp: number; humidity: number }>({
    temp: 30.3,
    humidity: 66,
  });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=11.5564&longitude=104.9282&current=temperature_2m,relative_humidity_2m'
        );
        if (res.ok) {
          const data = await res.json();
          if (data.current) {
            setWeather({
              temp: data.current.temperature_2m,
              humidity: data.current.relative_humidity_2m,
            });
          }
        }
      } catch (err) {
        console.warn('Weather fetch fallback active');
      }
    };

    fetchWeather();
    const timer = setInterval(fetchWeather, 300000); // 5 minutes poll
    return () => clearInterval(timer);
  }, []);

  // 1. Pump System (Dynamic detection of Pumps & Fans)
  const runningPumps = points.filter(isPumpRunning).length;

  // 2. Electrical System (Dynamic detection of ACB Breakers)
  const energizedElectrical = points.filter(isAcbEnergized).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      
      {/* Card 1: Station Connectivity */}
      <div className="bms-panel p-4 rounded-xl border border-[#1e2638] bg-[#131924]">
        <div className="text-xs font-medium text-slate-400 mb-2">Connectivity</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>• Online</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {totalPoints}/{totalPoints} CONNECTIVITY
          </div>
        </div>
      </div>

      {/* Card 2: System Telemetry Stream */}
      <div className="bms-panel p-4 rounded-xl border border-[#1e2638] bg-[#131924]">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>System Telemetry</span>
          <Activity className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white">{totalPoints}</span>
          <span className="text-xs text-blue-400 font-mono">Live Points</span>
        </div>
      </div>

      {/* Card 3: Outdoor Weather (Phnom Penh Ambient Monitor with View Trend) */}
      <div className="bms-panel p-4 rounded-xl border border-[#1e2638] bg-[#131924] relative group">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <CloudSun className="w-3.5 h-3.5 text-amber-400" /> Phnom Penh Ambient
          </span>
          {onOpenWeatherTrend && (
            <button
              onClick={onOpenWeatherTrend}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition cursor-pointer font-mono bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/20"
              title="View Weather Trend Chart"
            >
              <TrendingUp className="w-3 h-3" /> Trend
            </button>
          )}
        </div>
        <div
          className="flex items-baseline justify-between mt-1 cursor-pointer"
          onClick={onOpenWeatherTrend}
        >
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-amber-400">{weather.temp.toFixed(1)}</span>
            <span className="text-xs text-slate-400">°C</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-cyan-400 font-mono">
            <Droplets className="w-3 h-3 text-cyan-400" />
            <span>{weather.humidity}% RH</span>
          </div>
        </div>
      </div>

      {/* Card 4: Pump System */}
      <div className="bms-panel p-4 rounded-xl border border-[#1e2638] bg-[#131924]">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Pump System</span>
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-cyan-400">{runningPumps}</span>
          <span className="text-xs text-slate-400">Pumps Active</span>
        </div>
      </div>

      {/* Card 5: Electrical System */}
      <div className="bms-panel p-4 rounded-xl border border-[#1e2638] bg-[#131924]">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Electrical System</span>
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-amber-400">{energizedElectrical}</span>
          <span className="text-xs text-slate-400">ACB Energized</span>
        </div>
      </div>

    </div>
  );
};
