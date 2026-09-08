-- ==============================================================================
-- Add tenant billing email to tenant invoices for sending invoice PDFs by email
-- ==============================================================================

ALTER TABLE tenant_invoices ADD COLUMN IF NOT EXISTS tenant_email TEXT;

-- Optional backfill from existing client_accounts if email matches a tenant name
UPDATE tenant_invoices ti
SET tenant_email = ca.email
FROM client_accounts ca
WHERE ti.tenant_email IS NULL
  AND ca.assigned_tenant IS NOT NULL
  AND LOWER(ti.tenant_name) = LOWER(ca.assigned_tenant);