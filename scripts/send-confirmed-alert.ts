import { TelegramAlertService } from '../server/services/TelegramAlertService';
import { BakongSyncService } from '../server/services/BakongSyncService';

async function main() {
  console.log('Sending Telegram Payment Confirmation Alert...');
  const txHash = 'BAKONG' + Date.now().toString(16).toUpperCase();
  const paidDate = new Date();

  const success = await TelegramAlertService.sendPaymentAlert({
    invoiceNumber: 'INV-2026-001',
    tenantName: 'ASICS Facility',
    unitZone: 'Second_Floor - Suite 201',
    amountUsd: 0.01,
    amountKhr: 41,
    fromAccountId: 'ren_sodalin@bkrt',
    bakongHash: txHash,
    settledAt: paidDate,
  });

  if (success) {
    console.log('✅ Telegram payment alert successfully delivered to chat -5314819518!');
    await BakongSyncService.markSuccess(
      'INV-2026-001',
      txHash,
      'ren_sodalin@bkrt',
      paidDate
    );
    console.log('✅ Marked INV-2026-001 as SUCCESS and PAID in Supabase!');
  } else {
    console.error('❌ Failed to deliver Telegram alert.');
  }
}

main().catch(console.error);
