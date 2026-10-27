import nodemailer from 'nodemailer';
import { config } from '../config/env';

export interface SendInvoiceEmailParams {
  to: string;
  tenantName: string;
  invoiceNumber: string;
  unitZone: string;
  billingPeriod: string;
  kwhReading: number;
  ratePerKwh: number;
  demandCharge: number;
  totalCostUsd: number;
  totalCostKhr: number;
  dueDate?: Date;
  qrCodeDataUrl: string;
  md5Hash?: string;
  pdfBuffer?: Buffer;
}

export class EmailService {
  private static getTransporter() {
    const { user, appPassword } = config.gmail;
    if (!user || !appPassword) {
      throw new Error('Gmail SMTP credentials are not configured in .env (GMAIL_USER / GMAIL_APP_PASSWORD)');
    }

    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user,
        pass: appPassword,
      },
    });
  }

  public static async sendInvoiceWithKhqr(params: SendInvoiceEmailParams): Promise<{ success: boolean; messageId?: string }> {
    const transporter = this.getTransporter();

    const formattedDueDate = params.dueDate
      ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(params.dueDate)
      : 'Upon Receipt';

    // Extract base64 image data from data URL
    const base64Data = params.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const qrBuffer = Buffer.from(base64Data, 'base64');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .body-content { padding: 24px; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .row-label { color: #64748b; }
    .row-value { font-weight: 600; color: #0f172a; }
    .total-row { display: flex; justify-content: space-between; padding: 14px 0 6px 0; border-top: 2px solid #0284c7; margin-top: 10px; font-size: 16px; }
    .total-usd { font-size: 20px; font-weight: 700; color: #0284c7; }
    .total-khr { font-size: 13px; color: #64748b; font-weight: 500; }
    
    /* Bakong KHQR Showcase */
    .khqr-container { text-align: center; background: #fff5f5; border: 2px solid #ef4444; border-radius: 12px; padding: 20px; margin-top: 20px; }
    .khqr-badge { display: inline-block; background: #dc2626; color: #ffffff; font-weight: 800; font-size: 14px; padding: 4px 16px; border-radius: 999px; letter-spacing: 1px; margin-bottom: 10px; }
    .khqr-img { width: 220px; height: 220px; border-radius: 8px; border: 1px solid #fecaca; margin: 8px 0; }
    .khqr-instructions { font-size: 12px; color: #475569; margin: 8px 0 0 0; line-height: 1.4; }
    .khqr-payee { font-size: 13px; font-weight: 600; color: #991b1b; margin-top: 4px; }
    
    .footer { text-align: center; padding: 18px 24px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Intersys BMS Utility Statement</h1>
      <p>Intelligent Sub-Metering & Automated Energy Management</p>
    </div>

    <div class="body-content">
      <p style="margin-top: 0; font-size: 15px;">Dear <b>${params.tenantName}</b>,</p>
      <p style="font-size: 14px; color: #475569;">Your utility billing statement for <b>${params.billingPeriod}</b> is now ready. Below is the breakdown of your consumption and payment details.</p>

      <div class="summary-box">
        <div class="row">
          <span class="row-label">Invoice Number</span>
          <span class="row-value">${params.invoiceNumber}</span>
        </div>
        <div class="row">
          <span class="row-label">Tenant Unit / Zone</span>
          <span class="row-value">${params.unitZone}</span>
        </div>
        <div class="row">
          <span class="row-label">Billing Period</span>
          <span class="row-value">${params.billingPeriod}</span>
        </div>
        <div class="row">
          <span class="row-label">Energy Consumed</span>
          <span class="row-value">${params.kwhReading.toFixed(2)} kWh</span>
        </div>
        <div class="row">
          <span class="row-label">Energy Rate</span>
          <span class="row-value">$${params.ratePerKwh.toFixed(4)} / kWh</span>
        </div>
        <div class="row">
          <span class="row-label">Demand Charge</span>
          <span class="row-value">$${params.demandCharge.toFixed(2)}</span>
        </div>
        <div class="row">
          <span class="row-label">Due Date</span>
          <span class="row-value" style="color: #dc2626;">${formattedDueDate}</span>
        </div>

        <div class="total-row">
          <span style="font-weight: 700; color: #1e293b;">Total Amount Due</span>
          <div style="text-align: right;">
            <div class="total-usd">$${params.totalCostUsd.toFixed(2)}</div>
            <div class="total-khr">${params.totalCostKhr.toLocaleString()} KHR</div>
          </div>
        </div>
      </div>

      <!-- KHQR Section -->
      <div class="khqr-container">
        <div class="khqr-badge">KHQR • BAKONG</div>
        <br/>
        <img src="cid:khqr-image" class="khqr-img" alt="Bakong KHQR Code" />
        <div class="khqr-payee">Pay to: SODALIN REN (ren_sodalin@bkrt)</div>
        <p class="khqr-instructions">
          Scan this KHQR with <b>Bakong App</b>, <b>ABA Mobile</b>, <b>Wing</b>, <b>ACLEDA</b>, or any participating Cambodian mobile banking application.
        </p>
      </div>
    </div>

    <div class="footer">
      This is an automated statement from Intersys BMS Cloud.<br/>
      For questions or metering inquiries, contact facility operations at <b>billing@intersys.com</b>.
    </div>
  </div>
</body>
</html>
    `;

    const attachments: any[] = [
      {
        filename: `KHQR-${params.invoiceNumber}.png`,
        content: qrBuffer,
        cid: 'khqr-image', // Embedded image
      },
    ];

    if (params.pdfBuffer) {
      attachments.push({
        filename: `${params.invoiceNumber}.pdf`,
        content: params.pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    const info = await transporter.sendMail({
      from: `"Intersys BMS Billing" <${config.gmail.user}>`,
      to: params.to,
      subject: `[BMS Invoice] ${params.invoiceNumber} - Utility Statement for ${params.tenantName}`,
      html: htmlContent,
      attachments,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  }
}
