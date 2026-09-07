import React, { useState, useEffect, useMemo } from 'react';
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
  supabase,
} from '../../lib/supabase';

import { BillingHeaderBanner } from './BillingHeaderBanner';
import { TariffRateCalculator } from './TariffRateCalculator';
import { BillingKpiGrid } from './BillingKpiGrid';
import { TenantInvoicesTable, calculateIntervalConsumption } from './TenantInvoicesTable';
import { AddTenantInvoiceModal } from './AddTenantInvoiceModal';
import { EditTenantInvoiceModal } from './EditTenantInvoiceModal';
import { TenantInvoiceSummaryModal } from './TenantInvoiceSummaryModal';
import { TenantMeterTrendModal } from './TenantMeterTrendModal';





const LOCAL_STORAGE_KEY = 'bms_tenant_invoice_overrides';

const loadSavedOverrides = (): Record<string, Partial<TenantInvoiceDb>> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveOverridesToStorage = (overrides: Record<string, Partial<TenantInvoiceDb>>) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(overrides));
  } catch {}
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

interface BillingWorkspaceProps {
  points?: SensorPoint[];
  isAddInvoiceOpen?: boolean;
  onCloseAddInvoice?: () => void;
}

export const BillingWorkspace: React.FC<BillingWorkspaceProps> = ({
  points = [],
  isAddInvoiceOpen: externalIsAddOpen,
  onCloseAddInvoice: externalOnCloseAdd,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [ratePerKwh, setRatePerKwh] = useState<number>(0.155);
  const [dbInvoices, setDbInvoices] = useState<TenantInvoiceDb[]>([]);
  const [invoiceOverrides, setInvoiceOverrides] = useState<Record<string, Partial<TenantInvoiceDb>>>(loadSavedOverrides);
  const [dbConnected, setDbConnected] = useState(false);

  // Global Date Range Filter state (Defaults to current month from 1st to live second)
  const [startDate, setStartDate] = useState(() => getMonthStartIso());
  const [endDate, setEndDate] = useState(() => formatIsoSecond());

  // Modals state
  const [isInternalAddOpen, setIsInternalAddOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<TenantInvoiceDb | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<TenantInvoiceDb | null>(null);
  const [trendingInvoice, setTrendingInvoice] = useState<TenantInvoiceDb | null>(null);


  const isAddModalOpen = externalIsAddOpen !== undefined ? externalIsAddOpen : isInternalAddOpen;
  const handleCloseAddModal = externalOnCloseAdd || (() => setIsInternalAddOpen(false));
  const handleOpenAddModal = () => setIsInternalAddOpen(true);

  // Load utility rate & tenant invoices from Supabase
  useEffect(() => {
    loadBillingDbData();

    // Supabase Realtime Subscription for tenant invoices
    const invoiceChannel = supabase
      .channel('realtime_billing_invoices')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenant_invoices' },
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
      setDbConnected(true);
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
      const override = overrideByMeter || overrideByInv || {};

      // Validate tenant name against meter: never let an old override for a different meter rename this meter
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
      const totalUsd = Number((kwh * ratePerKwh + demand).toFixed(2));
      const totalKhr = Number((totalUsd * 4100).toFixed(2));

      return {
        id: invNum,
        invoice_number: invNum,
        tenant_name: tenantName,
        unit_zone: override.unit_zone || `Floor ${Math.floor(index / 3) + 1} - Suite ${101 + index}`,
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
  }, [points, ratePerKwh, startDate, endDate, invoiceOverrides]);

  const liveKwh = telemetryTenantInvoices.length > 0 ? telemetryTenantInvoices[0].kwh_reading : 1075.0;

  // Active Tenant Billing Ledger computed dynamically using ratePerKwh & live oBIX data
  const tenantInvoices: TenantInvoiceDb[] = useMemo(() => {
    if (dbInvoices.length > 0) {
      // Recalculate using active user rate input for real-time responsiveness
      return dbInvoices.map((inv) => {
        // Look up if live point exists for this meter using robust fuzzy matching
        const liveMatch = findLiveMeterPoint(points, inv.meter_name, inv.tenant_name);
        const kwh = liveMatch ? Number(liveMatch.current_value.toFixed(2)) : inv.kwh_reading;
        const override = invoiceOverrides[inv.invoice_number] || {};
        const demand = override.demand_charge !== undefined ? override.demand_charge : inv.demand_charge;
        const totalUsd = Number((kwh * ratePerKwh + demand).toFixed(2));

        return {
          ...inv,
          tenant_name: override.tenant_name || inv.tenant_name,
          unit_zone: override.unit_zone || inv.unit_zone,
          kwh_reading: kwh,
          rate_per_kwh: ratePerKwh,
          demand_charge: demand,
          total_cost_usd: totalUsd,
          total_cost_khr: Number((totalUsd * 4100).toFixed(2)),
          start_date: override.start_date || inv.start_date || startDate || getMonthStartIso(),
          end_date: override.end_date || inv.end_date || endDate || formatIsoSecond(),
          billing_period: override.billing_period || inv.billing_period || getCurrentPeriodLabel(),
          status: (override.status || inv.status) as 'PAID' | 'PENDING' | 'OVERDUE',
        };
      });
    }

    if (telemetryTenantInvoices.length > 0) {
      return telemetryTenantInvoices;
    }

    return [];
  }, [dbInvoices, telemetryTenantInvoices, points, ratePerKwh, invoiceOverrides, startDate, endDate]);

  // Update specific date for a tenant invoice and persist permanently
  const handleUpdateInvoiceDate = async (
    invoiceNumber: string,
    field: 'start_date' | 'end_date',
    value: string
  ) => {
    // 1. Immediately update and save overrides to localStorage
    setInvoiceOverrides((prev) => {
      const next = {
        ...prev,
        [invoiceNumber]: {
          ...(prev[invoiceNumber] || {}),
          [field]: value,
        },
      };
      saveOverridesToStorage(next);
      return next;
    });

    // 2. Update dbInvoices state if present
    setDbInvoices((prev) =>
      prev.map((inv) =>
        inv.invoice_number === invoiceNumber ? { ...inv, [field]: value } : inv
      )
    );

    // 3. Persist to Supabase
    const target = tenantInvoices.find((i) => i.invoice_number === invoiceNumber);
    if (target) {
      await upsertTenantInvoice({ ...target, [field]: value });
    }
  };

  // Save updated tenant invoice from Edit modal and persist permanently
  const handleSaveUpdatedInvoice = async (updated: TenantInvoiceDb) => {
    // 1. Immediately update and save overrides to localStorage keyed by meter_name and invoice_number
    setInvoiceOverrides((prev) => {
      const record = {
        ...(prev[updated.meter_name] || prev[updated.invoice_number] || {}),
        tenant_name: updated.tenant_name,
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
      };
      saveOverridesToStorage(next);
      return next;
    });

    // 2. Update dbInvoices state
    setDbInvoices((prev) =>
      prev.map((inv) =>
        inv.invoice_number === updated.invoice_number ? updated : inv
      )
    );

    // 3. Persist to Supabase
    await upsertTenantInvoice(updated);
  };

  // Delete a tenant invoice from DB and active state
  const handleDeleteInvoice = async (invoice: TenantInvoiceDb) => {
    setInvoiceOverrides((prev) => {
      const next = { ...prev };
      delete next[invoice.invoice_number];
      saveOverridesToStorage(next);
      return next;
    });

    setDbInvoices((prev) => prev.filter((i) => i.invoice_number !== invoice.invoice_number));

    await deleteTenantInvoice(invoice.invoice_number, invoice.meter_name);
  };


  // Filtered invoices logic with Date Range filtering
  const filteredInvoices = useMemo(() => {
    return tenantInvoices.filter((inv) => {
      const search = searchQuery.toLowerCase().trim();
      const matchSearch =
        !search ||
        inv.tenant_name.toLowerCase().includes(search) ||
        inv.meter_name.toLowerCase().includes(search) ||
        inv.unit_zone.toLowerCase().includes(search) ||
        inv.invoice_number.toLowerCase().includes(search);

      if (!matchSearch) return false;
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;

      // Start Date & End Date range filter
      if (startDate) {
        const itemStart = inv.start_date || '2026-08-01';
        if (itemStart < startDate) return false;
      }
      if (endDate) {
        const itemEnd = inv.end_date || '2026-08-31';
        if (itemEnd > endDate) return false;
      }

      return true;
    });
  }, [tenantInvoices, searchQuery, statusFilter, startDate, endDate]);

  // Summary Metrics
  const totalBilled = useMemo(
    () => tenantInvoices.reduce((acc, i) => acc + i.total_cost_usd, 0),
    [tenantInvoices]
  );
  const totalKwh = useMemo(
    () => tenantInvoices.reduce((acc, i) => acc + i.kwh_reading, 0),
    [tenantInvoices]
  );

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
        const meter = inv.meter_name || inv.tenant_name;
        const rangeResult = start && end ? await fetchMeterReadingRange(meter, start, end) : undefined;

        const {
          kwh: calcKwh,
          durationText,
          startReading,
          endReading,
          fraction,
          hasTelemetry,
        } = calculateIntervalConsumption(
          inv.kwh_reading,
          start,
          end,
          rangeResult
        );

        const accruedCost = Number((calcKwh * inv.rate_per_kwh + (hasTelemetry ? 0 : inv.demand_charge * fraction)).toFixed(2));

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
          `$${inv.total_cost_usd.toFixed(2)}`,
          `${inv.total_cost_khr.toLocaleString()} KHR`,
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


  // Apply same Start & End Date/Time to all tenant invoices
  const handleApplyDatesToAll = async (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);

    setInvoiceOverrides((prev) => {
      const next = { ...prev };
      tenantInvoices.forEach((inv) => {
        next[inv.invoice_number] = {
          ...(next[inv.invoice_number] || {}),
          start_date: start,
          end_date: end,
        };
      });
      saveOverridesToStorage(next);
      return next;
    });

    if (dbInvoices.length > 0) {
      const updated = dbInvoices.map((inv) => ({
        ...inv,
        start_date: start,
        end_date: end,
      }));
      setDbInvoices(updated);
      for (const inv of updated) {
        await upsertTenantInvoice(inv);
      }
    } else {
      for (const inv of tenantInvoices) {
        await upsertTenantInvoice({
          ...inv,
          start_date: start,
          end_date: end,
        });
      }
    }
  };


  return (
    <div className="flex-1 flex flex-col space-y-6 w-full animate-fadeIn">
      {/* Top Header Banner with Add Sub-Meter Button */}
      <BillingHeaderBanner
        dbConnected={dbConnected}
        onExportInvoices={handleExportInvoices}
        onOpenAddInvoice={handleOpenAddModal}
      />

      {/* Interactive Tariff Rate Calculator */}
      <TariffRateCalculator
        ratePerKwh={ratePerKwh}
        onRateChange={handleRateChange}
      />

      {/* Summary KPI Cards Grid */}
      <BillingKpiGrid
        totalBilled={totalBilled}
        totalKwh={totalKwh}
        liveKwh={liveKwh}
        ratePerKwh={ratePerKwh}
        tenantInvoices={tenantInvoices}
      />

      {/* Tenant Invoices Data Table with Start & End Date per Tenant */}
      <TenantInvoicesTable
        invoices={filteredInvoices}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        startDate={startDate}
        endDate={endDate}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onExportInvoices={handleExportInvoices}
        onOpenAddInvoice={handleOpenAddModal}
        onOpenEditInvoice={(inv) => setEditingInvoice(inv)}
        onViewInvoice={(inv) => setViewingInvoice(inv)}
        onSelectTenantTrend={(inv) => setTrendingInvoice(inv)}
        onDeleteInvoice={handleDeleteInvoice}
        onUpdateInvoiceDate={handleUpdateInvoiceDate}
        onApplyDatesToAll={handleApplyDatesToAll}
      />



      {/* Add Billing Sub-Meter & Tenant Invoice Modal */}

      <AddTenantInvoiceModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        onSuccess={() => {
          loadBillingDbData();
        }}
        ratePerKwh={ratePerKwh}
        existingCount={tenantInvoices.length}
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

    </div>
  );
};

export default BillingWorkspace;




