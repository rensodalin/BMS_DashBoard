import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { SensorPoint, TenantInvoiceDb } from '../../types/bms';
import { exportToCsv } from '../../lib/exportCsv';
import { isBillingPoint } from '../../App';
import {
  fetchTenantInvoices,
  fetchUtilityRates,
  updateUtilityRate,
  upsertTenantInvoice,
  deleteTenantInvoice,
  fetchMeterReadingRange,
  fetchClientAccountsDb,
  syncTenantClientAccount,
  type MeterReadingRangeResult,
  supabase,
} from '../../lib/supabase';

import { BillingKpiGrid } from './BillingKpiGrid';
import { TenantInvoicesTable, calculateIntervalConsumption } from './TenantInvoicesTable';
import { AddTenantInvoiceModal } from './AddTenantInvoiceModal';
import { EditTenantInvoiceModal } from './EditTenantInvoiceModal';
import { TenantInvoiceSummaryModal } from './TenantInvoiceSummaryModal';
import { TenantMeterTrendModal } from './TenantMeterTrendModal';
import { SendAllInvoicesModal } from './SendAllInvoicesModal';
import { detectFloorFromPoint, getInvoiceFloor, sortFloorNames } from '../../lib/floorUtils';





const LOCAL_STORAGE_KEY = 'bms_tenant_invoice_overrides';
const CUSTOM_INVOICES_KEY = 'bms_custom_tenant_invoices_v1';

const loadSavedOverrides = (): Record<string, Partial<TenantInvoiceDb>> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Sanitize any historical mislabeled overrides
    let modified = false;
    for (const key of Object.keys(parsed)) {
      const entry = parsed[key];
      if (
        (key.includes('BEAN') || key === 'INV-2026-002') &&
        entry?.tenant_name?.toLowerCase().includes('bingo')
      ) {
        delete parsed[key];
        modified = true;
      }
      if (
        (key.includes('Brown') || key === 'INV-2026-004') &&
        entry?.tenant_name?.toLowerCase().includes('bingo')
      ) {
        delete parsed[key];
        modified = true;
      }
    }
    if (modified) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return {};
  }
};

const saveOverridesToStorage = (overrides: Record<string, Partial<TenantInvoiceDb>>) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(overrides));
  } catch { }
};

const loadSavedCustomInvoices = (): TenantInvoiceDb[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_INVOICES_KEY);
    if (!raw) return [];
    const list: TenantInvoiceDb[] = JSON.parse(raw);
    const seen = new Set<string>();
    return list.filter((inv) => {
      const k = getMeterIdentityKey(inv.meter_name, inv.tenant_name);
      if (seen.has(k) || (inv.invoice_number && seen.has(inv.invoice_number))) return false;
      seen.add(k);
      if (inv.invoice_number) seen.add(inv.invoice_number);
      return true;
    });
  } catch {
    return [];
  }
};

const saveCustomInvoicesToStorage = (invoices: TenantInvoiceDb[]) => {
  try {
    localStorage.setItem(CUSTOM_INVOICES_KEY, JSON.stringify(invoices));
  } catch { }
};

const formatIsoSecond = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const getMonthStartIso = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01T00:00:00`;
};

const getCurrentPeriodLabel = (d: Date = new Date()): string => {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const findLiveMeterPoint = (
  points: SensorPoint[],
  meterName?: string,
  tenantName?: string
): SensorPoint | undefined => {
  if (!points || points.length === 0) return undefined;

  const normalize = (s?: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[\s_\-$]+/g, '')
      .replace(/(consumption|consumptions|kwh|meter|facility|tenant)/gi, '');

  const targetMeter = (meterName || '').toLowerCase().trim();
  const targetTenant = (tenantName || '').toLowerCase().trim();

  // 1. Direct exact match on point_name
  let match = points.find(
    (p) =>
      p.point_name.toLowerCase() === targetMeter ||
      (Boolean(targetTenant) && p.point_name.toLowerCase() === targetTenant)
  );
  if (match) return match;

  // 2. Normalized core match (e.g. "koi" matches "koi_consumption" or "koi_kwh")
  const coreMeter = normalize(meterName);
  if (coreMeter) {
    match = points.find((p) => normalize(p.point_name) === coreMeter);
    if (match) return match;
  }

  // 3. Match using tenant name (e.g. tenant "Brown" matches "Brown_Consumption")
  const coreTenant = normalize(tenantName);
  if (coreTenant) {
    match = points.find((p) => normalize(p.point_name) === coreTenant);
    if (match) return match;
  }

  // 4. Substring inclusion
  if (coreMeter && coreMeter.length >= 3) {
    match = points.find((p) => {
      const pCore = normalize(p.point_name);
      return pCore.includes(coreMeter) || coreMeter.includes(pCore);
    });
    if (match) return match;
  }

  if (coreTenant && coreTenant.length >= 3) {
    match = points.find((p) => {
      const pCore = normalize(p.point_name);
      return pCore.includes(coreTenant) || coreTenant.includes(pCore);
    });
    if (match) return match;
  }

  return undefined;
};

export const getMeterIdentityKey = (meterName?: string, tenantName?: string): string => {
  const norm = (s?: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[\s_\-$]+/g, '')
      .replace(/(consumption|consumptions|kwh|meter|facility|tenant)/gi, '')
      .trim();

  let mKey = norm(meterName);
  if (!mKey) mKey = norm(tenantName) || 'unknown_meter';

  if (mKey === 'stabucks' || mKey === 'starbucks') return 'starbucks';
  if (mKey === 'asic' || mKey === 'asics') return 'asics';

  return mKey;
};

interface BillingWorkspaceProps {
  points?: SensorPoint[];
  selectedFloor?: string;
  onSelectFloor?: (floor: string) => void;
  availableFloors?: string[];
  isAddInvoiceOpen?: boolean;
  onCloseAddInvoice?: () => void;
  onOpenAddPoint?: () => void;
}

export const BillingWorkspace: React.FC<BillingWorkspaceProps> = ({
  points = [],
  selectedFloor = 'ALL',
  onSelectFloor,
  availableFloors = [],
  isAddInvoiceOpen: externalIsAddOpen,
  onCloseAddInvoice: externalOnCloseAdd,
  onOpenAddPoint,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [ratePerKwh, setRatePerKwh] = useState<number>(0.155);

  // Independent floor selection for billing workspace
  const [billingSelectedFloor, setBillingSelectedFloor] = useState<string>(selectedFloor || 'ALL');

  useEffect(() => {
    if (selectedFloor !== undefined) {
      setBillingSelectedFloor(selectedFloor);
    }
  }, [selectedFloor]);

  const handleSelectFloor = (fl: string) => {
    setBillingSelectedFloor(fl);
    if (onSelectFloor) {
      onSelectFloor(fl);
    }
  };
  const [dbInvoices, setDbInvoices] = useState<TenantInvoiceDb[]>([]);
  const [customInvoices, setCustomInvoices] = useState<TenantInvoiceDb[]>(loadSavedCustomInvoices);
  const [invoiceOverrides, setInvoiceOverrides] = useState<Record<string, Partial<TenantInvoiceDb>>>(loadSavedOverrides);
  const [clientAccounts, setClientAccounts] = useState<any[]>([]);

  // Global Date Range Filter state (Defaults to current month from 1st to live second)
  const [startDate, setStartDate] = useState(() => getMonthStartIso());
  const [endDate, setEndDate] = useState(() => formatIsoSecond());
  const [intervalDataMap, setIntervalDataMap] = useState<Record<string, MeterReadingRangeResult>>({});

  // Modals state
  const [isInternalAddOpen, setIsInternalAddOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<TenantInvoiceDb | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<TenantInvoiceDb | null>(null);
  const [trendingInvoice, setTrendingInvoice] = useState<TenantInvoiceDb | null>(null);
  const [isSendAllOpen, setIsSendAllOpen] = useState(false);


  const isAddModalOpen = externalIsAddOpen !== undefined ? externalIsAddOpen : isInternalAddOpen;
  const handleCloseAddModal = externalOnCloseAdd || (() => setIsInternalAddOpen(false));

  // Load utility rate, tenant invoices & client accounts from Supabase
  useEffect(() => {
    loadBillingDbData();

    // Supabase Realtime Subscription for tenant invoices & client accounts
    const invoiceChannel = supabase
      .channel('realtime_billing_invoices')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenant_invoices' },
        () => {
          loadBillingDbData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_accounts' },
        () => {
          loadBillingDbData();
        }
      )
      .subscribe();

    // Continuous 1-second interval to ensure real-time telemetry updates match the dashboard
    const liveInterval = setInterval(() => {
      loadBillingDbData();
    }, 1000);

    return () => {
      clearInterval(liveInterval);
      supabase.removeChannel(invoiceChannel);
    };
  }, []);

  const loadBillingDbData = async () => {
    const rateData = await fetchUtilityRates();
    if (rateData && rateData.rate_per_kwh) {
      setRatePerKwh(rateData.rate_per_kwh);
    }

    const invData = await fetchTenantInvoices();
    if (invData && invData.length > 0) {
      setDbInvoices(invData);
    }

    const clients = await fetchClientAccountsDb();
    if (clients && clients.length > 0) {
      setClientAccounts(clients);
    }
  };

  // Handle user changing rate per kWh
  const handleRateChange = (newRate: number) => {
    setRatePerKwh(newRate);
    updateUtilityRate(newRate);
  };

  // Extract live tenant points from Niagara telemetry
  const telemetryTenantInvoices = useMemo<TenantInvoiceDb[]>(() => {
    const tenantPoints = points.filter((p) => isBillingPoint(p));
    if (tenantPoints.length === 0) return [];

    // Sort stably so rows stay fixed and never jump around when telemetry updates
    const sortedPoints = [...tenantPoints].sort((a, b) =>
      a.point_name.localeCompare(b.point_name)
    );

    return sortedPoints.map((p, index) => {
      const cleanName = p.point_name
        .replace(/(_consumptions|_consumption|_kwh)/gi, '')
        .replace(/^Tenant_?/i, '')
        .replace(/\$20/g, ' ')
        .replace(/_/g, ' ')
        .trim();

      const tenantTitle = cleanName ? `${cleanName} Facility` : 'Tenant Facility';
      const kwh = Number(p.current_value.toFixed(2));
      const invNum = `INV-2026-${String(index + 1).padStart(3, '0')}`;

      // Look up overrides by meter name first, or invoice number if matching
      const overrideByMeter = invoiceOverrides[p.point_name];
      const overrideByInv = invoiceOverrides[invNum];
      const override = { ...(overrideByMeter || {}), ...(overrideByInv || {}) };

      // Validate tenant name against meter
      let tenantName = tenantTitle;
      if (override.tenant_name) {
        if (overrideByMeter || (override.meter_name && override.meter_name === p.point_name)) {
          tenantName = override.tenant_name;
        } else {
          const core = cleanName.toLowerCase();
          if (override.tenant_name.toLowerCase().includes(core)) {
            tenantName = override.tenant_name;
          }
        }
      }

      const demand = override.demand_charge !== undefined ? override.demand_charge : 25.0;
      const totalUsd = Number((kwh * ratePerKwh).toFixed(2));
      const totalKhr = Number((totalUsd * 4100).toFixed(2));

      // Match tenant email from client_accounts if not set in overrides
      const clientMatch = clientAccounts.find((c: any) => {
        const assigned = (c.assignedTenant || c.name || '').toLowerCase().trim();
        const tLower = tenantName.toLowerCase().trim();
        return assigned === tLower || tLower.includes(assigned) || assigned.includes(tLower);
      });
      const resolvedEmail = override.tenant_email !== undefined ? override.tenant_email : (clientMatch?.email || '');

      return {
        id: invNum,
        invoice_number: invNum,
        tenant_name: tenantName,
        tenant_email: resolvedEmail,
        unit_zone: override.unit_zone || `${detectFloorFromPoint(p)} - Suite ${101 + index}`,
        meter_name: p.point_name,
        kwh_reading: kwh,
        rate_per_kwh: ratePerKwh,
        demand_charge: demand,
        total_cost_usd: totalUsd,
        total_cost_khr: totalKhr,
        start_date: override.start_date || startDate || getMonthStartIso(),
        end_date: override.end_date || endDate || formatIsoSecond(),
        billing_period: override.billing_period || getCurrentPeriodLabel(),
        status: (override.status || (index % 3 === 0 ? 'PAID' : index % 3 === 1 ? 'PENDING' : 'OVERDUE')) as 'PAID' | 'PENDING' | 'OVERDUE',
      };
    });
  }, [points, ratePerKwh, startDate, endDate, invoiceOverrides, clientAccounts]);

  const liveKwh = telemetryTenantInvoices.length > 0 ? telemetryTenantInvoices[0].kwh_reading : 1075.0;

  // Active Tenant Billing Ledger computed dynamically: combines live telemetry, Supabase db, and custom added invoices
  // Uses canonical getMeterIdentityKey to guarantee each physical or logical meter only has ONE row in the ledger
  const tenantInvoices: TenantInvoiceDb[] = useMemo(() => {
    const invoiceMap = new Map<string, TenantInvoiceDb>();

    const findClientEmail = (tName: string) => {
      if (!tName || !clientAccounts || clientAccounts.length === 0) return '';
      const clean = tName.toLowerCase().trim();
      const match = clientAccounts.find((c: any) => {
        const assigned = (c.assignedTenant || c.name || '').toLowerCase().trim();
        return assigned === clean || clean.includes(assigned) || assigned.includes(clean);
      });
      return match?.email || '';
    };

    // 1. Seed with telemetry tenant points from live Niagara discovery
    for (const telInv of telemetryTenantInvoices) {
      const key = getMeterIdentityKey(telInv.meter_name, telInv.tenant_name);
      invoiceMap.set(key, telInv);
    }

    // 2. Merge Supabase dbInvoices if available
    for (const dbInv of dbInvoices) {
      const key = getMeterIdentityKey(dbInv.meter_name, dbInv.tenant_name);
      const liveMatch = findLiveMeterPoint(points, dbInv.meter_name, dbInv.tenant_name);
      const kwh = liveMatch ? Number(liveMatch.current_value.toFixed(2)) : dbInv.kwh_reading;
      const override = {
        ...(invoiceOverrides[dbInv.meter_name] || {}),
        ...(invoiceOverrides[dbInv.invoice_number] || {}),
        ...(invoiceOverrides[key] || {}),
      };
      let tName = dbInv.tenant_name;
      if (override.tenant_name) {
        const coreMeter = dbInv.meter_name.toLowerCase().replace(/(_consumption|_consumptions|_kwh)/g, '').trim();
        if (
          invoiceOverrides[dbInv.meter_name]?.tenant_name ||
          override.tenant_name.toLowerCase().includes(coreMeter) ||
          coreMeter.includes(override.tenant_name.toLowerCase())
        ) {
          tName = override.tenant_name;
        }
      }
      const tEmail = override.tenant_email !== undefined
        ? override.tenant_email
        : (dbInv.tenant_email || findClientEmail(tName));

      // Synchronize unit_zone with actual live point floor if not manually overridden by user
      const liveFloor = liveMatch ? detectFloorFromPoint(liveMatch) : '';
      let resolvedUnitZone = override.unit_zone || dbInv.unit_zone;
      if (!override.unit_zone && liveFloor) {
        if (!resolvedUnitZone || !resolvedUnitZone.startsWith(liveFloor)) {
          const suitePart = resolvedUnitZone && resolvedUnitZone.includes('Suite')
            ? resolvedUnitZone.substring(resolvedUnitZone.indexOf('Suite'))
            : 'Suite 101';
          resolvedUnitZone = `${liveFloor} - ${suitePart}`;
        }
      }

      const demand = override.demand_charge !== undefined ? override.demand_charge : dbInv.demand_charge;
      const totalUsd = Number((kwh * ratePerKwh).toFixed(2));

      const merged: TenantInvoiceDb = {
        ...dbInv,
        tenant_name: tName,
        tenant_email: tEmail,
        unit_zone: resolvedUnitZone,
        kwh_reading: kwh,
        rate_per_kwh: ratePerKwh,
        demand_charge: demand,
        total_cost_usd: totalUsd,
        total_cost_khr: Number((totalUsd * 4100).toFixed(2)),
        start_date: override.start_date || dbInv.start_date || startDate || getMonthStartIso(),
        end_date: override.end_date || dbInv.end_date || endDate || formatIsoSecond(),
        billing_period: override.billing_period || dbInv.billing_period || getCurrentPeriodLabel(),
        status: (override.status || dbInv.status) as 'PAID' | 'PENDING' | 'OVERDUE',
      };
      invoiceMap.set(key, merged);
    }

    // 3. Merge custom user-added invoices (HIGHEST PRIORITY: updates/replaces automatic telemetry row)
    for (const custInv of customInvoices) {
      const key = getMeterIdentityKey(custInv.meter_name, custInv.tenant_name);
      const liveMatch = findLiveMeterPoint(points, custInv.meter_name, custInv.tenant_name);
      const kwh = liveMatch ? Number(liveMatch.current_value.toFixed(2)) : custInv.kwh_reading;
      const override = {
        ...(invoiceOverrides[custInv.meter_name] || {}),
        ...(invoiceOverrides[custInv.invoice_number] || {}),
        ...(invoiceOverrides[key] || {}),
      };
      const demand = override.demand_charge !== undefined ? override.demand_charge : custInv.demand_charge;
      const totalUsd = Number((kwh * ratePerKwh).toFixed(2));
      const tName = override.tenant_name || custInv.tenant_name;
      const tEmail = override.tenant_email !== undefined
        ? override.tenant_email
        : (custInv.tenant_email || findClientEmail(tName));

      const merged: TenantInvoiceDb = {
        ...custInv,
        tenant_name: tName,
        tenant_email: tEmail,
        unit_zone: override.unit_zone || custInv.unit_zone,
        meter_name: custInv.meter_name,
        kwh_reading: kwh,
        rate_per_kwh: ratePerKwh,
        demand_charge: demand,
        total_cost_usd: totalUsd,
        total_cost_khr: Number((totalUsd * 4100).toFixed(2)),
        start_date: override.start_date || custInv.start_date || startDate || getMonthStartIso(),
        end_date: override.end_date || custInv.end_date || endDate || formatIsoSecond(),
        billing_period: override.billing_period || custInv.billing_period || getCurrentPeriodLabel(),
        status: (override.status || custInv.status) as 'PAID' | 'PENDING' | 'OVERDUE',
      };
      invoiceMap.set(key, merged);
    }

    // Strictly deduplicate by physical meter key (guarantees every physical meter gets a row)
    const meterList = Array.from(invoiceMap.values());

    // Ensure every invoice has a clean, unique invoice number without collisions
    const usedInvNums = new Set<string>();
    const result: TenantInvoiceDb[] = [];

    meterList.forEach((inv, index) => {
      let invNum = inv.invoice_number;
      if (!invNum || usedInvNums.has(invNum)) {
        let counter = index + 1;
        invNum = `INV-2026-${String(counter).padStart(3, '0')}`;
        while (usedInvNums.has(invNum)) {
          counter++;
          invNum = `INV-2026-${String(counter).padStart(3, '0')}`;
        }
      }
      usedInvNums.add(invNum);
      result.push({
        ...inv,
        invoice_number: invNum,
      });
    });

    // Sort stably by meter_name
    return result.sort((a, b) => a.meter_name.localeCompare(b.meter_name));
  }, [telemetryTenantInvoices, dbInvoices, customInvoices, points, ratePerKwh, invoiceOverrides, startDate, endDate, clientAccounts]);

  // Auto-sync discovered tenants to Supabase (once per invoice_number per session)
  const syncedInvoicesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (tenantInvoices.length === 0) return;
    const toSync = tenantInvoices.filter(
      (inv) => !syncedInvoicesRef.current.has(inv.invoice_number)
    );
    if (toSync.length === 0) return;

    // Mark as synced immediately to avoid duplicate calls
    toSync.forEach((inv) => syncedInvoicesRef.current.add(inv.invoice_number));

    // Fire-and-forget upserts for all un-synced tenants
    toSync.forEach((inv) => {
      upsertTenantInvoice(inv).catch((err) =>
        console.warn('Auto-sync upsert error for', inv.invoice_number, err)
      );
      if (inv.tenant_email) {
        syncTenantClientAccount(inv.tenant_name, inv.tenant_email).catch(() => { });
      }
    });
  }, [tenantInvoices]);

  // Synchronously fetch and maintain live interval telemetry readings for all tenant meters
  const fetchAllIntervals = useCallback(
    async (customStart?: string, customEnd?: string) => {
      if (!tenantInvoices || tenantInvoices.length === 0) return;
      try {
        const results: Record<string, MeterReadingRangeResult> = {};
        await Promise.all(
          tenantInvoices.map(async (inv) => {
            const start = customStart || inv.start_date || startDate;
            const end = customEnd || inv.end_date || endDate;
            if (!start || !end) return;
            const liveMatch = findLiveMeterPoint(points, inv.meter_name, inv.tenant_name);
            const meter = liveMatch ? liveMatch.point_name : (inv.meter_name || inv.tenant_name);
            const res = await fetchMeterReadingRange(meter, start, end);
            results[inv.invoice_number] = res;
          })
        );
        setIntervalDataMap((prev) => ({ ...prev, ...results }));
      } catch (err) {
        console.warn('Error fetching meter reading range interval:', err);
      }
    },
    [tenantInvoices, startDate, endDate, points]
  );

  useEffect(() => {
    fetchAllIntervals();
    const interval = setInterval(() => {
      fetchAllIntervals();
    }, 5000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchAllIntervals]);

  // Handle adding an invoice successfully
  const handleAddInvoiceSuccess = (newInv?: TenantInvoiceDb) => {
    if (newInv) {
      if (newInv.tenant_email) {
        syncTenantClientAccount(newInv.tenant_name, newInv.tenant_email).catch(() => { });
      }
      const newKey = getMeterIdentityKey(newInv.meter_name, newInv.tenant_name);
      setCustomInvoices((prev) => {
        // Remove any prior entry matching the same meter identity or invoice_number
        const filtered = prev.filter((i) => {
          const iKey = getMeterIdentityKey(i.meter_name, i.tenant_name);
          return iKey !== newKey && i.invoice_number !== newInv.invoice_number;
        });
        const next = [newInv, ...filtered];
        saveCustomInvoicesToStorage(next);
        return next;
      });

      setInvoiceOverrides((prev) => {
        const next = {
          ...prev,
          [newInv.invoice_number]: newInv,
          [newInv.meter_name]: newInv,
          [newKey]: newInv,
        };
        saveOverridesToStorage(next);
        return next;
      });
    }
    loadBillingDbData();
  };

  // Update specific date for a tenant invoice and persist permanently
  const handleUpdateInvoiceDate = async (
    invoiceNumber: string,
    field: 'start_date' | 'end_date',
    value: string
  ) => {
    const target = tenantInvoices.find((i) => i.invoice_number === invoiceNumber);
    const meterName = target?.meter_name;
    const identityKey = target ? getMeterIdentityKey(target.meter_name, target.tenant_name) : '';

    // 1. Immediately update and save overrides to localStorage for all 3 lookup keys
    setInvoiceOverrides((prev) => {
      const next = { ...prev };
      const updateObj = (existing?: Partial<TenantInvoiceDb>) => ({
        ...(existing || {}),
        [field]: value,
      });

      if (invoiceNumber) next[invoiceNumber] = updateObj(prev[invoiceNumber]);
      if (meterName) next[meterName] = updateObj(prev[meterName]);
      if (identityKey) next[identityKey] = updateObj(prev[identityKey]);

      saveOverridesToStorage(next);
      return next;
    });

    // 2. Update customInvoices state if present
    setCustomInvoices((prev) => {
      const next = prev.map((inv) =>
        inv.invoice_number === invoiceNumber || (meterName && inv.meter_name === meterName)
          ? { ...inv, [field]: value }
          : inv
      );
      saveCustomInvoicesToStorage(next);
      return next;
    });

    // 3. Update dbInvoices state if present
    setDbInvoices((prev) =>
      prev.map((inv) =>
        inv.invoice_number === invoiceNumber || (meterName && inv.meter_name === meterName)
          ? { ...inv, [field]: value }
          : inv
      )
    );

    // 4. Persist to Supabase
    if (target) {
      await upsertTenantInvoice({ ...target, [field]: value });
    }
  };

  // Save updated tenant invoice from Edit modal and persist permanently
  const handleSaveUpdatedInvoice = async (updated: TenantInvoiceDb) => {
    const identityKey = getMeterIdentityKey(updated.meter_name, updated.tenant_name);

    // 1. Immediately update and save overrides to localStorage keyed by meter_name, invoice_number, and identity key
    setInvoiceOverrides((prev) => {
      const record = {
        ...(prev[updated.meter_name] || prev[updated.invoice_number] || prev[identityKey] || {}),
        tenant_name: updated.tenant_name,
        tenant_email: updated.tenant_email,
        unit_zone: updated.unit_zone,
        meter_name: updated.meter_name,
        start_date: updated.start_date,
        end_date: updated.end_date,
        billing_period: updated.billing_period,
        status: updated.status,
        demand_charge: updated.demand_charge,
      };
      const next = {
        ...prev,
        [updated.meter_name]: record,
        [updated.invoice_number]: record,
        [identityKey]: record,
      };
      saveOverridesToStorage(next);
      return next;
    });

    // 2. Update customInvoices state
    setCustomInvoices((prev) => {
      const next = prev.map((inv) =>
        inv.invoice_number === updated.invoice_number || inv.meter_name === updated.meter_name ? updated : inv
      );
      saveCustomInvoicesToStorage(next);
      return next;
    });

    // 3. Update dbInvoices state
    setDbInvoices((prev) =>
      prev.map((inv) =>
        inv.invoice_number === updated.invoice_number || inv.meter_name === updated.meter_name ? updated : inv
      )
    );

    // 4. Persist to Supabase
    await upsertTenantInvoice(updated);
    if (updated.tenant_email) {
      await syncTenantClientAccount(updated.tenant_name, updated.tenant_email);
    }
  };

  // Delete a tenant invoice from DB and active state
  const handleDeleteInvoice = async (invoice: TenantInvoiceDb) => {
    const delKey = getMeterIdentityKey(invoice.meter_name, invoice.tenant_name);
    setInvoiceOverrides((prev) => {
      const next = { ...prev };
      delete next[invoice.invoice_number];
      delete next[invoice.meter_name];
      delete next[delKey];
      saveOverridesToStorage(next);
      return next;
    });

    setCustomInvoices((prev) => {
      const next = prev.filter((i) => {
        const iKey = getMeterIdentityKey(i.meter_name, i.tenant_name);
        return iKey !== delKey && i.invoice_number !== invoice.invoice_number && i.meter_name !== invoice.meter_name;
      });
      saveCustomInvoicesToStorage(next);
      return next;
    });

    setDbInvoices((prev) => prev.filter((i) => i.invoice_number !== invoice.invoice_number));

    await deleteTenantInvoice(invoice.invoice_number, invoice.meter_name);
  };


  // Filtered invoices logic
  const filteredInvoices = useMemo(() => {
    return tenantInvoices.filter((inv) => {
      // 1. Filter by Selected Building Floor Scope for Billing (completely isolated from Dashboard)
      if (billingSelectedFloor && billingSelectedFloor !== 'ALL') {
        const invFloor = getInvoiceFloor(inv, points);
        if (invFloor !== billingSelectedFloor) return false;
      }

      // 2. Search query match
      const search = searchQuery.toLowerCase().trim();
      const matchSearch =
        !search ||
        inv.tenant_name.toLowerCase().includes(search) ||
        inv.meter_name.toLowerCase().includes(search) ||
        inv.unit_zone.toLowerCase().includes(search) ||
        inv.invoice_number.toLowerCase().includes(search);

      if (!matchSearch) return false;
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;

      return true;
    });
  }, [tenantInvoices, searchQuery, statusFilter, billingSelectedFloor, points]);

  // Dynamic available floors for billing: combine prop floors and floors from active tenant invoices & points
  const computedAvailableFloors = useMemo(() => {
    const set = new Set<string>(availableFloors || []);
    points.forEach((p) => {
      const fl = detectFloorFromPoint(p);
      if (fl) set.add(fl);
    });
    tenantInvoices.forEach((inv) => {
      const fl = getInvoiceFloor(inv, points);
      if (fl) set.add(fl);
    });
    return sortFloorNames(Array.from(set));
  }, [availableFloors, points, tenantInvoices]);

  // Summary Metrics calculated dynamically based on selected Date Range (end_date − start_date) interval consumption for all tenants
  const { totalBilled, totalKwh } = useMemo(() => {
    let billedSum = 0;
    let kwhSum = 0;

    for (const inv of filteredInvoices) {
      const intervalInfo = intervalDataMap[inv.invoice_number];
      const { kwh } = calculateIntervalConsumption(
        inv.kwh_reading,
        inv.start_date || startDate,
        inv.end_date || endDate,
        intervalInfo
      );
      kwhSum += kwh;
      billedSum += kwh * (inv.rate_per_kwh || ratePerKwh);
    }

    return {
      totalBilled: Number(billedSum.toFixed(2)),
      totalKwh: Number(kwhSum.toFixed(2)),
    };
  }, [filteredInvoices, startDate, endDate, intervalDataMap, ratePerKwh]);

  // Export Invoices CSV with Calculated Consumption (End Hour − Start Hour)
  const handleExportInvoices = async () => {
    const headers = [
      'Invoice Number',
      'Tenant Name',
      'Unit / Zone',
      'oBIX Meter Name',
      'Start Date & Time',
      'End Date & Time',
      'Interval Duration',
      'Start Reading (kWh)',
      'End Reading (kWh)',
      'Calculated Consumption (End Hour − Start Hour kWh)',
      'Tariff Rate ($/kWh)',
      'Demand Charge ($)',
      'Accrued Cost ($)',
      'Total Amount ($)',
      'Total Amount (KHR)',
      'Payment Status',
    ];

    const rows = await Promise.all(
      filteredInvoices.map(async (inv) => {
        const start = inv.start_date || startDate;
        const end = inv.end_date || endDate;
        const liveMatch = findLiveMeterPoint(points, inv.meter_name, inv.tenant_name);
        const meter = liveMatch ? liveMatch.point_name : (inv.meter_name || inv.tenant_name);
        const rangeResult = start && end ? await fetchMeterReadingRange(meter, start, end) : undefined;

        const {
          kwh: calcKwh,
          durationText,
          startReading,
          endReading,
        } = calculateIntervalConsumption(
          inv.kwh_reading,
          start,
          end,
          rangeResult
        );

        const accruedCost = Number((calcKwh * inv.rate_per_kwh).toFixed(2));
        const totalAmountUsd = Number((calcKwh * inv.rate_per_kwh).toFixed(2));
        const totalAmountKhr = Number((totalAmountUsd * 4100).toFixed(2));

        return [
          inv.invoice_number,
          inv.tenant_name,
          inv.unit_zone,
          inv.meter_name,
          start || 'N/A',
          end || 'N/A',
          durationText,
          startReading !== null ? startReading.toFixed(2) : 'N/A',
          endReading !== null ? endReading.toFixed(2) : inv.kwh_reading.toFixed(2),
          calcKwh.toFixed(3),
          `$${inv.rate_per_kwh.toFixed(4)}`,
          `$${inv.demand_charge.toFixed(2)}`,
          `$${accruedCost.toFixed(2)}`,
          `$${totalAmountUsd.toFixed(2)}`,
          `${totalAmountKhr.toLocaleString()} KHR`,
          inv.status,
        ];
      })
    );

    exportToCsv(
      `BMS_Tenant_Utility_Billing_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };


  // Open the Send All Tenant Invoices batch dispatcher modal
  const handleSendInvoicesToAll = () => {
    setIsSendAllOpen(true);
  };

  // Update tenant billing email directly from the Send All modal
  const handleUpdateTenantEmail = async (invoiceNumber: string, email: string) => {
    const targetInv = tenantInvoices.find((i) => i.invoice_number === invoiceNumber);
    const meterKey = targetInv?.meter_name || '';
    const identityKey = targetInv ? getMeterIdentityKey(targetInv.meter_name, targetInv.tenant_name) : '';

    setInvoiceOverrides((prev) => {
      const next = {
        ...prev,
        [invoiceNumber]: { ...(prev[invoiceNumber] || {}), tenant_email: email },
      };
      if (meterKey) {
        next[meterKey] = { ...(prev[meterKey] || {}), tenant_email: email };
      }
      if (identityKey) {
        next[identityKey] = { ...(prev[identityKey] || {}), tenant_email: email };
      }
      saveOverridesToStorage(next);
      return next;
    });

    setCustomInvoices((prev) => {
      const next = prev.map((inv) =>
        inv.invoice_number === invoiceNumber ? { ...inv, tenant_email: email } : inv
      );
      saveCustomInvoicesToStorage(next);
      return next;
    });

    setDbInvoices((prev) =>
      prev.map((inv) =>
        inv.invoice_number === invoiceNumber ? { ...inv, tenant_email: email } : inv
      )
    );

    if (targetInv) {
      await upsertTenantInvoice({ ...targetInv, tenant_email: email });
      if (email) {
        await syncTenantClientAccount(targetInv.tenant_name, email);
      }
    }
  };

  // Apply same Start & End Date/Time to all tenant invoices
  const handleApplyDatesToAll = async (start: string, end: string) => {
    const cleanStart = start ? start.replace(' ', 'T') : '';
    const cleanEnd = end ? end.replace(' ', 'T') : '';
    setStartDate(cleanStart);
    setEndDate(cleanEnd);

    // 1. Update invoiceOverrides for all keys (invoice_number, meter_name, and identityKey)
    setInvoiceOverrides((prev) => {
      const next: Record<string, Partial<TenantInvoiceDb>> = {};
      // Preserve existing non-date overrides, but update start_date & end_date across all existing keys
      Object.entries(prev).forEach(([k, v]) => {
        next[k] = {
          ...v,
          start_date: cleanStart,
          end_date: cleanEnd,
        };
      });

      // Ensure every invoice in tenantInvoices is explicitly updated under invoice_number, meter_name, and identityKey
      tenantInvoices.forEach((inv) => {
        const idKey = getMeterIdentityKey(inv.meter_name, inv.tenant_name);
        const updateDates = (existing?: Partial<TenantInvoiceDb>) => ({
          ...(existing || {}),
          start_date: cleanStart,
          end_date: cleanEnd,
        });

        if (inv.invoice_number) next[inv.invoice_number] = updateDates(next[inv.invoice_number]);
        if (inv.meter_name) next[inv.meter_name] = updateDates(next[inv.meter_name]);
        if (idKey) next[idKey] = updateDates(next[idKey]);
      });

      saveOverridesToStorage(next);
      return next;
    });

    // 2. Update customInvoices state and storage
    setCustomInvoices((prev) => {
      const updated = prev.map((inv) => ({
        ...inv,
        start_date: cleanStart,
        end_date: cleanEnd,
      }));
      saveCustomInvoicesToStorage(updated);
      return updated;
    });

    // 3. Update dbInvoices state
    setDbInvoices((prev) =>
      prev.map((inv) => ({
        ...inv,
        start_date: cleanStart,
        end_date: cleanEnd,
      }))
    );

    // 4. Persist all tenant invoices to Supabase
    for (const inv of tenantInvoices) {
      await upsertTenantInvoice({
        ...inv,
        start_date: cleanStart,
        end_date: cleanEnd,
      });
    }

    // 5. Immediately trigger interval telemetry calculation for all meters
    fetchAllIntervals(cleanStart, cleanEnd);
  };


  return (
    <div className="flex-1 flex flex-col space-y-4 w-full animate-fadeIn">
      {/* Summary KPI Cards Grid (Honeywell Forge status card style) */}
      <BillingKpiGrid
        totalBilled={totalBilled}
        totalKwh={totalKwh}
        liveKwh={liveKwh}
        ratePerKwh={ratePerKwh}
        tenantInvoices={filteredInvoices}
      />

      {/* Tenant Invoices Data Table with integrated rate control & action toolbar */}
      <TenantInvoicesTable
        invoices={filteredInvoices}
        allInvoices={tenantInvoices}
        points={points}
        selectedFloor={billingSelectedFloor}
        onSelectFloor={handleSelectFloor}
        availableFloors={computedAvailableFloors}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        startDate={startDate}
        endDate={endDate}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onExportInvoices={handleExportInvoices}
        onOpenAddPoint={onOpenAddPoint}
        onOpenEditInvoice={(inv) => setEditingInvoice(inv)}
        onViewInvoice={(inv) => setViewingInvoice(inv)}
        onSelectTenantTrend={(inv) => setTrendingInvoice(inv)}
        onDeleteInvoice={handleDeleteInvoice}
        onUpdateInvoiceDate={handleUpdateInvoiceDate}
        onApplyDatesToAll={handleApplyDatesToAll}
        onSendAllInvoices={handleSendInvoicesToAll}
        ratePerKwh={ratePerKwh}
        onRateChange={handleRateChange}
        intervalDataMap={intervalDataMap}
      />



      {/* Add Billing Sub-Meter & Tenant Invoice Modal */}

      <AddTenantInvoiceModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        onSuccess={handleAddInvoiceSuccess}
        ratePerKwh={ratePerKwh}
        existingCount={tenantInvoices.length}
        points={points}
        existingInvoices={tenantInvoices}
      />

      {/* Edit Tenant Billing Dates & Details Modal */}
      <EditTenantInvoiceModal
        isOpen={!!editingInvoice}
        invoice={editingInvoice}
        ratePerKwh={ratePerKwh}
        onClose={() => setEditingInvoice(null)}
        onSuccess={handleSaveUpdatedInvoice}
      />

      {/* Exact Tenant Bill Summary Document Modal (Printable & Exportable) */}
      <TenantInvoiceSummaryModal
        isOpen={!!viewingInvoice}
        invoice={viewingInvoice}
        ratePerKwh={ratePerKwh}
        onClose={() => setViewingInvoice(null)}
      />

      {/* Real-time Tenant Sub-Meter Energy Consumption Trend Modal */}
      <TenantMeterTrendModal
        isOpen={!!trendingInvoice}
        invoice={trendingInvoice}
        ratePerKwh={ratePerKwh}
        onClose={() => setTrendingInvoice(null)}
      />

      {/* Send All Tenant Invoices by Email Modal (Dynamically Formatted per Tenant) */}
      <SendAllInvoicesModal
        isOpen={isSendAllOpen}
        invoices={filteredInvoices}
        startDate={startDate}
        endDate={endDate}
        ratePerKwh={ratePerKwh}
        intervalDataMap={intervalDataMap}
        onClose={() => setIsSendAllOpen(false)}
        onUpdateTenantEmail={handleUpdateTenantEmail}
        onViewInvoice={(inv: TenantInvoiceDb) => setViewingInvoice(inv)}
      />

    </div>
  );
};

export default BillingWorkspace;




