import React, { useState } from 'react';
import {
  Search,
  FileText,
  ChevronsUpDown,
  Download,
  Calendar,
  Clock,
  Trash2,
  X,
  TrendingUp,
  Plus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Cloud,
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
  onUpdateInvoiceDate,
  onApplyDatesToAll,
}) => {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'SUMMARY' | 'INVOICES' | 'SUB-METERS' | 'INTERVALS' | 'TARIFFS'>('INVOICES');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  // Polling for interval meter telemetry (start hour vs end hour)
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
      {/* ── ROW 1: Honeywell Forge Workspace Tabs & Type Filters Bar ── */}
      <div
        className="px-4 flex flex-wrap items-center justify-between gap-3 overflow-x-auto"
        style={{
          borderBottom: '1px solid #202228',
          minHeight: '44px',
          backgroundColor: '#15161b',
        }}
      >
        {/* Left Tabs (SUMMARY, INVOICES, SUB-METERS, INTERVALS, TARIFFS) */}
        <div className="flex items-center gap-6">
          {(['SUMMARY', 'INVOICES', 'SUB-METERS', 'INTERVALS', 'TARIFFS'] as const).map((tab) => {
            const isActive = activeWorkspaceTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveWorkspaceTab(tab)}
                className={`hw-tab-btn ${isActive ? 'active' : ''}`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Right Status Filter Bar (<< ALL TYPES AHU ● BOILERS CHILLERS >> style) */}
        <div className="flex items-center gap-1.5 py-1">
          <button
            className="p-1 text-[#64748b] hover:text-white transition cursor-pointer"
            title="Previous Filters"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onStatusFilterChange('ALL')}
            className={`hw-filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
          >
            ALL TYPES
          </button>

          <button
            onClick={() => onStatusFilterChange('PAID')}
            className={`hw-filter-pill ${statusFilter === 'PAID' ? 'active' : ''}`}
          >
            PAID
          </button>

          <button
            onClick={() => onStatusFilterChange('PENDING')}
            className={`hw-filter-pill ${statusFilter === 'PENDING' ? 'active' : ''}`}
          >
            PENDING
          </button>

          <button
            onClick={() => onStatusFilterChange('OVERDUE')}
            className={`hw-filter-pill flex items-center gap-1.5 ${
              statusFilter === 'OVERDUE' ? 'active' : ''
            }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: '#e52b20' }}
            />
            <span style={{ color: overdueCount > 0 ? '#e52b20' : undefined }}>
              OVERDUE
            </span>
          </button>

          <button
            className="p-1 text-[#64748b] hover:text-white transition cursor-pointer"
            title="Next Filters"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {onOpenAddInvoice && (
            <button
              onClick={onOpenAddInvoice}
              className="flex items-center gap-1 px-2 py-0.5 ml-2 rounded text-[10px] font-bold uppercase tracking-wider text-white transition cursor-pointer"
              style={{ backgroundColor: '#00a4e4' }}
              title="Add New Invoice"
            >
              <Plus className="w-3 h-3" />
              <span>Add Invoice</span>
            </button>
          )}

          <button
            onClick={onExportInvoices}
            className="flex items-center gap-1 px-2 py-0.5 ml-1 rounded text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition cursor-pointer"
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

      {/* ── ROW 2: Honeywell Forge Metric Counters & Date/Search Row ── */}
      <div
        className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-4"
        style={{
          borderBottom: '1px solid #1c1e24',
          backgroundColor: '#121317',
        }}
      >
        {/* Left: Honeywell Counter Badges (e.g. 9 ALL, ☁ 3 OFFLINE, ▲ 1 ACTIVE HIGH ALARMS) */}
        <div className="flex items-center gap-6">
          {/* Total Counter */}
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="font-bold text-white text-lg font-mono">
              {invoices.length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              ALL
            </span>
          </div>

          {/* Paid Counter */}
          <div className="flex items-center gap-1.5 leading-none">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#48bb78' }} />
            <span className="font-bold text-sm font-mono text-[#48bb78]">
              {paidCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              PAID
            </span>
          </div>

          {/* Pending Counter */}
          <div className="flex items-center gap-1.5 leading-none">
            <Cloud className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
            <span className="font-bold text-sm font-mono" style={{ color: '#d97706' }}>
              {pendingCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              PENDING
            </span>
          </div>

          {/* Overdue Counter (Honeywell Active High Alarms style) */}
          <div className="flex items-center gap-1.5 leading-none">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#e52b20' }} />
            <span className="font-bold text-sm font-mono" style={{ color: '#e52b20' }}>
              {overdueCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              OVERDUE ALARMS
            </span>
          </div>
        </div>

        {/* Right: Date Interval Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker Range Bar */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded"
            style={{
              backgroundColor: '#101115',
              border: '1px solid #202228',
            }}
          >
            <span className="text-[10px] text-[#71717a] font-medium uppercase tracking-wider">
              Date from
            </span>
            <Calendar className="w-3 h-3 text-[#71717a]" />

            <input
              type="datetime-local"
              step="1"
              value={toDateTimeInputValue(startDate)}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="bg-transparent text-[11px] font-mono text-[#cbd5e1] outline-none cursor-pointer hover:text-white"
              title="Start Date (YYYY-MM-DD HH:mm:ss)"
            />

            <span className="text-[10px] text-[#52525b] font-mono mx-0.5">→</span>

            <input
              type="datetime-local"
              step="1"
              value={toDateTimeInputValue(endDate)}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="bg-transparent text-[11px] font-mono text-[#cbd5e1] outline-none cursor-pointer hover:text-white"
              title="End Date (YYYY-MM-DD HH:mm:ss)"
            />

            {/* Interval Duration Tag */}
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
                title="Sync this date range to all tenants"
              >
                Sync
              </button>
            )}
          </div>

          {/* Search Input */}
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

      {/* ── Main Data Table ── */}
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
              {/* Checkbox Column */}
              <th className="py-2.5 px-3 w-8">
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
                  title="Select all rows"
                />
              </th>

              {/* NAME */}
              <th className="py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>NAME</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* TYPE / SUB-METER */}
              <th className="py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>TYPE</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* BILLING DATES (START – END) */}
              <th className="py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>BILLING DATES</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* BASE READING */}
              <th className="py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>BASE READING</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* CONSUMPTION (Δ) */}
              <th className="py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>CONSUMPTION (Δ)</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* RATE & DEMAND */}
              <th className="py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>RATE & DEMAND</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* TOTAL AMOUNT */}
              <th className="py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>TOTAL AMOUNT</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* STATUS */}
              <th className="py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider text-[#858d9d]">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>STATUS</span>
                  <ChevronsUpDown className="w-3 h-3 text-[#52525b]" />
                </div>
              </th>

              {/* ACTIONS */}
              <th className="py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider text-[#858d9d] text-right">
                <span>ACTIONS</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="py-12 text-center text-slate-500 font-mono text-xs"
                >
                  No tenant invoices found for the selected dates and filters.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const isSelected = selectedInvoices.has(inv.invoice_number);
                const intervalInfo = intervalDataMap[inv.invoice_number];
                const {
                  kwh: calcKwh,
                  durationHours,
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
                const calcCost = Number(
                  (calcKwh * inv.rate_per_kwh + (hasTelemetry ? 0 : inv.demand_charge)).toFixed(2)
                );

                const isOverdue = inv.status === 'OVERDUE';

                return (
                  <tr
                    key={inv.invoice_number}
                    className="transition-colors"
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
                    {/* Row Checkbox */}
                    <td className="py-3 px-3 w-8">
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

                    {/* NAME (Honeywell Cyan #00a4e4 + Alarm badge if Overdue) */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => onOpenEditInvoice && onOpenEditInvoice(inv)}
                          className="font-medium hover:underline cursor-pointer transition truncate text-[13px]"
                          style={{ color: '#00a4e4' }}
                          title="Click to edit tenant billing details"
                        >
                          {inv.tenant_name}
                        </span>

                        {/* Honeywell Alarm Tag (Matching VAV Box 3 [☁] from screenshot) */}
                        {isOverdue && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              backgroundColor: 'rgba(229, 43, 32, 0.18)',
                              color: '#ff4d4f',
                              border: '1px solid rgba(229, 43, 32, 0.35)',
                            }}
                            title="Overdue Invoice Alert"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Overdue
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] font-mono text-[#64748b] mt-0.5 flex items-center gap-1">
                        <span>{inv.invoice_number}</span>
                        <span>•</span>
                        <span>{inv.unit_zone}</span>
                      </div>
                    </td>

                    {/* TYPE / SUB-METER */}
                    <td className="py-3 px-3">
                      <div
                        onClick={() => onSelectTenantTrend && onSelectTenantTrend(inv)}
                        className={`font-mono text-[12px] text-[#cbd5e1] ${
                          onSelectTenantTrend ? 'cursor-pointer hover:text-[#00a4e4] transition' : ''
                        }`}
                        title="Click to view telemetry trend"
                      >
                        {inv.meter_name}
                      </div>
                      <div className="text-[10px] text-[#64748b] font-mono mt-0.5">
                        {inv.unit_zone}
                      </div>
                    </td>

                    {/* BILLING DATES (START – END) */}
                    <td className="py-3 px-3 font-mono text-xs">
                      <div
                        className="flex flex-col gap-1 px-2 py-1 rounded transition w-fit"
                        style={{
                          backgroundColor: '#101115',
                          border: '1px solid #1c1e24',
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-semibold text-[#64748b] uppercase tracking-wider w-8 shrink-0">
                            From:
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
                            className="bg-transparent text-[11px] font-mono text-[#cbd5e1] outline-none cursor-pointer hover:text-white"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 border-t border-[#1e2029] pt-1">
                          <span className="text-[9px] font-semibold text-[#64748b] uppercase tracking-wider w-8 shrink-0">
                            To:
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
                            className="bg-transparent text-[11px] font-mono text-[#cbd5e1] outline-none cursor-pointer hover:text-white"
                          />
                        </div>
                      </div>

                      <div className="text-[10px] text-[#64748b] mt-1 flex items-center justify-between gap-2">
                        {getDurationText(inv.start_date, inv.end_date) ? (
                          <span className="text-[#94a3b8] font-mono">
                            ⏱️ {getDurationText(inv.start_date, inv.end_date)}
                          </span>
                        ) : (
                          <span>{inv.billing_period || 'Current Cycle'}</span>
                        )}
                        {onOpenEditInvoice && (
                          <button
                            onClick={() => onOpenEditInvoice(inv)}
                            className="text-[#00a4e4] hover:underline text-[10px] cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>

                    {/* BASE READING */}
                    <td className="py-3 px-3 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold text-sm">
                          {inv.kwh_reading.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-[#64748b]">kWh</span>
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: '#48bb78' }}
                          title="Live telemetry synchronized"
                        />
                      </div>
                    </td>

                    {/* CONSUMPTION (Δ) (End Reading − Start Reading) */}
                    <td className="py-3 px-3 font-mono text-xs">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 font-semibold text-white text-sm">
                          <span>
                            {calcKwh.toLocaleString('en-US', {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 3,
                            })}
                          </span>
                          <span className="text-[10px] text-[#64748b] font-normal">kWh</span>
                          {hasTelemetry && (
                            <span
                              className="px-1 py-0.2 rounded text-[8px] font-mono text-[#94a3b8]"
                              style={{
                                backgroundColor: '#101115',
                                border: '1px solid #202228',
                              }}
                              title="Calculated from actual recorded telemetry readings"
                            >
                              Meter Δ
                            </span>
                          )}
                        </div>

                        {/* End Reading − Start Reading */}
                        {startReading !== null && endReading !== null && (
                          <div className="text-[10px] text-[#64748b] font-mono flex items-center gap-1">
                            <span>Δ:</span>
                            <span className="text-[#cbd5e1] font-medium">
                              {endReading.toLocaleString()}
                            </span>
                            <span>−</span>
                            <span className="text-[#cbd5e1] font-medium">
                              {startReading.toLocaleString()}
                            </span>
                            <span>kWh</span>
                          </div>
                        )}

                        <div className="text-[10px] text-[#64748b] font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-[#64748b]" />
                          <span className="text-[#94a3b8]">{durationHours.toFixed(2)} hrs</span>
                          <span>
                            ({endHourStr} − {startHourStr})
                          </span>
                        </div>

                        <div className="text-[10px] text-[#64748b] font-mono">
                          Accrued: <span className="text-white font-medium">${calcCost.toFixed(2)}</span>
                        </div>
                      </div>
                    </td>

                    {/* RATE & DEMAND */}
                    <td className="py-3 px-3 font-mono text-xs">
                      <div className="text-[#cbd5e1] font-medium">
                        ${inv.rate_per_kwh.toFixed(2)} / kWh
                      </div>
                      <div className="text-[10px] text-[#64748b]">
                        +${inv.demand_charge.toFixed(2)} Demand
                      </div>
                    </td>

                    {/* TOTAL AMOUNT */}
                    <td className="py-3 px-3 font-mono text-xs">
                      <div className="font-bold text-white text-sm">
                        ${inv.total_cost_usd.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[#64748b]">
                        ~{inv.total_cost_khr.toLocaleString()} KHR
                      </div>
                    </td>

                    {/* STATUS */}
                    <td className="py-3 px-3">
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

                    {/* ACTIONS */}
                    <td className="py-3 px-3 text-right">
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
