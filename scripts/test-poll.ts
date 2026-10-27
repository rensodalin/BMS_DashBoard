import { PaymentMonitoringWorker } from '../server/workers/PaymentMonitoringWorker';
import { BakongSyncService } from '../server/services/BakongSyncService';

async function main() {
  const attempts = await BakongSyncService.getPendingAttempts();
  console.log(`Found ${attempts.length} pending attempts in Supabase:`);
  for (const a of attempts) {
    console.log(` - Invoice: ${a.invoiceNumber}, Amount: $${a.amountUsd}, MD5: ${a.md5Hash}`);
  }

  console.log('\nRunning pollPendingPayments...');
  await PaymentMonitoringWorker.pollPendingPayments();
  console.log('Poll completed.');
}

main().catch(console.error);
