import { supabase, fetchMeterReadingRange } from './supabase';
import type { TenantInvoiceDb } from '../types/bms';
import { getInvoicePdfBase64 } from './pdfInvoiceGenerator';
import { calculateTenantBillValues } from '../components/billing/TenantBillSheet';

export interface GmailSmtpConfig {
  email: string;
  appPassword: string;
  senderName?: string;
}

const STORAGE_KEY = 'bms_gmail_smtp_credentials';

/**
 * Retrieve saved Gmail SMTP credentials from local storage with fallback to env variables
 */
export function getGmailSmtpConfig(): GmailSmtpConfig {
  const defaultEmail = (import.meta.env.VITE_GMAIL_USER || 'rrensodalin@gmail.com').trim();
  const defaultPass = (import.meta.env.VITE_GMAIL_APP_PASSWORD || 'epsovhkaklzwcrqx').replace(/\s+/g, '');
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        email: defaultEmail,
        appPassword: defaultPass,
        senderName: 'Intersys BMS Operations',
      };
    }
    const parsed = JSON.parse(raw);
    return {
      email: (parsed.email || defaultEmail).trim(),
      appPassword: (parsed.appPassword || defaultPass).replace(/\s+/g, ''),
      senderName: (parsed.senderName || 'Intersys BMS Operations').trim(),
    };
  } catch {
    return {
      email: defaultEmail,
      appPassword: defaultPass,
      senderName: 'Intersys BMS Operations',
    };
  }
}

/**
 * Save Gmail SMTP credentials to local storage
 */
export function saveGmailSmtpConfig(config: GmailSmtpConfig): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      email: config.email.trim(),
      appPassword: config.appPassword.replace(/\s+/g, ''),
      senderName: config.senderName?.trim() || 'Intersys BMS Operations',
    })
  );
}

/**
 * Checks if Gmail SMTP credentials have been entered
 */
export function hasGmailSmtpConfig(): boolean {
  const cfg = getGmailSmtpConfig();
  return Boolean(cfg.email.trim() && cfg.appPassword.trim());
}

export interface SendInvoiceEmailParams {
  invoice: TenantInvoiceDb;
  startDate?: string;
  endDate?: string;
  customToEmail?: string;
  telemetryRange?: {
    startReading: number | null;
    endReading: number | null;
    deltaKwh: number | null;
  } | null;
  ratePerKwh?: number;
}

interface DispatchPayload {
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    encoding: string;
    contentType: string;
    cid?: string;
  }>;
}

/**
 * Dispatches email through either local Vite dev server endpoint (/api/send-email)
 * or Supabase Edge Function with automatic fallback.
 */
async function dispatchEmail(payload: DispatchPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // 1. Try local dev server endpoint first (Fastest in local development)
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, messageId: data.messageId };
    }
  } catch {
    // Continue to Supabase edge function fallback
  }

  // 2. Fallback to Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('send-smtp-email', {
      body: payload,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Edge function error dispatching email',
      };
    }

    if (data && !data.success) {
      return {
        success: false,
        error: data.error,
      };
    }

    return {
      success: true,
      messageId: data?.messageId,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to dispatch email';
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Dispatches an official tenant utility statement with the PDF attached directly via Gmail SMTP.
 */
export async function sendInvoiceEmailViaSmtp(
  params: SendInvoiceEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { invoice, startDate, endDate, customToEmail, telemetryRange, ratePerKwh } = params;
  const cfg = getGmailSmtpConfig();

  if (!cfg.email || !cfg.appPassword) {
    return {
      success: false,
      error: 'Gmail SMTP credentials are not configured. Please open Email Settings to configure your Gmail and Google App Password.',
    };
  }

  const to = (customToEmail || invoice.tenant_email || '').trim();
  if (!to) {
    return {
      success: false,
      error: `No email address specified for tenant "${invoice.tenant_name}".`,
    };
  }

  try {
    const startIso = invoice.start_date || startDate;
    const endIso = invoice.end_date || endDate;
    const meterName = invoice.meter_name || invoice.tenant_name;

    let activeTelemetryRange = telemetryRange;
    if (!activeTelemetryRange && meterName && startIso && endIso) {
      try {
        activeTelemetryRange = await fetchMeterReadingRange(meterName, startIso, endIso);
      } catch (err) {
        console.warn('Telemetry range fetch in sendInvoiceEmailViaSmtp notice:', err);
      }
    }

    const effectiveRate = ratePerKwh || invoice.rate_per_kwh || 0.155;

    // 1. Generate high-resolution PDF Base64 string matching the billing summary UI
    const pdfBase64 = await getInvoicePdfBase64(
      invoice,
      startIso,
      endIso,
      effectiveRate,
      activeTelemetryRange
    );
    const cleanTenantName = (invoice.tenant_name || 'Tenant').replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfFileName = `${invoice.invoice_number}_${cleanTenantName}_Utility_Statement.pdf`;

    // 2. Calculate identical figures matching the Billing Summary screen
    const billValues = calculateTenantBillValues(
      invoice,
      activeTelemetryRange,
      effectiveRate,
      startIso,
      endIso
    );

    const accountNumber = billValues.accountNumber;
    const billingPeriodStr = billValues.billingPeriodStr;
    const payByDateStr = billValues.payByDateStr;
    const amountDueStr = `$${billValues.totalAmountDue.toFixed(2)}`;
    const tenantName = (invoice.tenant_name || 'Valued Tenant').trim();

    // 3. User Requested Exact Statement Body Format
    const plainText =
      `Dear ${tenantName},\n\n` +
      `Please find attached your utility statement.\n\n` +
      `Account: ${accountNumber}\n` +
      `Invoice: ${invoice.invoice_number}\n` +
      `Billing Period: ${billingPeriodStr}\n` +
      `Total Amount Due: ${amountDueStr} (Pay by ${payByDateStr})\n\n` +
      `Thank you,\n` +
      `Intersys BMS Operations Team`;

    const htmlBody = `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #222222; margin: 0; padding: 0;">
        <p style="margin: 0 0 16px 0;">Dear ${tenantName},</p>
        <p style="margin: 0 0 20px 0;">Please find attached your utility statement.</p>
        <p style="margin: 0 0 20px 0; line-height: 1.6;">
          Account: ${accountNumber}<br />
          Invoice: ${invoice.invoice_number}<br />
          Billing Period: ${billingPeriodStr}<br />
          Total Amount Due: ${amountDueStr} (Pay by ${payByDateStr})
        </p>
        <p style="margin: 0 0 4px 0;">Thank you,<br />Intersys BMS Operations Team</p>
      </div>
    `;

    return await dispatchEmail({
      smtpUser: cfg.email,
      smtpPass: cfg.appPassword,
      fromName: cfg.senderName || 'Intersys BMS Billing',
      to,
      subject: `Utility Bill Statement - ${invoice.invoice_number} (${tenantName})`,
      html: htmlBody,
      text: plainText,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBase64,
          encoding: 'base64',
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred while sending email.';
    console.error('Error in sendInvoiceEmailViaSmtp:', err);
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Sends a quick test email to verify Gmail SMTP configuration
 */
export async function sendTestEmail(
  testRecipientEmail: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cfg = getGmailSmtpConfig();

  if (!cfg.email || !cfg.appPassword) {
    return {
      success: false,
      error: 'Please enter both your Gmail address and 16-character Google App Password.',
    };
  }

  return await dispatchEmail({
    smtpUser: cfg.email,
    smtpPass: cfg.appPassword,
    fromName: cfg.senderName || 'Intersys BMS Billing',
    to: testRecipientEmail.trim(),
    subject: 'Intersys BMS - Gmail SMTP Test Confirmation',
    text: 'Congratulations! Your Gmail SMTP configuration is working perfectly. You can now send automated tenant utility statements with PDF attachments directly in the background.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #005a87; margin-top: 0;">Intersys BMS Email Connected!</h2>
        <p style="color: #334155; font-size: 14px;">
          Congratulations! Your <strong>Gmail SMTP</strong> connection is active and ready to deliver utility invoices.
        </p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; color: #166534; font-size: 13px;">
          ✔ SMTP Authenticated: <strong>${cfg.email}</strong><br/>
          ✔ Ready for automated PDF invoice attachments.
        </div>
        <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">Intersys BMS Operations</p>
      </div>
    `,
  });
}
