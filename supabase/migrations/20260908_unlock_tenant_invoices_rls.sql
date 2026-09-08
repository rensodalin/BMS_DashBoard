-- ==============================================================================
-- BMS Unlock RLS for Tenant Invoices, Tenant Meters & Utility Rates
-- Run this in your Supabase SQL Editor to allow adding & editing tenants/emails
-- ==============================================================================

-- 1. Ensure tenant_email column exists on tenant_invoices
ALTER TABLE IF EXISTS tenant_invoices ADD COLUMN IF NOT EXISTS tenant_email TEXT;

-- 2. Disable Row Level Security (RLS) so the frontend client can read and write directly
ALTER TABLE IF EXISTS tenant_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS utility_rates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_meters DISABLE ROW LEVEL SECURITY;

-- 3. Grant full permissions to anon, authenticated, and service_role
GRANT ALL ON TABLE tenant_invoices TO anon, authenticated, service_role;
GRANT ALL ON TABLE utility_rates TO anon, authenticated, service_role;
GRANT ALL ON TABLE tenant_meters TO anon, authenticated, service_role;

-- 4. Permissive policies in case RLS is re-enabled in the future
DROP POLICY IF EXISTS "Allow all on tenant_invoices" ON tenant_invoices;
CREATE POLICY "Allow all on tenant_invoices" ON tenant_invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on utility_rates" ON utility_rates;
CREATE POLICY "Allow all on utility_rates" ON utility_rates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on tenant_meters" ON tenant_meters;
CREATE POLICY "Allow all on tenant_meters" ON tenant_meters FOR ALL USING (true) WITH CHECK (true);

-- 5. Backfill tenant emails from client_accounts if available
UPDATE tenant_invoices ti
SET tenant_email = ca.email
FROM client_accounts ca
WHERE (ti.tenant_email IS NULL OR ti.tenant_email = '')
  AND ca.assigned_tenant IS NOT NULL
  AND LOWER(ti.tenant_name) = LOWER(ca.assigned_tenant);
