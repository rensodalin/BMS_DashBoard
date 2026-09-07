import React from 'react';
import {
  Search,
  Zap,
  FileText,
  ChevronsUpDown,
  Download,
  Calendar,
  Clock,
  Edit,
  Trash2,
  X,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { TenantInvoiceDb } from '../../types/bms';
import { fetchMeterReadingRange, type MeterReadingRangeResult } from '../../lib/supabase';


export const toDateTimeInputValue = (val?: string): string => {
  if (!val) return '';
  if (val.length === 10) return `${val}T00:00:00`;
  if (val.includes(' ') && !val.includes('T')) return val.replace(' ', 'T');
  return val;
};

export const formatDisplayDateTime = (val?: string): string => {
  if (!val) return 'N/A';
  const clean = val.replace('T', ' ');
  return clean.length >= 19 ? clean.slice(0, 19) : clean;
};

export const getDurationText = (startStr?: string, endStr?: string): string | null => {
  if (!startStr || !endStr) return null;
  const s = new Date(startStr.includes(' ') ? startStr.replace(' ', 'T') : startStr).getTime();
  const e = new Date(endStr.includes(' ') ? endStr.replace(' ', 'T') : endStr).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return null;
  const diffSec = Math.floor((e - s) / 1000);
  const d = Math.floor(diffSec / 86400);
  const h = Math.floor((diffSec % 86400) / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const sec = diffSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

export interface IntervalCalculationResult {
  kwh: number;
  durationText: string;
  durationSec: number;
  durationHours: number;
  fraction: number;
  startHourStr: string;
  endHourStr: string;
  startReading: number | null;
  endReading: number | null;
  hasTelemetry: boolean;
}

export const calculateIntervalConsumption = (
  baseKwh: number,
  startStr?: string,
  endStr?: string,
  rangeResult?: MeterReadingRangeResult,
  cycleDays: number = 30
): IntervalCalculationResult => {
  const pad = (n: number) => String(n).padStart(2, '0');

  if (!startStr || !endStr) {
    return {
      kwh: baseKwh,
      durationText: '720.00 hrs (30d)',
      durationSec: 30 * 86400,
      durationHours: 720.0,
      fraction: 1,
      startHourStr: '00:00:00',
      endHourStr: '23:59:59',
      startReading: null,
      endReading: baseKwh,
      hasTelemetry: false,
    };
  }

  const s = new Date(startStr.includes(' ') ? startStr.replace(' ', 'T') : startStr);
  const e = new Date(endStr.includes(' ') ? endStr.replace(' ', 'T') : endStr);

  const sTime = s.getTime();
  const eTime = e.getTime();

  const startHourStr = isNaN(sTime)
    ? '00:00:00'
    : `${pad(s.getHours())}:${pad(s.getMinutes())}:${pad(s.getSeconds())}`;
  const endHourStr = isNaN(eTime)
    ? '00:00:00'
    : `${pad(e.getHours())}:${pad(e.getMinutes())}:${pad(e.getSeconds())}`;

  if (isNaN(sTime) || isNaN(eTime) || eTime <= sTime) {
    return {
      kwh: 0,
      durationText: '0.00 hrs (0s)',
      durationSec: 0,
      durationHours: 0,
      fraction: 0,
      startHourStr,
      endHourStr,
      startReading: null,
      endReading: null,
      hasTelemetry: false,
    };
  }

  const diffSec = Math.floor((eTime - sTime) / 1000);
  const diffHours = Number((diffSec / 3600).toFixed(2));
  const cycleSec = cycleDays * 86400; // 30-day billing cycle = 720 hours = 2,592,000 seconds
  const fraction = diffSec / cycleSec;

  const d = Math.floor(diffSec / 86400);
  const h = Math.floor((diffSec % 86400) / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const sec = diffSec % 60;

  let breakdown = '';
  if (d > 0) breakdown += `${d}d `;
  if (h > 0 || d > 0) breakdown += `${h}h `;
  if (m > 0 || h > 0 || d > 0) breakdown += `${m}m `;
  breakdown += `${sec}s`;

  const durationText = `${diffHours.toFixed(2)} hrs (${breakdown.trim()})`;

  // Real Meter Subtraction: End Reading - Start Reading
  let calculatedKwh = 0;
  let hasTelemetry = false;
  let startReading = rangeResult?.startReading ?? null;
  let endReading = rangeResult?.endReading ?? null;

  if (rangeResult && rangeResult.deltaKwh !== null) {
    calculatedKwh = rangeResult.deltaKwh;
    hasTelemetry = true;
  } else if (startReading !== null && endReading !== null) {
    calculatedKwh = Math.max(0, Number((endReading - startReading).toFixed(3)));
    hasTelemetry = true;
  } else {
    // If telemetry reading is still loading or unavailable, default to 0
    calculatedKwh = 0;
    hasTelemetry = false;
  }

  return {
    kwh: calculatedKwh,
    durationText,
    durationSec: diffSec,
    durationHours: diffHours,
    fraction,
    startHourStr,
    endHourStr,
    startReading,
    endReading,
    hasTelemetry,
  };
};


const formatIsoLocal = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};


interface TenantInvoicesTableProps {
  invoices: TenantInvoiceDb[];
  searchQuery: string;
  statusFilter: 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE';
  startDate: string;
  endDate: string;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE') => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onExportInvoices: () => void;
  onOpenAddInvoice?: () => void;
  onOpenEditInvoice?: (invoice: TenantInvoiceDb) => void;
  onViewInvoice?: (invoice: TenantInvoiceDb) => void;
  onSelectTenantTrend?: (invoice: TenantInvoiceDb) => void;
  onDeleteInvoice?: (invoice: TenantInvoiceDb) => void;
  onUpdateInvoiceDate?: (
    invoiceNumber: string,
    field: 'start_date' | 'end_date',
    value: string
  ) => void;
  onApplyDatesToAll?: (start: string, end: string) => void;
}


export const TenantInvoicesTable: React.FC<TenantInvoicesTableProps> = ({
  invoices,
  searchQuery,
  statusFilter,
  startDate,
  endDate,
  onSearchChange,
  onStatusFilterChange,
  onStartDateChange,
  onEndDateChange,
  onExportInvoices,
  onOpenEditInvoice,
  onViewInvoice,
  onSelectTenantTrend,
  onDeleteInvoice,
  onUpdateInvoiceDate,
  onApplyDatesToAll,
}) => {
  // Interval meter reading range telemetry (Start Hour vs End Hour) for all invoices
  const [intervalDataMap, setIntervalDataMap] = React.useState<Record<string, MeterReadingRangeResult>>({});

  React.useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    const fetchAllIntervals = async () => {
      if (isFetching || !invoices || invoices.length === 0) return;
      isFetching = true;
      try {
        const results: Record<string, MeterReadingRangeResult> = {};

        await Promise.all(
          invoices.map(async (inv) => {
            const start = inv.start_date || startDate;
            const end = inv.end_date || endDate;
            if (!start || !end) return;
            const meter = inv.meter_name || inv.tenant_name;
            const res = await fetchMeterReadingRange(meter, start, end);
            results[inv.invoice_number] = res;
          })
        );

        if (isMounted) {
          setIntervalDataMap((prev) => ({ ...prev, ...results }));
        }
      } finally {
        isFetching = false;
      }
    };

    fetchAllIntervals();
    const interval = setInterval(fetchAllIntervals, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [invoices, startDate, endDate]);

  const paidCount = invoices.filter((i) => i.status === 'PAID').length;
  const pendingCount = invoices.filter((i) => i.status === 'PENDING').length;
  const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length;

  return (
    <div className="flex flex-col select-none">
      {/* ── Top Workspace Filter Bar (Matches Dashboard Filter Panel) ── */}
      <div className="hw-panel mb-3 overflow-hidden">
        {/* Row 1: Workspace Title Tab + Status Filter Pills + Export */}
        <div
          className="px-3 flex flex-wrap items-center justify-between gap-3 overflow-x-auto"
          style={{ borderBottom: '1px solid #282a32', minHeight: '40px' }}
        >
          {/* Left Title Tab */}
          <div className="flex items-center gap-6">
            <button className="hw-tab-btn active">
              TENANT INVOICES & UTILITY LEDGER
            </button>
          </div>

          {/* Right Status Filter Pills & Export */}
          <div className="flex items-center gap-1.5 py-1">
            <button
              onClick={() => onStatusFilterChange('ALL')}
              className={`hw-filter-pill ${statusFilter === 'ALL' ? 'active' : ''
                }`}
            >
              ALL ({invoices.length})
            </button>

            <button
              onClick={() => onStatusFilterChange('PAID')}
              className={`hw-filter-pill flex items-center gap-1 ${statusFilter === 'PAID' ? 'active' : ''
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>PAID</span>
            </button>

            <button
              onClick={() => onStatusFilterChange('PENDING')}
              className={`hw-filter-pill flex items-center gap-1 ${statusFilter === 'PENDING' ? 'active' : ''
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>PENDING</span>
            </button>

            <button
              onClick={() => onStatusFilterChange('OVERDUE')}
              className={`hw-filter-pill flex items-center gap-1 ${statusFilter === 'OVERDUE' ? 'active' : ''
                }`}
            >
              {overdueCount > 0 ? (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 hw-pulse" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              )}
              <span
                style={{
                  color: overdueCount > 0 ? '#ef4444' : undefined,
                }}
              >
                OVERDUE
              </span>
            </button>

            {/* Quick Add Sub-Meter / Invoice Button */}


            {/* Quick Export CSV Button */}
            <button
              onClick={onExportInvoices}
              className="flex items-center gap-1 px-2.5 py-1 ml-1.5 rounded text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
              style={{
                backgroundColor: '#17181c',
                border: '1px solid #2d3038',
              }}
              title="Export Invoices CSV"
            >
              <Download className="w-3 h-3 text-cyan-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Row 2: Status Metric Counters + Date Range Filter + Search Box */}
        <div className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-4">
          {/* Left Summary Metric Counters */}
          <div className="flex items-center gap-6">
            {/* TOTAL Counter */}
            <div className="flex flex-col items-start leading-none">
              <span className="font-bold font-mono text-white text-base">
                {invoices.length}
              </span>
              <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">
                TOTAL
              </span>
            </div>

            {/* PAID Counter */}
            <div className="flex items-center gap-1.5 leading-none">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <div className="flex flex-col items-start leading-none">
                <span className="font-bold font-mono text-emerald-400 text-sm">
                  {paidCount}
                </span>
                <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">
                  PAID
                </span>
              </div>
            </div>

            {/* PENDING Counter */}
            <div className="flex items-center gap-1.5 leading-none">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <div className="flex flex-col items-start leading-none">
                <span className="font-bold font-mono text-amber-400 text-sm">
                  {pendingCount}
                </span>
                <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">
                  PENDING
                </span>
              </div>
            </div>

            {/* OVERDUE Counter */}
            <div className="flex items-center gap-1.5 leading-none">
              <span
                className={`w-2 h-2 rounded-full ${overdueCount > 0 ? 'bg-red-500 hw-pulse' : 'bg-slate-600'
                  } shrink-0`}
              />
              <div className="flex flex-col items-start leading-none">
                <span
                  className={`font-bold font-mono text-sm ${overdueCount > 0 ? 'text-red-400' : 'text-slate-500'
                    }`}
                >
                  {overdueCount}
                </span>
                <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">
                  OVERDUE
                </span>
              </div>
            </div>
          </div>

          {/* Right Date & Time Range Filter & Search Input Box */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Start & End DateTime Picker with Hour, Minute, and Second (step="1") */}
            <div
              className="flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded"
              style={{
                backgroundColor: '#17181c',
                border: '1px solid #2d3038',
              }}
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[10px] text-slate-400 font-mono uppercase">Start:</span>
              <input
                type="datetime-local"
                step="1"
                value={toDateTimeInputValue(startDate)}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="bg-transparent text-[11px] font-mono text-cyan-300 outline-none cursor-pointer"
                title="Set Start Date & Time (YYYY-MM-DD HH:mm:ss)"
              />
              <span className="text-[10px] text-slate-500 font-mono mx-0.5">→</span>
              <span className="text-[10px] text-slate-400 font-mono uppercase">End:</span>
              <input
                type="datetime-local"
                step="1"
                value={toDateTimeInputValue(endDate)}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="bg-transparent text-[11px] font-mono text-cyan-300 outline-none cursor-pointer"
                title="Set End Date & Time (YYYY-MM-DD HH:mm:ss)"
              />

              {/* Quick Testing Presets */}
              <div className="flex items-center gap-1 border-l border-slate-700/60 pl-2 ml-1">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    onEndDateChange(formatIsoLocal(now));
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-400 hover:bg-cyan-900/80 border border-cyan-800/40 transition cursor-pointer"
                  title="Set End to current live second"
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const past = new Date(now.getTime() - 1 * 60 * 1000);
                    onStartDateChange(formatIsoLocal(past));
                    onEndDateChange(formatIsoLocal(now));
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/70 text-amber-300 hover:text-white hover:bg-amber-900 border border-amber-700/50 transition cursor-pointer font-bold"
                  title="Test 1 minute interval (1 mn = 60 seconds)"
                >
                  1m
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const past = new Date(now.getTime() - 5 * 60 * 1000);
                    onStartDateChange(formatIsoLocal(past));
                    onEndDateChange(formatIsoLocal(now));
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#20242c] text-slate-300 hover:text-white hover:bg-[#282d38] border border-[#323846] transition cursor-pointer"
                  title="Test last 5 minutes interval"
                >
                  5m
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const past = new Date(now.getTime() - 15 * 60 * 1000);
                    onStartDateChange(formatIsoLocal(past));
                    onEndDateChange(formatIsoLocal(now));
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#20242c] text-slate-300 hover:text-white hover:bg-[#282d38] border border-[#323846] transition cursor-pointer"
                  title="Test last 15 minutes interval"
                >
                  15m
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const past = new Date(now.getTime() - 60 * 60 * 1000);
                    onStartDateChange(formatIsoLocal(past));
                    onEndDateChange(formatIsoLocal(now));
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#20242c] text-slate-300 hover:text-white hover:bg-[#282d38] border border-[#323846] transition cursor-pointer"
                  title="Test last 1 hour interval"
                >
                  1h
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                    onStartDateChange(formatIsoLocal(startOfDay));
                    onEndDateChange(formatIsoLocal(now));
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#20242c] text-slate-300 hover:text-white hover:bg-[#282d38] border border-[#323846] transition cursor-pointer"
                  title="Test Today interval from 00:00:00"
                >
                  Today
                </button>
              </div>

              {/* Calculated Interval Duration Indicator */}
              {getDurationText(startDate, endDate) && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 ml-1">
                  ⏱️ {getDurationText(startDate, endDate)}
                </span>
              )}

              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    onStartDateChange('');
                    onEndDateChange('');
                  }}
                  className="p-0.5 text-slate-400 hover:text-white transition cursor-pointer ml-1"
                  title="Clear interval filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {onApplyDatesToAll && (
                <button
                  type="button"
                  onClick={() => onApplyDatesToAll(startDate, endDate)}
                  className="flex items-center gap-1 px-2 py-0.5 ml-1 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition cursor-pointer"
                  title="Apply this exact time range to all tenants"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Sync All</span>
                </button>
              )}
            </div>


            {/* Search Input Box */}
            <div className="hw-search-box">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search tenant or meter..."
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="p-1 mr-1.5 text-slate-500 hover:text-white cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Data Table (Matches PointsTable.tsx) ── */}
      <div
        className="rounded overflow-hidden mb-6"
        style={{
          backgroundColor: '#202227',
          border: '1px solid #2d3038',
        }}
      >
        <div className="overflow-x-auto">
          <table
            className="w-full text-left"
            style={{ borderCollapse: 'collapse', fontSize: '13px' }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid #2d3038',
                  backgroundColor: '#1b1d22',
                }}
              >
                {/* Invoice & Tenant */}
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                    <span>Invoice & Tenant</span>
                    <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Sub-Meter Name */}
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                    <span>Sub-Meter Name</span>
                    <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Tenant Billing Dates (Start – End) */}
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                    <Calendar className="w-3 h-3 text-white" />
                    <span>Billing Dates (Start – End)</span>
                    <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Base Reading */}
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                    <span>Base Reading</span>
                    <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Calculated Consumption (End Hour − Start Hour) */}
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-amber-300">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Calculated Consumption (End Hour − Start Hour)</span>
                    <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>


                {/* Rate & Demand */}
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                    <span>Rate & Demand</span>
                    <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Total Amount */}
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                    <span>Total Amount</span>
                    <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Payment Status */}
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                    <span>Payment Status</span>
                    <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Action */}
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400 text-right">
                  <span>Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-14 text-center text-slate-500 font-mono text-xs"
                  >
                    No tenant invoices found for the selected dates and filters.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (

                  <tr
                    key={inv.invoice_number}
                    className="hover:bg-[#262930] transition-colors"
                    style={{
                      borderBottom: '1px solid #282a31',
                    }}
                  >
                    {/* Invoice & Tenant */}
                    <td className="py-3.5 px-4">
                      <div
                        onClick={() => onOpenEditInvoice && onOpenEditInvoice(inv)}
                        className="font-medium hover:underline cursor-pointer"
                        style={{ color: '#00a4e4', fontSize: '13px' }}
                        title="Click to edit tenant billing details"
                      >
                        {inv.tenant_name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                        <span className="text-slate-500">
                          {inv.invoice_number}
                        </span>
                        <span>•</span>
                        <span>{inv.unit_zone}</span>
                      </div>
                    </td>

                    {/* Sub-Meter Name */}
                    <td className="py-3.5 px-4">
                      <div
                        onClick={() => onSelectTenantTrend && onSelectTenantTrend(inv)}
                        className={`font-mono text-cyan-300 font-medium flex items-center gap-1.5 ${
                          onSelectTenantTrend ? 'cursor-pointer hover:underline hover:text-cyan-200' : ''
                        }`}
                        title="Click to view real-time energy trend chart"
                      >
                        <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>{inv.meter_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Zone: {inv.unit_zone}
                      </div>
                    </td>


                    {/* Editable Start Date/Time & End Date/Time per Tenant (HH:mm:ss supported) */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div
                        className="flex flex-col gap-1 px-2 py-1.5 rounded transition w-fit"
                        style={{
                          backgroundColor: '#17181c',
                          border: '1px solid #2d3038',
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider w-8 shrink-0">
                            FROM:
                          </span>
                          <input
                            type="datetime-local"
                            step="1"
                            value={toDateTimeInputValue(inv.start_date)}
                            onChange={(e) => {
                              if (onUpdateInvoiceDate) {
                                onUpdateInvoiceDate(
                                  inv.invoice_number,
                                  'start_date',
                                  e.target.value
                                );
                              }
                            }}
                            className="bg-transparent text-[11px] font-mono text-cyan-300 outline-none cursor-pointer hover:text-white transition"
                            title="Set Start Date & Time for this tenant (YYYY-MM-DD HH:mm:ss)"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 border-t border-slate-800/80 pt-1">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider w-8 shrink-0">
                            TO:
                          </span>
                          <input
                            type="datetime-local"
                            step="1"
                            value={toDateTimeInputValue(inv.end_date)}
                            onChange={(e) => {
                              if (onUpdateInvoiceDate) {
                                onUpdateInvoiceDate(
                                  inv.invoice_number,
                                  'end_date',
                                  e.target.value
                                );
                              }
                            }}
                            className="bg-transparent text-[11px] font-mono text-cyan-300 outline-none cursor-pointer hover:text-white transition"
                            title="Set End Date & Time for this tenant (YYYY-MM-DD HH:mm:ss)"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between gap-2">
                        {getDurationText(inv.start_date, inv.end_date) ? (
                          <span className="text-emerald-400 font-mono flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {getDurationText(inv.start_date, inv.end_date)}
                          </span>
                        ) : (
                          <span>{inv.billing_period || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                        )}
                        {onOpenEditInvoice && (
                          <button
                            onClick={() => onOpenEditInvoice(inv)}
                            className="text-cyan-400 hover:text-cyan-300 text-[10px] transition cursor-pointer"
                            title="Edit full cycle dates and details"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>


                    {/* Base Reading */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-100 font-bold text-sm">
                          {inv.kwh_reading.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          kWh
                        </span>
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-700/40 ml-1 animate-pulse"
                          title="Real-time telemetry updated every second"
                        >
                          LIVE
                        </span>
                      </div>
                    </td>

                    {/* Calculated Consumption Column (End Hour − Start Hour) */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {(() => {
                        const intervalInfo = intervalDataMap[inv.invoice_number];
                        const {
                          kwh: calcKwh,
                          durationHours,
                          fraction,
                          startHourStr,
                          endHourStr,
                          startReading,
                          endReading,
                          hasTelemetry,
                        } = calculateIntervalConsumption(
                          inv.kwh_reading,
                          inv.start_date || startDate,
                          inv.end_date || endDate,
                          intervalInfo
                        );
                        const calcCost = Number((calcKwh * inv.rate_per_kwh + (hasTelemetry ? 0 : inv.demand_charge * fraction)).toFixed(2));
                        const calcCostKhr = Math.round(calcCost * 4100);

                        return (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 font-bold text-amber-300 text-[13px]">
                              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>
                                {calcKwh.toLocaleString('en-US', {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 3,
                                })}
                              </span>
                              <span className="text-[10px] text-amber-400/80 font-normal">kWh</span>
                              {hasTelemetry && (
                                <span
                                  className="inline-flex items-center px-1 py-0.2 rounded text-[8px] font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-700/40 ml-1"
                                  title="Calculated from actual recorded Niagara telemetry readings"
                                >
                                  METER Δ
                                </span>
                              )}
                            </div>

                            {/* Subtraction Formula: End Reading − Start Reading */}
                            {startReading !== null && endReading !== null ? (
                              <div className="text-[10px] text-slate-300 font-mono flex items-center gap-1" title="End Hour Reading − Start Hour Reading">
                                <span className="text-slate-400">Δ:</span>
                                <span className="text-cyan-300 font-medium">{endReading.toLocaleString()}</span>
                                <span className="text-slate-500">−</span>
                                <span className="text-cyan-300 font-medium">{startReading.toLocaleString()}</span>
                                <span className="text-slate-500">kWh</span>
                              </div>
                            ) : null}

                            <div className="text-[10px] text-cyan-300 font-mono flex items-center gap-1 mt-0.5">
                              <Clock className="w-2.5 h-2.5 text-cyan-400" />
                              <span className="font-semibold text-emerald-300">
                                {durationHours.toFixed(2)} hrs
                              </span>
                              <span className="text-slate-500">
                                ({endHourStr} − {startHourStr})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Accrued: <span className="text-emerald-400 font-bold">${calcCost.toFixed(2)}</span>
                              <span className="text-slate-500 text-[9px] ml-1">({calcCostKhr.toLocaleString()} KHR)</span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>



                    {/* Rate & Demand */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="text-amber-300 font-bold">
                        ${inv.rate_per_kwh.toFixed(2)} / kWh
                      </div>
                      <div className="text-[10px] text-slate-500">
                        +${inv.demand_charge.toFixed(2)} Demand
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="font-bold text-emerald-400 text-sm">
                        ${inv.total_cost_usd.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ~{inv.total_cost_khr.toLocaleString()} KHR
                      </div>
                    </td>

                    {/* Payment Status */}
                    <td className="py-3.5 px-4">
                      {inv.status === 'PAID' && (
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span style={{ color: '#6fa889' }}>PAID</span>
                        </div>
                      )}
                      {inv.status === 'PENDING' && (
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span style={{ color: '#d6aa62' }}>PENDING</span>
                        </div>
                      )}
                      {inv.status === 'OVERDUE' && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
                          <span className="w-2 h-2 rounded-full bg-red-500 hw-pulse shrink-0" />
                          <span>OVERDUE</span>
                        </div>
                      )}
                    </td>

                    {/* Actions: Edit Dates & Export Invoice */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onOpenEditInvoice && (
                          <button
                            onClick={() => onOpenEditInvoice(inv)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                            style={{
                              backgroundColor: '#17252d',
                              border: '1px solid #234354',
                            }}
                            title={`Set Start/End Dates & Edit ${inv.invoice_number}`}
                          >
                            <Edit className="w-3 h-3" />
                            <span>Set Dates</span>
                          </button>
                        )}

                        {onSelectTenantTrend && (
                          <button
                            onClick={() => onSelectTenantTrend(inv)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-amber-300 hover:text-amber-200 transition cursor-pointer"
                            style={{
                              backgroundColor: '#252014',
                              border: '1px solid #4a3e22',
                            }}
                            title={`View real-time kWh energy trend chart for ${inv.tenant_name}`}
                          >
                            <TrendingUp className="w-3 h-3 text-amber-400" />
                            <span>Trend</span>
                          </button>
                        )}


                        <button
                          onClick={() => {
                            if (onViewInvoice) {
                              onViewInvoice(inv);
                            } else {
                              onExportInvoices();
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
                          style={{
                            backgroundColor: '#17181c',
                            border: '1px solid #2d3038',
                          }}
                          title={`View Tenant Bill Summary for ${inv.invoice_number}`}
                        >
                          <FileText className="w-3 h-3 text-cyan-400" />
                          <span>Bill Summary</span>
                        </button>

                        {onDeleteInvoice && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete invoice ${inv.invoice_number} for "${inv.tenant_name}"?`
                                )
                              ) {
                                onDeleteInvoice(inv);
                              }
                            }}
                            className="flex items-center justify-center px-2 py-1 rounded text-[11px] font-medium text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 transition cursor-pointer"
                            style={{
                              backgroundColor: '#201618',
                              border: '1px solid #442226',
                            }}
                            title={`Delete invoice ${inv.invoice_number}`}
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            <span>Delete</span>
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>

                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};




