-- ==============================================================================
-- BMS TIMEZONE & LOCAL TIMESTAMP UPDATE
-- ==============================================================================
-- Run this in your Supabase SQL Editor to make Supabase display local time (UTC+7)

-- 1. Set Database Timezone to your local timezone (Asia/Phnom_Penh / Asia/Bangkok UTC+7)
ALTER DATABASE postgres SET timezone TO 'Asia/Phnom_Penh';

-- 2. Convert recorded_at and updated_at to TIMESTAMP (without timezone)
-- This allows Supabase Table Editor to show the exact literal local time numbers
ALTER TABLE IF EXISTS point_readings 
  ALTER COLUMN recorded_at TYPE TIMESTAMP;

ALTER TABLE IF EXISTS sensor_points 
  ALTER COLUMN updated_at TYPE TIMESTAMP;

-- 3. Optional: Set default values to local time
ALTER TABLE IF EXISTS sensor_points 
  ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'Asia/Phnom_Penh');

ALTER TABLE IF EXISTS point_readings 
  ALTER COLUMN recorded_at SET DEFAULT (now() AT TIME ZONE 'Asia/Phnom_Penh');
