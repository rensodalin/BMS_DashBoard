-- ==============================================================================
-- 10-Point Niagara oBIX Poller & Telegram Alert Module Schema
-- ==============================================================================

-- 1. Table for tracking live 10-point statuses
CREATE TABLE IF NOT EXISTS sensor_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_name TEXT UNIQUE NOT NULL,
    current_value NUMERIC(12, 4) NOT NULL,
    alert_threshold NUMERIC(10, 2) DEFAULT 30.0,
    is_alarm BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table for recording time-series historical logs
CREATE TABLE IF NOT EXISTS point_readings (
    id BIGSERIAL PRIMARY KEY,
    point_name TEXT NOT NULL,
    value NUMERIC(12, 4) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Index for high-speed historical queries
CREATE INDEX IF NOT EXISTS idx_point_readings_name_time 
ON point_readings (point_name, recorded_at DESC);

-- Enable Supabase Realtime for instant UI dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_points;

-- Disable Row Level Security (RLS) for backend worker write access
ALTER TABLE sensor_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE point_readings DISABLE ROW LEVEL SECURITY;

-- Alternatively, permissive RLS policies if RLS is kept enabled:
-- CREATE POLICY "Allow full access to sensor_points" ON sensor_points FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow full access to point_readings" ON point_readings FOR ALL USING (true) WITH CHECK (true);


