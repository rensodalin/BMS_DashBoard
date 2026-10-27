import nodemailer from 'nodemailer';
import { KhqrService } from '../server/services/KhqrService';
import { BakongSyncService } from '../server/services/BakongSyncService';
import { config } from '../server/config/env';

async function sendTestEmailWithKhqr() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Dispatching Test Invoice Email with $0.01 Bakong KHQR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const recipientEmail = 'rrensodalin@gmail.com';
  const invoiceNumber = 'INV-2026-001';
  const tenantName = 'ASICS Facility';
  const unitZone = 'Second_Floor - Suite 201';
  const testAmountUsd = 0.01;
  const testAmountKhr = 41;

  // 1. Generate Valid Bakong KHQR with $0.01
  const khqr = await KhqrService.generateInvoiceKhqr({
    invoiceNumber,
    amount: testAmountUsd,
    currency: 'USD',
    tenantName,
    ttlHours: 72,
  });

  console.log(`✅ Generated Bakong KHQR:`);
  console.log(`   • Invoice Number : ${invoiceNumber}`);
  console.log(`   • Amount         : $${testAmountUsd} USD (${testAmountKhr} KHR)`);
  console.log(`   • Bakong MD5     : ${khqr.md5}`);
  console.log(`   • Payee Account  : ${config.bakong.accountId}`);

  // 2. Register Active Payment Attempt in Supabase for PaymentMonitoringWorker
  await BakongSyncService.saveAttempt({
    invoiceNumber,
    tenantName,
    unitZone,
    amountUsd: testAmountUsd,
    amountKhr: testAmountKhr,
    md5Hash: khqr.md5,
    qrString: khqr.qr,
    tenantEmail: recipientEmail,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    expiresAt: khqr.expiresAt.toISOString(),
  });

  console.log(`✅ Registered payment attempt in Supabase tracking queue.`);

  // 3. Send Email via Gmail SMTP
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: config.gmail.user,
      pass: config.gmail.appPassword,
    },
  });

  const base64Clean = khqr.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const qrBuffer = Buffer.from(base64Clean, 'base64');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Utility Bill Statement - Test $0.01</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #001F3F 0%, #003366 100%); padding: 24px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">INTERSYS BMS - UTILITY STATEMENT</h2>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.85;">Test Payment Verification • $0.01 USD</p>
    </div>

    <div style="padding: 24px;">
      <div style="background: #eff6ff; border-left: 4px solid #005a87; padding: 12px 16px; margin-bottom: 20px; border-radius: 6px; font-size: 13px; color: #1e3a8a;">
        <strong>Test Notice:</strong> This invoice contains a test amount of <strong>$0.01 USD</strong> (approx. 41 KHR). You can scan this QR code with Bakong or ABA Mobile to test automated Telegram bot notification!
      </div>

      <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Invoice Number:</td>
          <td style="font-weight: bold; font-family: monospace; color: #0f172a;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Tenant:</td>
          <td style="font-weight: bold; color: #0f172a;">${tenantName}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Unit / Zone:</td>
          <td style="color: #334155;">${unitZone}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Billing Period:</td>
          <td style="color: #334155;">Aug 2026</td>
        </tr>
        <tr style="border-top: 2px solid #e2e8f0;">
          <td style="font-weight: bold; padding: 12px 0; font-size: 15px; color: #001F3F;">Test Total Due:</td>
          <td style="font-weight: bold; font-size: 18px; color: #001F3F;">$${testAmountUsd.toFixed(2)} USD <span style="font-size: 13px; color: #64748b;">(41 KHR)</span></td>
        </tr>
      </table>

      <!-- Bakong KHQR Box -->
      <div style="background: #fdf2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 20px; text-align: center;">
        <div style="background: #dc2626; color: white; display: inline-block; font-size: 12px; font-weight: bold; padding: 3px 14px; border-radius: 999px; letter-spacing: 0.5px; margin-bottom: 12px;">
          KHQR • SCAN TO PAY
        </div>
        <div>
          <img src="cid:khqr-image" alt="Bakong KHQR" style="width: 200px; height: 200px; display: block; margin: 0 auto; border-radius: 8px;" />
        </div>
        <div style="font-weight: bold; color: #991b1b; font-size: 14px; margin-top: 10px;">
          Payee: SODALIN REN (ren_sodalin@bkrt)
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
          Scan with Bakong, ABA Mobile, Wing, or ACLEDA
        </div>
      </div>
    </div>

    <div style="background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      Intersys BMS Automated Energy & Utility Billing System
    </div>
  </div>
</body>
</html>
  `;

  const info = await transporter.sendMail({
    from: `"Intersys BMS Billing" <${config.gmail.user}>`,
    to: recipientEmail,
    subject: `Test Utility Bill Statement - ${invoiceNumber} ($0.01 USD)`,
    html,
    attachments: [
      {
        filename: 'bakong-khqr.png',
        content: qrBuffer,
        contentType: 'image/png',
        cid: 'khqr-image',
        headers: {
          'Content-ID': '<khqr-image>',
          'Content-Disposition': 'inline',
        },
      },
      {
        filename: `Bakong_KHQR_Payment_${invoiceNumber}.png`,
        content: qrBuffer,
        contentType: 'image/png',
      },
    ],
  });

  console.log(`✅ Email successfully sent to ${recipientEmail}! Message ID: ${info.messageId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 ACTION READY:');
  console.log('1. Open your Gmail (rrensodalin@gmail.com).');
  console.log('2. Scan the $0.01 KHQR with your Bakong or ABA Mobile app.');
  console.log('3. Complete the 0.01 USD payment.');
  console.log('4. Within ~10 seconds, the background worker will verify it and alert your Telegram bot!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

sendTestEmailWithKhqr().catch(console.error);
