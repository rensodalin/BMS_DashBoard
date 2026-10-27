import axios, { AxiosError } from 'axios';
import { config } from '../config/env';

export interface BakongTxnCheckResult {
  isPaid: boolean;
  isRateLimited?: boolean;
  responseCode: number;
  responseMessage: string;
  transaction?: {
    hash: string;
    fromAccountId: string;
    toAccountId: string;
    currency: string;
    amount: number;
    description?: string;
    paidAt: Date;
    externalRef?: string;
  };
  raw?: any;
}

export class BakongService {
  /**
   * Queries Bakong Open API by MD5 hash to verify if payment has been settled
   */
  public static async checkTransactionByMd5(md5: string): Promise<BakongTxnCheckResult> {
    const baseUrl = config.bakong.apiUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/v1/check_transaction_by_md5`;

    try {
      const response = await axios.post(
        endpoint,
        { md5 },
        {
          headers: {
            Authorization: `Bearer ${config.bakong.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const data = response.data;

      // In Bakong Open API, responseCode 0 indicates successful transaction
      if (data && data.responseCode === 0 && data.data) {
        const txn = data.data;
        return {
          isPaid: true,
          responseCode: 0,
          responseMessage: data.responseMessage || 'Success',
          transaction: {
            hash: txn.hash || txn.trxId || md5,
            fromAccountId: txn.fromAccountId || txn.senderAccount || 'Unknown Account',
            toAccountId: txn.toAccountId || config.bakong.accountId,
            currency: txn.currency || 'USD',
            amount: Number(txn.amount || 0),
            description: txn.description || '',
            paidAt: txn.createdDateMs ? new Date(txn.createdDateMs) : new Date(),
            externalRef: txn.externalRef || '',
          },
          raw: data,
        };
      }

      const msg = (data?.responseMessage || '').toLowerCase();
      const isRateLimited =
        msg.includes('daily request limit') ||
        msg.includes('limit of 100') ||
        msg.includes('too many requests');

      return {
        isPaid: false,
        isRateLimited,
        responseCode: data?.responseCode ?? 1,
        responseMessage: data?.responseMessage || 'Pending or Transaction Not Found',
        raw: data,
      };
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const axiosErr = err as AxiosError<any>;
        // Bakong returns 404 or specific code if payment hasn't been scanned/made yet
        const status = axiosErr.response?.status;
        const errData = axiosErr.response?.data;

        return {
          isPaid: false,
          responseCode: errData?.responseCode || (status === 404 ? 404 : 1),
          responseMessage:
            errData?.responseMessage ||
            errData?.message ||
            (status === 404 ? 'Transaction not yet completed' : axiosErr.message),
          raw: errData || { message: axiosErr.message },
        };
      }

      return {
        isPaid: false,
        responseCode: -1,
        responseMessage: err.message || 'Network error querying Bakong API',
        raw: { error: err.message },
      };
    }
  }
}
