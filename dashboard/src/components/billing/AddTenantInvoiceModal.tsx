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
  Clock,
  Mail,
} from 'lucide-react';
import { upsertTenantInvoice, syncTenantClientAccount } from '../../lib/supabase';
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

interface AddTenantInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newInvoice?: TenantInvoiceDb) => void;
  ratePerKwh: number;
  existingCount?: number;
  points?: import('../../types/bms').SensorPoint[];
  existingInvoices?: TenantInvoiceDb[];
}

export const AddTenantInvoiceModal: React.FC<AddTenantInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  ratePerKwh,
  existingCount = 0,
  points = [],
  existingInvoices = [],
}) => {
  const [obixUrl, setObixUrl] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [unitZone, setUnitZone] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
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

  // Auto-parse Niagara oBIX Power Meter URL with smart live telemetry matching
  const handleObixUrlChange = (url: string) => {
    setObixUrl(url);
    if (!url.trim()) return;

    try {
      const cleanUrl = url.trim().replace(/\/+$/, '');
      const segments = cleanUrl.split('/');
      const lastSegment = decodeURIComponent((segments[segments.length - 1] || '').replace(/\$20/g, ' '));

      if (lastSegment) {
        // Derive clean tenant name
        let cleanName = lastSegment;
        if (cleanName.toLowerCase().includes('tenant')) {
          const rawName = cleanName.replace(/_kwh/i, '').replace(/^tenant_?/i, '');
          cleanName = rawName ? `Tenant ${rawName}` : 'Tenant Intersys';
        } else {
          cleanName = cleanName.replace(/(_consumptions|_consumption|_kwh)/gi, '');
        }
        cleanName = cleanName.replace(/\$20/g, ' ').replace(/_/g, ' ').trim();
        setTenantName(cleanName);

        const normTarget = cleanName.toLowerCase().replace(/[\s_\-$]+/g, '');

        // Try to match against live telemetry points if available
        let matchedPoint: import('../../types/bms').SensorPoint | undefined;
        if (points && points.length > 0) {
          matchedPoint = points.find((p) => {
            const pNorm = p.point_name.toLowerCase().replace(/[\s_\-$]+/g, '').replace(/(consumption|consumptions|kwh)/gi, '');
            return pNorm === normTarget || p.point_name.toLowerCase().includes(normTarget);
          });
        }

        if (matchedPoint) {
          setMeterName(matchedPoint.point_name);
          setKwhReading(matchedPoint.current_value.toFixed(1));
        } else {
          const meterTag = lastSegment.toLowerCase().endsWith('_kwh') || lastSegment.toLowerCase().endsWith('_consumption')
            ? lastSegment
            : `${lastSegment}_kWh`;
          setMeterName(meterTag);
        }

        // Check if an invoice for this meter or tenant already exists in the system
        const existingInv = existingInvoices.find((inv) => {
          const invNorm = (inv.meter_name || inv.tenant_name || '')
            .toLowerCase()
            .replace(/[\s_\-$]+/g, '')
            .replace(/(consumption|consumptions|kwh|meter|facility|tenant)/gi, '');
          return invNorm === normTarget || (inv.meter_name && inv.meter_name.toLowerCase().includes(normTarget));
        });

        if (existingInv) {
          setInvoiceNumber(existingInv.invoice_number);
          if (existingInv.unit_zone) setUnitZone(existingInv.unit_zone);
          if (existingInv.demand_charge !== undefined) setDemandCharge(existingInv.demand_charge.toString());
          if (existingInv.status) setStatus(existingInv.status);
        } else if (!unitZone) {
          setUnitZone('Commercial Suite 101');
        }
      }
    } catch {
      // ignore parse errors during typing
    }
  };

  const parsedKwh = parseFloat(kwhReading) || 0;
  const parsedDemand = parseFloat(demandCharge) || 0;
  const totalUsd = Number((parsedKwh * ratePerKwh + parsedDemand).toFixed(2));
  const totalKhr = Number((totalUsd * 4100).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!tenantName.trim()) {
      setErrorMsg('Tenant name is required.');
      return;
    }

    if (!meterName.trim()) {
      setErrorMsg('Sub-Meter tag name is required.');
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

    if (tenantEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantEmail.trim())) {
      setErrorMsg('Please enter a valid tenant email address.');
      return;
    }

    setIsSubmitting(true);

    const now = new Date();
    const newInvoice: TenantInvoiceDb = {
      id: invoiceNumber.trim() || `INV-${now.getFullYear()}-${Date.now().toString().slice(-4)}`,
      invoice_number: invoiceNumber.trim() || `INV-${now.getFullYear()}-${Date.now().toString().slice(-4)}`,
      tenant_name: tenantName.trim(),
      unit_zone: unitZone.trim() || 'General Commercial Wing',
      tenant_email: tenantEmail.trim(),
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
      setIsSubmitting(true);
      const saved = await upsertTenantInvoice(newInvoice);
      if (newInvoice.tenant_email) {
        await syncTenantClientAccount(newInvoice.tenant_name, newInvoice.tenant_email);
      }
      if (!saved) {
        console.warn('Supabase upsert returned false, but proceeding with local state.');
      }
      onSuccess(newInvoice);
      onClose();
    } catch (err) {
      console.error('Error saving tenant invoice:', err);
      if (newInvoice.tenant_email) {
        syncTenantClientAccount(newInvoice.tenant_name, newInvoice.tenant_email).catch(() => {});
      }
      setErrorMsg('Failed to save to database. The tenant was added locally.');
      onSuccess(newInvoice);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl bg-[#15161b] border border-[#202228] rounded-lg shadow-2xl shadow-black flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#202228] bg-[#121317]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-[#00a4e4]/10 border border-[#00a4e4]/20 text-[#00a4e4]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Add Sub-Meter / Tenant Invoice
              </h3>
              <p className="text-[11px] text-[#8b929e]">
                Connect Niagara oBIX meter telemetry to the tenant utility billing ledger
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

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded text-xs flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400">
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <form id="add-invoice-form" onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Section 1: Niagara oBIX Integration */}
            <div className="p-3 rounded bg-[#0e0f13] border border-[#202228]">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-[#00a4e4]" />
                  Niagara oBIX Power Meter URL
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Optional Auto-Fill</span>
              </div>
              <input
                type="url"
                value={obixUrl}
                onChange={(e) => handleObixUrlChange(e.target.value)}
                placeholder="https://localhost/obix/config/Drivers/ObixTest/PowerMeter/TenantIntersys_kWh/"
                className="w-full bg-[#15161b] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded px-3 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Paste an oBIX URL to automatically extract the meter tag name and tenant information.
              </p>
            </div>

            {/* Section 2: Tenant & Unit Info */}
            <div className="space-y-3">
              <div className="text-[11px] font-semibold text-slate-400">
                Tenant & Identification
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tenant Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="Tenant Intersys Co., Ltd."
                      className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded pl-8 pr-3 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Invoice Number <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs font-mono rounded pl-8 pr-3 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Sub-Meter Tag Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Zap className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={meterName}
                      onChange={(e) => setMeterName(e.target.value)}
                      placeholder="TenantIntersys_kWh"
                      className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded pl-8 pr-3 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
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
                    className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs rounded px-3 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tenant Billing Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="email"
                      value={tenantEmail}
                      onChange={(e) => setTenantEmail(e.target.value)}
                      placeholder="billing@tenant-company.com"
                      className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded pl-8 pr-3 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Billing Cycle Dates */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">
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
                  placeholder={getCurrentPeriodLabel()}
                  className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-slate-200 text-xs font-mono rounded px-3 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30"
                />
              </div>
            </div>

            {/* Section 4: Energy Reading & Tariff */}
            <div className="space-y-2.5 pt-1">
              <div className="text-[11px] font-semibold text-slate-400">
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

            {/* Total Estimated Cost Summary Bar */}
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
            form="add-invoice-form"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white bg-[#00a4e4] hover:bg-[#0092cc] transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Billing Ledger</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

