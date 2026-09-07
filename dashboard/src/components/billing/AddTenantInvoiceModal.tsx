import React, { useState, useEffect } from 'react';
import {
  X,
  Link,
  Zap,
  Building2,
  Calendar,
  DollarSign,
  Plus,
  FileText,
} from 'lucide-react';
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

const getCurrentPeriodLabel = (d: Date = new Date()): string => {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

interface AddTenantInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ratePerKwh: number;
  existingCount?: number;
}

export const AddTenantInvoiceModal: React.FC<AddTenantInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  ratePerKwh,
  existingCount = 0,
}) => {
  const [obixUrl, setObixUrl] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [unitZone, setUnitZone] = useState('');
  const [meterName, setMeterName] = useState('TenantIntersys_kWh');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [kwhReading, setKwhReading] = useState('1075.0');
  const [demandCharge, setDemandCharge] = useState('25.00');
  const [billingPeriod, setBillingPeriod] = useState('');
  const [status, setStatus] = useState<'PAID' | 'PENDING' | 'OVERDUE'>('PENDING');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync with current live date, time, and period whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setStartDate(getMonthStartIso(now));
      setEndDate(formatIsoSecond(now));
      setBillingPeriod(getCurrentPeriodLabel(now));
      setInvoiceNumber(`INV-${now.getFullYear()}-${String(existingCount + 1).padStart(3, '0')}`);
      setErrorMsg('');
    }
  }, [isOpen, existingCount]);

  if (!isOpen) return null;

  // Auto-parse Niagara oBIX Power Meter URL
  const handleObixUrlChange = (url: string) => {
    setObixUrl(url);
    if (!url.trim()) return;

    try {
      const cleanUrl = url.trim().replace(/\/+$/, '');
      const segments = cleanUrl.split('/');
      const lastSegment = segments[segments.length - 1] || '';

      if (lastSegment) {
        const meterTag = lastSegment.toLowerCase().endsWith('_kwh')
          ? lastSegment
          : `${lastSegment}_kWh`;
        setMeterName(meterTag);

        // Derive tenant name
        if (lastSegment.toLowerCase().includes('tenant')) {
          const rawName = lastSegment.replace(/_kwh/i, '').replace(/^tenant_?/i, '');
          const cleanName = rawName ? `Tenant ${rawName}` : 'Tenant Intersys';
          setTenantName(cleanName);
        } else {
          const cleanName = lastSegment.replace(/_kwh/i, '');
          setTenantName(cleanName);
        }

        if (!unitZone) {
          setUnitZone('Commercial Suite 101');
        }
      }

    } catch {
      // ignore parse errors during typing
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!tenantName.trim()) {
      setErrorMsg('Tenant name is required.');
      return;
    }

    if (!meterName.trim()) {
      setErrorMsg('oBIX Meter Tag Name is required.');
      return;
    }

    const kwh = parseFloat(kwhReading);
    const demand = parseFloat(demandCharge);

    if (isNaN(kwh) || kwh < 0) {
      setErrorMsg('Please enter a valid energy reading (kWh).');
      return;
    }

    if (isNaN(demand) || demand < 0) {
      setErrorMsg('Please enter a valid demand charge ($).');
      return;
    }

    setIsSubmitting(true);

    const totalUsd = Number((kwh * ratePerKwh + demand).toFixed(2));
    const totalKhr = Number((totalUsd * 4100).toFixed(2));

    const now = new Date();
    const newInvoice: TenantInvoiceDb = {
      invoice_number: invoiceNumber.trim() || `INV-${now.getFullYear()}-${Date.now().toString().slice(-4)}`,
      tenant_name: tenantName.trim(),
      unit_zone: unitZone.trim() || 'General Commercial Wing',
      meter_name: meterName.trim(),
      kwh_reading: kwh,
      rate_per_kwh: ratePerKwh,
      demand_charge: demand,
      total_cost_usd: totalUsd,
      total_cost_khr: totalKhr,
      start_date: startDate.includes('T') ? startDate.replace('T', ' ') : startDate,
      end_date: endDate.includes('T') ? endDate.replace('T', ' ') : endDate,
      billing_period: billingPeriod.trim() || getCurrentPeriodLabel(now),
      status: status,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    try {
      await upsertTenantInvoice(newInvoice);
      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to add tenant invoice:', err);
      setIsSubmitting(false);
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-lg rounded p-5 relative max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: '#202227',
          border: '1px solid #2d3038',
        }}
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
                backgroundColor: 'rgba(0, 164, 228, 0.15)',
                color: '#00a4e4',
              }}
            >
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Add Sub-Meter / Tenant Invoice
              </h3>
              <p className="text-[11px] text-slate-400">
                Connect Niagara oBIX Power Meter to tenant utility ledger
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

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          {/* oBIX Power Meter URL Box */}
          <div
            className="p-3 rounded"
            style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}
          >
            <label className="block text-xs font-semibold text-cyan-400 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5" /> Niagara oBIX Power Meter URL
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Auto-extract</span>
            </label>
            <input
              type="url"
              value={obixUrl}
              onChange={(e) => handleObixUrlChange(e.target.value)}
              placeholder="e.g. https://localhost/obix/config/Drivers/ObixTest/PowerMeter/TenantIntersys_kWh/"
              className="w-full hw-input text-xs font-mono text-cyan-300"
            />
          </div>

          {/* Tenant Name & Invoice # */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tenant Name
              </label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Tenant Intersys Co., Ltd."
                  className="w-full hw-input pl-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Invoice Number
              </label>
              <div className="relative">
                <FileText className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full hw-input pl-8 text-xs font-mono text-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Sub-Meter Name & Unit/Zone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Sub-Meter Tag Name
              </label>
              <div className="relative">
                <Zap className="w-3.5 h-3.5 text-amber-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={meterName}
                  onChange={(e) => setMeterName(e.target.value)}
                  placeholder="TenantIntersys_kWh"
                  className="w-full hw-input pl-8 text-xs font-mono text-amber-300"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Unit / Zone Location
              </label>
              <input
                type="text"
                value={unitZone}
                onChange={(e) => setUnitZone(e.target.value)}
                placeholder="Floor 3 - Suite 302"
                className="w-full hw-input text-xs font-mono"
                required
              />
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
                className="w-full hw-input text-xs font-mono text-white"
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
                className="w-full hw-input text-xs font-mono text-white"
                required
              />
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 -mt-1 mb-1">
            <span className="text-[10px] text-slate-400 font-mono">Quick Date:</span>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                setStartDate(formatIsoSecond(todayStart));
                setEndDate(formatIsoSecond(now));
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/50 cursor-pointer"
            >
              Today (00:00 to Now)
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setStartDate(getMonthStartIso(now));
                setEndDate(formatIsoSecond(now));
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#282a32] text-slate-300 hover:text-white border border-[#363a45] cursor-pointer"
            >
              Month to Now
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setEndDate(formatIsoSecond(now));
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/70 text-amber-300 hover:bg-amber-900 border border-amber-700/50 cursor-pointer"
            >
              End = Now
            </button>
          </div>

          {/* Billing Period Label */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Billing Period Label (e.g. {getCurrentPeriodLabel()})
            </label>
            <input
              type="text"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              placeholder={getCurrentPeriodLabel()}
              className="w-full hw-input text-xs font-mono"
            />
          </div>

          {/* kWh Reading & Demand Fee & Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Energy (kWh)
              </label>
              <input
                type="number"
                step="0.1"
                value={kwhReading}
                onChange={(e) => setKwhReading(e.target.value)}
                className="w-full hw-input text-xs font-mono text-amber-300"
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

          {/* Cost Preview Box */}
          <div
            className="p-3 rounded text-xs font-mono flex items-center justify-between"
            style={{
              backgroundColor: '#17181c',
              border: '1px solid #282a32',
            }}
          >
            <span className="text-slate-400">
              Estimated Total (@ ${ratePerKwh.toFixed(3)}/kWh):
            </span>
            <span className="text-emerald-400 font-bold text-sm">
              $
              {(
                (parseFloat(kwhReading) || 0) * ratePerKwh +
                (parseFloat(demandCharge) || 0)
              ).toFixed(2)}
            </span>
          </div>

          {/* Actions */}
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: '#00a4e4' }}
            >
              {isSubmitting ? (
                <span>Adding...</span>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Add to Billing Ledger
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
