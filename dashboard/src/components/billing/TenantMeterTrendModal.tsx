import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  TrendingUp,
  RefreshCw,
  Download,
  Zap,
  Clock,
  DollarSign,
  Activity,
  Layers,
} from 'lucide-react';

import type { TenantInvoiceDb, PointReading } from '../../types/bms';
import { fetchPointReadings } from '../../lib/supabase';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { exportToCsv } from '../../lib/exportCsv';

interface TenantMeterTrendModalProps {
  isOpen: boolean;
  invoice: TenantInvoiceDb | null;
  ratePerKwh: number;
  onClose: () => void;
}

export const TenantMeterTrendModal: React.FC<TenantMeterTrendModalProps> = ({
  isOpen,
  invoice,
  ratePerKwh,
  onClose,
}) => {
  const [readings, setReadings] = useState<PointReading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dataPointsLimit, setDataPointsLimit] = useState<number>(200);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [intervalMode, setIntervalMode] = useState<'1m' | 'raw'>('1m');

  // Load readings from Supabase
  const loadData = async (showSpinner = false) => {
    if (!invoice?.meter_name) return;
    if (showSpinner) setIsLoading(true);
    try {
      const data = await fetchPointReadings(invoice.meter_name, dataPointsLimit);
      setReadings(data);
    } catch (err) {
      console.error('Failed to load point readings for trend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !invoice?.meter_name) return;

    loadData(true);

    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, invoice?.meter_name, dataPointsLimit, isAutoRefresh]);

  // Process Readings by 1-Minute Interval or Raw
  const processedSeries = useMemo(() => {
    if (readings.length === 0) {
      const fallbackKwh = invoice?.kwh_reading || 0;
      return [
        {
          timeStr: 'Current',
          fullTime: new Date().toLocaleString(),
          value: fallbackKwh,
          deltaKwh: 0,
          cost: Number((fallbackKwh * ratePerKwh).toFixed(2)),
          samplesCount: 1,
        },
      ];
    }

    if (intervalMode === '1m') {
      // Bucket by exact 1-minute intervals (YYYY-MM-DD HH:mm:00)
      const minuteMap = new Map<string, { date: Date; values: number[] }>();

      for (const r of readings) {
        const d = new Date(r.recorded_at);
        const pad = (n: number) => String(n).padStart(2, '0');
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
        if (!minuteMap.has(key)) {
          minuteMap.set(key, { date: d, values: [] });
        }
        minuteMap.get(key)!.values.push(r.value);
      }

      const points = Array.from(minuteMap.entries()).map(([key, data], idx, arr) => {
        const lastVal = data.values[data.values.length - 1];
        const cost = Number((lastVal * ratePerKwh).toFixed(2));
        const d = data.date;
        const pad = (n: number) => String(n).padStart(2, '0');
        const prevVal = idx > 0 ? arr[idx - 1][1].values[arr[idx - 1][1].values.length - 1] : lastVal;
        const deltaKwh = Number(Math.max(0, lastVal - prevVal).toFixed(3));

        return {
          timeStr: `${pad(d.getHours())}:${pad(d.getMinutes())}:00`,
          fullTime: key,
          value: Number(lastVal.toFixed(2)),
          deltaKwh,
          cost,
          samplesCount: data.values.length,
        };
      });

      return points;
    }

    // Raw stream
    return readings.map((r, idx) => {
      const d = new Date(r.recorded_at);
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      const fullTime = d.toLocaleString();
      const cost = Number((r.value * ratePerKwh).toFixed(2));
      const prevVal = idx > 0 ? readings[idx - 1].value : r.value;
      const deltaKwh = Number(Math.max(0, r.value - prevVal).toFixed(3));

      return {
        timeStr,
        fullTime,
        value: Number(r.value.toFixed(2)),
        deltaKwh,
        cost,
        samplesCount: 1,
      };
    });
  }, [readings, invoice, ratePerKwh, intervalMode]);

  // Derived Analytics
  const stats = useMemo(() => {
    if (processedSeries.length === 0) {
      const fallbackKwh = invoice?.kwh_reading || 0;
      return {
        min: fallbackKwh,
        max: fallbackKwh,
        avg: fallbackKwh,
        delta: 0,
        current: fallbackKwh,
        pointsCount: 0,
        ratePerMin: 0,
      };
    }

    const values = processedSeries.map((r) => r.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Number((sum / values.length).toFixed(2));
    const current = values[values.length - 1];
    const delta = Number((values[values.length - 1] - values[0]).toFixed(2));

    // Compute average 1-minute delta
    const deltas = processedSeries.map((p) => p.deltaKwh).filter((d) => d > 0);
    const ratePerMin = deltas.length > 0 ? Number((deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(3)) : 0;

    return {
      min,
      max,
      avg,
      delta: Math.max(0, delta),
      current,
      pointsCount: processedSeries.length,
      ratePerMin,
    };
  }, [processedSeries, invoice]);


  if (!isOpen || !invoice) return null;

  // Export 1-Minute Interval Telemetry Data to CSV
  const handleExportCsv = async (exportAll = true) => {
    if (!invoice?.meter_name) return;

    let targetReadings: PointReading[] = readings;
    if (exportAll) {
      try {
        const allData = await fetchPointReadings(invoice.meter_name, 1000);
        if (allData && allData.length > 0) {
          targetReadings = allData;
        }
      } catch (err) {
        console.warn('Using loaded readings for CSV export:', err);
      }
    }

    if (targetReadings.length === 0) return;

    // Bucket readings by exact 1-minute intervals (YYYY-MM-DD HH:mm:00)
    const minuteMap = new Map<string, { date: Date; values: number[] }>();

    for (const r of targetReadings) {
      const d = new Date(r.recorded_at);
      const pad = (n: number) => String(n).padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      if (!minuteMap.has(key)) {
        minuteMap.set(key, { date: d, values: [] });
      }
      minuteMap.get(key)!.values.push(r.value);
    }

    const minuteEntries = Array.from(minuteMap.entries());
    const minutePoints = minuteEntries.map(([key, data], idx, arr) => {
      const lastVal = data.values[data.values.length - 1];
      const prevVal = idx > 0 ? arr[idx - 1][1].values[arr[idx - 1][1].values.length - 1] : lastVal;
      const deltaKwh = Number(Math.max(0, lastVal - prevVal).toFixed(3));
      const cost = Number((lastVal * ratePerKwh).toFixed(2));
      const costKhr = Math.round(cost * 4100);

      return {
        timestamp: key,
        value: lastVal,
        deltaKwh,
        cost,
        costKhr,
        samplesInMinute: data.values.length,
      };
    });

    const headers = [
      '#',
      'Timestamp (1-Minute Interval)',
      'Tenant Name',
      'Invoice #',
      'Unit / Zone',
      'oBIX Meter Tag',
      'Interval Duration',
      'Cumulative Reading (kWh)',
      '1-Min Interval Delta (kWh)',
      'Tariff Rate ($/kWh)',
      'Accrued Cost ($ USD)',
      'Accrued Cost (KHR)',
      'Samples Aggregated',
    ];

    // Export in reverse-chronological order (newest minute interval first)
    const sorted = [...minutePoints].reverse();
    const rows = sorted.map((p, idx) => [
      idx + 1,
      p.timestamp,
      invoice.tenant_name,
      invoice.invoice_number,
      invoice.unit_zone,
      invoice.meter_name,
      '1 Minute (60s)',
      p.value.toFixed(2),
      `+${p.deltaKwh.toFixed(3)}`,
      `$${ratePerKwh.toFixed(4)}`,
      `$${p.cost.toFixed(2)}`,
      `${p.costKhr.toLocaleString()} KHR`,
      `${p.samplesInMinute} raw readings`,
    ]);

    const cleanTenantName = invoice.tenant_name.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    exportToCsv(
      `1Min_Telemetry_${cleanTenantName}_${sorted.length}_minutes_${dateStr}_${timeStr}.csv`,
      headers,
      rows
    );
  };




  const currentCostUsd = Number((stats.current * ratePerKwh + (invoice.demand_charge || 0)).toFixed(2));
  const currentCostKhr = Math.round(currentCostUsd * 4100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-fadeIn">
      <div
        className="w-full max-w-4xl rounded-lg overflow-hidden flex flex-col max-h-[92vh] shadow-2xl border"
        style={{
          backgroundColor: '#1b1d22',
          borderColor: '#2d3038',
        }}
      >
        {/* ── Modal Header ── */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{
            backgroundColor: '#15171b',
            borderBottom: '1px solid #282a32',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-md"
              style={{
                backgroundColor: 'rgba(0, 164, 228, 0.12)',
                border: '1px solid rgba(0, 164, 228, 0.3)',
                color: '#00a4e4',
              }}
            >
              <TrendingUp className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {invoice.tenant_name}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                  {invoice.invoice_number}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {invoice.unit_zone}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                <span className="flex items-center gap-1 text-amber-300 font-medium">
                  <Zap className="w-3.5 h-3.5" />
                  {invoice.meter_name}
                </span>
                <span>•</span>
                <span className="text-slate-400">
                  Cycle: {invoice.start_date || '2026-08-01'} → {invoice.end_date || '2026-08-31'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadData(true)}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Refresh telemetry readings"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => handleExportCsv(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-slate-300 hover:text-white bg-[#22252c] hover:bg-[#2a2d36] border border-[#323640] transition cursor-pointer"
              title="Export complete historical telemetry readings to CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>


            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Key Metric Summary Cards ── */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#17191d] border-b border-[#282a32]">
          {/* Card 1: Live Reading */}
          <div
            className="p-3 rounded-md"
            style={{
              backgroundColor: '#1f2228',
              border: '1px solid #2d313a',
            }}
          >
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Live Consumption</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="font-mono text-xl font-bold text-amber-300 mt-1">
              {stats.current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 ml-1">kWh</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Live from Niagara oBIX
            </div>
          </div>

          {/* Card 2: Estimated Bill Cost */}
          <div
            className="p-3 rounded-md"
            style={{
              backgroundColor: '#1f2228',
              border: '1px solid #2d313a',
            }}
          >
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Total Accrued Cost</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="font-mono text-xl font-bold text-emerald-400 mt-1">
              ${currentCostUsd.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              ~{currentCostKhr.toLocaleString()} KHR (@ ${ratePerKwh.toFixed(3)}/kWh)
            </div>
          </div>

          {/* Card 3: Min, Max & 1-Minute Burn Rate */}
          <div
            className="p-3 rounded-md"
            style={{
              backgroundColor: '#1f2228',
              border: '1px solid #2d313a',
            }}
          >
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>1-Min Interval Rate</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="font-mono text-xs text-slate-200 mt-1 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Rate / Min:</span>
                <span className="font-bold text-emerald-400">+{stats.ratePerMin.toFixed(3)} kWh/m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Peak / Low:</span>
                <span className="font-bold text-cyan-300">{stats.max.toFixed(1)} / {stats.min.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Historical Data Points & Auto Refresh */}
          <div
            className="p-3 rounded-md"
            style={{
              backgroundColor: '#1f2228',
              border: '1px solid #2d313a',
            }}
          >
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Telemetry Stream</span>
              <Layers className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="font-mono text-base font-bold text-white mt-1 flex items-center justify-between">
              <span>{stats.pointsCount} <span className="text-xs font-normal text-slate-400">Buckets</span></span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-700/40">
                1 mn / pt
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-slate-500">Live Polling:</span>
              <button
                type="button"
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded transition cursor-pointer ${
                  isAutoRefresh ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isAutoRefresh ? '3s Active' : 'Paused'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Main Time Series Chart Section ── */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col">
          {/* Controls row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium text-slate-300">
                Energy Consumption Trend ({intervalMode === '1m' ? '1-Minute Intervals' : 'Raw Telemetry'})
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Average: {stats.avg.toFixed(2)} kWh
              </span>
            </div>

            {/* Interval Mode & Sample Limit Selectors */}
            <div className="flex items-center gap-3">
              {/* Interval Grouping Selector */}
              <div className="flex items-center gap-1 bg-[#15171b] p-0.5 rounded border border-[#2d313a]">
                <button
                  type="button"
                  onClick={() => setIntervalMode('1m')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                    intervalMode === '1m'
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1 mn Interval
                </button>
                <button
                  type="button"
                  onClick={() => setIntervalMode('raw')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                    intervalMode === 'raw'
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Raw (3s)
                </button>
              </div>

              {/* Point Limit Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono text-slate-500">Samples:</span>
                {[50, 100, 200, 500].map((limit) => (
                  <button
                    key={limit}
                    type="button"
                    onClick={() => setDataPointsLimit(limit)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                      dataPointsLimit === limit
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'bg-[#22252c] text-slate-400 hover:text-white border border-[#2d313a]'
                    }`}
                  >
                    {limit}
                  </button>
                ))}
              </div>

            </div>
          </div>

          {/* Chart Container */}
          <div
            className="w-full h-72 rounded-md p-3"
            style={{
              backgroundColor: '#14161a',
              border: '1px solid #262932',
            }}
          >
            {processedSeries.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
                <Activity className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                <span>No telemetry logs recorded yet for {invoice.meter_name}.</span>
                <span className="text-[10px] text-slate-600 mt-1">
                  Readings will log automatically as Niagara poller runs.
                </span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={processedSeries}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="kwhElectricGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00a4e4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00a4e4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#22252e" vertical={false} />

                  <XAxis
                    dataKey="timeStr"
                    stroke="#505664"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#282b34' }}
                  />

                  <YAxis
                    stroke="#505664"
                    fontSize={10}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#282b34' }}
                    tickFormatter={(v) => `${v.toFixed(1)}`}
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div
                          className="p-3 rounded shadow-xl font-mono text-xs"
                          style={{
                            backgroundColor: '#1b1e24',
                            border: '1px solid #333844',
                            color: '#ffffff',
                          }}
                        >
                          <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            <span>{item.fullTime}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-amber-300 font-bold">Energy Total:</span>
                            <span className="text-white font-bold">{item.value} kWh</span>
                          </div>
                          {item.deltaKwh !== undefined && (
                            <div className="flex items-center justify-between gap-4 mt-1">
                              <span className="text-cyan-400">1-Min Interval Δ:</span>
                              <span className="text-cyan-300 font-bold">+{item.deltaKwh} kWh</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-4 mt-1 border-t border-slate-700/60 pt-1">
                            <span className="text-emerald-400">Accrued Cost:</span>
                            <span className="text-emerald-300 font-bold">${item.cost}</span>
                          </div>
                        </div>
                      );
                    }}
                  />

                  <ReferenceLine
                    y={stats.avg}
                    stroke="#d0b36b"
                    strokeDasharray="4 4"
                    label={{
                      value: `Avg: ${stats.avg.toFixed(1)} kWh`,
                      fill: '#d0b36b',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#00a4e4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#kwhElectricGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Table of Latest Recorded Telemetry Samples */}
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>
                  Latest Recorded Telemetry Data ({processedSeries.length} {intervalMode === '1m' ? '1-minute intervals' : 'samples'})
                </span>
                <span className="text-[10px] text-amber-300 font-mono">
                  (1 mn / point)
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleExportCsv(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/40 transition cursor-pointer"
                title="Export complete historical telemetry dataset to CSV"
              >
                <Download className="w-2.5 h-2.5" />
                <span>Export Telemetry CSV</span>
              </button>

            </div>

            <div
              className="rounded overflow-hidden border max-h-44 overflow-y-auto"
              style={{
                backgroundColor: '#17191d',
                borderColor: '#262932',
              }}
            >
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: '#131518', borderBottom: '1px solid #262932' }}>
                    <th className="py-1.5 px-3 text-slate-400 font-medium">Timestamp ({intervalMode === '1m' ? '1m' : 'Raw'})</th>
                    <th className="py-1.5 px-3 text-slate-400 font-medium">Meter Tag</th>
                    <th className="py-1.5 px-3 text-slate-400 font-medium text-right">Reading (kWh)</th>
                    <th className="py-1.5 px-3 text-slate-400 font-medium text-right">Interval Δ</th>
                    <th className="py-1.5 px-3 text-slate-400 font-medium text-right">Cost ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {processedSeries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-500 text-xs">
                        No recorded telemetry points yet.
                      </td>
                    </tr>
                  ) : (
                    [...processedSeries]
                      .reverse()
                      .map((p, i) => (
                        <tr
                          key={p.fullTime || i}
                          className="hover:bg-[#20232a] transition-colors"
                          style={{ borderBottom: '1px solid #20232a' }}
                        >
                          <td className="py-1.5 px-3 text-slate-300 font-mono">
                            {p.fullTime}
                          </td>
                          <td className="py-1.5 px-3 text-cyan-300">{invoice.meter_name}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-amber-300">
                            {p.value.toFixed(2)} kWh
                          </td>
                          <td className="py-1.5 px-3 text-right font-bold text-cyan-400">
                            +{p.deltaKwh.toFixed(3)} kWh
                          </td>
                          <td className="py-1.5 px-3 text-right font-bold text-emerald-400">
                            ${p.cost.toFixed(2)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>



        {/* ── Footer ── */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{
            backgroundColor: '#15171b',
            borderTop: '1px solid #282a32',
          }}
        >
          <div className="text-xs text-slate-400 font-mono">
            Tariff Rate: <span className="text-amber-300 font-bold">${ratePerKwh.toFixed(4)}</span> / kWh
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-medium bg-[#2a2d36] hover:bg-[#343843] text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenantMeterTrendModal;
