-- Add floor_name column to sensor_points table
ALTER TABLE sensor_points ADD COLUMN IF NOT EXISTS floor_name TEXT DEFAULT 'Floor 1';

-- Create performance index for fast floor-level queries
CREATE INDEX IF NOT EXISTS idx_sensor_points_floor ON sensor_points(floor_name);
