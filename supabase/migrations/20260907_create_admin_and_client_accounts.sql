-- ==============================================================================
-- BMS Admin Credentials & Client Accounts Schema + RLS Unlock
-- ==============================================================================

-- 1. Table for Administrator Profile & Credentials
CREATE TABLE IF NOT EXISTS admin_settings (
    id TEXT PRIMARY KEY DEFAULT 'admin_primary',
    name TEXT NOT NULL DEFAULT 'System Administrator',
    email TEXT NOT NULL DEFAULT 'admin@intersys.com',
    password TEXT NOT NULL DEFAULT 'admin12345.intersys',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table for Client & Tenant Authorized Accounts
CREATE TABLE IF NOT EXISTS client_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client',
    assigned_tenant TEXT DEFAULT 'All Tenants',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_client_accounts_email ON client_accounts(email);
CREATE INDEX IF NOT EXISTS idx_client_accounts_status ON client_accounts(status);

-- Enable Supabase Realtime for instant multi-user synchronization
ALTER PUBLICATION supabase_realtime ADD TABLE admin_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE client_accounts;

-- Disable Row Level Security (RLS) so the frontend client can read and write
ALTER TABLE IF EXISTS admin_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_accounts DISABLE ROW LEVEL SECURITY;

-- Grant full table permissions to anon and authenticated roles
GRANT ALL ON TABLE admin_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE client_accounts TO anon, authenticated, service_role;

-- Drop and recreate permissive RLS Policies (if RLS is ever re-enabled)
DROP POLICY IF EXISTS "Allow all on client_accounts" ON client_accounts;
CREATE POLICY "Allow all on client_accounts" ON client_accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on admin_settings" ON admin_settings;
CREATE POLICY "Allow all on admin_settings" ON admin_settings FOR ALL USING (true) WITH CHECK (true);

-- Seed Default Master Admin row if not already present
INSERT INTO admin_settings (id, name, email, password)
VALUES ('admin_primary', 'System Administrator', 'admin@intersys.com', 'admin12345.intersys')
ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;
