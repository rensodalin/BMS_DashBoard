import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ISensorRepository } from "../../adapters/repositories/ISensorRepository";
import { SensorPoint } from "../../domain/entities/SensorPoint";

export class SupabaseSensorRepository implements ISensorRepository {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase URL and API Key must be configured.");
    }
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  public async saveBatchReadings(points: SensorPoint[]): Promise<void> {
    if (points.length === 0) return;

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

    const sensorPointsBatch = points.map((pt) => ({
      point_name: pt.name,
      current_value: pt.numericValue,
      alert_threshold: pt.highLimit,
      is_alarm: pt.isAlarm(),
      updated_at: nowLocal,
    }));

    const pointReadingsBatch = points.map((pt) => ({
      point_name: pt.name,
      value: pt.numericValue,
      recorded_at: nowLocal,
    }));

    // 1. Single Batch Upsert into sensor_points table
    try {
      const { error: upsertErr } = await this.supabase
        .from("sensor_points")
        .upsert(sensorPointsBatch, { onConflict: "point_name" });

      if (upsertErr) {
        console.error("❌ Supabase Batch Upsert Error:", upsertErr.message);
      }
    } catch (e: any) {
      console.warn("⚠️ Temporary Supabase Network Fetch Warning (Retrying next cycle):", e.message || e);
    }

    // 2. Single Batch Insert into point_readings time-series table
    try {
      const { error: insertErr } = await this.supabase
        .from("point_readings")
        .insert(pointReadingsBatch);

      if (insertErr) {
        console.error("❌ Supabase Batch Insert Error:", insertErr.message);
      }
    } catch (e: any) {
      // Ignore temporary socket hiccups gracefully
    }
  }
}


