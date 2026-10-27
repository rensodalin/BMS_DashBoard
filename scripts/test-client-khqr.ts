import { generateClientKhqr } from '../dashboard/src/lib/khqrGenerator';

async function main() {
  console.log('Testing generateClientKhqr...');
  try {
    const res = await generateClientKhqr({ invoiceNumber: 'TEST-001', amountUsd: 0.01 });
    console.log('Result MD5:', res.md5);
    console.log('QR length:', res.qr.length);
    console.log('Data URL length:', res.qrCodeDataUrl.length);
  } catch (e) {
    console.error('Failed:', e);
  }
}

main();
