import { BakongKHQR, IndividualInfo, khqrData } from 'bakong-khqr';
import QRCode from 'qrcode';
import { config } from '../config/env';

export interface GenerateKhqrParams {
  invoiceNumber: string;
  amount: number;
  currency?: 'USD' | 'KHR';
  tenantName?: string;
  storeLabel?: string;
  terminalLabel?: string;
  ttlHours?: number;
}

export interface KhqrResult {
  qr: string;
  md5: string;
  qrCodeDataUrl: string;
  amount: number;
  currency: 'USD' | 'KHR';
  expiresAt: Date;
}

export class KhqrService {
  private static bakong = new BakongKHQR();

  /**
   * Generates a standard Bakong individual KHQR string, MD5 hash, and PNG Data URL
   */
  public static async generateInvoiceKhqr(params: GenerateKhqrParams): Promise<KhqrResult> {
    const currency = params.currency || 'USD';
    const khqrCurrency =
      currency === 'KHR' ? khqrData.currency.khr : khqrData.currency.usd;

    // Amount formatted to 2 decimals for USD, integer for KHR
    const amountVal =
      currency === 'KHR' ? Math.round(params.amount) : Number(params.amount.toFixed(2));

    const ttlHours = params.ttlHours || 48;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const expirationTimestamp = expiresAt.getTime();

    const individualInfo = new IndividualInfo(
      config.bakong.accountId,
      config.bakong.merchantName,
      config.bakong.merchantCity,
      {
        accountInformation: config.bakong.accountId,
        currency: khqrCurrency,
        amount: amountVal,
        billNumber: params.invoiceNumber,
        storeLabel: params.storeLabel || 'Intersys BMS',
        terminalLabel: params.terminalLabel || 'Web Billing',
        expirationTimestamp: expirationTimestamp,
      }
    );

    const response = this.bakong.generateIndividual(individualInfo);

    if (!response || response.status?.code !== 0 || !response.data) {
      const errMsg = response?.status?.message || 'Failed to generate Bakong KHQR code';
      throw new Error(`KHQR Generation Error (${response?.status?.errorCode || 'unknown'}): ${errMsg}`);
    }

    const { qr, md5 } = response.data;

    // Generate high-resolution PNG data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qr, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return {
      qr,
      md5,
      qrCodeDataUrl,
      amount: amountVal,
      currency,
      expiresAt,
    };
  }
}
