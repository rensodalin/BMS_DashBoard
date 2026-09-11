import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Check,
  Search,
  Zap,
  Loader2,
  Download,
  Eye,
  Calendar,
  Building2,
  Copy,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import type { TenantInvoiceDb } from '../../types/bms';
import {
  sendInvoiceEmailViaSmtp,
  hasGmailSmtpConfig,
} from '../../lib/emailService';
import { downloadInvoicePdf } from '../../lib/pdfInvoiceGenerator';
import { calculateTenantBillValues, type TenantBillCalculatedValues } from './TenantBillSheet';
import { fetchMeterReadingRange } from '../../lib/supabase';
import { EmailSettingsModal } from './EmailSettingsModal';

export interface TenantEmailMessage {
  tenantName: string;
  tenantEmail: string;
  accountNumber: string;
  invoiceNumber: string;
  billingPeriodStr: string;
  totalAmountDueStr: string;
  payByDateStr: string;
  subject: string;
  body: string;
  mailtoUrl: string;
  gmailUrl: string;
  outlookWebUrl: string;
}

/**
 * Derives professional billing email text matching the Billing Summary screen exactly:
 */
export function generateTenantEmailMessage(
  inv: TenantInvoiceDb,
  globalStartDate?: string,
  globalEndDate?: string,
  telemetryRange?: {
    startReading: number | null;
    endReading: number | null;
    deltaKwh: number | null;
  } | null,
  ratePerKwh?: number
): TenantEmailMessage {
  const billValues = calculateTenantBillValues(
    inv,
    telemetryRange,
    ratePerKwh,
    globalStartDate,
    globalEndDate
  );

  const accountNumber = billValues.accountNumber;
  const billingPeriodStr = billValues.billingPeriodStr;
  const totalAmountDueStr = `$${billValues.totalAmountDue.toFixed(2)}`;
  const payByDateStr = billValues.payByDateStr;
  const tenantName = (inv.tenant_name || 'Valued Tenant').trim();
  const tenantEmail = (inv.tenant_email || '').trim();

  const body =
    `Dear ${tenantName},\n\n` +
    `Please find attached your utility statement.\n\n` +
    `Account: ${accountNumber}\n` +
    `Invoice: ${inv.invoice_number}\n` +
    `Billing Period: ${billingPeriodStr}\n` +
    `Total Amount Due: ${totalAmountDueStr} (Pay by ${payByDateStr})\n\n` +
    `Thank you,\n` +
    `Intersys BMS Operations Team`;

  const subject = `Utility Bill Statement - ${inv.invoice_number} (${tenantName})`;
  const encodedEmail = encodeURIComponent(tenantEmail);
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  const mailtoUrl = `mailto:${encodedEmail}?subject=${encodedSubject}&body=${encodedBody}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedEmail}&su=${encodedSubject}&body=${encodedBody}`;
  const outlookWebUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodedEmail}&subject=${encodedSubject}&body=${encodedBody}`;

  return {
    tenantName,
    tenantEmail,
    accountNumber,
    invoiceNumber: inv.invoice_number,
    billingPeriodStr,
    totalAmountDueStr,
    payByDateStr,
    subject,
    body,
    mailtoUrl,
    gmailUrl,
    outlookWebUrl,
  };
}

interface SendAllInvoicesModalProps {
  isOpen: boolean;
  invoices: TenantInvoiceDb[];
  startDate?: string;
  endDate?: string;
  ratePerKwh?: number;
  intervalDataMap?: Record<string, { startReading: number | null; endReading: number | null; deltaKwh: number | null } | null>;
  onClose: () => void;
  onUpdateTenantEmail?: (invoiceNumber: string, email: string) => void;
  onViewInvoice?: (invoice: TenantInvoiceDb) => void;
}

export const SendAllInvoicesModal: React.FC<SendAllInvoicesModalProps> = ({
  isOpen,
  invoices,
  startDate,
  endDate,
  ratePerKwh,
  intervalDataMap: propIntervalDataMap,
  onClose,
  onUpdateTenantEmail,
  onViewInvoice: _onViewInvoice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, boolean>>({});
  const [editingEmailInv, setEditingEmailInv] = useState<string | null>(null);
  const [tempEmailValue, setTempEmailValue] = useState('');
  const [sentInvoices, setSentInvoices] = useState<Record<string, boolean>>({});
  const [emailClient, setEmailClient] = useState<'smtp' | 'gmail'>('smtp');
  const [isEmailSettingsOpen, setIsEmailSettingsOpen] = useState(false);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentTenant: string;
  } | null>(null);
  const [errorInvoices, setErrorInvoices] = useState<Record<string, string>>({});
  const [internalIntervalDataMap, setInternalIntervalDataMap] = useState<
    Record<string, { startReading: number | null; endReading: number | null; deltaKwh: number | null } | null>
  >({});
  const [previewItem, setPreviewItem] = useState<{
    invoice: TenantInvoiceDb;
    billValues: TenantBillCalculatedValues;
    msg: TenantEmailMessage;
    hasEmail: boolean;
  } | null>(null);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isSendingSingle, setIsSendingSingle] = useState(false);

  const handleOpenPreview = (item: {
    invoice: TenantInvoiceDb;
    billValues: TenantBillCalculatedValues;
    msg: TenantEmailMessage;
    hasEmail: boolean;
  }) => {
    setPreviewItem(item);
    setPreviewSubject(item.msg.subject);
    setPreviewBody(item.msg.body);
  };

  const handleSendSinglePreview = async (item: {
    invoice: TenantInvoiceDb;
    billValues: TenantBillCalculatedValues;
    msg: TenantEmailMessage;
    hasEmail: boolean;
  }) => {
    if (!hasGmailSmtpConfig()) {
      setIsEmailSettingsOpen(true);
      return;
    }
    setIsSendingSingle(true);
    try {
      const res = await sendInvoiceEmailViaSmtp({
        invoice: item.invoice,
        startDate: item.invoice.start_date || startDate,
        endDate: item.invoice.end_date || endDate,
        ratePerKwh,
        customSubject: previewSubject,
        customBody: previewBody,
        telemetryRange: activeIntervalDataMap[item.invoice.invoice_number] || null,
      });
      if (res.success) {
        setSentInvoices((prev) => ({ ...prev, [item.invoice.invoice_number]: true }));
        setErrorInvoices((prev) => {
          const next = { ...prev };
          delete next[item.invoice.invoice_number];
          return next;
        });
        alert(`Success! Dispatched utility statement to ${item.invoice.tenant_email}`);
        setPreviewItem(null);
      } else {
        alert(`Failed to send email: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Failed to send email: ${err.message || err}`);
    } finally {
      setIsSendingSingle(false);
    }
  };

  // Combine parent provided intervals with internal fetched ones
  const activeIntervalDataMap = useMemo(() => {
    return {
      ...(propIntervalDataMap || {}),
      ...internalIntervalDataMap,
    };
  }, [propIntervalDataMap, internalIntervalDataMap]);

  // Synchronously ensure real recorded meter readings exist for every row
  useEffect(() => {
    if (!isOpen || !invoices || invoices.length === 0) return;
    let isMounted = true;

    const missingInvoices = invoices.filter((inv) => !activeIntervalDataMap[inv.invoice_number]);
    if (missingInvoices.length === 0) return;

    const fetchMissing = async () => {
      const results: Record<string, { startReading: number | null; endReading: number | null; deltaKwh: number | null } | null> = {};
      await Promise.all(
        missingInvoices.map(async (inv) => {
          const s = inv.start_date || startDate;
          const e = inv.end_date || endDate;
          const meter = inv.meter_name || inv.tenant_name;
          if (!s || !e || !meter) return;
          try {
            const res = await fetchMeterReadingRange(meter, s, e);
            results[inv.invoice_number] = res;
          } catch (err) {
            console.warn('Range fetch notice:', err);
          }
        })
      );
      if (isMounted) {
        setInternalIntervalDataMap((prev) => ({ ...prev, ...results }));
      }
    };

    fetchMissing();
    return () => {
      isMounted = false;
    };
  }, [isOpen, invoices, startDate, endDate, activeIntervalDataMap]);

  // Derived item list with 100% verified calculations identical to TenantBillSheet
  const dynamicItems = useMemo(() => {
    return invoices.map((inv) => {
      const telemetry = activeIntervalDataMap[inv.invoice_number] || null;
      const billValues: TenantBillCalculatedValues = calculateTenantBillValues(
        inv,
        telemetry,
        ratePerKwh,
        startDate,
        endDate
      );
      const msg: TenantEmailMessage = generateTenantEmailMessage(
        inv,
        startDate,
        endDate,
        telemetry,
        ratePerKwh
      );

      return {
        invoice: inv,
        billValues,
        msg,
        hasEmail: !!(inv.tenant_email || '').trim(),
      };
    });
  }, [invoices, startDate, endDate, activeIntervalDataMap, ratePerKwh]);

  // Filtered items based on search query
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return dynamicItems;
    return dynamicItems.filter(
      (item) =>
        item.invoice.tenant_name.toLowerCase().includes(q) ||
        item.invoice.invoice_number.toLowerCase().includes(q) ||
        item.invoice.unit_zone.toLowerCase().includes(q) ||
        (item.invoice.tenant_email || '').toLowerCase().includes(q)
    );
  }, [dynamicItems, searchQuery]);

  const wasOpenRef = useRef(false);

  // Initialize all selectable invoices as selected ONLY once when modal first opens
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const initial: Record<string, boolean> = {};
      invoices.forEach((inv) => {
        initial[inv.invoice_number] = true;
      });
      setSelectedInvoices(initial);
      setSentInvoices({});
      setErrorInvoices({});
      setSearchQuery('');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, invoices]);

  if (!isOpen) return null;

  const totalCount = dynamicItems.length;
  const withEmailCount = dynamicItems.filter((i) => i.hasEmail).length;
  const missingEmailCount = totalCount - withEmailCount;

  const selectedCount = Object.values(selectedInvoices).filter(Boolean).length;
  const selectedWithEmail = dynamicItems.filter(
    (i) => selectedInvoices[i.invoice.invoice_number] && i.hasEmail
  );

  const handleToggleAll = () => {
    if (selectedCount === totalCount) {
      setSelectedInvoices({});
    } else {
      const all: Record<string, boolean> = {};
      dynamicItems.forEach((i) => {
        all[i.invoice.invoice_number] = true;
      });
      setSelectedInvoices(all);
    }
  };

  const handleToggleItem = (invoiceNumber: string) => {
    setSelectedInvoices((prev) => ({
      ...prev,
      [invoiceNumber]: !prev[invoiceNumber],
    }));
  };

  const handleSaveEmail = (invoiceNumber: string) => {
    if (onUpdateTenantEmail) {
      onUpdateTenantEmail(invoiceNumber, tempEmailValue.trim());
    }
    setEditingEmailInv(null);
    setTempEmailValue('');
  };

  // Main Batch Send Handler (Sends to ALL selected tenants — PARALLEL for speed)
  const handleStartBatch = async () => {
    if (selectedWithEmail.length === 0) {
      alert('No selected tenants have a valid billing email address.');
      return;
    }

    if (emailClient === 'smtp') {
      if (!hasGmailSmtpConfig()) {
        setIsEmailSettingsOpen(true);
        return;
      }

      setIsSendingBatch(true);
      let successCount = 0;
      let failedCount = 0;
      const total = selectedWithEmail.length;

      // Send in parallel chunks of 3 for speed without overwhelming SMTP
      const CONCURRENCY = 3;
      for (let chunk = 0; chunk < total; chunk += CONCURRENCY) {
        const batch = selectedWithEmail.slice(chunk, chunk + CONCURRENCY);

        setBatchProgress({
          current: Math.min(chunk + CONCURRENCY, total),
          total,
          currentTenant: batch.map((b) => b.invoice.tenant_name).join(', '),
        });

        const results = await Promise.allSettled(
          batch.map((item) =>
            sendInvoiceEmailViaSmtp({
              invoice: item.invoice,
              startDate: item.invoice.start_date || startDate,
              endDate: item.invoice.end_date || endDate,
              ratePerKwh,
              telemetryRange: activeIntervalDataMap[item.invoice.invoice_number] || null,
            }).then((res) => ({ item, res }))
          )
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.res.success) {
            successCount++;
            setSentInvoices((prev) => ({ ...prev, [result.value.item.invoice.invoice_number]: true }));
            setErrorInvoices((prev) => {
              const next = { ...prev };
              delete next[result.value.item.invoice.invoice_number];
              return next;
            });
          } else {
            failedCount++;
            const errMsg =
              result.status === 'fulfilled'
                ? result.value.res.error || 'Delivery failed'
                : 'Network error';
            const invNum =
              result.status === 'fulfilled'
                ? result.value.item.invoice.invoice_number
                : batch[results.indexOf(result)]?.invoice.invoice_number || '';
            if (invNum) {
              setErrorInvoices((prev) => ({
                ...prev,
                [invNum]: errMsg,
              }));
            }
          }
        }
      }

      setIsSendingBatch(false);
      setBatchProgress(null);

      if (failedCount === 0) {
        alert(`Success! Dispatched ${successCount} utility statements with attached PDF bills.`);
      } else {
        alert(`Batch completed: ${successCount} sent, ${failedCount} failed. Review marked invoices.`);
      }
    } else {
      // Open in Gmail Web — fire all at once with minimal delay
      selectedWithEmail.forEach((item, idx) => {
        setTimeout(() => {
          window.open(item.msg.gmailUrl, '_blank');
          setSentInvoices((prev) => ({ ...prev, [item.invoice.invoice_number]: true }));
        }, idx * 150);
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-xs select-none overflow-y-auto">
      {/* Executive Modal Container */}
      <div className="w-full max-w-5xl bg-white border border-slate-100 rounded-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto">

        {/* ── 1. Clean Executive Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  Send All Utility Invoices
                </h2>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-[#e6edf5] text-[#001F3F]">
                  {totalCount} Tenants
                </span>
                {missingEmailCount > 0 && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-[#fef2f2] text-[#FF3523]">
                    {missingEmailCount} Missing Email
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── 2. Unified Controls & Method Bar ── */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          {/* Search Input, Select All & Quick Send All Button */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tenant or invoice..."
                className="w-48 bg-white border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md pl-8 pr-3 py-1.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 shadow-2xs transition"
              />
            </div>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <input
                type="checkbox"
                id="select-all-invoices"
                checked={selectedCount === totalCount && totalCount > 0}
                onChange={handleToggleAll}
                className="w-3.5 h-3.5 rounded bg-white border-slate-300 text-[#001F3F] focus:ring-[#001F3F] cursor-pointer"
              />
              <label htmlFor="select-all-invoices" className="text-xs text-slate-700 font-bold cursor-pointer select-none">
                Select All ({selectedCount})
              </label>
            </div>

            {/* Prominent Header Send All Button */}
            <button
              type="button"
              onClick={handleStartBatch}
              disabled={isSendingBatch || selectedWithEmail.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#001F3F] hover:bg-[#001428] text-white text-xs font-bold shadow-sm shadow-[#001F3F]/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send invoices to all selected tenants"
            >
              {isSendingBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending ({batchProgress?.current}/{batchProgress?.total})...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send All ({selectedWithEmail.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── 3. High-Density Structured Ledger Table ── */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#1c202a] bg-[#0c0d12] text-xs text-slate-300 font-semibold sticky top-0 z-10">
                <th className="py-2.5 px-4 w-10 text-center">
                  <span className="sr-only">Select</span>
                </th>
                <th className="py-2.5 px-4 font-semibold text-slate-300">Tenant &amp; Space</th>
                <th className="py-2.5 px-4 font-semibold text-slate-300">Invoice &amp; Cycle</th>
                <th className="py-2.5 px-4 font-semibold text-slate-300">Billed Usage</th>
                <th className="py-2.5 px-4 font-semibold text-slate-300 text-right">Amount Due</th>
                <th className="py-2.5 px-4 font-semibold text-slate-300">Recipient Email</th>
                <th className="py-2.5 px-4 font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#171923]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 font-mono text-xs">
                    No matching tenant invoices found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const { invoice, billValues, hasEmail } = item;
                  const isSelected = !!selectedInvoices[invoice.invoice_number];
                  const isSent = !!sentInvoices[invoice.invoice_number];
                  const isEditing = editingEmailInv === invoice.invoice_number;

                  return (
                    <tr
                      key={invoice.invoice_number}
                      className={`transition-colors ${isSelected
                        ? 'bg-[#131620] hover:bg-[#161a26]'
                        : 'bg-transparent hover:bg-[#11131a] opacity-60'
                        }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleItem(invoice.invoice_number)}
                          className="w-3.5 h-3.5 rounded bg-[#151822] border-[#2b3040] accent-[#00a4e4] cursor-pointer"
                        />
                      </td>

                      {/* Tenant & Suite */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white text-xs">
                          {billValues.customerName}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{invoice.unit_zone || 'Commercial Space'}</span>
                        </div>
                      </td>

                      {/* Invoice Number & Billing Cycle */}
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#38bdf8] bg-[#005a87]/20 px-1.5 py-0.5 rounded border border-[#005a87]/30">
                          {invoice.invoice_number}
                        </div>
                        <div className="text-[10.5px] text-slate-400 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{billValues.billingPeriodStr}</span>
                        </div>
                      </td>

                      {/* Billed Energy Consumption */}
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-baseline gap-1 text-slate-200 font-semibold">
                          <span>{billValues.kwhAmount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
                          <span className="text-[10px] text-slate-400 font-normal">kWh</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {billValues.openReading.toLocaleString()} → {billValues.closeReading.toLocaleString()}
                        </div>
                      </td>

                      {/* Amount Due (Synchronized to Billing Summary) */}
                      <td className="py-3 px-4 font-mono text-right">
                        <div className="font-bold text-sm text-[#38bdf8]">
                          ${billValues.totalAmountDue.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {billValues.isPaid ? (
                            <span className="text-emerald-400 font-semibold">PAID</span>
                          ) : (
                            <span>Due {billValues.payByDateStr}</span>
                          )}
                        </div>
                      </td>

                      {/* Recipient Email & Inline Editor */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="email"
                              value={tempEmailValue}
                              onChange={(e) => setTempEmailValue(e.target.value)}
                              placeholder="tenant@domain.com"
                              className="bg-[#151822] border border-[#00a4e4] text-white text-xs font-mono rounded px-2 py-0.5 focus:outline-none w-44"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEmail(invoice.invoice_number);
                                if (e.key === 'Escape') setEditingEmailInv(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEmail(invoice.invoice_number)}
                              className="p-1 rounded bg-[#005a87] text-white hover:bg-[#0077a6] cursor-pointer"
                              title="Save Email"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEmailInv(null)}
                              className="p-1 rounded bg-[#1c202a] text-slate-400 hover:text-white cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {hasEmail ? (
                              <span className="font-mono text-xs text-slate-300 truncate max-w-[190px]">
                                {invoice.tenant_email}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEmailInv(invoice.invoice_number);
                                  setTempEmailValue('');
                                }}
                                className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 transition cursor-pointer flex items-center gap-1"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span>+ Add Email</span>
                              </button>
                            )}

                            {hasEmail && onUpdateTenantEmail && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEmailInv(invoice.invoice_number);
                                  setTempEmailValue(invoice.tenant_email || '');
                                }}
                                className="p-1 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                                title="Edit Email Address"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Action Buttons: View Bill & Download PDF (No row Gmail button) */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Gmail Message Preview Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(item)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#151822] hover:bg-[#1f2433] text-slate-300 hover:text-white border border-[#222736] hover:border-[#00a4e4] transition cursor-pointer text-xs font-medium"
                            title={`View Gmail message for ${invoice.tenant_name}`}
                          >
                            <Eye className="w-3.5 h-3.5 text-[#00a4e4]" />
                            <span>View</span>
                          </button>

                          {/* Download PDF Button */}
                          <button
                            type="button"
                            onClick={() =>
                              downloadInvoicePdf(
                                invoice,
                                invoice.start_date || startDate,
                                invoice.end_date || endDate,
                                ratePerKwh,
                                null,
                                activeIntervalDataMap[invoice.invoice_number] || null
                              )
                            }
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#151822] hover:bg-[#1f2433] text-slate-300 hover:text-white border border-[#222736] hover:border-[#38bdf8] transition cursor-pointer text-xs font-medium"
                            title="Download official high-resolution PDF utility statement"
                          >
                            <Download className="w-3.5 h-3.5 text-[#38bdf8]" />
                            <span>PDF</span>
                          </button>

                          {/* Sent Indicator */}
                          {isSent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Sent</span>
                            </span>
                          )}

                          {/* Error indicator if failed */}
                          {errorInvoices[invoice.invoice_number] && !isSent && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono"
                              title={errorInvoices[invoice.invoice_number]}
                            >
                              Failed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 4. Executive Bottom Action Bar ── */}
        <div className="px-6 py-3.5 border-t border-[#1c202a] bg-[#12141c] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Status info & total sum */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Selected:</span>
              <span className="font-mono font-bold text-white bg-[#1a1e2a] px-2 py-0.5 rounded border border-[#242a3a]">
                {selectedCount} / {totalCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Total Payable:</span>
              <span className="font-mono font-bold text-[#38bdf8] text-sm">
                ${dynamicItems
                  .filter((i) => selectedInvoices[i.invoice.invoice_number])
                  .reduce((acc, curr) => acc + curr.billValues.totalAmountDue, 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>


          </div>

          {/* Batch Progress or Action Buttons */}
          <div className="flex items-center gap-2.5">
            {batchProgress && (
              <div className="flex items-center gap-2 px-3 py-1 bg-[#161a24] rounded-md border border-[#23293a] text-slate-300">
                <Loader2 className="w-3.5 h-3.5 text-[#00a4e4] animate-spin" />
                <span className="font-mono text-xs">
                  {batchProgress.current} / {batchProgress.total}: {batchProgress.currentTenant}
                </span>
              </div>
            )}





            {/* Primary Send All Tenants Button */}
            <button
              type="button"
              onClick={handleStartBatch}
              disabled={isSendingBatch || selectedWithEmail.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-md bg-[#001F3F] hover:bg-[#001428] text-white font-semibold shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingBatch ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching Statements...</span>
                </>
              ) : emailClient === 'smtp' ? (
                <>
                  <Zap className="w-4 h-4 text-[#38bdf8]" />
                  <span>Send to All Selected Tenants ({selectedWithEmail.length})</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Open All in Gmail Web ({selectedWithEmail.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Email Settings Modal */}
      <EmailSettingsModal
        isOpen={isEmailSettingsOpen}
        onClose={() => setIsEmailSettingsOpen(false)}
        onConfigSaved={() => {
          setEmailClient('smtp');
        }}
      />

      {/* ── Authentic Google Gmail Compose Window ── */}
      {previewItem && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs select-none animate-in fade-in duration-100"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#202124] rounded-lg shadow-2xl border border-[#3c4043] flex flex-col max-h-[90vh] overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Real Gmail Window Bar */}
            <div className="h-10 px-4 bg-[#292a2d] border-b border-[#3c4043] flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-[#e8eaed] select-none">
                New Message
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const editedGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
                      previewItem.invoice.tenant_email || ''
                    )}&su=${encodeURIComponent(previewSubject)}&body=${encodeURIComponent(previewBody)}`;
                    window.open(editedGmailUrl, '_blank');
                  }}
                  className="w-7 h-7 rounded flex items-center justify-center text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#35373a] transition cursor-pointer"
                  title="Open in full Gmail tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="w-7 h-7 rounded flex items-center justify-center text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#35373a] transition cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Recipients (To) Row */}
            <div className="px-4 py-2 border-b border-[#3c4043] flex items-center gap-2 shrink-0">
              <span className="text-xs text-[#9aa0a6] w-12 shrink-0 select-none">To</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {previewItem.invoice.tenant_email ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#303134] text-xs text-[#e8eaed] border border-[#5f6368] truncate max-w-full">
                    <span>{previewItem.invoice.tenant_name}</span>
                    <span className="text-[#9aa0a6]">&lt;{previewItem.invoice.tenant_email}&gt;</span>
                  </span>
                ) : (
                  <span className="text-amber-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> No recipient email set for {previewItem.invoice.tenant_name}
                  </span>
                )}
              </div>
            </div>

            {/* Subject Row (Editable) */}
            <div className="px-4 py-2 border-b border-[#3c4043] flex items-center gap-2 shrink-0">
              <span className="text-xs text-[#9aa0a6] w-12 shrink-0 select-none">Subject</span>
              <input
                type="text"
                value={previewSubject}
                onChange={(e) => setPreviewSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 bg-transparent text-xs text-[#e8eaed] font-normal focus:outline-none placeholder:text-[#9aa0a6]"
              />
            </div>

            {/* Email Body (Editable Text Area) */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#202124] flex flex-col min-h-0">
              <textarea
                value={previewBody}
                onChange={(e) => setPreviewBody(e.target.value)}
                placeholder="Type email body here..."
                rows={9}
                className="w-full flex-1 bg-transparent text-xs text-[#e8eaed] font-sans leading-relaxed resize-none focus:outline-none placeholder:text-[#9aa0a6] select-text min-h-[190px]"
              />

              {/* Real Gmail Attachment Chip */}
              <div className="pt-2 shrink-0">
                <div
                  onClick={() =>
                    downloadInvoicePdf(
                      previewItem.invoice,
                      previewItem.invoice.start_date || startDate,
                      previewItem.invoice.end_date || endDate,
                      ratePerKwh,
                      null,
                      activeIntervalDataMap[previewItem.invoice.invoice_number] || null
                    )
                  }
                  className="inline-flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#28292c] hover:bg-[#303236] border border-[#3c4043] text-left transition cursor-pointer max-w-md group"
                  title="Click to download PDF statement"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded bg-[#ea4335]/15 flex items-center justify-center text-[#ea4335] shrink-0 font-bold text-[10px]">
                      PDF
                    </div>
                    <div className="truncate">
                      <div className="text-xs text-[#e8eaed] font-medium truncate group-hover:text-white">
                        Invoice-{previewItem.invoice.invoice_number}.pdf
                      </div>
                      <div className="text-[10px] text-[#9aa0a6]">
                        42 KB
                      </div>
                    </div>
                  </div>
                  <Download className="w-3.5 h-3.5 text-[#9aa0a6] group-hover:text-[#e8eaed] shrink-0 ml-2" />
                </div>
              </div>
            </div>

            {/* Real Gmail Bottom Toolbar */}
            <div className="h-12 px-4 border-t border-[#3c4043] bg-[#202124] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {/* Google Blue Send Button */}
                <button
                  type="button"
                  onClick={() => handleSendSinglePreview(previewItem)}
                  disabled={!previewItem.invoice.tenant_email || isSendingSingle}
                  className="px-5 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1b66c9] active:bg-[#174ea6] text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  {isSendingSingle ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </>
                  )}
                </button>

                {/* Open in Gmail Web Pill */}
                <button
                  type="button"
                  onClick={() => {
                    const editedGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
                      previewItem.invoice.tenant_email || ''
                    )}&su=${encodeURIComponent(previewSubject)}&body=${encodeURIComponent(previewBody)}`;
                    window.open(editedGmailUrl, '_blank');
                  }}
                  className="px-3 py-1.5 rounded-md hover:bg-[#2e3033] text-[#8ab4f8] text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                  title="Open draft in Gmail Web (mail.google.com)"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open in Gmail Web</span>
                </button>

                {/* Copy Text Button */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(previewBody);
                    setCopiedMsgId(previewItem.invoice.invoice_number);
                    setTimeout(() => setCopiedMsgId(null), 2000);
                  }}
                  className="p-2 rounded hover:bg-[#2e3033] text-[#9aa0a6] hover:text-[#e8eaed] transition cursor-pointer"
                  title="Copy message body text"
                >
                  {copiedMsgId === previewItem.invoice.invoice_number ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Discard / Close Button */}
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-2 rounded hover:bg-[#2e3033] text-[#9aa0a6] hover:text-[#e8eaed] transition cursor-pointer"
                title="Discard draft"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SendAllInvoicesModal;
