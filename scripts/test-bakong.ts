import { KhqrService } from '../server/services/KhqrService';
import { BakongService } from '../server/services/BakongService';

async function test() {
  console.log('--- 1. Testing Bakong KHQR Generation ---');
  const result = await KhqrService.generateInvoiceKhqr({
    invoiceNumber: 'INV-2026-TEST',
    amount: 12.5,
    currency: 'USD',
    tenantName: 'Intersys Test Tenant',
  });

  console.log('✅ Generated KHQR String:', result.qr.substring(0, 50) + '...');
  console.log('✅ MD5 Hash:', result.md5);
  console.log('✅ QR Code PNG DataURL Length:', result.qrCodeDataUrl.length);
  console.log('✅ Expires At:', result.expiresAt);

  console.log('\n--- 2. Testing Bakong Open API Check ---');
  const check = await BakongService.checkTransactionByMd5(result.md5);
  console.log('✅ Bakong API Response:', {
    isPaid: check.isPaid,
    responseCode: check.responseCode,
    responseMessage: check.responseMessage,
  });
}

test().catch(console.error);
