import React, { useState } from 'react';
import {
  Search,
  FileText,
  ChevronsUpDown,
  Download,
  Calendar,
  Trash2,
  X,
  TrendingUp,
  Plus,
  RotateCcw,
  AlertTriangle,
  Cloud,
  Edit2,
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

  if (rangeResult && rangeResult.deltaKwh !== null) {
    calculatedKwh = rangeResult.deltaKwh;
    hasTelemetry = true;
  } else if (startReading !== null && endReading !== null) {
    calculatedKwh = Math.max(0, Number((endReading - startReading).toFixed(3)));
    hasTelemetry = true;
  } else {
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
  ratePerKwh?: number;
  onRateChange?: (newRate: number) => void;
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
  onOpenAddInvoice,
  onOpenEditInvoice,
  onViewInvoice,
  onSelectTenantTrend,
  onDeleteInvoice,
  onApplyDatesToAll,
  ratePerKwh,
  onRateChange,
}) => {
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  // Polling for interval telemetry
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
    <div
      className="rounded overflow-hidden select-none"
      style={{
        backgroundColor: '#15161b',
        border: '1px solid #202228',
      }}
    >
      {/* ── ROW 1: Clean Tabs (Left) + Actions & Rate (Right) ── */}
      <div
        className="px-4 flex flex-wrap items-center justify-between gap-3 overflow-x-auto"
        style={{
          borderBottom: '1px solid #202228',
          minHeight: '44px',
          backgroundColor: '#15161b',
        }}
      >
        {/* Status Tabs */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onStatusFilterChange('ALL')}
            className={`hw-tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
          >
            ALL INVOICES ({invoices.length})
          </button>

          <button
            onClick={() => onStatusFilterChange('PAID')}
            className={`hw-tab-btn ${statusFilter === 'PAID' ? 'active' : ''}`}
          >
            PAID ({paidCount})
          </button>

          <button
            onClick={() => onStatusFilterChange('PENDING')}
            className={`hw-tab-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
          >
            PENDING ({pendingCount})
          </button>

          <button
            onClick={() => onStatusFilterChange('OVERDUE')}
            className={`hw-tab-btn flex items-center gap-1.5 ${statusFilter === 'OVERDUE' ? 'active' : ''
              }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: '#e52b20' }}
            />
            <span style={{ color: overdueCount > 0 ? '#e52b20' : undefined }}>
              OVERDUE ({overdueCount})
            </span>
          </button>
        </div>

        {/* Right Toolbar: Rate Pill + Add Invoice + Export */}
        <div className="flex items-center gap-2 py-1">
          {ratePerKwh !== undefined && onRateChange && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono"
              style={{
                backgroundColor: '#101115',
                border: '1px solid #202228',
              }}
              title="Global Utility Tariff Rate"
            >
              <span className="text-[#64748b] text-[10px] uppercase tracking-wider font-semibold">
                Rate:
              </span>
              <span className="text-[#858d9d]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={ratePerKwh}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onRateChange(isNaN(val) ? 0 : val);
                }}
                className="w-12 bg-transparent text-white font-mono font-semibold outline-none text-right cursor-pointer"
                title="Edit rate per kWh"
              />
              <span className="text-[#64748b] text-[10px]">/kWh</span>
            </div>
          )}



          <button
            onClick={onExportInvoices}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition cursor-pointer"
            style={{
              backgroundColor: '#101115',
              border: '1px solid #202228',
            }}
            title="Export CSV"
          >
            <Download className="w-3 h-3 text-[#00a4e4]" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ── ROW 2: Honeywell Metric Badges + Global Date Range & Search ── */}
      <div
        className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-4"
        style={{
          borderBottom: '1px solid #1c1e24',
          backgroundColor: '#121317',
        }}
      >
        {/* Left: Summary Metrics */}
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="font-bold text-white text-base font-mono">
              {invoices.length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              TOTAL
            </span>
          </div>

          <div className="flex items-center gap-1.5 leading-none">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#48bb78' }} />
            <span className="font-bold text-sm font-mono text-[#48bb78]">
              {paidCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              PAID
            </span>
          </div>

          <div className="flex items-center gap-1.5 leading-none">
            <Cloud className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
            <span className="font-bold text-sm font-mono" style={{ color: '#d97706' }}>
              {pendingCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              PENDING
            </span>
          </div>

          <div className="flex items-center gap-1.5 leading-none">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#e52b20' }} />
            <span className="font-bold text-sm font-mono" style={{ color: '#e52b20' }}>
              {overdueCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              OVERDUE
            </span>
          </div>
        </div>

        {/* Right: Date Interval Selector & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded"
            style={{
              backgroundColor: '#101115',
              border: '1px solid #202228',
            }}
          >
            <Calendar className="w-3.5 h-3.5 text-[#71717a]" />
            <input
              type="datetime-local"
              step="1"
              value={toDateTimeInputValue(startDate)}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="bg-transparent text-[11px] font-mono text-[#cbd5e1] outline-none cursor-pointer hover:text-white"
              title="Interval Start"
            />
            <span className="text-[10px] text-[#52525b] font-mono">→</span>
            <input
              type="datetime-local"
              step="1"
              value={toDateTimeInputValue(endDate)}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="bg-transparent text-[11px] font-mono text-[#cbd5e1] outline-none cursor-pointer hover:text-white"
              title="Interval End"
            />

            {getDurationText(startDate, endDate) && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#94a3b8] ml-1"
                style={{ backgroundColor: '#181920', border: '1px solid #282b36' }}
              >
                ⏱️ {getDurationText(startDate, endDate)}
              </span>
            )}

            {(startDate || endDate) && (
              <button
                onClick={() => {
                  onStartDateChange('');
                  onEndDateChange('');
                }}
                className="p-0.5 text-slate-500 hover:text-white transition cursor-pointer ml-1"
                title="Reset interval"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}

            {onApplyDatesToAll && (
              <button
                type="button"
                onClick={() => onApplyDatesToAll(startDate, endDate)}
                className="px-1.5 py-0.5 ml-1 rounded text-[10px] font-mono text-slate-300 hover:text-white transition cursor-pointer"
                style={{ backgroundColor: '#181920', border: '1px solid #282b36' }}
                title="Apply date range to all tenants"
              >
                Sync All
              </button>
            )}
          </div>

          {/* Search Box */}
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

      {/* ── Main Clean Table: Easy to Watch & Scan ── */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-left"
          style={{ borderCollapse: 'collapse', fontSize: '12px' }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: '#121317',
                borderBottom: '1px solid #202228',
              }}
            >
              <th className="py-3 px-3 w-8">
                <input
                  type="checkbox"
                  checked={invoices.length > 0 && selectedInvoices.size === invoices.length}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded-sm cursor-pointer"
                  style={{
                    backgroundColor: '#101115',
                    borderColor: '#2d313c',
                    accentColor: '#00a4e4',
                  }}
                  title="Select all"
                />
              </th>

              {/* TENANT & SUITE */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>Tenant & Suite</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* METER */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>Meter</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* BILLING PERIOD */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>Billing Period</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* CONSUMPTION */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>Consumption</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* AMOUNT */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>Amount (USD)</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* STATUS */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>Status</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* ACTIONS */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-[#858d9d] text-right">
                <span>Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-14 text-center text-slate-500 font-mono text-xs"
                >
                  No tenant invoices found for the selected filters.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const isSelected = selectedInvoices.has(inv.invoice_number);
                const intervalInfo = intervalDataMap[inv.invoice_number];
                const {
                  kwh: calcKwh,
                  hasTelemetry,
                } = calculateIntervalConsumption(
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
                    className="transition-colors cursor-default"
                    style={{
                      borderBottom: '1px solid #1a1c22',
                      backgroundColor: isSelected ? '#1b1d24' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#181a20';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(inv.invoice_number)}
                        className="w-3.5 h-3.5 rounded-sm cursor-pointer"
                        style={{
                          backgroundColor: '#101115',
                          borderColor: '#2d313c',
                          accentColor: '#00a4e4',
                        }}
                      />
                    </td>

                    {/* 1. TENANT & SUITE */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => onOpenEditInvoice && onOpenEditInvoice(inv)}
                          className="font-medium hover:underline cursor-pointer transition text-[13px]"
                          style={{ color: '#00a4e4' }}
                          title="Click to edit invoice details"
                        >
                          {inv.tenant_name}
                        </span>

                        {isOverdue && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              backgroundColor: 'rgba(229, 43, 32, 0.18)',
                              color: '#ff4d4f',
                              border: '1px solid rgba(229, 43, 32, 0.35)',
                            }}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Overdue
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-[#64748b] mt-0.5 flex items-center gap-1.5">
                        <span>{inv.invoice_number}</span>
                        <span>•</span>
                        <span>{inv.unit_zone}</span>
                      </div>
                    </td>

                    {/* 2. METER */}
                    <td className="py-3.5 px-4 font-mono">
                      <div
                        onClick={() => onSelectTenantTrend && onSelectTenantTrend(inv)}
                        className={`text-[12px] text-[#cbd5e1] font-medium ${onSelectTenantTrend ? 'cursor-pointer hover:text-[#00a4e4] transition' : ''
                          }`}
                        title="Click to view telemetry trend"
                      >
                        {inv.meter_name}
                      </div>
                      <div className="text-[10px] text-[#64748b] mt-0.5">
                        Zone: {inv.unit_zone}
                      </div>
                    </td>

                    {/* 3. BILLING PERIOD (Clean & Readable text) */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div
                        onClick={() => onOpenEditInvoice && onOpenEditInvoice(inv)}
                        className="text-[#cbd5e1] text-[11px] hover:text-[#00a4e4] cursor-pointer transition flex items-center gap-1.5"
                        title="Click to edit billing dates"
                      >
                        <span>{formatShortDateRange(inv.start_date || startDate, inv.end_date || endDate)}</span>
                      </div>
                      <div className="text-[10px] text-[#64748b] mt-0.5 flex items-center gap-1">
                        {duration ? <span>⏱️ {duration}</span> : <span>{inv.billing_period || 'Current Period'}</span>}
                      </div>
                    </td>

                    {/* 4. CONSUMPTION (Main kWh value + Subtle Base Reading) */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm">
                          {calcKwh.toLocaleString('en-US', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 3,
                          })}
                        </span>
                        <span className="text-[10px] text-[#64748b]">kWh</span>

                        {hasTelemetry && (
                          <span
                            className="px-1 py-0.2 rounded text-[8px] font-mono text-[#94a3b8]"
                            style={{
                              backgroundColor: '#101115',
                              border: '1px solid #202228',
                            }}
                            title="Calculated from actual recorded telemetry delta"
                          >
                            Meter Δ
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-[#64748b] mt-0.5">
                        Base: {inv.kwh_reading.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kWh
                      </div>
                    </td>

                    {/* 5. TOTAL AMOUNT */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="font-bold text-white text-sm">
                        ${inv.total_cost_usd.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[#64748b] mt-0.5">
                        @ ${inv.rate_per_kwh.toFixed(2)}/kWh
                      </div>
                    </td>

                    {/* 6. STATUS */}
                    <td className="py-3.5 px-4">
                      {inv.status === 'PAID' && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-[#cbd5e1]">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: '#48bb78' }}
                          />
                          <span>PAID</span>
                        </div>
                      )}
                      {inv.status === 'PENDING' && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-[#cbd5e1]">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: '#fa8c16' }}
                          />
                          <span>PENDING</span>
                        </div>
                      )}
                      {inv.status === 'OVERDUE' && (
                        <div
                          className="flex items-center gap-1.5 text-xs font-semibold"
                          style={{ color: '#e52b20' }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: '#e52b20' }}
                          />
                          <span>OVERDUE</span>
                        </div>
                      )}
                    </td>

                    {/* 7. ACTIONS (Summary, Trend, Edit, Delete) */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onSelectTenantTrend && (
                          <button
                            onClick={() => onSelectTenantTrend(inv)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
                            style={{
                              backgroundColor: '#101115',
                              border: '1px solid #202228',
                            }}
                            title={`View energy trend for ${inv.tenant_name}`}
                          >
                            <TrendingUp className="w-3 h-3 text-[#00a4e4]" />
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
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
                          style={{
                            backgroundColor: '#101115',
                            border: '1px solid #202228',
                          }}
                          title={`View Invoice Summary for ${inv.invoice_number}`}
                        >
                          <FileText className="w-3 h-3 text-[#858d9d]" />
                          <span>Summary</span>
                        </button>

                        {onOpenEditInvoice && (
                          <button
                            onClick={() => onOpenEditInvoice(inv)}
                            className="p-1 rounded text-[#64748b] hover:text-[#00a4e4] transition cursor-pointer"
                            title={`Edit ${inv.invoice_number} dates & details`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

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
                            className="p-1 rounded text-[#64748b] hover:text-[#e52b20] transition cursor-pointer"
                            title={`Delete invoice ${inv.invoice_number}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
