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
    .order('point_name', { ascending: true });


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
  if (point.building_name) {
    payload.building_name = point.building_name;
  }
  if (point.floor_name) {
    payload.floor_name = point.floor_name;
  }

  const { error } = await supabase.from('sensor_points').upsert(
    payload,
    { onConflict: 'point_name' }
  );

  if (error) {
    console.warn('Error upserting sensor_point with extra fields:', error.message);
    let fallbackNeeded = false;
    if (error.message.includes('obix_url') || error.code === 'PGRST204') {
      delete payload.obix_url;
      fallbackNeeded = true;
    }
    if (error.message.includes('building_name') || error.code === 'PGRST204') {
      delete payload.building_name;
      fallbackNeeded = true;
    }
    if (error.message.includes('floor_name') || error.code === 'PGRST204') {
      delete payload.floor_name;
      fallbackNeeded = true;
    }
    if (fallbackNeeded) {
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

export interface MeterReadingRangeResult {
  startReading: number | null;
  endReading: number | null;
  deltaKwh: number | null;
  startTimeActual?: string;
  endTimeActual?: string;
}

// High-performance in-memory cache for meter interval ranges
const rangeResultCache = new Map<string, { result: MeterReadingRangeResult; time: number }>();

/**
 * Fetch the exact recorded meter readings for a given start and end timestamp from point_readings
 * Runs parallel indexed queries in ~300ms and caches responses for instant date-change calculations.
 */
export async function fetchMeterReadingRange(
  pointName: string,
  startIso: string,
  endIso: string
): Promise<MeterReadingRangeResult> {
  try {
    let cleanStart = (startIso || '').includes(' ')
      ? startIso.replace(' ', 'T')
      : (startIso || '');
    if (cleanStart.length === 10) cleanStart += 'T00:00:00';
    else if (cleanStart.length === 16) cleanStart += ':00';
    else cleanStart = cleanStart.slice(0, 19);

    let cleanEnd = (endIso || '').includes(' ')
      ? endIso.replace(' ', 'T')
      : (endIso || '');
    if (cleanEnd.length === 10) cleanEnd += 'T23:59:59';
    else if (cleanEnd.length === 16) cleanEnd += ':00';
    else cleanEnd = cleanEnd.slice(0, 19);

    const cacheKey = `${pointName}_${cleanStart}_${cleanEnd}`;
    const cached = rangeResultCache.get(cacheKey);
    // Return cached range if younger than 10 seconds
    if (cached && Date.now() - cached.time < 10000) {
      return cached.result;
    }

    // Execute start and end indexed queries in parallel (~300ms total)
    const [startRes, endRes] = await Promise.all([
      supabase
        .from('point_readings')
        .select('value, recorded_at')
        .eq('point_name', pointName)
        .lte('recorded_at', cleanStart)
        .order('recorded_at', { ascending: false })
        .limit(1),
      supabase
        .from('point_readings')
        .select('value, recorded_at')
        .eq('point_name', pointName)
        .lte('recorded_at', cleanEnd)
        .order('recorded_at', { ascending: false })
        .limit(1),
    ]);

    let startRow = startRes.data?.[0];
    let endRow = endRes.data?.[0];

    // If no row exists before start, look for the first row right after start
    if (!startRow) {
      const { data: gteData } = await supabase
        .from('point_readings')
        .select('value, recorded_at')
        .eq('point_name', pointName)
        .gte('recorded_at', cleanStart)
        .order('recorded_at', { ascending: true })
        .limit(1);
      startRow = gteData?.[0];
    }

    // If no row exists before end, look for latest available reading
    if (!endRow) {
      const { data: latestData } = await supabase
        .from('point_readings')
        .select('value, recorded_at')
        .eq('point_name', pointName)
        .order('recorded_at', { ascending: false })
        .limit(1);
      endRow = latestData?.[0];
    }

    let startVal = startRow ? Number(startRow.value) : null;
    let endVal = endRow ? Number(endRow.value) : null;

    // Handle counter reset or rollover (e.g. if startRow came from a previous session before counter reset)
    if (startVal !== null && endVal !== null && startVal > endVal) {
      const { data: gteData } = await supabase
        .from('point_readings')
        .select('value, recorded_at')
        .eq('point_name', pointName)
        .gte('recorded_at', cleanStart)
        .lte('recorded_at', cleanEnd)
        .order('recorded_at', { ascending: true })
        .limit(1);

      if (gteData && gteData[0]) {
        const candidateStartVal = Number(gteData[0].value);
        if (candidateStartVal <= endVal) {
          startRow = gteData[0];
          startVal = candidateStartVal;
        }
      }
    }

    let result: MeterReadingRangeResult;
    if (startVal !== null && endVal !== null) {
      const delta = Math.max(0, Number((endVal - startVal).toFixed(3)));
      result = {
        startReading: startVal,
        endReading: endVal,
        deltaKwh: delta,
        startTimeActual: startRow?.recorded_at,
        endTimeActual: endRow?.recorded_at,
      };
    } else {
      result = { startReading: startVal, endReading: endVal, deltaKwh: null };
    }

    rangeResultCache.set(cacheKey, { result, time: Date.now() });
    return result;
  } catch (err) {
    console.error('Error fetching meter reading range:', err);
    return { startReading: null, endReading: null, deltaKwh: null };
  }
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
  try {
    const { data, error } = await supabase
      .from('utility_rates')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
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
 * Tries full payload first, then retries without non-schema columns if needed.
 */
export async function upsertTenantInvoice(invoice: Partial<TenantInvoiceDb>): Promise<boolean> {
  // Clean payload: remove undefined values
  const cleanPayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(invoice)) {
    if (v !== undefined) cleanPayload[k] = v;
  }

  // Strip non-UUID synthetic id (e.g. 'INV-2026-001') to avoid Postgres 22P02 uuid format error
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (cleanPayload.id && !isUuid.test(String(cleanPayload.id))) {
    delete cleanPayload.id;
  }

  // If updating an existing invoice by invoice_number, update directly
  if (cleanPayload.invoice_number) {
    const { data: updatedRows, error: updateErr } = await supabase
      .from('tenant_invoices')
      .update(cleanPayload)
      .eq('invoice_number', cleanPayload.invoice_number)
      .select('id');

    if (!updateErr && updatedRows && updatedRows.length > 0) {
      console.log('✅ Supabase update success:', cleanPayload.invoice_number || cleanPayload.tenant_name);
      return true;
    }
  }

  // Otherwise attempt upsert
  const { error } = await supabase
    .from('tenant_invoices')
    .upsert(cleanPayload, { onConflict: 'invoice_number' });

  if (!error) {
    console.log('✅ Supabase upsert success:', cleanPayload.invoice_number || cleanPayload.tenant_name);
    return true;
  }

  // If schema error (PGRST204 or column not found), retry without start_date/end_date
  if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema')) {
    console.warn('Supabase schema issue, retrying without start_date/end_date:', error.message);
    const { start_date, end_date, ...fallbackPayload } = cleanPayload as any;
    const { error: retryErr } = await supabase
      .from('tenant_invoices')
      .upsert(fallbackPayload, { onConflict: 'invoice_number' });

    if (!retryErr) {
      console.log('✅ Supabase upsert success (fallback):', fallbackPayload.invoice_number);
      return true;
    }
    console.error('❌ Supabase upsert failed even after fallback:', retryErr.message, fallbackPayload);
    return false;
  }

  console.error('❌ Supabase upsert failed:', error.message, cleanPayload);
  return false;
}

/**
 * Delete a tenant invoice from Supabase database
 */
export async function deleteTenantInvoice(
  invoiceNumber: string,
  meterName?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('tenant_invoices')
    .delete()
    .eq('invoice_number', invoiceNumber);

  if (meterName) {
    await supabase.from('tenant_meters').delete().eq('meter_name', meterName);
    await supabase.from('sensor_points').delete().eq('point_name', meterName);
  }

  if (error) {
    console.warn(`Warning deleting tenant_invoice ${invoiceNumber}:`, error.message);
    return false;
  }
  return true;
}

/**
 * Fetch Admin settings and credentials from Supabase
 */
export async function fetchAdminSettingsDb(): Promise<{ name: string; email: string; password?: string } | null> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      name: data.name,
      email: data.email,
      password: data.password,
    };
  } catch {
    return null;
  }
}

/**
 * Save or update Admin settings in Supabase
 */
export async function saveAdminSettingsDb(settings: { name: string; email: string; password?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: any = {
      id: 'admin_primary',
      name: settings.name,
      email: settings.email,
      updated_at: new Date().toISOString(),
    };
    if (settings.password) {
      payload.password = settings.password;
    }

    const { error } = await supabase.from('admin_settings').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Notice saving admin_settings to Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save admin settings to Supabase' };
  }
}

/**
 * Fetch all registered Client accounts from Supabase
 */
export async function fetchClientAccountsDb(): Promise<any[] | null> {
  try {
    const { data, error } = await supabase
      .from('client_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      username: d.username || d.email.split('@')[0],
      password: d.password,
      role: d.role,
      assignedTenant: d.assigned_tenant,
      assignedPoints: d.assigned_points || [],
      status: d.status,
      siteName: d.site_name || d.name,
      imageUrl: d.image_url || '/building_hq.jpg',
      locationAddress: d.location_address || 'Phnom Penh, Cambodia',
      mapUrl: d.map_url || '',
      createdAt: d.created_at,
    }));
  } catch {
    return null;
  }
}

/**
 * Save or update a Client account in Supabase
 */
export async function saveClientAccountDb(account: {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
  role: string;
  assignedTenant?: string;
  assignedPoints?: string[];
  status: string;
  siteName?: string;
  imageUrl?: string;
  locationAddress?: string;
  mapUrl?: string;
  createdAt?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: any = {
      id: account.id,
      name: account.name,
      email: account.email,
      username: account.username,
      password: account.password,
      role: account.role,
      assigned_tenant: account.assignedTenant,
      status: account.status,
      created_at: account.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (account.assignedPoints && account.assignedPoints.length > 0) {
      payload.assigned_points = account.assignedPoints;
    }
    if (account.siteName !== undefined) payload.site_name = account.siteName;
    if (account.imageUrl !== undefined) payload.image_url = account.imageUrl;
    if (account.locationAddress !== undefined) payload.location_address = account.locationAddress;
    if (account.mapUrl !== undefined) payload.map_url = account.mapUrl;

    const { error } = await supabase.from('client_accounts').upsert(payload, { onConflict: 'id' });
    if (error) {
      let fallbackNeeded = false;
      if (error.message.includes('assigned_points') || error.code === 'PGRST204') {
        delete payload.assigned_points;
        fallbackNeeded = true;
      }
      if (error.message.includes('site_name') || error.code === 'PGRST204') {
        delete payload.site_name;
        fallbackNeeded = true;
      }
      if (error.message.includes('image_url') || error.code === 'PGRST204') {
        delete payload.image_url;
        fallbackNeeded = true;
      }
      if (error.message.includes('location_address') || error.code === 'PGRST204') {
        delete payload.location_address;
        fallbackNeeded = true;
      }
      if (error.message.includes('map_url') || error.code === 'PGRST204') {
        delete payload.map_url;
        fallbackNeeded = true;
      }

      if (fallbackNeeded) {
        const { error: retryErr } = await supabase.from('client_accounts').upsert(payload, { onConflict: 'id' });
        if (retryErr) {
          console.warn('Notice saving client_account to Supabase fallback:', retryErr.message);
          return { success: false, error: retryErr.message };
        }
        return { success: true };
      }
      console.warn('Notice saving client_account to Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save client account to Supabase' };
  }
}

/**
 * Delete a Client account from Supabase
 */
export async function deleteClientAccountDb(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('client_accounts').delete().eq('id', id);
    if (error) {
      console.warn('Notice deleting client_account from Supabase:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync tenant name and email to Supabase client_accounts table.
 * Updates email if a matching client account exists; NEVER creates accounts automatically.
 */
export async function syncTenantClientAccount(tenantName: string, email: string): Promise<boolean> {
  if (!tenantName || !email || !email.includes('@')) return false;
  try {
    const cleanTenant = tenantName.trim();
    const cleanEmail = email.trim();

    const { data: accounts, error: fetchErr } = await supabase
      .from('client_accounts')
      .select('id, email, assigned_tenant');

    if (fetchErr) {
      console.warn('Notice querying client_accounts:', fetchErr.message);
      return false;
    }

    const match = (accounts || []).find((a: any) =>
      (a.assigned_tenant && a.assigned_tenant.toLowerCase() === cleanTenant.toLowerCase()) ||
      (a.email && a.email.toLowerCase() === cleanEmail.toLowerCase())
    );

    // Only update if account already exists - never resurrect deleted accounts!
    if (match) {
      const { error } = await supabase
        .from('client_accounts')
        .update({
          email: cleanEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id);
      return !error;
    }
    return false;
  } catch (err: any) {
    console.warn('Notice syncing tenant email to client_accounts:', err.message || err);
    return false;
  }
}

// ==============================================================================
// FACILITY / CLIENT SITE PROFILES DATABASE HELPERS
// ==============================================================================

export interface FacilityProfileDb {
  facility_name: string;
  site_name: string;
  image_url?: string | null;
  location_address?: string | null;
  map_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetch facility site profile from Supabase by facility name
 */
export async function fetchFacilityProfileDb(facilityName: string): Promise<FacilityProfileDb | null> {
  if (!facilityName) return null;
  try {
    const cleanName = facilityName.trim();
    // 1. First attempt to fetch from dedicated facility_profiles table
    const { data, error } = await supabase
      .from('facility_profiles')
      .select('*')
      .ilike('facility_name', cleanName)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as FacilityProfileDb;
    }

    // 2. If table not found or row missing, fall back to matching client_accounts
    const { data: clientData } = await supabase
      .from('client_accounts')
      .select('*')
      .or(`assigned_tenant.ilike.${cleanName},name.ilike.${cleanName}`)
      .limit(1)
      .maybeSingle();

    if (clientData) {
      return {
        facility_name: clientData.assigned_tenant || cleanName,
        site_name: clientData.site_name || clientData.name || cleanName,
        image_url: clientData.image_url || null,
        location_address: clientData.location_address || 'Phnom Penh, Cambodia',
        map_url: clientData.map_url || null,
        updated_at: clientData.updated_at,
      };
    }

    return null;
  } catch (err: any) {
    console.warn('Notice fetching facility profile:', err.message || err);
    return null;
  }
}

/**
 * Fetch all facility site profiles from Supabase
 */
export async function fetchAllFacilityProfilesDb(): Promise<FacilityProfileDb[]> {
  try {
    const { data, error } = await supabase
      .from('facility_profiles')
      .select('*')
      .order('facility_name', { ascending: true });

    if (error) {
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Save or update facility site profile in Supabase database.
 * Upserts to facility_profiles, and synchronizes matching client_accounts.
 */
export async function saveFacilityProfileDb(profile: {
  facility_name: string;
  site_name: string;
  image_url?: string;
  location_address?: string;
  map_url?: string;
  client_id?: string;
}): Promise<{ success: boolean; error?: string }> {
  const cleanFacility = profile.facility_name.trim();
  const cleanSite = profile.site_name.trim();
  const nowIso = new Date().toISOString();

  const payload: any = {
    facility_name: cleanFacility,
    site_name: cleanSite,
    image_url: profile.image_url || null,
    location_address: profile.location_address || 'Phnom Penh, Cambodia',
    map_url: profile.map_url || null,
    updated_at: nowIso,
  };

  let primarySuccess = false;
  let primaryError: string | undefined;

  try {
    // 1. Upsert to facility_profiles
    const { error: facErr } = await supabase
      .from('facility_profiles')
      .upsert(payload, { onConflict: 'facility_name' });

    if (!facErr) {
      primarySuccess = true;
    } else {
      primaryError = facErr.message;
      console.warn('Notice saving to facility_profiles in Supabase:', facErr.message);
    }
  } catch (err: any) {
    primaryError = err.message || 'Error saving facility profile';
  }

  // 2. Also sync client_accounts if this facility belongs to a registered client (by client_id or facility name)
  try {
    let clients: any[] | null = null;
    if (profile.client_id) {
      const { data } = await supabase
        .from('client_accounts')
        .select('id, assigned_tenant, name')
        .eq('id', profile.client_id);
      clients = data;
    }
    if (!clients || clients.length === 0) {
      const { data } = await supabase
        .from('client_accounts')
        .select('id, assigned_tenant, name')
        .or(`assigned_tenant.ilike.${cleanFacility},name.ilike.${cleanFacility}`);
      clients = data;
    }

    if (clients && clients.length > 0) {
      for (const client of clients) {
        // Attempt full update with site metadata
        const clientUpdate: any = {
          name: cleanSite,
          site_name: cleanSite,
          image_url: profile.image_url || null,
          location_address: profile.location_address || 'Phnom Penh, Cambodia',
          map_url: profile.map_url || null,
          updated_at: nowIso,
        };

        const { error: clientErr } = await supabase
          .from('client_accounts')
          .update(clientUpdate)
          .eq('id', client.id);

        if (clientErr) {
          // If columns site_name/image_url are not in schema yet, fallback to updating name & updated_at
          await supabase
            .from('client_accounts')
            .update({ name: cleanSite, updated_at: nowIso })
            .eq('id', client.id);
        }
      }
    }
  } catch (clientSyncErr) {
    console.warn('Notice updating matching client_accounts:', clientSyncErr);
  }

  return { success: primarySuccess, error: primaryError };
}



