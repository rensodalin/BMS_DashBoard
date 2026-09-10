-- ==============================================================================
-- Client Site Profiles & Multi-Building Schema
-- Stores site information for each client account in Supabase database:
-- - Company / Site Name
-- - Company Banner / Building Photo
-- - Physical Location / Street Address
-- - Google Maps Navigation Link or Coordinates
-- ==============================================================================

-- 1. Add site profile columns directly to client_accounts table
-- Each client created by the Admin has their own site information stored directly on their account!
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS site_name TEXT;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS location_address TEXT DEFAULT 'Phnom Penh, Cambodia';
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS map_url TEXT;

-- 2. Create facility_profiles table to store site metadata by facility/building scope
CREATE TABLE IF NOT EXISTS facility_profiles (
    facility_name TEXT PRIMARY KEY,
    site_name TEXT NOT NULL,
    image_url TEXT,
    location_address TEXT DEFAULT 'Phnom Penh, Cambodia',
    map_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_facility_profiles_name ON facility_profiles(facility_name);
CREATE INDEX IF NOT EXISTS idx_client_accounts_tenant ON client_accounts(assigned_tenant);

-- 3. Enable Supabase Realtime safely (idempotent check prevents 42710 error)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'facility_profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE facility_profiles;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'client_accounts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE client_accounts;
    END IF;
END $$;

-- 4. Disable Row Level Security (RLS) so frontend client and admin can read/write
ALTER TABLE IF EXISTS facility_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_accounts DISABLE ROW LEVEL SECURITY;

-- 5. Grant full table permissions to anon, authenticated, and service_role
GRANT ALL ON TABLE facility_profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE client_accounts TO anon, authenticated, service_role;

-- 6. Add open RLS policies (in case RLS is ever re-enabled)
DROP POLICY IF EXISTS "Allow all on facility_profiles" ON facility_profiles;
CREATE POLICY "Allow all on facility_profiles" ON facility_profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on client_accounts" ON client_accounts;
CREATE POLICY "Allow all on client_accounts" ON client_accounts FOR ALL USING (true) WITH CHECK (true);

-- 7. Dynamic initialization: Automatically copy site info from any existing client accounts into facility_profiles
INSERT INTO facility_profiles (facility_name, site_name, image_url, location_address, map_url)
SELECT 
    COALESCE(assigned_tenant, name) AS facility_name,
    name AS site_name,
    COALESCE(image_url, '/building_hq.jpg') AS image_url,
    COALESCE(location_address, 'Phnom Penh, Cambodia') AS location_address,
    COALESCE(map_url, '') AS map_url
FROM client_accounts
WHERE assigned_tenant IS NOT NULL AND assigned_tenant != ''
ON CONFLICT (facility_name) DO UPDATE 
SET site_name = EXCLUDED.site_name,
    updated_at = now();

-- Also ensure default master Station HQ row exists for the Administrator view
INSERT INTO facility_profiles (facility_name, site_name, image_url, location_address, map_url)
VALUES ('Station HQ', 'Station HQ', '/building_hq.jpg', 'Phnom Penh, Cambodia', '')
ON CONFLICT (facility_name) DO NOTHING;
