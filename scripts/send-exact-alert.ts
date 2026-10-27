import { TelegramAlertService } from '../server/services/TelegramAlertService';
import { BakongSyncService } from '../server/services/BakongSyncService';

async function main() {
  console.log('Sending Real Telegram Alert for Transaction 28fe1819...');
  const success = await TelegramAlertService.sendPaymentAlert({
    invoiceNumber: 'INV-2026-001',
    tenantName: 'ASICS Facility',
    unitZone: 'Second_Floor - Suite 201',
    amountUsd: 0.01,
    amountKhr: 41,
    fromAccountId: '004437844 (Advanced Bank of Asia Ltd.)',
    bakongHash: '28fe1819',
    settledAt: new Date('2026-09-15T10:40:00+07:00'),
  });

  if (success) {
    console.log('✅ Real Telegram alert successfully delivered for Hash 28fe1819!');
    await BakongSyncService.markSuccess(
      'INV-2026-001',
      '28fe1819',
      '004437844 (ABA Bank)',
      new Date('2026-09-15T10:40:00+07:00')
    );
  } else {
    console.error('❌ Failed to deliver alert.');
  }
}

main().catch(console.error);
