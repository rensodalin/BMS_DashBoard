import React from 'react';
import { DollarSign, Zap, Activity, CheckCircle2 } from 'lucide-react';
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 select-none">
      {/* ── Card 1: Total Billed Utility ── */}
      <div className="hw-panel p-3.5 flex flex-col justify-between">
        <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <span>Monthly Billed Utility</span>
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-white">
            ${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-emerald-400 font-mono">USD</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center justify-between">
          <span>Est. ~{(totalBilled * 4100).toLocaleString('en-US', { maximumFractionDigits: 0 })} KHR</span>
          <span className="text-emerald-400 font-mono">@ ${ratePerKwh.toFixed(2)}/kWh</span>
        </div>
      </div>

      {/* ── Card 2: Sub-Metered Consumption ── */}
      <div className="hw-panel p-3.5 flex flex-col justify-between">
        <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <span>Sub-Metered Consumption</span>
          <Zap className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-amber-500">
            {totalKwh.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span className="text-xs text-slate-400 font-mono">kWh</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center justify-between">
          <span>{tenantInvoices.length} Active Sub-Meters</span>
          <span className="text-cyan-400 font-mono">{(totalKwh / 1000).toFixed(2)} MWh Load</span>
        </div>
      </div>

      {/* ── Card 3: Live Tenant Telemetry ── */}
      <div className="hw-panel p-3.5 flex flex-col justify-between">
        <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 hw-pulse" />
            <span>Live Tenant Meter</span>
          </div>
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-cyan-400">
            {liveKwh.toFixed(2)}
          </span>
          <span className="text-xs text-slate-400 font-mono">kW·h</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center justify-between">
          <span className="font-mono text-cyan-300">TenantIntersys_kWh</span>
          <span className="text-emerald-400 font-mono font-semibold">
            ${(liveKwh * ratePerKwh).toFixed(2)}
          </span>
        </div>
      </div>

      {/* ── Card 4: Invoice Collection ── */}
      <div className="hw-panel p-3.5 flex flex-col justify-between">
        <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <span>Invoice Collection</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-white">
            {paidInvoicesCount}/{tenantInvoices.length}
          </span>
          <span className="text-xs text-slate-400 font-mono">Paid ({paidPercentage}%)</span>
        </div>
        <div className="text-[10px] font-mono mt-1 flex items-center gap-2">
          <span className="text-emerald-400">{paidInvoicesCount} Paid</span>
          <span className="text-amber-400">• {pendingCount} Pending</span>
          <span className={overdueCount > 0 ? 'text-red-400 font-semibold' : 'text-slate-500'}>
            • {overdueCount} Overdue
          </span>
        </div>
      </div>
    </div>
  );
};