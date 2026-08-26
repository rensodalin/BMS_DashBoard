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
    for (const pt of points) {
      // 1. Upsert latest value into sensor_points
      const { error: upsertError } = await this.supabase
        .from("sensor_points")
        .upsert(
          {
            point_name: pt.name,
            current_value: pt.numericValue,
            alert_threshold: pt.highLimit,
            is_alarm: pt.isAlarm(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "point_name" }
        );

      if (upsertError) {
        console.error(`Error upserting sensor_point (${pt.name}):`, upsertError.message);
        if (upsertError.message.includes("row-level security")) {
          console.warn(`💡 Fix RLS: Run "ALTER TABLE sensor_points DISABLE ROW LEVEL SECURITY;" in Supabase SQL Editor.`);
        }
      }

      // 2. Insert record into point_readings time-series table
      const { error: insertError } = await this.supabase
        .from("point_readings")
        .insert({
          point_name: pt.name,
          value: pt.numericValue,
          recorded_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error(`Error inserting point_reading (${pt.name}):`, insertError.message);
      }
    }
  }
}
