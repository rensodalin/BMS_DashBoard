-- ==============================================================================
-- Add building/facility tag to sensor points and point assignments to clients
-- ==============================================================================

-- 1. Add building_name column to sensor_points table
ALTER TABLE sensor_points ADD COLUMN IF NOT EXISTS building_name TEXT DEFAULT 'Station HQ';

-- 2. Add assigned_points array to client_accounts table
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS assigned_points TEXT[];

-- 3. Seed existing points with initial building tags based on point conventions
UPDATE sensor_points
SET building_name = 'KOI Facility'
WHERE LOWER(point_name) LIKE '%koi%' AND (building_name IS NULL OR building_name = 'Station HQ');

UPDATE sensor_points
SET building_name = 'BINGO Facility'
WHERE LOWER(point_name) LIKE '%bingo%' AND (building_name IS NULL OR building_name = 'Station HQ');

UPDATE sensor_points
SET building_name = 'BEAN Facility'
WHERE LOWER(point_name) LIKE '%bean%' AND (building_name IS NULL OR building_name = 'Station HQ');

UPDATE sensor_points
SET building_name = 'STARBUCKS Facility'
WHERE LOWER(point_name) LIKE '%starbucks%' AND (building_name IS NULL OR building_name = 'Station HQ');

UPDATE sensor_points
SET building_name = 'Brown Facility'
WHERE LOWER(point_name) LIKE '%brown%' AND (building_name IS NULL OR building_name = 'Station HQ');

-- ObixTest room points remain tagged under 'Station HQ' (the primary BMS controller facility)
UPDATE sensor_points
SET building_name = 'Station HQ'
WHERE (building_name IS NULL OR building_name = '')
  AND (device_name = 'ObixTest' OR point_name LIKE 'TempRoom%' OR point_name LIKE 'Smoke%' OR point_name LIKE 'PUMP%');
