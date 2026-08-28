/**
 * ============================================================================
 * TELEGRAM API GATEWAY (ALERTS & 2-WAY CHATBOT ENGINE)
 * ============================================================================
 * Handles sending state-change HTML alert cards to Telegram and answering
 * live questions typed by group members in your Telegram group chat.
 */

import { ITelegramGateway } from "../../adapters/gateways/ITelegramGateway";
import { SensorPoint } from "../../domain/entities/SensorPoint";

export class TelegramApiGateway implements ITelegramGateway {
  private readonly botToken: string;
  private readonly chatId: string;
  private lastUpdateId: number = 0;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  /**
   * Escapes special HTML characters (<, >, &) to prevent Telegram API 400 Bad Request parsing errors
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Helper method to send raw HTML payload to Telegram Bot API
   */
  private async sendTelegramMsg(msgText: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: msgText,
          parse_mode: "HTML",
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ Telegram send failed (${res.status}): ${errorText}`);
        return false;
      }
      return true;
    } catch (e: any) {
      console.error("❌ Telegram Send Exception:", e.message || e);
      return false;
    }
  }

  /**
   * ==========================================================================
   * STATE-CHANGE TELEGRAM ALERT CARD GENERATOR
   * ==========================================================================
   * 💡 HOW TO CUSTOMIZE TELEGRAM ALERT MESSAGES:
   * Edit headers, emojis, or descriptions in the switch-like branches below!
   */
  public async sendPointStateAlert(point: SensorPoint): Promise<boolean> {
    const cleanPoint = this.escapeHtml(
      point.name.replace(/\$20/g, " ").replace(/%20/g, " ")
    );
    const deviceName = this.escapeHtml(point.deviceName);
    const stateType = point.state;
    const displayVal = this.escapeHtml(point.displayValue);
    const lowLim = point.lowLimit;
    const highLim = point.highLimit;

    let header = "";
    let statusDesc = "";
    let readingStr = "";

    // 1. ENUM POINT ALERTS (Alarm 2, Fault 3, Disabled 4, Normal 1)
    if (stateType === "ENUM_ALARM") {
      header = `🚨 <b>BMS ${cleanPoint.toUpperCase()} ALARM ALERT!</b> 🚨`;
      statusDesc = "🔥 <b>Status:</b> ALARM DETECTED (State 2)";
      readingStr = "🚨 ALARM (2)";
    } else if (stateType === "ENUM_FAULT") {
      header = `⚠️ <b>BMS ${cleanPoint.toUpperCase()} FAULT ALERT!</b> ⚠️`;
      statusDesc = "🛠 <b>Status:</b> EQUIPMENT FAULT (State 3)";
      readingStr = "⚠️ FAULT (3)";
    } else if (stateType === "ENUM_DISABLE") {
      header = `🔴 <b>BMS ${cleanPoint.toUpperCase()} DISABLED!</b> 🔴`;
      statusDesc = "🚫 <b>Status:</b> System Disabled (State 4)";
      readingStr = "🔴 DISABLED (4)";
    } else if (stateType === "ENUM_NORMAL") {
      header = `✅ <b>BMS ${cleanPoint.toUpperCase()} NORMAL</b> ✅`;
      statusDesc = "🟢 <b>Status:</b> System Normal (State 1)";
      readingStr = "✅ NORMAL (1)";
    } 
    // 2. BOOLEAN (True / False) SMOKE / FIRE ALERTS
    else if (stateType === "SMOKE_ALARM") {
      header = `🚨 <b>BMS SMOKE DETECTED ALERT!</b> 🚨`;
      statusDesc = "🔥 <b>Status:</b> SMOKE / FIRE ALARM DETECTED (TRUE)!";
      readingStr = "⚠️ ACTIVE ALARM";
    } else if (stateType === "SMOKE_NORMAL") {
      header = `✅ <b>BMS ${cleanPoint.toUpperCase()} NORMAL</b> ✅`;
      statusDesc = "🟢 <b>Status:</b> Normal (No Smoke Detected)";
      readingStr = "CLEAR (FALSE)";
    } 
    // 3. BOOLEAN RUN / STOP / ON / OFF ALERTS
    else if (stateType === "BOOL_ON") {
      const isRunText = /\b(run|running)\b/i.test(displayVal);
      header = isRunText
        ? `⚡ <b>BMS ${cleanPoint.toUpperCase()} IS RUNNING!</b> ⚡`
        : `⚡ <b>BMS ${cleanPoint.toUpperCase()} IS ON!</b> ⚡`;
      statusDesc = "🟢 <b>Status:</b> System Active / Running";
      readingStr = isRunText ? `⚡ RUNNING (${displayVal})` : `⚡ ON (${displayVal})`;
    } else if (stateType === "BOOL_OFF") {
      const isStopText = /\b(stop|stopped)\b/i.test(displayVal);
      header = isStopText
        ? `🔴 <b>BMS ${cleanPoint.toUpperCase()} IS STOPPED</b> 🔴`
        : `🔴 <b>BMS ${cleanPoint.toUpperCase()} IS OFF</b> 🔴`;
      statusDesc = "🛑 <b>Status:</b> System Standby / Stopped";
      readingStr = isStopText ? `🔴 STOPPED (${displayVal})` : `🔴 OFF (${displayVal})`;
    } 
    // 4. NUMERIC TEMPERATURE HIGH / LOW / NORMAL ALERTS
    else if (stateType === "HIGH") {
      header = `🚨 <b>BMS HIGH ${cleanPoint.toUpperCase()} ALERT!</b> 🚨`;
      statusDesc = `🔥 <b>Status:</b> High Limit (&gt; ${highLim.toFixed(1)} °C)`;
      readingStr = `${displayVal} °C`;
    } else if (stateType === "LOW") {
      header = `❄️ <b>BMS LOW ${cleanPoint.toUpperCase()} ALERT!</b> ❄️`;
      statusDesc = `🧊 <b>Status:</b> Low Limit (&lt; ${lowLim.toFixed(1)} °C)`;
      readingStr = `${displayVal} °C`;
    } else {
      header = `✅ <b>BMS ${cleanPoint.toUpperCase()} NORMAL</b> ✅`;
      statusDesc = `🟢 <b>Status:</b> Normal (${lowLim.toFixed(1)} °C - ${highLim.toFixed(1)} °C)`;
      readingStr = `${displayVal} °C`;
    }

    const timeStr = new Date().toISOString().replace("T", " ").substring(0, 19);
    const msg =
      `${header}\n\n` +
      `🏷 <b>Device:</b> ${deviceName}\n` +
      `📍 <b>Point:</b> ${cleanPoint}\n` +
      `🌡 <b>Current Status:</b> ${readingStr}\n` +
      `${statusDesc}\n` +
      `⏰ <b>Time:</b> ${timeStr}`;

    return this.sendTelegramMsg(msg);
  }

  /**
   * ==========================================================================
   * 2-WAY TELEGRAM CHATBOT QUESTION POLLER
   * ==========================================================================
   * Polls Telegram /getUpdates for messages typed in your Telegram group.
   */
  public async checkIncomingQuestionsAndReply(
    liveDataMap: Map<string, SensorPoint>
  ): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=1`;

    try {
      const res = await fetch(url);
      if (!res.ok) return;

      const data: any = await res.json();
      const updates = data.result || [];

      for (const update of updates) {
        this.lastUpdateId = update.update_id;
        const msg = update.message;
        if (!msg || !msg.text) continue;

        const text: string = msg.text;

        // Skip bot's own alert messages starting with icons
        if (
          ["🚨", "✅", "❄️", "⚠️", "🔴", "🤖"].some((icon) =>
            text.startsWith(icon)
          )
        ) {
          continue;
        }

        await this.replyUserQuery(text, liveDataMap);
      }
    } catch (e) {
      // Ignore network polling exceptions silently
    }
  }

  /**
   * 💡 HOW TO ADD NEW CHATBOT QUERY KEYWORDS:
   * Add new words to `validKeywords` below (e.g. "chiller", "fan", "pump", "valve")!
   */
  private async replyUserQuery(
    queryText: string,
    liveDataMap: Map<string, SensorPoint>
  ): Promise<void> {
    const queryLower = queryText.toLowerCase();

    // Strict Filter Engine: Only replies if the message is genuinely about BMS points or equipment!
    const validKeywords = [
      "temp",
      "temperature",
      "room",
      "sensor",
      "pump",
      "pumb",
      "fan",
      "ahu",
      "chiller",
      "valve",
      "fire",
      "smoke",
      "heat",
      "alarm",
      "fault",
      "disable",
      "disabled",
      "status",
      "all",
      "run",
      "running",
      "stop",
      "stopped",
      "off",
      "on",
      "1",
      "2",
      "3",
      "4",
      "5",
    ];

    // Dynamic check: Also accept any text matching live devices or points in memory
    const hasLiveMatch = Array.from(liveDataMap.values()).some(
      (pt) =>
        queryLower.includes(pt.name.toLowerCase()) ||
        queryLower.includes((pt.deviceName || "").toLowerCase()) ||
        pt.name.toLowerCase().includes(queryLower) ||
        (pt.deviceName || "").toLowerCase().includes(queryLower)
    );

    if (!hasLiveMatch && !validKeywords.some((k) => queryLower.includes(k))) {
      console.log(`🛑 Ignored non-BMS chat message: '${queryText}' (SILENT - No reply sent)`);
      return;
    }

    console.log(`📩 Processing BMS Question: '${queryText}'`);

    const matchingPoints: Map<string, SensorPoint> = new Map();
    const queryNumbers: string[] = queryLower.match(/\d+/g) || [];

    for (const [ptName, pt] of liveDataMap.entries()) {
      const ptLower = ptName.toLowerCase().replace(/\$20/g, " ");
      const ptNumbers: string[] = ptLower.match(/\d+/g) || [];

      if (queryNumbers.length > 0) {
        if (queryNumbers.some((n) => ptNumbers.includes(n))) {
          if (
            queryLower.includes("temp") &&
            (ptLower.includes("temp") || ptLower.includes("sensor"))
          ) {
            matchingPoints.set(ptName, pt);
          } else if (
            (queryLower.includes("smoke") ||
              queryLower.includes("fire") ||
              queryLower.includes("alarm")) &&
            (ptLower.includes("smoke") ||
              ptLower.includes("fire") ||
              ptLower.includes("alarm"))
          ) {
            matchingPoints.set(ptName, pt);
          } else if (
            queryLower.includes("heat") &&
            ptLower.includes("heat")
          ) {
            matchingPoints.set(ptName, pt);
          } else if (
            !["temp", "smoke", "fire", "heat"].some((k) =>
              queryLower.includes(k)
            )
          ) {
            matchingPoints.set(ptName, pt);
          }
        }
      } else {
        if (
          queryLower.includes("temp") ||
          queryLower.includes("temperature")
        ) {
          if (
            ptLower.includes("temp") ||
            ptLower.includes("sensor") ||
            ["HIGH", "LOW", "NORMAL"].includes(pt.state)
          ) {
            matchingPoints.set(ptName, pt);
          }
        } else if (
          queryLower.includes("smoke") ||
          queryLower.includes("fire") ||
          queryLower.includes("alarm")
        ) {
          if (
            ptLower.includes("smoke") ||
            ptLower.includes("fire") ||
            ptLower.includes("alarm") ||
            pt.state.includes("SMOKE")
          ) {
            matchingPoints.set(ptName, pt);
          }
        } else if (queryLower.includes("heat")) {
          if (ptLower.includes("heat")) {
            matchingPoints.set(ptName, pt);
          }
        } else if (
          queryLower.includes("status") ||
          queryLower.includes("all")
        ) {
          matchingPoints.set(ptName, pt);
        }
      }
    }

    if (matchingPoints.size === 0) {
      for (const [ptName, pt] of liveDataMap.entries()) {
        const ptClean = ptName
          .toLowerCase()
          .replace(/\$20/g, "")
          .replace(/_/g, "");
        const qClean = queryLower.replace(/\s+/g, "").replace(/_/g, "");
        if (ptClean.includes(qClean) || qClean.includes(ptClean)) {
          matchingPoints.set(ptName, pt);
        }
      }
    }

    if (matchingPoints.size === 0) {
      console.log(`🛑 No matching BMS points found for: '${queryText}'`);
      return;
    }

    let replyCard = `🤖 <b>BMS REPORT</b>\n`;

    for (const [ptName, pt] of matchingPoints.entries()) {
      const cleanName = this.escapeHtml(ptName.replace(/\$20/g, " "));
      const state = pt.state;
      const val = this.escapeHtml(pt.displayValue);
      const dev = this.escapeHtml(pt.deviceName || "BMS");
      const lowLim = pt.lowLimit;
      const highLim = pt.highLimit;

      let icon = "🟢";
      let desc = "NORMAL";

      if (state === "HIGH") {
        icon = "🚨";
        desc = `HIGH (&gt; ${highLim}°C)`;
      } else if (state === "LOW") {
        icon = "❄️";
        desc = `LOW (&lt; ${lowLim}°C)`;
      } else if (state === "SMOKE_ALARM") {
        icon = "🚨";
        desc = "SMOKE DETECTED!";
      } else if (state === "SMOKE_NORMAL") {
        icon = "✅";
        desc = "NO SMOKE";
      } else if (state === "BOOL_ON") {
        icon = "⚡";
        desc = "ON / RUNNING";
      } else if (state === "BOOL_OFF") {
        icon = "🔴";
        desc = "OFF / STOPPED";
      } else if (state === "ENUM_ALARM") {
        icon = "🚨";
        desc = "ALARM (2)";
      } else if (state === "ENUM_FAULT") {
        icon = "⚠️";
        desc = "FAULT (3)";
      } else if (state === "ENUM_DISABLE") {
        icon = "🔴";
        desc = "DISABLED (4)";
      } else {
        icon = "🟢";
        desc = "NORMAL";
      }

      replyCard += `${icon} <b>[${dev}] ${cleanName}:</b> ${val} (${desc})\n`;
    }

    const timeStr = new Date().toTimeString().substring(0, 8);
    replyCard += `\n⏰ <b>Time:</b> ${timeStr}`;
    await this.sendTelegramMsg(replyCard);
  }

  public async sendReportCard(
    points: SensorPoint[],
    hasAlarm: boolean
  ): Promise<boolean> {
    const lines: string[] = [
      `🏢 <b>AHU CONTROLLER STATUS SUMMARY</b>`,
      `─────────────────────────────────────`,
    ];

    for (const pt of points) {
      const cleanName = this.escapeHtml(pt.name.replace(/_/g, " "));
      const displayVal = this.escapeHtml(pt.displayValue);
      if (pt.isAlarm()) {
        lines.push(
          `🌡️ <b>${cleanName}:</b> <code>${displayVal}</code> 🔴 (ALARM)`
        );
      } else {
        lines.push(
          `⚙️ <b>${cleanName}:</b> <code>${displayVal}</code> 🟢 (Normal)`
        );
      }
    }

    lines.push(`─────────────────────────────────────`);
    lines.push(
      hasAlarm
        ? `⚠️ <b>Status:</b> BMS Alarm Condition Detected!`
        : `✅ <b>Status:</b> All Points Normal`
    );
    lines.push(
      `⏰ <b>Time:</b> ${new Date().toISOString().replace("T", " ").substring(0, 19)}`
    );

    return this.sendTelegramMsg(lines.join("\n"));
  }
}
