import { generateClientKhqr } from '../dashboard/src/lib/khqrGenerator';

async function main() {
  const res = await generateClientKhqr({ invoiceNumber: 'INV-2026-001', amountUsd: 0.01 });
  console.log('✅ Generated successfully!');
  console.log('   • QR Length:', res.qr.length);
  console.log('   • MD5:', res.md5);
  console.log('   • Data URL length:', res.qrCodeDataUrl.length);
  console.log('   • Valid CRC tag?:', /6304[0-9A-F]{4}$/.test(res.qr));
}

main().catch(console.error);
