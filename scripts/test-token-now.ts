import axios from 'axios';
import { config } from '../server/config/env';

async function main() {
  try {
    const res = await axios.post(
      'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5',
      { md5: '423432159d40bbe44039b268d8c1ea96' },
      { 
        headers: { 
          Authorization: `Bearer ${config.bakong.accessToken}`,
          'Content-Type': 'application/json' 
        },
        timeout: 5000
      }
    );
    console.log('LIVE RESPONSE:', res.data);
  } catch (err: any) {
    console.log('LIVE ERROR:', err.response?.data || err.message);
  }
}

main().catch(console.error);
