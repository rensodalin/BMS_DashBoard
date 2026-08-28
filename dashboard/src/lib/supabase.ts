import { createClient } from '@supabase/supabase-js';
import type { SensorPoint, PointReading, TenantInvoiceDb, UtilityRate, TenantMeter } from '../types/bms';

// Read credentials from env or fallback to project credentials
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://urnndyjtemzbjvjsbqyz.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybm5keWp0ZW16Ymp2anNicXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDE4MjUsImV4cCI6MjEwMjk3NzgyNX0.Hq5xegqbeAYBAtgiGTv19b6t9Pz7Fqk4puDvDhEc0y0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetch all live sensor points from Supabase
 */
export async function fetchSensorPoints(): Promise<SensorPoint[]> {
  const { data, error } = await supabase
    .from('sensor_points')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching sensor_points:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Register or update a sensor point in Supabase (with optional oBIX URL)
 */
export async function addOrUpdateSensorPoint(point: Partial<SensorPoint>): Promise<boolean> {
  const payload: any = {
    point_name: point.point_name,
    device_name: point.device_name || 'Pump',
    current_value: point.current_value ?? 0,
    alert_threshold: point.alert_threshold ?? 30.0,
    is_alarm: point.is_alarm ?? false,
    updated_at: new Date().toISOString(),
  };

  if (point.obix_url) {
    payload.obix_url = point.obix_url;
  }

  const { error } = await supabase.from('sensor_points').upsert(
    payload,
    { onConflict: 'point_name' }
  );

  if (error) {
    console.error('Error upserting sensor_point:', error.message);
    if (error.message.includes('obix_url') || error.code === 'PGRST204') {
      delete payload.obix_url;
      const { error: retryErr } = await supabase.from('sensor_points').upsert(
        payload,
        { onConflict: 'point_name' }
      );
      if (retryErr) {
        console.error('Retry error upserting sensor_point:', retryErr.message);
        return false;
      }
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Delete a sensor point from Supabase database
 */
export async function deleteSensorPoint(pointName: string): Promise<boolean> {
  const { error } = await supabase
    .from('sensor_points')
    .delete()
    .eq('point_name', pointName);

  if (error) {
    console.error(`Error deleting sensor_point ${pointName}:`, error.message);
    return false;
  }
  return true;
}

/**
 * Fetch historical readings time-series log for a given point name
 */
export async function fetchPointReadings(pointName: string, limit = 50): Promise<PointReading[]> {
  const { data, error } = await supabase
    .from('point_readings')
    .select('*')
    .eq('point_name', pointName)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`Error fetching point_readings for ${pointName}:`, error.message);
    return [];
  }
  return (data || []).reverse();
}

// ==============================================================================
// BILLING SYSTEM DATABASE HELPERS
// ==============================================================================

/**
 * Fetch all tenant invoices from Supabase
 */
export async function fetchTenantInvoices(): Promise<TenantInvoiceDb[]> {
  const { data, error } = await supabase
    .from('tenant_invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Info: tenant_invoices table query notice:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetch all tenant meters from Supabase
 */
export async function fetchTenantMeters(): Promise<TenantMeter[]> {
  const { data, error } = await supabase
    .from('tenant_meters')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Info: tenant_meters table query notice:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetch active utility rate tariff settings from Supabase
 */
export async function fetchUtilityRates(): Promise<UtilityRate | null> {
  const { data, error } = await supabase
    .from('utility_rates')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error) {
    console.warn('Info: utility_rates table query notice:', error.message);
    return null;
  }
  return data;
}

/**
 * Update global tariff rate ($/kWh) in Supabase database
 */
export async function updateUtilityRate(ratePerKwh: number): Promise<boolean> {
  const { error } = await supabase
    .from('utility_rates')
    .upsert(
      {
        rate_name: 'Standard Commercial Tariff',
        rate_per_kwh: ratePerKwh,
        currency: 'USD',
        khr_exchange_rate: 4100.0,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'rate_name' }
    );

  if (error) {
    console.warn('Warning updating utility_rates:', error.message);
    return false;
  }
  return true;
}

/**
 * Upsert tenant invoice record in Supabase
 */
export async function upsertTenantInvoice(invoice: Partial<TenantInvoiceDb>): Promise<boolean> {
  const { error } = await supabase
    .from('tenant_invoices')
    .upsert(invoice, { onConflict: 'invoice_number' });

  if (error) {
    console.warn('Warning upserting tenant_invoice:', error.message);
    return false;
  }
  return true;
}
