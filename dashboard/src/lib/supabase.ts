import { createClient } from '@supabase/supabase-js';
import type { SensorPoint, PointReading } from '../types/bms';

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
    // If obix_url column doesn't exist in Supabase yet, retry without obix_url column
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
