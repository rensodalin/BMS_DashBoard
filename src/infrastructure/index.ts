import "dotenv/config";
import { ObixHttpGateway } from "./gateways/ObixHttpGateway";
import { TelegramApiGateway } from "./gateways/TelegramApiGateway";
import { SupabaseSensorRepository } from "./database/SupabaseSensorRepository";
import { Process10PointObixBatch } from "../use-cases/Process10PointObixBatch";

// CONFIGURATION (Loads from .env with fallbacks matching plan)
const TELEGRAM_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "8890272332:AAHprBblI9WaahOIZrT23hJJZs1y1BFNohg";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-5314819518";

const PARENT_OBIX_URL =
  process.env.OBIX_URL || "https://192.168.1.100/obix/config/Drivers/Pump/";
const USERNAME = process.env.OBIX_USERNAME || "UserObix";
const PASSWORD = process.env.OBIX_PASSWORD || "UserObix12345";
const ALLOW_SELFSIGNED = process.env.OBIX_ALLOW_SELFSIGNED_CERT !== "false";

// SUPABASE CONFIG (Set your Supabase credentials in .env)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "3000", 10);

// Instantiate Clean Architecture Components
const obixGateway = new ObixHttpGateway(PARENT_OBIX_URL, USERNAME, PASSWORD, ALLOW_SELFSIGNED);
const telegramGateway = new TelegramApiGateway(TELEGRAM_TOKEN, CHAT_ID);
const sensorRepo = new SupabaseSensorRepository(SUPABASE_URL, SUPABASE_ANON_KEY);

const batchUseCase = new Process10PointObixBatch(obixGateway, telegramGateway, sensorRepo);

console.log("===============================================================");
console.log("🏢 Supabase + Clean Architecture Niagara oBIX Poller Worker");
console.log("📡 Target oBIX URL:", PARENT_OBIX_URL);
console.log(`⏰ Polling Interval: ${POLL_INTERVAL} ms`);
console.log("===============================================================");

// Main Polling Loop
let isRunning = false;

const runCycle = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    const syncedCount = await batchUseCase.execute();
    if (syncedCount > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] ✅ ${syncedCount} Points synced to Supabase & evaluated.`);
    } else {
      console.warn(`[${new Date().toLocaleTimeString()}] ⚠️ 0 Points fetched from oBIX endpoint. Check URL/credentials/connectivity.`);
    }
  } catch (err: any) {
    console.error(`[${new Date().toLocaleTimeString()}] ⚠️ Sync cycle warning:`, err.message || err);
  } finally {
    isRunning = false;
  }
};

// Initial run followed by recurring timer
runCycle();
setInterval(runCycle, POLL_INTERVAL);

