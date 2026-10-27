import axios from 'axios';
import { config } from '../server/config/env';
import { BakongSyncService } from '../server/services/BakongSyncService';

async function main() {
  console.log('Using Bakong Token prefix:', config.bakong.accessToken?.substring(0, 15));
  const attempts = await BakongSyncService.getPendingAttempts();
  console.log(`Found ${attempts.length} tracked attempts.`);

  for (const a of attempts) {
    try {
      const res = await axios.post(
        'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5',
        { md5: a.md5Hash },
        { 
          headers: { 
            Authorization: `Bearer ${config.bakong.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000 
        }
      );
      console.log(`[${a.invoiceNumber}] MD5 ${a.md5Hash}: responseCode = ${res.data?.responseCode}, message = ${res.data?.responseMessage}`);
      if (res.data?.data) {
        console.log('   DATA:', JSON.stringify(res.data.data));
      }
    } catch (err: any) {
      console.log(`[${a.invoiceNumber}] MD5 ${a.md5Hash}: error =`, err.response?.data || err.message);
    }
  }
}

main().catch(console.error);
