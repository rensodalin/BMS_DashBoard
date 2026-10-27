import { PaymentAttempt, PaymentTransaction, Invoice } from '../models';
import { BakongService } from '../services/BakongService';
import { TelegramAlertService } from '../services/TelegramAlertService';
import { SupabaseSyncService } from '../services/SupabaseSyncService';
import { BakongSyncService, BakongPaymentAttempt } from '../services/BakongSyncService';
import { config } from '../config/env';

export class PaymentMonitoringWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning: boolean = false;
  private static rateLimitCooldownUntil: number = 0;

  /**
   * Starts the payment monitoring worker
   */
  public static start() {
    if (this.timer) return;

    // Use at least 30s interval to prevent exhausting NBC Bakong's 100/day request quota
    const pollInterval = Math.max(30000, config.worker.intervalMs || 30000);
    console.log(`[PaymentWorker] 🚀 Started Payment Monitoring Worker (Interval: ${pollInterval}ms)`);

    // Run initial poll, then periodically
    this.pollPendingPayments();
    this.timer = setInterval(() => {
      this.pollPendingPayments();
    }, pollInterval);
  }

  /**
   * Stops the worker
   */
  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[PaymentWorker] ⏹️ Stopped Payment Monitoring Worker.');
    }
  }

  /**
   * Core polling cycle: Finds active pending attempts from Supabase & MongoDB,
   * queries Bakong Open API by MD5, auto-updates DB & alerts Telegram
   */
  public static async pollPendingPayments() {
    if (this.isRunning) return;
    if (Date.now() < this.rateLimitCooldownUntil) {
      return;
    }
    this.isRunning = true;

    try {
      // 1. Fetch pending payment attempts from Supabase
      const supabaseAttempts = await BakongSyncService.getPendingAttempts();

      // 2. Filter to only recent attempts (created within the last 2 hours) to avoid quota burn
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const recentPending = supabaseAttempts.filter((a) => {
        const createdMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        return a.status === 'PENDING' && (createdMs === 0 || createdMs > twoHoursAgo);
      });

      if (recentPending.length === 0) {
        return;
      }

      // Limit to max 3 most recent attempts per poll to conserve Bakong quota
      const targetAttempts = recentPending.slice(0, 3);

      for (const attempt of targetAttempts) {
        // Query Bakong Open API by MD5 hash
        const checkResult = await BakongService.checkTransactionByMd5(attempt.md5Hash);

        if (checkResult.isRateLimited) {
          console.warn('[PaymentWorker] ⚠️ NBC Bakong Daily API quota reached (100 reqs/day). Pausing queries for 15 minutes.');
          this.rateLimitCooldownUntil = Date.now() + 15 * 60 * 1000;
          break;
        }

        if (checkResult.isPaid && checkResult.transaction) {
          const txn = checkResult.transaction;
          console.log(`[PaymentWorker] 💰 PAYMENT CONFIRMED for ${attempt.invoiceNumber}! Bakong Hash: ${txn.hash}`);

          // A. Mark SUCCESS in Supabase & update invoice to PAID
          await BakongSyncService.markSuccess(
            attempt.invoiceNumber,
            txn.hash,
            txn.fromAccountId,
            txn.paidAt
          );

          // B. Update MongoDB if connected
          try {
            await PaymentAttempt.updateOne(
              { md5Hash: attempt.md5Hash },
              { status: 'SUCCESS', lastCheckedAt: new Date() }
            );
            await Invoice.updateOne(
              { invoiceNumber: attempt.invoiceNumber },
              { status: 'PAID', paidAt: txn.paidAt }
            );
          } catch {}

          // C. Dispatch Telegram Payment Alert!
          const telegramSent = await TelegramAlertService.sendPaymentAlert({
            invoiceNumber: attempt.invoiceNumber,
            tenantName: attempt.tenantName,
            unitZone: attempt.unitZone,
            amountUsd: attempt.amountUsd,
            amountKhr: attempt.amountKhr,
            fromAccountId: txn.fromAccountId,
            bakongHash: txn.hash,
            settledAt: txn.paidAt,
          });

          if (telegramSent) {
            console.log(`[PaymentWorker] 📲 Telegram alert sent for ${attempt.invoiceNumber}!`);
          } else {
            console.warn(`[PaymentWorker] ⚠️ Telegram alert dispatch failed for ${attempt.invoiceNumber}`);
          }
        }
      }
    } catch (err: any) {
      console.error('[PaymentWorker] Error in poll cycle:', err.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Helper to manually simulate or trigger a paid event (useful for development & testing)
   */
  public static async simulatePaymentSuccess(invoiceNumber: string, customFromAccount?: string) {
    const mockHash = 'BAKONG-' + Date.now().toString(16).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    const fromAccount = customFromAccount || '001992831@abaa';

    // 1. Mark in Supabase & get attempt info
    await BakongSyncService.markSuccess(invoiceNumber, mockHash, fromAccount, new Date());
    const attempts = await BakongSyncService.loadAllAttempts();
    const tracked = attempts[invoiceNumber];

    // 2. Update MongoDB if available
    try {
      const invoice = await Invoice.findOne({ invoiceNumber });
      if (invoice) {
        const attempt = await PaymentAttempt.findOne({ invoiceNumber });
        if (attempt) {
          attempt.status = 'SUCCESS';
          await attempt.save();
        }
        invoice.status = 'PAID';
        invoice.paidAt = new Date();
        await invoice.save();
      }
    } catch {}

    // 3. Dispatch Telegram alert
    await TelegramAlertService.sendPaymentAlert({
      invoiceNumber,
      tenantName: tracked?.tenantName || 'Tenant Facility',
      unitZone: tracked?.unitZone || 'Ground Floor',
      amountUsd: tracked?.amountUsd || 10.0,
      amountKhr: tracked?.amountKhr || 41000,
      fromAccountId: fromAccount,
      bakongHash: mockHash,
      settledAt: new Date(),
    });

    return {
      success: true,
      invoiceNumber,
      bakongHash: mockHash,
      fromAccountId: fromAccount,
      status: 'PAID',
    };
  }
}
