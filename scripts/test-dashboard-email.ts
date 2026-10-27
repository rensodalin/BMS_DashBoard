import nodemailer from 'nodemailer';
import { KhqrService } from '../server/services/KhqrService';

async function testEmail() {
  console.log('--- Testing Dispatching Full Tenant Invoice Summary via Gmail SMTP ---');
  
  const user = 'rrensodalin@gmail.com';
  const pass = 'epsovhkaklzwcrqx';

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  const khqr = await KhqrService.generateInvoiceKhqr({
    invoiceNumber: 'INV-2026-002',
    amount: 367.58,
    currency: 'USD',
    tenantName: 'Grand Retail Zone A',
  });

  const base64Clean = khqr.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const qrBuffer = Buffer.from(base64Clean, 'base64');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Utility Invoice Summary</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f1f5f9; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background: #005a87; padding: 20px 24px; color: white;">
      <h2 style="margin: 0; font-size: 18px;">INTERSYS SOLUTIONS - UTILITY STATEMENT</h2>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Intelligent Sub-Metering & Automated Energy Management</p>
    </div>
    <div style="padding: 24px;">
      <h3 style="margin-top: 0; color: #0f172a;">Tenant Invoice Summary</h3>
      <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 16px;">
        <tr><td style="color: #64748b; padding: 4px 0;">Tenant:</td><td style="font-weight: bold;">Grand Retail Zone A</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Invoice #:</td><td style="font-mono; color: #0284c7;">INV-2026-002</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Billing Period:</td><td>Aug 01, 2026 to Aug 31, 2026</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Energy Consumed:</td><td>2,150.50 kWh</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Tariff Rate:</td><td>$0.1500 / kWh</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Demand Charge:</td><td>$45.00</td></tr>
        <tr style="border-top: 2px solid #005a87;"><td style="font-weight: bold; padding: 8px 0; font-size: 15px;">Total Amount Due:</td><td style="font-weight: bold; font-size: 16px; color: #005a87;">$367.58 (1,507,078 KHR)</td></tr>
      </table>

      <!-- KHQR Box -->
      <div style="background: #fff5f5; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="background: #dc2626; color: white; display: inline-block; font-size: 12px; font-weight: bold; padding: 2px 12px; border-radius: 999px;">KHQR • BAKONG</div>
        <div style="margin: 10px 0;"><img src="cid:khqr-image" style="width: 180px; height: 180px;" /></div>
        <div style="font-weight: bold; color: #991b1b; font-size: 13px;">Pay to: SODALIN REN (ren_sodalin@bkrt)</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Scan with Bakong, ABA Mobile, Wing, or ACLEDA</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const info = await transporter.sendMail({
    from: `"Intersys BMS Billing" <${user}>`,
    to: 'rrensodalin@gmail.com',
    subject: `[BMS Statement] INV-2026-002 - Utility Invoice Summary for Grand Retail Zone A`,
    html,
    attachments: [
      {
        filename: 'KHQR-INV-2026-002.png',
        content: qrBuffer,
        cid: 'khqr-image',
      },
    ],
  });

  console.log('✅ Email Dispatched Successfully! Message ID:', info.messageId);
}

testEmail().catch(console.error);
