-- ==============================================================================
-- 5-MINUTE ROLLING RETENTION & 300-POINT PRUNING POLICY
-- ==============================================================================
-- Math:
--   - Interval = 1 second per point
--   - Duration = 5 minutes = 300 seconds
--   - Total Capacity = 300 points per tenant meter
--
-- Behavior:
--   As each tenant meter records every 1 second, it accumulates up to 300 points.
--   When total points exceed 300 points, it rolls and erases older points,
--   keeping strictly the latest 300 points (last 5 minutes of data).
-- ==============================================================================

-- 1. Optimize indexes for time-series range scans and rolling window deletion
CREATE INDEX IF NOT EXISTS idx_point_readings_recorded_at 
ON point_readings (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_point_readings_name_time_id 
ON point_readings (point_name, recorded_at DESC, id DESC);

-- 2. Drop previous function signatures
DROP FUNCTION IF EXISTS prune_old_point_readings(integer, integer);
DROP FUNCTION IF EXISTS prune_old_point_readings(integer);
DROP FUNCTION IF EXISTS prune_old_point_readings();

-- 3. Stored Procedure: Capacity = 300 Records (5-Minute Roll Policy)
CREATE OR REPLACE FUNCTION prune_old_point_readings(
    max_points_per_meter integer DEFAULT 300
)
RETURNS bigint AS $$
DECLARE
    deleted_total bigint := 0;
    deleted_now bigint := 0;
    p_name text;
    cutoff_time timestamp;
    cutoff_id bigint;
BEGIN
    -- For each meter, enforce strict Capacity = 300 records (Roll Policy)
    -- Only deletes when a meter has more than max_points_per_meter (300) records
    FOR p_name IN SELECT DISTINCT point_name FROM point_readings LOOP
        SELECT recorded_at, id INTO cutoff_time, cutoff_id
        FROM point_readings
        WHERE point_name = p_name
        ORDER BY recorded_at DESC, id DESC
        OFFSET max_points_per_meter
        LIMIT 1;

        IF cutoff_time IS NOT NULL THEN
            DELETE FROM point_readings
            WHERE point_name = p_name
              AND (
                  recorded_at < cutoff_time 
                  OR (recorded_at = cutoff_time AND id <= cutoff_id)
              );
            GET DIAGNOSTICS deleted_now = ROW_COUNT;
            deleted_total := deleted_total + deleted_now;
        END IF;
    END LOOP;

    RETURN deleted_total;
END;
$$ LANGUAGE plpgsql;

-- 4. Diagnostic function to inspect point retention status per meter
DROP FUNCTION IF EXISTS get_meter_point_retention_stats();

CREATE OR REPLACE FUNCTION get_meter_point_retention_stats()
RETURNS TABLE(
    point_name text,
    total_points bigint,
    oldest_reading timestamp,
    latest_reading timestamp,
    latest_kwh numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.point_name,
        COUNT(*)::bigint AS total_points,
        MIN(pr.recorded_at)::timestamp AS oldest_reading,
        MAX(pr.recorded_at)::timestamp AS latest_reading,
        (
            SELECT value FROM point_readings sub 
            WHERE sub.point_name = pr.point_name 
            ORDER BY recorded_at DESC, id DESC 
            LIMIT 1
        ) AS latest_kwh
    FROM point_readings pr
    GROUP BY pr.point_name
    ORDER BY total_points DESC;
END;
$$ LANGUAGE plpgsql;
