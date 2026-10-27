import { TelegramAlertService } from '../server/services/TelegramAlertService';

async function test() {
  console.log('--- Testing Telegram Payment Alert Notification ---');
  const success = await TelegramAlertService.sendPaymentAlert({
    invoiceNumber: 'INV-2026-003',
    tenantName: 'Grand Retail Zone A',
    unitZone: 'Ground Floor - Retail 101',
    amountUsd: 367.58,
    amountKhr: 1507078,
    fromAccountId: '001992831@abaa',
    bakongHash: 'BAKONG-TEST-9F8A21C0',
    settledAt: new Date(),
  });

  console.log('Telegram Alert Sent:', success ? '✅ SUCCESS' : '❌ FAILED');
}

test().catch(console.error);
