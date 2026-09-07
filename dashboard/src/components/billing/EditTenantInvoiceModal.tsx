import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, Zap, DollarSign } from 'lucide-react';
import { upsertTenantInvoice } from '../../lib/supabase';

import type { TenantInvoiceDb } from '../../types/bms';

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

    const totalUsd = Number((kwh * ratePerKwh + demand).toFixed(2));
    const totalKhr = Number((totalUsd * 4100).toFixed(2));

    const updated: TenantInvoiceDb = {
      ...invoice,
      start_date: startDate,
      end_date: endDate,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-lg rounded p-5 relative max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#202227', border: '1px solid #2d3038' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between pb-3 mb-4"
          style={{ borderBottom: '1px solid #282a32' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
              }}
            >
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Set Tenant Billing Dates & Cycle
              </h3>
              <p className="text-[11px] text-slate-400">
                {invoice.tenant_name} • {invoice.invoice_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div
            className="p-2.5 mb-3 rounded text-xs flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(229, 43, 32, 0.12)',
              border: '1px solid rgba(229, 43, 32, 0.3)',
              color: '#ef4444',
            }}
          >
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          {/* Tenant & Meter Summary Box */}
          <div
            className="p-3 rounded text-xs"
            style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
          >
            <div className="flex items-center justify-between font-mono mb-1">
              <span className="text-slate-400">Tenant:</span>
              <span className="text-white font-medium">{invoice.tenant_name}</span>
            </div>
            <div className="flex items-center justify-between font-mono mb-1">
              <span className="text-slate-400">Unit / Location:</span>
              <span className="text-cyan-300">{invoice.unit_zone}</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">oBIX Meter Tag:</span>
              <span className="text-amber-300">{invoice.meter_name}</span>
            </div>
          </div>

          {/* Start Date & Time and End Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-white" /> Start Date & Time
              </label>
              <input
                type="datetime-local"
                step="1"
                value={startDate.length === 10 ? `${startDate}T00:00:00` : startDate.replace(' ', 'T')}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full hw-input text-xs font-mono text-cyan-300"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-white" /> End Date & Time
              </label>
              <input
                type="datetime-local"
                step="1"
                value={endDate.length === 10 ? `${endDate}T23:59:59` : endDate.replace(' ', 'T')}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full hw-input text-xs font-mono text-cyan-300"
                required
              />
            </div>
          </div>



          {/* Billing Period Label */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Billing Period Label (e.g. Aug 2026)
            </label>
            <input
              type="text"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              placeholder="e.g. Aug 2026"
              className="w-full hw-input text-xs font-mono"
            />
          </div>

          {/* kWh Reading, Demand Fee & Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Energy (kWh)
              </label>
              <div className="relative">
                <Zap className="w-3.5 h-3.5 text-amber-500 absolute left-2.5 top-2.5" />
                <input
                  type="number"
                  step="0.1"
                  value={kwhReading}
                  onChange={(e) => setKwhReading(e.target.value)}
                  className="w-full hw-input pl-8 text-xs font-mono text-amber-400"
                  required
                />
              </div>
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
                  className="w-full hw-input pl-8 text-xs font-mono"
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
                className="w-full hw-input text-xs font-mono bg-[#17181c] text-white"
              >
                <option value="PAID">PAID</option>
                <option value="PENDING">PENDING</option>
                <option value="OVERDUE">OVERDUE</option>
              </select>
            </div>
          </div>

          {/* Summary Preview Box */}
          <div
            className="p-3 rounded text-xs font-mono flex items-center justify-between"
            style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
          >
            <span className="text-slate-400">
              Total Cost (@ ${ratePerKwh.toFixed(3)}/kWh):
            </span>
            <span className="text-emerald-400 font-bold text-sm">
              $
              {(
                (parseFloat(kwhReading) || 0) * ratePerKwh +
                (parseFloat(demandCharge) || 0)
              ).toFixed(2)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#282a32] mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: '#00a4e4' }}
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
