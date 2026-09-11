import React from 'react';
import type { TenantInvoiceDb } from '../../types/bms';

interface BillingKpiGridProps {
  totalBilled: number;
  totalKwh: number;
  liveKwh: number;
  ratePerKwh: number;
  tenantInvoices: TenantInvoiceDb[];
}

export const BillingKpiGrid: React.FC<BillingKpiGridProps> = ({
  totalBilled,
  totalKwh,
  liveKwh,
  ratePerKwh,
  tenantInvoices,
}) => {
  const paidInvoicesCount = tenantInvoices.filter(
    (i) => i.status === 'PAID'
  ).length;

  const pendingCount = tenantInvoices.filter(
    (i) => i.status === 'PENDING'
  ).length;

  const overdueCount = tenantInvoices.filter(
    (i) => i.status === 'OVERDUE'
  ).length;

  const paidPercentage =
    tenantInvoices.length > 0
      ? ((paidInvoicesCount / tenantInvoices.length) * 100).toFixed(0)
      : '0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none mb-5">
      {/* ── Card 1: Total Billed Utility ── */}
      <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow min-h-[148px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Monthly Utility Billed</span>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">
              ${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-[#001F3F]">USD</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-block px-2.5 py-0.5 rounded bg-[#e6edf5] text-[#001F3F] text-[10px] font-semibold">
              ${ratePerKwh.toFixed(2)}/kWh
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>Est. ~{(totalBilled * 4100).toLocaleString('en-US', { maximumFractionDigits: 0 })} KHR</span>

        </div>
      </div>

      {/* ── Card 2: Sub-Metered Consumption ── */}
      <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow min-h-[148px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Sub-Metered Total</span>

        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {totalKwh.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-semibold text-slate-400">kWh</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-block px-2.5 py-0.5 rounded bg-[#e6edf5] text-[#001F3F] text-[10px] font-semibold">
              {(totalKwh / 1000).toFixed(2)} MWh Recorded
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>{tenantInvoices.length} Sub-Meters</span>

        </div>
      </div>

      {/* ── Card 3: Live Tenant Telemetry ── */}
      <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow min-h-[148px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Live Tenant Meter</span>

        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {liveKwh.toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-slate-400">kW·h</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-block px-2.5 py-0.5 rounded bg-[#e6edf5] text-[#001F3F] text-[10px] font-semibold">
              Live: ${(liveKwh * ratePerKwh).toFixed(2)}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-mono mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between truncate">
          <span className="truncate">TenantIntersys_kWh</span>

        </div>
      </div>

      {/* ── Card 4: Invoice Collection ── */}
      <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow min-h-[148px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Invoice Collection</span>

        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {paidInvoicesCount}/{tenantInvoices.length}
            </span>
            <span className="text-xs font-semibold text-[#001F3F]">({paidPercentage}% Paid)</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#e6edf5] text-[#001F3F] text-[10px] font-semibold">
              {paidInvoicesCount} Paid
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold">
              {pendingCount} Pending
            </span>
            {overdueCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#fef2f2] text-[#FF3523] text-[10px] font-semibold">
                {overdueCount} Overdue
              </span>
            )}
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>Automatic Reconciliation</span>
          <span>Realtime</span>
        </div>
      </div>
    </div>
  );
}; 