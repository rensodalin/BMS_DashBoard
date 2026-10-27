import dotenv from 'dotenv';
import path from 'path';

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server Port
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB Configuration
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bms_billing',

  // Bakong Open API & KHQR Configuration
  bakong: {
    accountId: process.env.BAKONG_ACCOUNT_ID || 'ren_sodalin@bkrt',
    merchantName: (process.env.BAKONG_MERCHANT_NAME || 'SODALIN REN').replace(/['"]/g, ''),
    merchantCity: (process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh').replace(/['"]/g, ''),
    accessToken: process.env.BAKONG_ACCESS_TOKEN || '',
    apiUrl: (process.env.BAKONG_API_URL || 'https://api-bakong.nbc.gov.kh/').replace(/['"]/g, ''),
  },

  // Telegram Alert Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  // Gmail SMTP Email Service Configuration
  gmail: {
    user: process.env.GMAIL_USER || '',
    appPassword: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
  },

  // Supabase Configuration for Dual Sync
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },

  // Payment Monitoring Worker
  worker: {
    intervalMs: parseInt(process.env.PAYMENT_MONITOR_INTERVAL_MS || '10000', 10), // check every 10s
    attemptTtlMinutes: 60, // check attempts created in last 60 minutes
  },
};
