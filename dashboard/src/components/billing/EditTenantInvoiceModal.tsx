import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, DollarSign, Clock } from 'lucide-react';
import { upsertTenantInvoice } from '../../lib/supabase';
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
  const [demandCharge, setDemandCharge] = useState('');
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
      setDemandCharge(invoice.demand_charge.toString());
      setStatus(invoice.status);
      setErrorMsg('');
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const parsedKwh = parseFloat(kwhReading) || 0;
  const parsedDemand = parseFloat(demandCharge) || 0;
  const totalUsd = Number((parsedKwh * ratePerKwh + parsedDemand).toFixed(2));
  const totalKhr = Number((totalUsd * 4100).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const kwh = parseFloat(kwhReading);
    const demand = parseFloat(demandCharge);

    if (isNaN(kwh) || isNaN(demand) || kwh < 0 || demand < 0) {
      setErrorMsg('kWh reading and demand charge must be valid numbers.');
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
      total_cost_usd: totalUsd,
      total_cost_khr: totalKhr,
      status,
      updated_at: new Date().toISOString(),
    };

    await upsertTenantInvoice(updated);

    setIsSubmitting(false);
    onSuccess(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl bg-[#15161b] border border-[#202228] rounded-lg shadow-2xl shadow-black flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#202228] bg-[#121317]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-[#00a4e4]/10 border border-[#00a4e4]/20 text-[#00a4e4]">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-white">
                Edit Tenant Invoice & Billing Parameters
              </h3>
              <p className="text-[11px] text-[#8b929e]">
                {invoice.tenant_name} • {invoice.invoice_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#8b929e] hover:text-white hover:bg-[#202228] transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded text-xs flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400">
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <form id="edit-invoice-form" onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Tenant & Meter Summary Box */}
            <div className="p-3 rounded bg-[#0e0f13] border border-[#202228]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Tenant</span>
                  <span className="text-white font-medium truncate block">{invoice.tenant_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Unit / Zone</span>
                  <span className="text-slate-300 truncate block">{invoice.unit_zone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Meter Tag</span>
                  <span className="text-slate-300 truncate block">{invoice.meter_name}</span>
                </div>
              </div>
            </div>

            {/* Billing Cycle Dates & Presets */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Billing Period & Schedule
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Date Range Presets:</span>
              </div>

              {/* Clean Unified Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                    setStartDate(formatIsoSecond(todayStart));
                    setEndDate(formatIsoSecond(now));
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-mono bg-[#1a1c22] hover:bg-[#232630] text-slate-300 hover:text-white border border-[#282b35] transition cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setStartDate(getMonthStartIso(now));
                    setEndDate(formatIsoSecond(now));
                    setBillingPeriod(getCurrentPeriodLabel(now));
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-mono bg-[#1a1c22] hover:bg-[#232630] text-slate-300 hover:text-white border border-[#282b35] transition cursor-pointer"
                >
                  Month to Date
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setStartDate(getMonthStartIso(now));
                    setEndDate(getMonthEndIso(now));
                    setBillingPeriod(getCurrentPeriodLabel(now));
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-mono bg-[#1a1c22] hover:bg-[#232630] text-slate-300 hover:text-white border border-[#282b35] transition cursor-pointer"
                >
                  Full Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setEndDate(formatIsoSecond(now));
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-mono bg-[#1a1c22] hover:bg-[#232630] text-slate-300 hover:text-white border border-[#282b35] transition cursor-pointer"
                >
                  End = Now
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    step="1"
                    value={startDate.length === 10 ? `${startDate}T00:00:00` : startDate.replace(' ', 'T')}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    step="1"
                    value={endDate.length === 10 ? `${endDate}T23:59:59` : endDate.replace(' ', 'T')}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> Billing Period Description
                </label>
                <input
                  type="text"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  placeholder="e.g. Aug 2026"
                  className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded px-3 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                />
              </div>
            </div>

            {/* Energy Reading & Financial Charges */}
            <div className="space-y-2.5 pt-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Telemetry Reading & Cost Allocation
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Energy (kWh)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={kwhReading}
                    onChange={(e) => setKwhReading(e.target.value)}
                    className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Demand Fee ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="number"
                      step="0.01"
                      value={demandCharge}
                      onChange={(e) => setDemandCharge(e.target.value)}
                      className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as 'PAID' | 'PENDING' | 'OVERDUE')
                    }
                    className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summary Preview Box */}
            <div className="p-3 rounded bg-[#0e0f13] border border-[#202228]">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="text-slate-400">
                  <span>Rate: </span>
                  <span className="text-white font-semibold">${ratePerKwh.toFixed(3)}/kWh</span>
                  <span className="mx-2 text-slate-600">•</span>
                  <span className="text-slate-400">Total Calculation:</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-400">
                    ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-2">
                    (៛{totalKhr.toLocaleString('en-US')})
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-[#202228] bg-[#121317]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-[#202228] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-invoice-form"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white bg-[#00a4e4] hover:bg-[#0092cc] transition cursor-pointer disabled:opacity-50 shadow-sm"
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

