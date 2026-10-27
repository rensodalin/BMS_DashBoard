import { EmailService } from '../server/services/EmailService';
import { KhqrService } from '../server/services/KhqrService';

async function test() {
  console.log('--- Testing Email Service with Embedded KHQR ---');

  const khqr = await KhqrService.generateInvoiceKhqr({
    invoiceNumber: 'INV-2026-001',
    amount: 186.25,
    currency: 'USD',
    tenantName: 'Tenant Intersys Co., Ltd.',
  });

  const res = await EmailService.sendInvoiceWithKhqr({
    to: 'rrensodalin@gmail.com',
    tenantName: 'Tenant Intersys Co., Ltd.',
    invoiceNumber: 'INV-2026-001',
    unitZone: 'Floor 3 - Suite 302',
    billingPeriod: 'Aug 2026',
    kwhReading: 1075.0,
    ratePerKwh: 0.15,
    demandCharge: 25.0,
    totalCostUsd: 186.25,
    totalCostKhr: 763625,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    qrCodeDataUrl: khqr.qrCodeDataUrl,
    md5Hash: khqr.md5,
  });

  console.log('Email Result:', res);
}

test().catch(console.error);
