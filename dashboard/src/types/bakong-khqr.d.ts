declare module 'bakong-khqr' {
  export class BakongKHQR {
    generateIndividual(individualInfo: any): {
      status: {
        code: number;
        errorCode: number | null;
        message: string | null;
      };
      data: {
        qr: string;
        md5: string;
      } | null;
    };
    generateMerchant(merchantInfo: any): {
      status: {
        code: number;
        errorCode: number | null;
        message: string | null;
      };
      data: {
        qr: string;
        md5: string;
      } | null;
    };
    decode(qrString: string): any;
  }

  export class IndividualInfo {
    constructor(
      bakongAccountID: string,
      merchantName: string,
      merchantCity: string,
      optional?: {
        accountInformation?: string;
        acquiringBank?: string;
        currency?: number;
        amount?: number;
        merchantName?: string;
        merchantCity?: string;
        billNumber?: string;
        storeLabel?: string;
        terminalLabel?: string;
        mobileNumber?: string;
        purposeOfTransaction?: string;
        languagePreference?: string;
        merchantNameAlternateLanguage?: string;
        merchantCityAlternateLanguage?: string;
        upiMerchantAccount?: string;
        expirationTimestamp?: number;
        merchantCategoryCode?: string;
      }
    );
  }

  export class MerchantInfo {
    constructor(
      bakongAccountID: string,
      merchantName: string,
      merchantCity: string,
      optional?: any
    );
  }

  export const khqrData: {
    currency: {
      usd: number;
      khr: number;
    };
  };
}
