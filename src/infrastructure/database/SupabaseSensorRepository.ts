import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ISensorRepository } from "../../adapters/repositories/ISensorRepository";
import { SensorPoint } from "../../domain/entities/SensorPoint";

export class SupabaseSensorRepository implements ISensorRepository {
  private supabase: SupabaseClient;
  private cycleCounter: number = 0;
  private isPruning: boolean = false;

  constructor(supabaseUrl: string, supabaseKey: string) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase URL and API Key must be configured.");
    }
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  public async saveBatchReadings(points: SensorPoint[]): Promise<void> {
    if (points.length === 0) return;

    // Filter out Niagara workspace metadata like wsAnnotation
    const validPoints = points.filter(
      (pt) => pt.name && pt.name !== "wsAnnotation" && !pt.name.toLowerCase().startsWith("ws")
    );

    if (validPoints.length === 0) return;

    // Build batch payloads for single HTTP request
    // Helper to format exact local PC timestamp (YYYY-MM-DD HH:mm:ss)
    const getLocalTimestamp = (): string => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const YYYY = now.getFullYear();
      const MM = pad(now.getMonth() + 1);
      const DD = pad(now.getDate());
      const HH = pad(now.getHours());
      const mm = pad(now.getMinutes());
      const ss = pad(now.getSeconds());
      return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
    };

    const nowLocal = getLocalTimestamp();

    // Deduplicate by point_name so Postgres never throws ON CONFLICT DO UPDATE multiple row error
    const sensorPointMap = new Map<string, any>();
    for (const pt of validPoints) {
      sensorPointMap.set(pt.name, {
        point_name: pt.name,
        device_name: pt.deviceName || "Niagara Controller",
        floor_name: pt.floorName || "GF",
        current_value: pt.numericValue,
        alert_threshold: pt.highLimit,
        is_alarm: pt.isAlarm(),
        updated_at: nowLocal,
      });
    }
    const sensorPointsBatch = Array.from(sensorPointMap.values());

    const readingMap = new Map<string, any>();
    for (const pt of validPoints) {
      readingMap.set(pt.name, {
        point_name: pt.name,
        value: pt.numericValue,
        recorded_at: nowLocal,
      });
    }
    const pointReadingsBatch = Array.from(readingMap.values());

    // Execute sensor_points upsert & point_readings insert in parallel for max speed
    try {
      const [upsertRes, insertRes] = await Promise.all([
        this.supabase
          .from("sensor_points")
          .upsert(sensorPointsBatch, { onConflict: "point_name" }),
        this.supabase
          .from("point_readings")
          .insert(pointReadingsBatch),
      ]);

      if (upsertRes.error) {
        console.error("❌ Supabase Batch Upsert Error:", upsertRes.error.message);
      }
      if (insertRes.error) {
        console.error("❌ Supabase Batch Insert Error:", insertRes.error.message);
      }
    } catch (e: any) {
      console.warn("⚠️ Temporary Supabase Network Warning:", e.message || e);
    }

    // 3. Periodic Rolling Retention Cleanup (keeps ample history for billing ranges)
    // Only trims when accumulated beyond 20,000 points per meter, running every 10 minutes
    this.cycleCounter++;
    if (this.cycleCounter % 600 === 0) {
      this.pruneOldReadings(20000).catch(() => {});
    }
  }

  /**
   * Prunes historical readings exceeding maxPointsPerMeter (default 20,000 points)
   * retaining ample historical points for accurate interval billing and trends.
   */
  public async pruneOldReadings(
    maxPointsPerMeter: number = 20000
  ): Promise<number> {
    if (this.isPruning) return 0;
    this.isPruning = true;
    let totalDeleted = 0;

    try {
      // 1. Primary: Fast Postgres Stored Procedure RPC
      let { data, error } = await this.supabase.rpc("prune_old_point_readings", {
        max_points_per_meter: maxPointsPerMeter,
      });

      if (error && error.code === "PGRST202") {
        const retry = await this.supabase.rpc("prune_old_point_readings", {
          max_points_per_meter: maxPointsPerMeter,
          retention_days: 30,
        });
        data = retry.data;
        error = retry.error;
      }

      if (!error && (typeof data === "number" || typeof data === "string")) {
        totalDeleted = Number(data);
        if (totalDeleted > 0) {
          console.log(
            `[Retention Policy (Record Count = ${maxPointsPerMeter})] 🧹 Rolled buffer: pruned ${totalDeleted} oldest points beyond ${maxPointsPerMeter} limit.`
          );
        }
        return totalDeleted;
      }

      // 2. Fallback: Strict Record Count Capacity = 100 per meter (Niagara Roll Policy)
      // Only deletes points when a meter's point count exceeds maxPointsPerMeter (100 records)
      const { data: meterPoints } = await this.supabase
        .from("sensor_points")
        .select("point_name");

      if (meterPoints && meterPoints.length > 0) {
        for (const mp of meterPoints) {
          const { data: excess } = await this.supabase
            .from("point_readings")
            .select("id")
            .eq("point_name", mp.point_name)
            .order("recorded_at", { ascending: false })
            .range(maxPointsPerMeter, maxPointsPerMeter + 500);

          if (excess && excess.length > 0) {
            const ids = excess.map((r: any) => r.id);
            const { count: excessDelCount } = await this.supabase
              .from("point_readings")
              .delete({ count: "exact" })
              .in("id", ids);

            if (excessDelCount) {
              totalDeleted += excessDelCount;
              console.log(
                `[Retention Policy (Capacity = ${maxPointsPerMeter})] 🧹 Pruned ${excessDelCount} oldest points for [${mp.point_name}] (keeping latest ${maxPointsPerMeter}).`
              );
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("[Retention Policy] Retention check warning:", err.message || err);
    } finally {
      this.isPruning = false;
    }

    return totalDeleted;
  }
}


