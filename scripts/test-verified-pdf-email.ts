import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import { KhqrService } from '../server/services/KhqrService';

async function verifyEmailWithPdfAndSummary() {
  console.log('--- Verifying Email with Tenant Invoice Summary & Attached PDF ---');

  const user = 'rrensodalin@gmail.com';
  const pass = 'epsovhkaklzwcrqx';

  // 1. Generate jsPDF Statement
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(0, 90, 135);
  pdf.text('INTERSYS SOLUTIONS - UTILITY STATEMENT', 14, 20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  pdf.text('Tenant: Grand Retail Zone A | Invoice: INV-2026-002', 14, 28);
  pdf.text('Period: 01/08/2026 - 31/08/2026 | Due: 15/09/2026', 14, 34);
  pdf.text('Total Amount Due: $367.58 (1,507,078 KHR)', 14, 42);

  const pdfDataUri = pdf.output('datauristring');
  const base64Pdf = pdfDataUri.split(',')[1];
  const pdfBuffer = Buffer.from(base64Pdf, 'base64');

  // 2. Generate Bakong KHQR
  const khqr = await KhqrService.generateInvoiceKhqr({
    invoiceNumber: 'INV-2026-002',
    amount: 367.58,
    currency: 'USD',
    tenantName: 'Grand Retail Zone A',
  });

  const base64Qr = khqr.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const qrBuffer = Buffer.from(base64Qr, 'base64');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f1f5f9; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #005a87; color: white; padding: 18px 24px;">
      <h2 style="margin: 0; font-size: 18px;">INTERSYS SOLUTIONS - UTILITY STATEMENT</h2>
      <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.9;">Intelligent Sub-Metering & Automated Energy Management</p>
    </div>
    <div style="padding: 24px;">
      <h3 style="margin-top: 0; color: #0f172a;">Tenant Invoice Summary</h3>
      <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="color: #64748b; padding: 4px 0;">Tenant:</td><td style="font-weight: bold;">Grand Retail Zone A</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Invoice #:</td><td style="color: #0284c7; font-weight: bold;">INV-2026-002</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Billing Period:</td><td>Aug 01, 2026 to Aug 31, 2026</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Energy Consumed:</td><td>2,150.50 kWh</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Tariff Rate:</td><td>$0.1500 / kWh</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Demand Charge:</td><td>$45.00</td></tr>
        <tr style="border-top: 2px solid #005a87;"><td style="font-weight: bold; padding: 8px 0; font-size: 15px;">Total Amount Due:</td><td style="font-weight: bold; font-size: 16px; color: #005a87;">$367.58 (1,507,078 KHR)</td></tr>
      </table>

      <!-- Bakong KHQR -->
      <div style="background: #fff5f5; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px;">
        <div style="background: #dc2626; color: white; display: inline-block; font-size: 12px; font-weight: bold; padding: 2px 14px; border-radius: 999px;">KHQR • BAKONG PAYMENT</div>
        <div style="margin: 10px 0;"><img src="cid:khqr-image" style="width: 180px; height: 180px;" alt="KHQR Code" /></div>
        <div style="font-weight: bold; color: #991b1b; font-size: 13px;">Pay to: SODALIN REN (ren_sodalin@bkrt)</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Scan with Bakong, ABA Mobile, Wing, or ACLEDA</div>
      </div>

      <!-- Attachment Notice -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; font-size: 12px; color: #166534;">
        📎 <b>Official PDF Attached:</b> The complete statement <code>INV-2026-002_Grand_Retail_Zone_A_Utility_Statement.pdf</code> is attached to this email.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const info: any = await transporter.sendMail({
    from: `"Intersys BMS Billing" <${user}>`,
    to: 'rrensodalin@gmail.com',
    subject: '[Verified Test] INV-2026-002 - Tenant Invoice Summary & Attached PDF',
    html,
    attachments: [
      {
        filename: 'INV-2026-002_Grand_Retail_Zone_A_Utility_Statement.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
      {
        filename: 'KHQR-INV-2026-002.png',
        content: qrBuffer,
        contentType: 'image/png',
        cid: 'khqr-image',
      },
    ],
  });

  console.log('✅ Email Dispatched with Tenant Invoice Summary AND Attached PDF! Message ID:', info.messageId);
}

verifyEmailWithPdfAndSummary().catch(console.error);
