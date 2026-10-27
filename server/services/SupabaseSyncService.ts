import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env';

export class SupabaseSyncService {
  private static client: SupabaseClient | null = null;

  public static getClient(): SupabaseClient | null {
    if (!this.client && config.supabase.url && config.supabase.anonKey) {
      this.client = createClient(config.supabase.url, config.supabase.anonKey);
    }
    return this.client;
  }

  /**
   * Syncs an invoice status update directly to Supabase table `tenant_invoices`
   * This triggers Supabase Realtime broadcast so the React Dashboard updates immediately!
   */
  public static async markInvoicePaid(invoiceNumber: string): Promise<boolean> {
    const supabase = this.getClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('tenant_invoices')
        .update({
          status: 'PAID',
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_number', invoiceNumber);

      if (error) {
        console.warn(`[SupabaseSync] Failed to update ${invoiceNumber} status:`, error.message);
        return false;
      }

      console.log(`[SupabaseSync] Successfully synchronized ${invoiceNumber} to PAID in Supabase!`);
      return true;
    } catch (err: any) {
      console.error(`[SupabaseSync] Error updating Supabase invoice:`, err.message);
      return false;
    }
  }

  /**
   * Fetches invoices from Supabase
   */
  public static async fetchSupabaseInvoices(): Promise<any[]> {
    const supabase = this.getClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('tenant_invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[SupabaseSync] Error fetching tenant_invoices:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Fetches tenant meters from Supabase
   */
  public static async fetchSupabaseMeters(): Promise<any[]> {
    const supabase = this.getClient();
    if (!supabase) return [];

    const { data, error } = await supabase.from('tenant_meters').select('*');
    if (error) {
      console.warn('[SupabaseSync] Error fetching tenant_meters:', error.message);
      return [];
    }
    return data || [];
  }
}
