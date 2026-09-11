import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, Clock, Mail } from 'lucide-react';
import { upsertTenantInvoice, syncTenantClientAccount, fetchMeterReadingRange } from '../../lib/supabase';
import { calculateIntervalConsumption } from './TenantInvoicesTable';
import type { TenantInvoiceDb } from '../../types/bms';

const formatIsoSecond = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const getMonthStartIso = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01T00:00:00`;
};

const getMonthEndIso = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(lastDay)}T23:59:59`;
};

const getCurrentPeriodLabel = (d: Date = new Date()): string => {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

interface EditTenantInvoiceModalProps {
  isOpen: boolean;
  invoice: TenantInvoiceDb | null;
  ratePerKwh: number;
  onClose: () => void;
  onSuccess: (updatedInvoice: TenantInvoiceDb) => void;
}

export const EditTenantInvoiceModal: React.FC<EditTenantInvoiceModalProps> = ({
  isOpen,
  invoice,
  ratePerKwh,
  onClose,
  onSuccess,
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('');
  const [kwhReading, setKwhReading] = useState('');
  const [demandCharge, setDemandCharge] = useState('0');
  const [tenantEmail, setTenantEmail] = useState('');
  const [status, setStatus] = useState<'PAID' | 'PENDING' | 'OVERDUE'>('PENDING');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (invoice) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00:00`;
      const defaultEnd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const defaultPeriod = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      setStartDate(invoice.start_date || defaultStart);
      setEndDate(invoice.end_date || defaultEnd);
      setBillingPeriod(invoice.billing_period || defaultPeriod);
      setKwhReading(invoice.kwh_reading.toString());
      setDemandCharge((invoice.demand_charge || 0).toString());
      setTenantEmail(invoice.tenant_email || '');
      setStatus(invoice.status);
      setErrorMsg('');
    }
  }, [invoice]);

  // Recalculate interval energy consumption whenever dates change
  useEffect(() => {
    let isCancelled = false;
    const fetchIntervalKwh = async () => {
      if (!invoice || !startDate || !endDate) return;
      try {
        const meter = invoice.meter_name || invoice.tenant_name;
        const rangeResult = await fetchMeterReadingRange(meter, startDate, endDate);
        if (!isCancelled) {
          const calc = calculateIntervalConsumption(
            invoice.kwh_reading,
            startDate,
            endDate,
            rangeResult
          );
          setKwhReading(calc.kwh.toFixed(2));
        }
      } catch (err) {
        console.warn('Error updating interval kWh in edit modal:', err);
      }
    };

    fetchIntervalKwh();
    return () => {
      isCancelled = true;
    };
  }, [invoice, startDate, endDate]);

  const setPresetInterval = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setStartDate(formatIsoSecond(start).replace('T', ' '));
    setEndDate(formatIsoSecond(end).replace('T', ' '));
    setBillingPeriod(getCurrentPeriodLabel(end));
  };

  const setCurrentMonthPreset = () => {
    const now = new Date();
    setStartDate(getMonthStartIso(now).replace('T', ' '));
    setEndDate(getMonthEndIso(now).replace('T', ' '));
    setBillingPeriod(getCurrentPeriodLabel(now));
  };

  const setPreviousMonthPreset = () => {
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    setStartDate(getMonthStartIso(prev).replace('T', ' '));
    setEndDate(getMonthEndIso(prev).replace('T', ' '));
    setBillingPeriod(getCurrentPeriodLabel(prev));
  };

  if (!isOpen || !invoice) return null;

  const parsedKwh = parseFloat(kwhReading) || 0;
  const totalUsd = Number((parsedKwh * ratePerKwh).toFixed(2));
  const totalKhr = Number((totalUsd * 4100).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const kwh = parseFloat(kwhReading);
    const demand = parseFloat(demandCharge) || 0;

    if (isNaN(kwh) || kwh < 0) {
      setErrorMsg('kWh reading must be a valid number.');
      return;
    }

    if (tenantEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantEmail.trim())) {
      setErrorMsg('Please enter a valid tenant email address.');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setErrorMsg('Start date cannot be after end date.');
      return;
    }

    setIsSubmitting(true);

    const updated: TenantInvoiceDb = {
      ...invoice,
      start_date: startDate.includes('T') ? startDate.replace('T', ' ') : startDate,
      end_date: endDate.includes('T') ? endDate.replace('T', ' ') : endDate,
      billing_period: billingPeriod.trim() || `${startDate} - ${endDate}`,
      kwh_reading: kwh,
      demand_charge: demand,
      rate_per_kwh: ratePerKwh,
      tenant_email: tenantEmail.trim(),
      total_cost_usd: totalUsd,
      total_cost_khr: totalKhr,
      status,
      updated_at: new Date().toISOString(),
    };

    await upsertTenantInvoice(updated);
    if (updated.tenant_email) {
      await syncTenantClientAccount(updated.tenant_name, updated.tenant_email);
    }

    setIsSubmitting(false);
    onSuccess(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl bg-white border border-slate-100 rounded-md shadow-xl shadow-slate-900/10 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Edit Tenant Invoice & Billing Parameters
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {invoice.tenant_name} • <span className="font-mono text-slate-600">{invoice.invoice_number}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-md text-xs flex items-center gap-2 bg-[#fef2f2] border border-[#FF3523]/20 text-[#FF3523]">
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <form id="edit-invoice-form" onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Tenant & Meter Summary Box */}
            <div className="p-4 rounded-md bg-slate-50/80 border border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Tenant</span>
                  <span className="text-slate-800 font-bold truncate block mt-0.5">{invoice.tenant_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Unit / Zone</span>
                  <span className="text-slate-700 font-medium truncate block mt-0.5">{invoice.unit_zone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Meter Tag</span>
                  <span className="text-slate-700 font-mono text-[11px] truncate block mt-0.5">{invoice.meter_name}</span>
                </div>
              </div>

              {/* Tenant Contact Email for Billing */}
              <div className="mt-3 pt-3 border-t border-slate-200/60">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#001F3F]" /> Tenant Billing Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    placeholder="billing@tenant-company.com"
                    className="w-full bg-white border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md pl-9 pr-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Billing Cycle Dates & Presets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Billing Period & Telemetry Sync
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {startDate && endDate ? `${startDate.slice(0, 10)} to ${endDate.slice(0, 10)}` : 'Full Interval'}
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPresetInterval(1)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  Last 24h
                </button>
                <button
                  type="button"
                  onClick={() => setPresetInterval(7)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setPresetInterval(30)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={setCurrentMonthPreset}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={setPreviousMonthPreset}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  Last Month
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#001F3F]" /> Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    step="1"
                    value={startDate.length === 10 ? `${startDate}T00:00:00` : startDate.replace(' ', 'T')}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs font-mono rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#001F3F]" /> End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    step="1"
                    value={endDate.length === 10 ? `${endDate}T23:59:59` : endDate.replace(' ', 'T')}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs font-mono rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#001F3F]" /> Billing Period Description
                </label>
                <input
                  type="text"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  placeholder="e.g. Aug 2026"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Energy Reading & Financial Charges */}
            <div className="space-y-3 pt-1">
              <div className="text-xs font-bold text-slate-700">
                Telemetry Reading & Cost Allocation
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Energy (kWh)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={kwhReading}
                    onChange={(e) => setKwhReading(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs font-mono font-bold rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as 'PAID' | 'PENDING' | 'OVERDUE')
                    }
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs font-semibold rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition cursor-pointer"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summary Preview Box */}
            <div className="p-4 rounded-md bg-[#e6edf5]/60 border border-[#001F3F]/20">
              <div className="flex items-center justify-between text-xs">
                <div className="text-slate-600 font-medium">
                  <span>Rate: </span>
                  <span className="text-slate-800 font-bold font-mono">${ratePerKwh.toFixed(3)}/kWh</span>
                  <span className="mx-2 text-slate-300">•</span>
                  <span className="text-slate-500">Total Calculation:</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold font-mono text-[#001F3F]">
                    ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-slate-500 ml-2 font-mono">
                    (៛{totalKhr.toLocaleString('en-US')})
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-invoice-form"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-md text-xs font-bold text-white bg-[#001F3F] hover:bg-[#001428] transition cursor-pointer disabled:opacity-50 shadow-sm shadow-[#001F3F]/20"
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
