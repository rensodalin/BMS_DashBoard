// Supabase Edge Function: obix-telegram-poller (Deno)
// Used for scheduled/cron triggers on Supabase cloud if deployed

// @ts-ignore - Handled by Deno runtime in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Ambient declaration for Deno globals when viewed in standard Node/TS environments
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

Deno.serve(async (_req: Request) => {
  try {
    const obixUrl = Deno.env.get("OBIX_URL");
    const obixUser = Deno.env.get("OBIX_USERNAME");
    const obixPass = Deno.env.get("OBIX_PASSWORD");
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

    if (!obixUrl || !obixUser || !obixPass || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing required environment variables." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const authHeader = `Basic ${btoa(`${obixUser}:${obixPass}`)}`;
    const res = await fetch(obixUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/xml, text/xml, */*",
      },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `oBIX returned HTTP ${res.status}: ${res.statusText}` }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const xml = await res.text();
    const regex = /<real\s+[^>]*name="([^"]+)"[^>]*val="([^"]+)"/g;
    const points: Array<{ name: string; value: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(xml)) !== null) {
      const name = match[1];
      const value = parseFloat(match[2]);
      if (!isNaN(value)) {
        points.push({ name, value });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    let hasHighTempAlarm = false;

    for (const pt of points) {
      const isAlarm = pt.name.includes("Temp") && pt.value >= 30.0;
      if (isAlarm) hasHighTempAlarm = true;

      await supabase.from("sensor_points").upsert(
        {
          point_name: pt.name,
          current_value: pt.value,
          is_alarm: isAlarm,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "point_name" }
      );

      await supabase.from("point_readings").insert({
        point_name: pt.name,
        value: pt.value,
        recorded_at: new Date().toISOString(),
      });
    }

    // Optional Telegram notification on alarm trigger
    if (hasHighTempAlarm && telegramToken && chatId) {
      const lines = [
        `🏢 <b>AHU CONTROLLER STATUS SUMMARY (Edge Function)</b>`,
        `─────────────────────────────────────`,
      ];
      for (const pt of points) {
        const cleanName = pt.name.replace(/_/g, " ");
        if (pt.name.includes("Temp") && pt.value >= 30.0) {
          lines.push(`🌡️ <b>${cleanName}:</b> <code>${pt.value.toFixed(1)} °C</code> 🔴 (HIGH ALARM)`);
        } else if (pt.name.includes("Temp")) {
          lines.push(`🌡️ <b>${cleanName}:</b> <code>${pt.value.toFixed(1)} °C</code> 🟢 (Normal)`);
        } else {
          lines.push(`⚙️ <b>${cleanName}:</b> <code>${pt.value.toFixed(1)}</code> 🟢 (Normal)`);
        }
      }
      lines.push(`─────────────────────────────────────`);
      lines.push(`⚠️ <b>Status:</b> High Temperature Detected!`);
      lines.push(`⏰ <b>Time:</b> ${new Date().toISOString().replace("T", " ").substring(0, 19)}`);

      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join("\n"),
          parse_mode: "HTML",
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        pointsSynced: points.length,
        hasHighTempAlarm,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
