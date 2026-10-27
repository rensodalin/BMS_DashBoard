import axios from 'axios';
import { config } from '../config/env';

export interface TelegramPaymentAlertPayload {
  invoiceNumber: string;
  tenantName: string;
  unitZone: string;
  amountUsd: number;
  amountKhr: number;
  fromAccountId: string;
  bakongHash: string;
  settledAt: Date;
}

export class TelegramAlertService {
  /**
   * Dispatches a payment receipt alert to the configured Telegram Chat
   */
  public static async sendPaymentAlert(payload: TelegramPaymentAlertPayload): Promise<boolean> {
    const { botToken, chatId } = config.telegram;

    if (!botToken || !chatId) {
      console.warn('[TelegramAlert] Bot Token or Chat ID not configured. Skipping alert.');
      return false;
    }

    const formattedDate = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Phnom_Penh',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(payload.settledAt);

    const messageHtml = [
      `🔔 <b>BAKONG PAYMENT RECEIVED</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🧾 <b>Invoice:</b> <code>${payload.invoiceNumber}</code>`,
      `🏢 <b>Tenant:</b> ${payload.tenantName}`,
      `📍 <b>Unit/Zone:</b> ${payload.unitZone}`,
      `💵 <b>Amount (USD):</b> $${payload.amountUsd.toFixed(2)}`,
      `🇰🇭 <b>Amount (KHR):</b> ${payload.amountKhr.toLocaleString()} KHR`,
      `🏦 <b>Payer Account:</b> <code>${payload.fromAccountId}</code>`,
      `🔗 <b>Bakong Hash:</b> <code>${payload.bakongHash}</code>`,
      `⏰ <b>Settled At:</b> ${formattedDate} (ICT)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✅ <b>Status:</b> <i>PAID & AUTO-RECONCILED</i>`,
    ].join('\n');

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await axios.post(
        url,
        {
          chat_id: chatId,
          text: messageHtml,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        },
        { timeout: 8000 }
      );

      return response.data?.ok === true;
    } catch (err: any) {
      console.error('[TelegramAlert] Failed to send Telegram alert:', err.response?.data || err.message);
      return false;
    }
  }
}
