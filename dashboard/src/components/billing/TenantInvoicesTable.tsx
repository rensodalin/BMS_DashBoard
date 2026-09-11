import React, { useState } from 'react';
import {
  Search,
  Download,
  Calendar,
  X,
  RotateCcw,
  AlertTriangle,
  Send,
  Mail,
  Plus,
  Layers,
} from 'lucide-react';
import type { TenantInvoiceDb, SensorPoint } from '../../types/bms';
import { fetchMeterReadingRange, type MeterReadingRangeResult } from '../../lib/supabase';
import { getInvoiceFloor } from '../../lib/floorUtils';

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

export const formatShortDateRange = (startStr?: string, endStr?: string): string => {
  if (!startStr && !endStr) return 'Current Cycle';
  const cleanDate = (s?: string) => {
    if (!s) return '';
    const part = s.split('T')[0].split(' ')[0];
    const p = part.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : part;
  };
  const s = cleanDate(startStr);
  const e = cleanDate(endStr);
  if (s && e) return `${s} → ${e}`;
  return s || e || 'Current Cycle';
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
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
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
      durationText: '0.00 hrs',
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
  const cycleSec = cycleDays * 86400;
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

  let calculatedKwh = 0;
  let hasTelemetry = false;
  const startReading = rangeResult?.startReading ?? null;
  const endReading = rangeResult?.endReading ?? null;

  if (rangeResult && rangeResult.deltaKwh !== null && rangeResult.deltaKwh > 0) {
    calculatedKwh = rangeResult.deltaKwh;
    hasTelemetry = true;
  } else if (startReading !== null && endReading !== null && endReading > startReading) {
    calculatedKwh = Math.max(0, Number((endReading - startReading).toFixed(3)));
    hasTelemetry = true;
  } else {
    // If telemetry delta has no positive change or is loading, fall back to baseKwh
    calculatedKwh = baseKwh > 0
      ? (fraction > 0 && fraction < 1 ? Number((baseKwh * fraction).toFixed(2)) : baseKwh)
      : 0;
    hasTelemetry = rangeResult?.deltaKwh !== null && rangeResult?.deltaKwh !== undefined && rangeResult.deltaKwh > 0;
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

interface TenantInvoicesTableProps {
  invoices: TenantInvoiceDb[];
  allInvoices?: TenantInvoiceDb[];
  points?: SensorPoint[];
  selectedFloor?: string;
  onSelectFloor?: (floor: string) => void;
  availableFloors?: string[];
  searchQuery: string;
  statusFilter: 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE';
  startDate: string;
  endDate: string;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE') => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onExportInvoices: () => void;
  onOpenAddPoint?: () => void;
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
  onSendAllInvoices?: () => void;
  ratePerKwh?: number;
  onRateChange?: (newRate: number) => void;
  intervalDataMap?: Record<string, MeterReadingRangeResult>;
}

export const TenantInvoicesTable: React.FC<TenantInvoicesTableProps> = ({
  invoices,
  allInvoices,
  points = [],
  selectedFloor = 'ALL',
  onSelectFloor,
  availableFloors = [],
  searchQuery,
  statusFilter,
  startDate,
  endDate,
  onSearchChange,
  onStatusFilterChange,
  onStartDateChange,
  onEndDateChange,
  onExportInvoices,
  onOpenAddPoint,
  onOpenEditInvoice,
  onViewInvoice,
  onSelectTenantTrend,
  onDeleteInvoice,
  onApplyDatesToAll,
  onSendAllInvoices,
  ratePerKwh,
  onRateChange,
  intervalDataMap: propIntervalDataMap,
}) => {
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  // Internal fallback polling for interval telemetry
  const [internalIntervalDataMap, setInternalIntervalDataMap] = React.useState<Record<string, MeterReadingRangeResult>>({});
  const intervalDataMap = propIntervalDataMap && Object.keys(propIntervalDataMap).length > 0
    ? propIntervalDataMap
    : internalIntervalDataMap;

  React.useEffect(() => {
    if (propIntervalDataMap && Object.keys(propIntervalDataMap).length > 0) return;
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
          setInternalIntervalDataMap((prev) => ({ ...prev, ...results }));
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

  const toggleSelectAll = () => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map((i) => i.invoice_number)));
    }
  };

  const toggleSelectOne = (invNum: string) => {
    const next = new Set(selectedInvoices);
    if (next.has(invNum)) {
      next.delete(invNum);
    } else {
      next.add(invNum);
    }
    setSelectedInvoices(next);
  };

  return (
    <div className="bg-white border border-slate-100/90 rounded-md shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden select-none mb-6">
      {/* ── ROW 1: Clean Tabs (Left) + Actions & Rate (Right) ── */}
      <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white">
        {/* Status Tabs - Rounded Rectangles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onStatusFilterChange('ALL')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#001F3F] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            All Invoices ({invoices.length})
          </button>

          <button
            onClick={() => onStatusFilterChange('PAID')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'PAID'
                ? 'bg-[#001F3F] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Paid ({paidCount})
          </button>

          <button
            onClick={() => onStatusFilterChange('PENDING')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'PENDING'
                ? 'bg-[#001F3F] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Pending ({pendingCount})
          </button>

          <button
            onClick={() => onStatusFilterChange('OVERDUE')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'OVERDUE'
                ? 'bg-[#FF3523] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Overdue ({overdueCount})
          </button>
        </div>

        {/* Right Toolbar: Floor Scope Selector + Rate Pill + Add Point + Add Invoice + Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Floor Scope Selector */}
          {onSelectFloor && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono bg-slate-100 border border-slate-200"
              title="Filter tenant billing meters by building floor"
            >
              <Layers className="w-3.5 h-3.5 text-[#001F3F] shrink-0" />
              <span className="text-slate-500 text-[11px] font-semibold">
                Floor:
              </span>
              <select
                value={selectedFloor || 'ALL'}
                onChange={(e) => onSelectFloor(e.target.value)}
                className="bg-transparent text-slate-800 font-mono font-bold outline-none cursor-pointer pr-1 text-xs"
              >
                <option value="ALL">
                  All Floors {allInvoices ? `(${allInvoices.length})` : ''}
                </option>
                {(availableFloors && availableFloors.length > 0
                  ? availableFloors
                  : Array.from(new Set(allInvoices ? allInvoices.map((inv) => getInvoiceFloor(inv, points)) : []))
                ).map((floor) => {
                  const countOnFloor = allInvoices
                    ? allInvoices.filter((inv) => getInvoiceFloor(inv, points) === floor).length
                    : undefined;
                  return (
                    <option key={floor} value={floor}>
                      {floor} {countOnFloor !== undefined ? `(${countOnFloor})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {ratePerKwh !== undefined && onRateChange && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono bg-slate-100 border border-slate-200"
              title="Global Utility Tariff Rate"
            >
              <span className="text-slate-500 text-[11px] font-semibold">
                Rate:
              </span>
              <span className="text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={ratePerKwh}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onRateChange(isNaN(val) ? 0 : val);
                }}
                className="w-12 bg-transparent text-slate-800 font-mono font-bold outline-none text-right cursor-pointer"
                title="Edit rate per kWh"
              />
              <span className="text-slate-500 text-[10px]">/kWh</span>
            </div>
          )}

          {onOpenAddPoint && (
            <button
              onClick={onOpenAddPoint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-[#001F3F] hover:bg-[#001428] transition cursor-pointer shadow-sm"
              title="Add or discover oBIX sub-meter points from floor folders"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Point</span>
            </button>
          )}

          <button
            onClick={onExportInvoices}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#001F3F]" />
            <span>Export</span>
          </button>

          {onSendAllInvoices && (
            <button
              onClick={onSendAllInvoices}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-[#001F3F] hover:bg-[#001428] transition cursor-pointer shadow-sm"
              title="Email every tenant their invoice in one click"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send All</span>
            </button>
          )}
        </div>
      </div>

      {/* ── ROW 2: Metric Badges + Global Date Range & Search ── */}
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70 border-b border-slate-100">
        {/* Left: Summary Metrics */}
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="font-bold text-slate-900 text-base font-mono">
              {invoices.length}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Total
            </span>
          </div>

          <div className="flex items-baseline gap-1 leading-none">
            <span className="font-bold text-sm font-mono text-[#001F3F]">
              {paidCount}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Paid
            </span>
          </div>

          <div className="flex items-baseline gap-1 leading-none">
            <span className="font-bold text-sm font-mono text-amber-600">
              {pendingCount}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Pending
            </span>
          </div>

          <div className="flex items-baseline gap-1 leading-none">
            <span className="font-bold text-sm font-mono text-[#FF3523]">
              {overdueCount}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Overdue
            </span>
          </div>
        </div>

        {/* Right: Date Interval Selector & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="datetime-local"
              step="1"
              value={toDateTimeInputValue(startDate)}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="bg-transparent text-xs font-mono text-slate-700 outline-none cursor-pointer"
              title="Interval Start"
            />
            <span className="text-xs text-slate-400 font-mono">→</span>
            <input
              type="datetime-local"
              step="1"
              value={toDateTimeInputValue(endDate)}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="bg-transparent text-xs font-mono text-slate-700 outline-none cursor-pointer"
              title="Interval End"
            />

            {getDurationText(startDate, endDate) && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#e6edf5] text-[#001F3F] ml-1">
                {getDurationText(startDate, endDate)}
              </span>
            )}

            {(startDate || endDate) && (
              <button
                onClick={() => {
                  onStartDateChange('');
                  onEndDateChange('');
                }}
                className="p-1 text-slate-400 hover:text-slate-800 transition cursor-pointer ml-1"
                title="Reset interval"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}

            {onApplyDatesToAll && (
              <button
                type="button"
                onClick={() => onApplyDatesToAll(startDate, endDate)}
                className="px-2.5 py-0.5 ml-1 rounded text-[10px] font-semibold text-[#001F3F] bg-[#e6edf5] hover:bg-[#001F3F] hover:text-white transition cursor-pointer"
                title="Apply date range to all tenants"
              >
                Sync All
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tenant or meter..."
              className="w-52 bg-white border border-slate-200 text-slate-800 text-xs rounded-md pl-8 pr-7 py-1.5 placeholder:text-slate-400 focus:outline-none focus:border-[#001F3F]"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="p-1 absolute right-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Clean Table: Easy to Watch & Scan ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/70">
              <th className="py-3 px-3 w-8">
                <input
                  type="checkbox"
                  checked={invoices.length > 0 && selectedInvoices.size === invoices.length}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded cursor-pointer accent-[#001F3F]"
                  title="Select all"
                />
              </th>

              {/* TENANT */}
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Tenant
              </th>

              {/* METER */}
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Meter
              </th>

              {/* BILLING PERIOD */}
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Billing Period
              </th>

              {/* CONSUMPTION */}
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Consumption
              </th>

              {/* STATUS */}
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Status
              </th>

              {/* ACTIONS */}
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-xs text-slate-400 font-medium">
                  {selectedFloor && selectedFloor !== 'ALL'
                    ? `No tenant meter points found for ${selectedFloor}. Click "+ Add Point" above to configure points for ${selectedFloor}.`
                    : 'No tenant invoices found for the selected filters.'}
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const isSelected = selectedInvoices.has(inv.invoice_number);
                const intervalInfo = intervalDataMap[inv.invoice_number];
                const { kwh: calcKwh } = calculateIntervalConsumption(
                  inv.kwh_reading,
                  inv.start_date || startDate,
                  inv.end_date || endDate,
                  intervalInfo
                );

                const isOverdue = inv.status === 'OVERDUE';
                const duration = getDurationText(inv.start_date || startDate, inv.end_date || endDate);

                return (
                  <tr
                    key={inv.invoice_number}
                    className={`transition-colors ${
                      isSelected ? 'bg-[#e6edf5]/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(inv.invoice_number)}
                        className="w-3.5 h-3.5 rounded cursor-pointer accent-[#001F3F]"
                      />
                    </td>

                    {/* 1. TENANT & SUITE */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => onOpenEditInvoice && onOpenEditInvoice(inv)}
                          className="font-bold text-slate-800 hover:text-[#001F3F] cursor-pointer transition text-xs"
                          title="Click to edit invoice details"
                        >
                          {inv.tenant_name}
                        </span>

                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#fef2f2] text-[#FF3523] border border-[#FF3523]/20">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Overdue
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {inv.invoice_number}
                      </div>

                      {inv.tenant_email ? (
                        <div
                          className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5"
                          title={`Billing Email: ${inv.tenant_email}`}
                        >
                          <Mail className="w-3 h-3 text-[#001F3F] shrink-0" />
                          <span className="truncate max-w-[150px]">{inv.tenant_email}</span>
                        </div>
                      ) : (
                        <div
                          onClick={() => onOpenEditInvoice && onOpenEditInvoice(inv)}
                          className="text-[10px] text-slate-400 font-mono italic flex items-center gap-1 mt-0.5 cursor-pointer hover:text-amber-600"
                          title="Click to add tenant billing email"
                        >
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>No email set</span>
                        </div>
                      )}
                    </td>

                    {/* 2. METER */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          onClick={() => onSelectTenantTrend && onSelectTenantTrend(inv)}
                          className={`text-xs text-slate-700 font-semibold ${
                            onSelectTenantTrend ? 'cursor-pointer hover:text-[#001F3F] transition' : ''
                          }`}
                          title="Click to view telemetry trend"
                        >
                          {inv.meter_name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#e6edf5] text-[#001F3F]">
                          {getInvoiceFloor(inv, points)}
                        </span>
                      </div>
                    </td>

                    {/* 3. BILLING PERIOD */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div
                        onClick={() => onOpenEditInvoice && onOpenEditInvoice(inv)}
                        className="text-slate-700 text-xs font-medium hover:text-[#001F3F] cursor-pointer transition flex items-center gap-1.5"
                        title="Click to edit billing dates"
                      >
                        <span>{formatShortDateRange(inv.start_date || startDate, inv.end_date || endDate)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        {duration ? <span>{duration}</span> : <span>{inv.billing_period || 'Current Period'}</span>}
                      </div>
                    </td>

                    {/* 4. CONSUMPTION */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-sm">
                          {calcKwh.toLocaleString('en-US', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 3,
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">kWh</span>
                      </div>

                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Base: {inv.kwh_reading.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kWh
                      </div>
                    </td>

                    {/* 5. STATUS */}
                    <td className="py-3.5 px-4">
                      {inv.status === 'PAID' && (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#e6edf5] text-[#001F3F] border border-[#001F3F]/20">
                          Paid
                        </span>
                      )}
                      {inv.status === 'PENDING' && (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                          Pending
                        </span>
                      )}
                      {inv.status === 'OVERDUE' && (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#fef2f2] text-[#FF3523] border border-[#FF3523]/30">
                          Overdue
                        </span>
                      )}
                    </td>

                    {/* 6. ACTIONS (Summary, Trend, Edit, Delete) */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (onViewInvoice) {
                              onViewInvoice(inv);
                            } else {
                              onExportInvoices();
                            }
                          }}
                          className="px-2.5 py-1 rounded text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
                          title={`View Invoice Summary for ${inv.invoice_number}`}
                        >
                          Summary
                        </button>

                        {onSelectTenantTrend && (
                          <button
                            type="button"
                            onClick={() => onSelectTenantTrend(inv)}
                            className="px-2.5 py-1 rounded text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
                            title={`View energy trend for ${inv.tenant_name}`}
                          >
                            Trend
                          </button>
                        )}

                        {onOpenEditInvoice && (
                          <button
                            type="button"
                            onClick={() => onOpenEditInvoice(inv)}
                            className="px-2 py-1 rounded text-xs font-medium text-slate-500 hover:text-[#001F3F] hover:bg-slate-100 transition cursor-pointer"
                            title={`Edit ${inv.invoice_number}`}
                          >
                            Edit
                          </button>
                        )}

                        {onDeleteInvoice && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete invoice ${inv.invoice_number} for "${inv.tenant_name}"?`
                                )
                              ) {
                                onDeleteInvoice(inv);
                              }
                            }}
                            className="px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-[#FF3523] hover:bg-red-50 transition cursor-pointer"
                            title={`Delete invoice ${inv.invoice_number}`}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
