import { SupabaseSyncService } from './SupabaseSyncService';
import { KhqrService } from './KhqrService';

export interface BakongPaymentAttempt {
  invoiceNumber: string;
  tenantName: string;
  unitZone: string;
  amountUsd: number;
  amountKhr: number;
  md5Hash: string;
  qrString?: string;
  tenantEmail?: string;
  status: 'PENDING' | 'SUCCESS' | 'EXPIRED';
  createdAt: string;
  expiresAt?: string;
  paidAt?: string;
  bakongHash?: string;
  fromAccountId?: string;
}

const SETTINGS_ROW_ID = 'bakong_payment_attempts';

export class BakongSyncService {
  /**
   * Load all tracked payment attempts from Supabase admin_settings
   */
  public static async loadAllAttempts(): Promise<Record<string, BakongPaymentAttempt>> {
    const sb = SupabaseSyncService.getClient();
    if (!sb) return {};

    try {
      const { data, error } = await sb
        .from('admin_settings')
        .select('email')
        .eq('id', SETTINGS_ROW_ID)
        .maybeSingle();

      if (error || !data || !data.email) return {};
      return JSON.parse(data.email);
    } catch (err: any) {
      console.warn('[BakongSyncService] Notice loading attempts:', err.message);
      return {};
    }
  }

  /**
   * Save or update an active payment attempt in Supabase
   */
  public static async saveAttempt(attempt: BakongPaymentAttempt): Promise<void> {
    const sb = SupabaseSyncService.getClient();
    if (!sb) return;

    try {
      const all = await this.loadAllAttempts();
      all[attempt.invoiceNumber] = attempt;

      await sb.from('admin_settings').upsert({
        id: SETTINGS_ROW_ID,
        name: 'Bakong Active Attempts',
        email: JSON.stringify(all),
        password: 'active',
        updated_at: new Date().toISOString(),
      });
      console.log(`[BakongSyncService] 💾 Registered payment attempt for ${attempt.invoiceNumber} (MD5: ${attempt.md5Hash})`);
    } catch (err: any) {
      console.warn('[BakongSyncService] Notice saving attempt:', err.message);
    }
  }

  /**
   * Get all currently PENDING payment attempts
   */
  public static async getPendingAttempts(): Promise<BakongPaymentAttempt[]> {
    const all = await this.loadAllAttempts();
    return Object.values(all).filter((a) => a.status === 'PENDING' && a.md5Hash);
  }

  /**
   * Mark a payment attempt as SUCCESS after verification
   */
  public static async markSuccess(
    invoiceNumber: string,
    bakongHash: string,
    fromAccountId: string,
    paidAt: Date = new Date()
  ): Promise<void> {
    const sb = SupabaseSyncService.getClient();
    if (!sb) return;

    try {
      const all = await this.loadAllAttempts();
      if (all[invoiceNumber]) {
        all[invoiceNumber].status = 'SUCCESS';
        all[invoiceNumber].bakongHash = bakongHash;
        all[invoiceNumber].fromAccountId = fromAccountId;
        all[invoiceNumber].paidAt = paidAt.toISOString();

        await sb.from('admin_settings').upsert({
          id: SETTINGS_ROW_ID,
          name: 'Bakong Active Attempts',
          email: JSON.stringify(all),
          password: 'active',
          updated_at: new Date().toISOString(),
        });
      }

      // Synchronize invoice in Supabase to PAID
      await SupabaseSyncService.markInvoicePaid(invoiceNumber);
      console.log(`[BakongSyncService] ✅ Payment marked SUCCESS for ${invoiceNumber}`);
    } catch (err: any) {
      console.warn('[BakongSyncService] Error marking success:', err.message);
    }
  }

  /**
   * Ensures every PENDING invoice in Supabase has a valid Bakong KHQR & MD5 hash tracked
   */
  public static async ensurePendingInvoicesTracked(): Promise<number> {
    const sb = SupabaseSyncService.getClient();
    if (!sb) return 0;

    try {
      const { data: invoices, error } = await sb
        .from('tenant_invoices')
        .select('*')
        .in('status', ['PENDING', 'OVERDUE']);

      if (error || !invoices || invoices.length === 0) return 0;

      const currentAttempts = await this.loadAllAttempts();
      let newCount = 0;

      for (const inv of invoices) {
        // If already tracked and pending with valid md5, skip
        if (currentAttempts[inv.invoice_number]?.status === 'PENDING' && currentAttempts[inv.invoice_number]?.md5Hash) {
          continue;
        }

        const amountUsd = Number(inv.total_cost_usd || 10.0);
        const khqr = await KhqrService.generateInvoiceKhqr({
          invoiceNumber: inv.invoice_number,
          amount: amountUsd,
          currency: 'USD',
          tenantName: inv.tenant_name,
          ttlHours: 72,
        });

        currentAttempts[inv.invoice_number] = {
          invoiceNumber: inv.invoice_number,
          tenantName: inv.tenant_name,
          unitZone: inv.unit_zone || '',
          amountUsd: amountUsd,
          amountKhr: Math.round(amountUsd * 4100),
          md5Hash: khqr.md5,
          qrString: khqr.qr,
          tenantEmail: inv.tenant_email || '',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          expiresAt: khqr.expiresAt.toISOString(),
        };
        newCount++;
      }

      if (newCount > 0) {
        await sb.from('admin_settings').upsert({
          id: SETTINGS_ROW_ID,
          name: 'Bakong Active Attempts',
          email: JSON.stringify(currentAttempts),
          password: 'active',
          updated_at: new Date().toISOString(),
        });
        console.log(`[BakongSyncService] 🔄 Registered KHQR tracking for ${newCount} pending invoice(s).`);
      }

      return newCount;
    } catch (err: any) {
      console.warn('[BakongSyncService] Notice ensuring pending invoices tracked:', err.message);
      return 0;
    }
  }
}
