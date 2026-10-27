import { KhqrService } from '../server/services/KhqrService';

async function run() {
  const res = await KhqrService.generateInvoiceKhqr({
    invoiceNumber: 'INV-2026-001',
    amount: 0.01,
    currency: 'USD',
    storeLabel: 'Intersys BMS',
    terminalLabel: 'Web Billing'
  });
  console.log('Official QR:', res.qr);
  console.log('Official MD5:', res.md5);
}

run().catch(console.error);
