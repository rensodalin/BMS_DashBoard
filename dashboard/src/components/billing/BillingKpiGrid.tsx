import React from 'react';
import { DollarSign, Zap, Sparkles, CheckCircle2, TrendingUp } from 'lucide-react';
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
  const paidInvoicesCount = tenantInvoices.filter((i) => i.status === 'PAID').length;
  const pendingCount = tenantInvoices.filter((i) => i.status === 'PENDING').length;
  const overdueCount = tenantInvoices.filter((i) => i.status === 'OVERDUE').length;
  const paidPercentage = tenantInvoices.length > 0
    ? ((paidInvoicesCount / tenantInvoices.length) * 100).toFixed(0)
    : '0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Billed */}
      <div className="bms-panel rounded-xl p-5 bg-[#131924] border border-[#1e2638]">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium">Monthly Billed Utility</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-2xl font-bold text-white font-mono">
          ${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>Est. ~{(totalBilled * 4100).toLocaleString()} KHR</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" /> @ ${ratePerKwh.toFixed(2)}/kWh
          </span>
        </div>
      </div>

      {/* Total kWh Consumption */}
      <div className="bms-panel rounded-xl p-5 bg-[#131924] border border-[#1e2638]">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium">Sub-Metered Consumption</span>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-2xl font-bold text-amber-400 font-mono">
          {totalKwh.toLocaleString('en-US', { minimumFractionDigits: 1 })} kWh
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>{tenantInvoices.length} Active Sub-Meters</span>
          <span className="text-cyan-300 font-mono">Rate: ${ratePerKwh.toFixed(2)}</span>
        </div>
      </div>

      {/* Live Niagara Meter Reading */}
      <div className="bms-panel rounded-xl p-5 bg-[#131924] border border-[#1e2638] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Live Tenant Meter
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <div className="text-2xl font-bold text-blue-400 font-mono">
          {liveKwh.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kW-hr</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span className="font-mono text-cyan-300">TenantIntersys_kWh</span>
          <span className="text-emerald-400 font-mono font-semibold">
            ${(liveKwh * ratePerKwh).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Payment Collection Status */}
      <div className="bms-panel rounded-xl p-5 bg-[#131924] border border-[#1e2638]">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium">Invoice Collection</span>
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-2xl font-bold text-white font-mono">
          {paidInvoicesCount} / {tenantInvoices.length}{' '}
          <span className="text-xs text-slate-400 font-normal">Paid</span>
        </div>
        <div className="text-[11px] font-medium mt-1 flex items-center gap-2">
          <span className="text-emerald-400">Paid: {paidPercentage}%</span>
          <span className="text-amber-400">• {pendingCount} Pending</span>
          <span className="text-red-400">• {overdueCount} Overdue</span>
        </div>
      </div>
    </div>
  );
};
