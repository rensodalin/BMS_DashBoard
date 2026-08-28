import React from 'react';
import { CreditCard, Code2, Download, Database } from 'lucide-react';

interface BillingHeaderBannerProps {
  dbConnected: boolean;
  showObixXml: boolean;
  onToggleObixXml: () => void;
  onExportInvoices: () => void;
}

export const BillingHeaderBanner: React.FC<BillingHeaderBannerProps> = ({
  dbConnected,
  showObixXml,
  onToggleObixXml,
  onExportInvoices,
}) => {
  return (
    <div className="bms-panel rounded-xl p-6 bg-[#131924] border border-[#1e2638] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-5 h-5 text-blue-400" />
          <h1 className="text-xl font-bold text-white tracking-wide">
            Utility Billing & Tenant Sub-Metering
          </h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Niagara oBIX Powered
          </span>
          {dbConnected && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Database className="w-3 h-3 text-emerald-400" /> Supabase Synced
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Real-time power meter telemetry, tenant energy cost allocation & utility invoice management.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onToggleObixXml}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#0c1018] border border-[#1e2638] text-slate-300 hover:text-white hover:border-slate-600 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Code2 className="w-4 h-4 text-cyan-400" />
          {showObixXml ? 'Hide oBIX XML Data' : 'View oBIX XML Feed'}
        </button>

        <button
          onClick={onExportInvoices}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export Invoices CSV
        </button>
      </div>
    </div>
  );
};
