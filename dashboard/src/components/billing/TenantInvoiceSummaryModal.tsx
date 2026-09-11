import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Hash,
} from 'lucide-react';
import type { TenantInvoiceDb } from '../../types/bms';
import { fetchMeterReadingRange } from '../../lib/supabase';
import { sendInvoiceEmailViaSmtp, hasGmailSmtpConfig } from '../../lib/emailService';
import { downloadInvoicePdf } from '../../lib/pdfInvoiceGenerator';
import { EmailSettingsModal } from './EmailSettingsModal';
import { TenantBillSheet } from './TenantBillSheet';

interface TenantInvoiceSummaryModalProps {
  isOpen: boolean;
  invoice: TenantInvoiceDb | null;
  ratePerKwh: number;
  onClose: () => void;
}

export const TenantInvoiceSummaryModal: React.FC<TenantInvoiceSummaryModalProps> = ({
  isOpen,
  invoice,
  ratePerKwh,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSendingSmtp, setIsSendingSmtp] = useState(false);
  const [smtpSuccess, setSmtpSuccess] = useState(false);
  const [isEmailSettingsOpen, setIsEmailSettingsOpen] = useState(false);
  const [telemetryRange, setTelemetryRange] = useState<{
    startReading: number | null;
    endReading: number | null;
    deltaKwh: number | null;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !invoice?.meter_name) return;

    let isMounted = true;
    const startIso = invoice.start_date
      ? (invoice.start_date.includes(' ') ? invoice.start_date.replace(' ', 'T') : invoice.start_date).slice(0, 19)
      : '2026-08-01T00:00:00';
    const endIso = invoice.end_date
      ? (invoice.end_date.includes(' ') ? invoice.end_date.replace(' ', 'T') : invoice.end_date).slice(0, 19)
      : '2026-09-04T23:59:59';

    fetchMeterReadingRange(invoice.meter_name, startIso, endIso)
      .then((res) => {
        if (isMounted) {
          setTelemetryRange(res);
        }
      })
      .catch((err) => {
        console.warn('Telemetry range fetch notice:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoice?.meter_name, invoice?.start_date, invoice?.end_date]);

  if (!isOpen || !invoice) return null;

  // Invoice status & customer information
  const isPaid = (invoice.status as string) === 'PAID';
  const isOverdue = (invoice.status as string) === 'OVERDUE';
  const customerName = (invoice.tenant_name || 'System Tenant').toUpperCase();

  // ── 1:1 Pixel-Perfect PDF Export (Matching Dashboard UI Exactly) ──
  const handleExportPdf = async () => {
    if (isExportingPdf || !invoice) return;
    setIsExportingPdf(true);

    try {
      await downloadInvoicePdf(
        invoice,
        invoice.start_date,
        invoice.end_date,
        ratePerKwh,
        printRef.current,
        telemetryRange
      );
    } catch (error) {
      console.error('Failed to export bill summary PDF:', error);
      alert('Failed to generate PDF automatically. You can use the Print button to Save as PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };


  const handleSendSmtpWithPdf = async () => {
    if (!invoice) return;
    if (!hasGmailSmtpConfig()) {
      setIsEmailSettingsOpen(true);
      return;
    }
    const tenantMail = (invoice.tenant_email || '').trim();
    if (!tenantMail) {
      alert('No billing email set for this tenant. Edit the invoice and add a Tenant Billing Email first.');
      return;
    }

    setIsSendingSmtp(true);
    setSmtpSuccess(false);

    const res = await sendInvoiceEmailViaSmtp({
      invoice,
      startDate: invoice.start_date,
      endDate: invoice.end_date,
      ratePerKwh,
      telemetryRange,
    });

    setIsSendingSmtp(false);

    if (res.success) {
      setSmtpSuccess(true);
      alert(`Success! Dispatched utility statement with attached PDF invoice directly to ${tenantMail} via your Gmail account.`);
      setTimeout(() => setSmtpSuccess(false), 3000);
    } else {
      alert(`Failed to send email: ${res.error}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs overflow-y-auto select-none print:p-0 print:bg-white print:static">
      {/* Modal Outer Container */}
      <div className="w-full max-w-4xl my-auto flex flex-col items-center">
        {/* Top Control Bar (Hidden when printing, matches Dashboard Theme) */}
        <div className="w-full flex items-center justify-between px-4 py-2.5 mb-2.5 bg-[#15161b] border border-[#202228] rounded-lg shadow-lg print:hidden">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00a4e4] animate-pulse"></span>
              Utility Billing Summary
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#005a87]/25 text-[#38bdf8] border border-[#005a87]/40 flex items-center gap-1">
              <Hash className="w-3 h-3 text-[#38bdf8]" />
              {invoice.invoice_number}
            </span>
            <span className="text-[11px] text-slate-300 font-medium">
              {customerName}
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${isPaid
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : isOverdue
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
            >
              {isPaid ? <CheckCircle2 className="w-3 h-3" /> : isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {invoice.status === 'PAID' ? 'Paid' : invoice.status === 'OVERDUE' ? 'Overdue' : 'Pending'}
            </span>
          </div>

          <div className="flex items-center gap-2">


            {/* Direct Gmail SMTP Button with PDF Attached */}
            <button
              onClick={handleSendSmtpWithPdf}
              disabled={isSendingSmtp}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#005a87] to-[#00a4e4] hover:from-[#004870] hover:to-[#0093ce] text-white font-medium rounded text-xs transition cursor-pointer shadow-sm disabled:opacity-60"
              title="Send invoice with PDF attached directly via your Gmail account"
            >
              {isSendingSmtp ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending PDF...</span>
                </>
              ) : smtpSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Sent via Gmail!</span>
                </>
              ) : (
                <>

                  <span>Send + PDF</span>
                </>
              )}
            </button>





            {/* Direct High-Fidelity PDF Export Button */}
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00a4e4] hover:bg-[#0093ce] text-white font-medium rounded text-xs transition cursor-pointer shadow-sm disabled:opacity-60"
              title="Download 1:1 Pixel-Perfect Utility Bill PDF"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 bg-[#202228] hover:bg-[#2b2e36] text-slate-400 hover:text-white rounded transition cursor-pointer border border-[#2d3039]"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
              AUTHENTIC BILL SHEET (Intersys Company Logo & Consistent Typography)
          ══════════════════════════════════════════════════════════════════ */}
        <TenantBillSheet
          ref={printRef}
          invoice={invoice}
          ratePerKwh={ratePerKwh}
          telemetryRange={telemetryRange}
        />
      </div>

      {/* Email Settings Modal */}
      <EmailSettingsModal
        isOpen={isEmailSettingsOpen}
        onClose={() => setIsEmailSettingsOpen(false)}
      />
    </div>
  );
};

export default TenantInvoiceSummaryModal;
