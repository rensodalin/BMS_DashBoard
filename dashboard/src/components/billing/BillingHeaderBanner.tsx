import React from 'react';
import { CreditCard, Download, Database, Plus } from 'lucide-react';

interface BillingHeaderBannerProps {
  dbConnected: boolean;
  onExportInvoices: () => void;
  onOpenAddInvoice?: () => void;
}

export const BillingHeaderBanner: React.FC<BillingHeaderBannerProps> = ({
  dbConnected,
  onExportInvoices,
  onOpenAddInvoice,
}) => {
  return (
    <div
      className="bms-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      style={{
        backgroundColor: '#17191d',
        border: '1px solid #292c31',
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
          <CreditCard
            className="w-4 h-4"
            style={{ color: '#8a9199' }}
          />

          <h1
            className="text-lg font-medium"
            style={{ color: '#e1e3e5' }}
          >
            Utility Billing & Tenant Sub-Metering
          </h1>

          {dbConnected && (
            <span
              className="px-2 py-0.5 text-[10px] font-mono flex items-center gap-1"
              style={{
                backgroundColor: '#1b2924',
                color: '#83b99f',
                border: '1px solid #294036',
              }}
            >
              <Database
                className="w-3 h-3"
                style={{ color: '#6fa889' }}
              />
              Supabase Synced
            </span>
          )}
        </div>

        <p
          className="text-xs leading-relaxed max-w-3xl"
          style={{ color: '#777d85' }}
        >
          Real-time power meter telemetry, tenant energy cost
          allocation & utility invoice management.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onOpenAddInvoice && (
          <button
            onClick={onOpenAddInvoice}
            className="px-3 py-2 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            style={{
              backgroundColor: '#1c1e22',
              border: '1px solid #30343a',
              color: '#00a4e4',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#38bdf8';
              e.currentTarget.style.borderColor = '#00a4e4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#00a4e4';
              e.currentTarget.style.borderColor = '#30343a';
            }}
            title="Add new sub-meter or invoice"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Sub-Meter / Invoice
          </button>
        )}

        <button
          onClick={onExportInvoices}
          className="px-3.5 py-2 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
          style={{
            backgroundColor: '#087fb1',
            border: '1px solid #0b8bbd',
            color: '#ffffff',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0a91c5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#087fb1';
          }}
        >
          <Download className="w-3.5 h-3.5" />
          Export Invoices CSV
        </button>
      </div>
    </div>
  );
};