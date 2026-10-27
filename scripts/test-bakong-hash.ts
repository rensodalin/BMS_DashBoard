import axios from 'axios';
import { config } from '../server/config/env';

async function testEndpoints() {
  const token = config.bakong.accessToken;
  const hash = '28fe1819';
  const md5 = '423432159d40bbe44039b268d8c1ea96';

  console.log('Testing Bakong Open API endpoints for hash 28fe1819 & md5...');

  const endpoints = [
    { name: 'check_transaction_by_md5', url: 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5', data: { md5 } },
    { name: 'check_transaction_by_short_hash', url: 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_short_hash', data: { short_hash: hash } },
    { name: 'check_transaction_by_hash', url: 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_hash', data: { hash } },
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.post(ep.url, ep.data, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 5000,
      });
      console.log(`[${ep.name}] RESULT:`, res.data);
    } catch (err: any) {
      console.log(`[${ep.name}] ERROR:`, err.response?.data || err.message);
    }
  }
}

testEndpoints().catch(console.error);
