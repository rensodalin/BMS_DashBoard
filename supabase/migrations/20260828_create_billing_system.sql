-- ==============================================================================
-- BMS Billing & Utility Sub-Metering Database Schema
-- ==============================================================================

-- 1. Table for Tenant Sub-Meters
CREATE TABLE IF NOT EXISTS tenant_meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_name TEXT UNIQUE NOT NULL,
    obix_href TEXT,
    tenant_name TEXT NOT NULL,
    unit_zone TEXT NOT NULL,
    demand_charge NUMERIC(10, 2) DEFAULT 25.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table for Global Utility Tariff Rates
CREATE TABLE IF NOT EXISTS utility_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_name TEXT NOT NULL DEFAULT 'Standard Commercial Tariff',
    rate_per_kwh NUMERIC(10, 4) NOT NULL DEFAULT 0.1500,
    currency TEXT DEFAULT 'USD',
    khr_exchange_rate NUMERIC(10, 2) DEFAULT 4100.00,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Table for Tenant Utility Invoices
CREATE TABLE IF NOT EXISTS tenant_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    meter_name TEXT NOT NULL,
    tenant_name TEXT NOT NULL,
    unit_zone TEXT NOT NULL,
    kwh_reading NUMERIC(12, 2) NOT NULL,
    rate_per_kwh NUMERIC(10, 4) NOT NULL DEFAULT 0.1500,
    demand_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_cost_usd NUMERIC(12, 2) NOT NULL,
    total_cost_khr NUMERIC(14, 2) NOT NULL,
    billing_period TEXT NOT NULL DEFAULT 'Aug 2026',
    status TEXT CHECK (status IN ('PAID', 'PENDING', 'OVERDUE')) DEFAULT 'PENDING',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_invoices_meter ON tenant_invoices(meter_name);
CREATE INDEX IF NOT EXISTS idx_tenant_invoices_status ON tenant_invoices(status);
CREATE INDEX IF NOT EXISTS idx_tenant_meters_name ON tenant_meters(meter_name);

-- Enable Supabase Realtime for instant UI sync
ALTER PUBLICATION supabase_realtime ADD TABLE tenant_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE utility_rates;

-- Disable Row Level Security for backend worker & dashboard access
ALTER TABLE tenant_meters DISABLE ROW LEVEL SECURITY;
ALTER TABLE utility_rates DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invoices DISABLE ROW LEVEL SECURITY;

-- Initial Seed Data
INSERT INTO utility_rates (rate_name, rate_per_kwh, currency, khr_exchange_rate, is_active)
VALUES ('Standard Commercial Tariff', 0.1500, 'USD', 4100.00, true)
ON CONFLICT DO NOTHING;

INSERT INTO tenant_meters (meter_name, obix_href, tenant_name, unit_zone, demand_charge)
VALUES 
    ('TenantIntersys_kWh', '/obix/config/Drivers/ObixTest/PowerMeter/TenantIntersys_kWh/', 'Tenant Intersys Co., Ltd.', 'Floor 3 - Suite 302', 25.00),
    ('ChillerPlant_kWh', '/obix/config/Drivers/ObixTest/PowerMeter/ChillerPlant_kWh/', 'HVAC Chiller Plant (Common)', 'Basement Mechanical Room', 120.00),
    ('Retail_A_kWh', '/obix/config/Drivers/ObixTest/PowerMeter/Retail_A_kWh/', 'Grand Retail Zone A', 'Ground Floor - Retail 101', 45.00),
    ('DataCenter_kWh', '/obix/config/Drivers/ObixTest/PowerMeter/DataCenter_kWh/', 'Server & Data Center UPS', 'Floor 2 - Data Wing', 80.00),
    ('ExecSuite_kWh', '/obix/config/Drivers/ObixTest/PowerMeter/ExecSuite_kWh/', 'Executive Office Suite', 'Floor 5 - Executive Tower', 20.00)
ON CONFLICT (meter_name) DO NOTHING;

INSERT INTO tenant_invoices (invoice_number, meter_name, tenant_name, unit_zone, kwh_reading, rate_per_kwh, demand_charge, total_cost_usd, total_cost_khr, billing_period, status)
VALUES 
    ('INV-2026-001', 'TenantIntersys_kWh', 'Tenant Intersys Co., Ltd.', 'Floor 3 - Suite 302', 1075.00, 0.1500, 25.00, 186.25, 763625.00, 'Aug 2026', 'PAID'),
    ('INV-2026-002', 'ChillerPlant_kWh', 'HVAC Chiller Plant (Common)', 'Basement Mechanical Room', 4820.00, 0.1500, 120.00, 843.00, 3456300.00, 'Aug 2026', 'PENDING'),
    ('INV-2026-003', 'Retail_A_kWh', 'Grand Retail Zone A', 'Ground Floor - Retail 101', 2150.50, 0.1500, 45.00, 367.58, 1507078.00, 'Aug 2026', 'PAID'),
    ('INV-2026-004', 'DataCenter_kWh', 'Server & Data Center UPS', 'Floor 2 - Data Wing', 3640.00, 0.1500, 80.00, 626.00, 2566600.00, 'Aug 2026', 'PAID'),
    ('INV-2026-005', 'ExecSuite_kWh', 'Executive Office Suite', 'Floor 5 - Executive Tower', 890.25, 0.1500, 20.00, 153.54, 629514.00, 'Aug 2026', 'OVERDUE')
ON CONFLICT (invoice_number) DO NOTHING;
