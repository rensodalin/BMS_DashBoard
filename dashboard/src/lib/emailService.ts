import { supabase, fetchMeterReadingRange, registerBakongPaymentAttempt } from './supabase';
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
  customSubject?: string;
  customBody?: string;
  telemetryRange?: {
    startReading: number | null;
    endReading: number | null;
    deltaKwh: number | null;
  } | null;
  ratePerKwh?: number;
  sourceElement?: HTMLElement | null;
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
    const { data, error } = await supabase.functions.invoke('send-invoice-email', {
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
      activeTelemetryRange,
      params.sourceElement
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

    // 3. Generate Bakong KHQR for seamless payment (Using 0.01 for test payment verification)
    const khqrTestAmount = 0.01;
    let khqrResult = null;
    try {
      const { generateClientKhqr } = await import('./khqrGenerator');
      khqrResult = await generateClientKhqr({
        invoiceNumber: invoice.invoice_number,
        amountUsd: khqrTestAmount,
        tenantName: tenantName,
      });

      if (khqrResult && khqrResult.md5) {
        registerBakongPaymentAttempt({
          invoiceNumber: invoice.invoice_number,
          tenantName: tenantName,
          unitZone: invoice.unit_zone || '',
          amountUsd: khqrTestAmount,
          amountKhr: Math.round(khqrTestAmount * 4100),
          md5Hash: khqrResult.md5,
          qrString: khqrResult.qr,
          tenantEmail: to,
        }).catch((err) => console.warn('Could not register Bakong payment attempt:', err));
      }
    } catch (khqrErr) {
      console.warn('KHQR generation notice in emailService:', khqrErr);
    }

    const totalKhrStr = Math.round(billValues.totalAmountDue * 4100).toLocaleString() + ' KHR';
    const statusBg = billValues.isPaid
      ? '#ecfdf5'
      : billValues.isOverdue
        ? '#fff1f2'
        : '#eff6ff';
    const statusColor = billValues.isPaid
      ? '#059669'
      : billValues.isOverdue
        ? '#e11d48'
        : '#0284c7';
    const statusText = billValues.isPaid ? 'PAID' : billValues.isOverdue ? 'OVERDUE' : 'PENDING';

    const plainText =
      params.customBody ||
      `Dear ${tenantName},\n\n` +
      `Please find below your Utility Billing Statement Summary for ${billingPeriodStr}.\n\n` +
      `Account: ${accountNumber}\n` +
      `Invoice Number: ${invoice.invoice_number}\n` +
      `Meter ID: ${invoice.meter_name || 'Standard Meter'}\n` +
      `Unit / Zone: ${invoice.unit_zone || 'Standard Zone'}\n` +
      `Previous Reading: ${billValues.openReading.toFixed(2)} kWh\n` +
      `Present Reading: ${billValues.closeReading.toFixed(2)} kWh\n` +
      `Energy Consumed: ${billValues.kwhAmount.toFixed(2)} kWh\n` +
      `Tariff Rate: $${billValues.effectiveRate.toFixed(4)} / kWh\n` +
      `Electricity Charge: $${billValues.electricityCost.toFixed(2)}\n` +
      `Demand Charge: $${billValues.demandCharge.toFixed(2)}\n` +
      `Total Amount Due: ${amountDueStr} (${totalKhrStr}) - Pay by ${payByDateStr}\n\n` +
      `Official PDF statement is attached to this email.\n\n` +
      `Thank you,\n` +
      `Intersys BMS Operations Team`;

    const customIntroBlock = params.customBody
      ? `<div style="background: #f0f9ff; border-left: 4px solid #005a87; padding: 14px 18px; margin-bottom: 20px; border-radius: 6px; font-size: 13px; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${params.customBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
      : '';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Utility Bill Statement - ${invoice.invoice_number}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
    
    <!-- Top Brand Accent -->
    <div style="background: linear-gradient(90deg, #005a87 0%, #00a4e4 100%); height: 6px; width: 100%;"></div>

    <!-- Header -->
    <div style="padding: 24px 28px; border-bottom: 1px solid #f1f5f9; background: #fafcff;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #003652; letter-spacing: -0.5px;">INTERSYS SOLUTIONS</h1>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Intelligent Sub-Metering & Energy Management</p>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}33;">
            ${statusText}
          </span>
        </div>
      </div>
    </div>

    <!-- Invoice Summary Banner -->
    <div style="padding: 24px 28px;">
      ${customIntroBlock}
      <div style="background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; padding: 18px 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          Utility Invoice Summary
        </h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; width: 38%;">Tenant / Client:</td>
            <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${tenantName}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Service Unit / Zone:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #1e293b;">${invoice.unit_zone || 'Standard Zone'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Account Number:</td>
            <td style="padding: 4px 0; font-family: monospace; font-size: 12px; font-weight: 600; color: #005a87;">${accountNumber}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Invoice Reference:</td>
            <td style="padding: 4px 0; font-family: monospace; font-size: 12px; font-weight: 600; color: #0284c7;">${invoice.invoice_number}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Billing Period:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #334155;">${billingPeriodStr}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Pay By / Due Date:</td>
            <td style="padding: 4px 0; font-weight: 700; color: #dc2626;">${payByDateStr}</td>
          </tr>
        </table>
      </div>

      <!-- Energy Meter Breakdown Table -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
          Meter Telemetry & Energy Usage
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569;">
              <th style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">Item / Meter Description</th>
              <th style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">Reading / Rate</th>
              <th style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">Amount (USD)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9;">
                <div style="font-weight: 600; color: #0f172a;">Active Power Consumption</div>
                <div style="font-size: 11px; color: #64748b;">Meter: ${invoice.meter_name || 'Sub-Meter'} | Usage: ${billValues.kwhAmount.toFixed(2)} kWh</div>
              </td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #475569;">
                $${billValues.effectiveRate.toFixed(4)} / kWh
              </td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600; color: #0f172a;">
                $${billValues.electricityCost.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9;">
                <div style="font-weight: 600; color: #0f172a;">Base Demand & Sub-Metering Charge</div>
                <div style="font-size: 11px; color: #64748b;">Facility infrastructure & capacity maintenance</div>
              </td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #475569;">
                Fixed / Period
              </td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600; color: #0f172a;">
                $${billValues.demandCharge.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Total Amount Due Highlight Card -->
      <div style="background: linear-gradient(135deg, #005a87 0%, #003652 100%); border-radius: 10px; padding: 20px 24px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85;">Total Amount Due</div>
          <div style="font-size: 26px; font-weight: 800; margin: 4px 0 2px 0;">${amountDueStr}</div>
          <div style="font-size: 13px; opacity: 0.9;">Equivalent: <b>${totalKhrStr}</b></div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; opacity: 0.8;">Payment Due Date</div>
          <div style="font-size: 14px; font-weight: 700; color: #fecdd3; margin-top: 2px;">${payByDateStr}</div>
        </div>
      </div>

      <!-- Bakong KHQR Payment Section -->
      <div style="background: #fff5f5; border: 2px solid #ef4444; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; background: #dc2626; color: #ffffff; font-weight: 800; font-size: 13px; padding: 4px 18px; border-radius: 9999px; letter-spacing: 1px; margin-bottom: 12px;">
          KHQR • BAKONG PAYMENT
        </div>
        <div style="margin: 10px auto; text-align: center;">
          <img src="cid:khqr-image" style="width: 220px; height: 220px; border-radius: 10px; border: 1px solid #fecaca; background: #ffffff; padding: 8px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.06);" alt="Bakong KHQR Payment Code" />
        </div>
        <div style="font-size: 14px; font-weight: 700; color: #991b1b; margin-top: 6px;">
          Pay to: SODALIN REN (ren_sodalin@bkrt)
        </div>
        <div style="font-size: 13px; font-weight: 600; color: #b91c1c; margin-top: 2px;">
          Amount: $${khqrTestAmount.toFixed(2)} USD (Test Amount)
        </div>
        <p style="font-size: 12px; color: #475569; margin: 8px auto 0 auto; max-width: 440px; line-height: 1.4;">
          Scan with <b>Bakong App</b>, <b>ABA Mobile</b>, <b>Wing Bank</b>, <b>ACLEDA</b>, or any participating KHQR banking application for instant payment.
        </p>
      </div>

      <!-- PDF Attachment Notice -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #166534; display: flex; align-items: center; gap: 8px;">
        <span>📎</span>
        <span><b>Official PDF Statement Attached:</b> The complete high-resolution bill statement has been attached to this email for your corporate accounting records.</span>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
      Intersys BMS Cloud &bull; Automated Sub-Metering System<br/>
      For billing inquiries, please contact facility operations at <b>billing@intersys.com</b>
    </div>
  </div>
</body>
</html>
    `;

    const emailAttachments: Array<{
      filename: string;
      content: string;
      encoding: string;
      contentType: string;
      cid?: string;
    }> = [
      {
        filename: pdfFileName,
        content: pdfBase64,
        encoding: 'base64',
        contentType: 'application/pdf',
      },
    ];

    // Embed KHQR code image if available (Both inline CID and standalone attachment for guaranteed display)
    if (khqrResult?.qrCodeDataUrl) {
      const qrBase64Clean = khqrResult.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, '');
      // 1. Inline image matching <img src="cid:khqr-image">
      emailAttachments.push({
        filename: `KHQR-${invoice.invoice_number}.png`,
        content: qrBase64Clean,
        encoding: 'base64',
        contentType: 'image/png',
        cid: 'khqr-image',
      });
      // 2. Standalone downloadable attachment so tenant can also open/scan the PNG directly
      emailAttachments.push({
        filename: `Bakong_KHQR_Payment_${invoice.invoice_number}.png`,
        content: qrBase64Clean,
        encoding: 'base64',
        contentType: 'image/png',
      });
    }

    return await dispatchEmail({
      smtpUser: cfg.email,
      smtpPass: cfg.appPassword,
      fromName: cfg.senderName || 'Intersys BMS Billing',
      to,
      subject: params.customSubject || `Utility Bill Statement - ${invoice.invoice_number} (${tenantName})`,
      html: htmlBody,
      text: plainText,
      attachments: emailAttachments,
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
