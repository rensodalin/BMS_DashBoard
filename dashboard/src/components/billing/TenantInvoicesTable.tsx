import React from 'react';
import { Filter, Search, Zap, CheckCircle2, Clock, AlertCircle, FileText } from 'lucide-react';
import type { TenantInvoiceDb } from '../../types/bms';

interface TenantInvoicesTableProps {
  invoices: TenantInvoiceDb[];
  searchQuery: string;
  statusFilter: 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE';
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE') => void;
  onExportInvoices: () => void;
}

export const TenantInvoicesTable: React.FC<TenantInvoicesTableProps> = ({
  invoices,
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onExportInvoices,
}) => {
  const statuses: Array<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'> = ['ALL', 'PAID', 'PENDING', 'OVERDUE'];

  return (
    <div className="bms-panel rounded-xl bg-[#131924] border border-[#1e2638] overflow-hidden">
      {/* Table Filter Bar */}
      <div className="p-4 border-b border-[#1e2638] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <span className="text-[11px] font-mono text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> STATUS:
          </span>

          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => onStatusFilterChange(status)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                statusFilter === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#0c1018] text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {status} {status === 'ALL' ? `(${invoices.length})` : ''}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tenant or meter..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md bms-input text-xs placeholder:text-slate-500 bg-[#0c1018] border-[#1e2638]"
          />
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#0c1018] text-slate-400 font-mono border-b border-[#1e2638] uppercase tracking-wider text-[11px]">
              <th className="p-3.5 pl-5">Invoice & Tenant</th>
              <th className="p-3.5">Sub-Meter Name</th>
              <th className="p-3.5">kWh Consumption</th>
              <th className="p-3.5">Rate & Demand</th>
              <th className="p-3.5">Total Amount</th>
              <th className="p-3.5">Payment Status</th>
              <th className="p-3.5 pr-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2638]/60 text-slate-200">
            {invoices.map((inv) => (
              <tr
                key={inv.invoice_number}
                className="hover:bg-[#182030]/60 transition-colors group"
              >
                <td className="p-3.5 pl-5">
                  <div className="font-semibold text-white group-hover:text-blue-400 transition">
                    {inv.tenant_name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                    <span className="text-slate-500">{inv.invoice_number}</span> •{' '}
                    <span>{inv.unit_zone}</span>
                  </div>
                </td>

                <td className="p-3.5">
                  <div className="font-mono text-cyan-300 font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    {inv.meter_name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {inv.billing_period}
                  </div>
                </td>

                <td className="p-3.5">
                  <div className="font-mono font-bold text-amber-400 text-sm">
                    {inv.kwh_reading.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    <span className="text-[10px] text-slate-400">kWh</span>
                  </div>
                </td>

                <td className="p-3.5">
                  <div className="text-amber-300 font-mono font-bold">
                    ${inv.rate_per_kwh.toFixed(2)} / kWh
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    +${inv.demand_charge.toFixed(2)} Demand
                  </div>
                </td>

                <td className="p-3.5">
                  <div className="font-mono font-bold text-emerald-400 text-sm">
                    ${inv.total_cost_usd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    ~{inv.total_cost_khr.toLocaleString()} KHR
                  </div>
                </td>

                <td className="p-3.5">
                  {inv.status === 'PAID' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" /> PAID
                    </span>
                  )}
                  {inv.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Clock className="w-3 h-3" /> PENDING
                    </span>
                  )}
                  {inv.status === 'OVERDUE' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                      <AlertCircle className="w-3 h-3" /> OVERDUE
                    </span>
                  )}
                </td>

                <td className="p-3.5 pr-5 text-right">
                  <button
                    onClick={onExportInvoices}
                    className="px-2.5 py-1 rounded bg-[#0c1018] hover:bg-blue-600 text-slate-300 hover:text-white border border-[#1e2638] text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3 h-3" /> Invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
