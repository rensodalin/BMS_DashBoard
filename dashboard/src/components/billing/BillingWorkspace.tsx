import React, { useState, useEffect, useMemo } from 'react';
import type { SensorPoint, TenantInvoiceDb } from '../../types/bms';
import { exportToCsv } from '../../lib/exportCsv';
import {
  fetchTenantInvoices,
  fetchUtilityRates,
  updateUtilityRate,
  supabase,
} from '../../lib/supabase';
import { BillingHeaderBanner } from './BillingHeaderBanner';
import { TariffRateCalculator } from './TariffRateCalculator';
import { BillingKpiGrid } from './BillingKpiGrid';
import { ObixXmlInspector } from './ObixXmlInspector';
import { TenantInvoicesTable } from './TenantInvoicesTable';

interface BillingWorkspaceProps {
  points?: SensorPoint[];
}

export const BillingWorkspace: React.FC<BillingWorkspaceProps> = ({ points = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [showObixXml, setShowObixXml] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);

  // Dynamic Price per kWh input state (Default: $0.15 / kWh)
  const [ratePerKwh, setRatePerKwh] = useState<number>(0.15);

  // Supabase Database Tenant Invoices state
  const [dbInvoices, setDbInvoices] = useState<TenantInvoiceDb[]>([]);

  // Load initial Supabase Billing database data & setup Realtime subscription
  useEffect(() => {
    loadBillingDbData();

    // Supabase Realtime WebSocket Listener for tenant_invoices table
    const channel = supabase
      .channel('realtime_billing_invoices')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenant_invoices' },
        () => {
          loadBillingDbData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadBillingDbData = async () => {
    // 1. Fetch Utility Rate from Supabase
    const rateData = await fetchUtilityRates();
    if (rateData && rateData.rate_per_kwh) {
      setRatePerKwh(rateData.rate_per_kwh);
    }

    // 2. Fetch Tenant Invoices from Supabase
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

  // Extract or synthesize live oBIX tenant reading from points or Niagara sample
  const tenantIntersysPoint = useMemo(() => {
    return points.find(
      (p) =>
        p.point_name.toLowerCase().includes('tenantintersys') ||
        p.point_name.toLowerCase().includes('kwh')
    );
  }, [points]);

  const liveKwh = tenantIntersysPoint ? tenantIntersysPoint.current_value : 1075.0;

  // Active Tenant Billing Ledger computed dynamically using ratePerKwh & live oBIX data
  const tenantInvoices: TenantInvoiceDb[] = useMemo(() => {
    if (dbInvoices.length > 0) {
      // Recalculate using active user rate input for real-time responsiveness
      return dbInvoices.map((inv) => {
        const kwh = inv.meter_name === 'TenantIntersys_kWh' ? liveKwh : inv.kwh_reading;
        const totalUsd = Number((kwh * ratePerKwh + inv.demand_charge).toFixed(2));
        return {
          ...inv,
          kwh_reading: kwh,
          rate_per_kwh: ratePerKwh,
          total_cost_usd: totalUsd,
          total_cost_khr: Number((totalUsd * 4100).toFixed(2)),
        };
      });
    }

    // Default fallback ledger incorporating actual Niagara oBIX point
    return [
      {
        id: 'INV-2026-001',
        invoice_number: 'INV-2026-001',
        tenant_name: 'Tenant Intersys Co., Ltd.',
        unit_zone: 'Floor 3 - Suite 302',
        meter_name: 'TenantIntersys_kWh',
        kwh_reading: liveKwh,
        rate_per_kwh: ratePerKwh,
        demand_charge: 25.0,
        total_cost_usd: Number((liveKwh * ratePerKwh + 25.0).toFixed(2)),
        total_cost_khr: Number(((liveKwh * ratePerKwh + 25.0) * 4100).toFixed(2)),
        billing_period: 'Aug 2026',
        status: 'PAID',
      },
      {
        id: 'INV-2026-002',
        invoice_number: 'INV-2026-002',
        tenant_name: 'HVAC Chiller Plant (Common)',
        unit_zone: 'Basement Mechanical Room',
        meter_name: 'ChillerPlant_kWh',
        kwh_reading: 4820.0,
        rate_per_kwh: ratePerKwh,
        demand_charge: 120.0,
        total_cost_usd: Number((4820.0 * ratePerKwh + 120.0).toFixed(2)),
        total_cost_khr: Number(((4820.0 * ratePerKwh + 120.0) * 4100).toFixed(2)),
        billing_period: 'Aug 2026',
        status: 'PENDING',
      },
      {
        id: 'INV-2026-003',
        invoice_number: 'INV-2026-003',
        tenant_name: 'Grand Retail Zone A',
        unit_zone: 'Ground Floor - Retail 101',
        meter_name: 'Retail_A_kWh',
        kwh_reading: 2150.5,
        rate_per_kwh: ratePerKwh,
        demand_charge: 45.0,
        total_cost_usd: Number((2150.5 * ratePerKwh + 45.0).toFixed(2)),
        total_cost_khr: Number(((2150.5 * ratePerKwh + 45.0) * 4100).toFixed(2)),
        billing_period: 'Aug 2026',
        status: 'PAID',
      },
      {
        id: 'INV-2026-004',
        invoice_number: 'INV-2026-004',
        tenant_name: 'Server & Data Center UPS',
        unit_zone: 'Floor 2 - Data Wing',
        meter_name: 'DataCenter_kWh',
        kwh_reading: 3640.0,
        rate_per_kwh: ratePerKwh,
        demand_charge: 80.0,
        total_cost_usd: Number((3640.0 * ratePerKwh + 80.0).toFixed(2)),
        total_cost_khr: Number(((3640.0 * ratePerKwh + 80.0) * 4100).toFixed(2)),
        billing_period: 'Aug 2026',
        status: 'PAID',
      },
      {
        id: 'INV-2026-005',
        invoice_number: 'INV-2026-005',
        tenant_name: 'Executive Office Suite',
        unit_zone: 'Floor 5 - Executive Tower',
        meter_name: 'ExecSuite_kWh',
        kwh_reading: 890.25,
        rate_per_kwh: ratePerKwh,
        demand_charge: 20.0,
        total_cost_usd: Number((890.25 * ratePerKwh + 20.0).toFixed(2)),
        total_cost_khr: Number(((890.25 * ratePerKwh + 20.0) * 4100).toFixed(2)),
        billing_period: 'Aug 2026',
        status: 'OVERDUE',
      },
    ];
  }, [dbInvoices, liveKwh, ratePerKwh]);

  // Filtered invoices logic
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
      return true;
    });
  }, [tenantInvoices, searchQuery, statusFilter]);

  // Summary Metrics
  const totalBilled = useMemo(
    () => tenantInvoices.reduce((acc, i) => acc + i.total_cost_usd, 0),
    [tenantInvoices]
  );
  const totalKwh = useMemo(
    () => tenantInvoices.reduce((acc, i) => acc + i.kwh_reading, 0),
    [tenantInvoices]
  );

  // Export Invoices CSV
  const handleExportInvoices = () => {
    const headers = [
      'Invoice Number',
      'Tenant Name',
      'Unit / Zone',
      'oBIX Meter Name',
      'Energy Reading (kWh)',
      'Tariff Rate ($/kWh)',
      'Demand Charge ($)',
      'Total Amount ($)',
      'Total Amount (KHR)',
      'Billing Period',
      'Payment Status',
    ];

    const rows = filteredInvoices.map((inv) => [
      inv.invoice_number,
      inv.tenant_name,
      inv.unit_zone,
      inv.meter_name,
      inv.kwh_reading.toFixed(2),
      `$${inv.rate_per_kwh.toFixed(4)}`,
      `$${inv.demand_charge.toFixed(2)}`,
      `$${inv.total_cost_usd.toFixed(2)}`,
      `${inv.total_cost_khr.toLocaleString()} KHR`,
      inv.billing_period,
      inv.status,
    ]);

    exportToCsv(
      `BMS_Tenant_Utility_Billing_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  return (
    <div className="flex-1 flex flex-col space-y-6 w-full animate-fadeIn">
      {/* Top Header Banner */}
      <BillingHeaderBanner
        dbConnected={dbConnected}
        showObixXml={showObixXml}
        onToggleObixXml={() => setShowObixXml(!showObixXml)}
        onExportInvoices={handleExportInvoices}
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

      {/* Live oBIX XML Telemetry Inspector */}
      {showObixXml && <ObixXmlInspector liveKwh={liveKwh} />}

      {/* Tenant Invoices Data Table */}
      <TenantInvoicesTable
        invoices={filteredInvoices}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onExportInvoices={handleExportInvoices}
      />
    </div>
  );
};

export default BillingWorkspace;
