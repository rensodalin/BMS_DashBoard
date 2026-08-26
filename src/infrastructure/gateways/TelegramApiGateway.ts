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

  public async sendPointStateAlert(point: SensorPoint): Promise<boolean> {
    const cleanPoint = point.name.replace(/\$20/g, " ").replace(/%20/g, " ");
    const deviceName = point.deviceName;
    const stateType = point.state;
    const displayVal = point.displayValue;
    const lowLim = point.lowLimit;
    const highLim = point.highLimit;

    let header = "";
    let statusDesc = "";
    let readingStr = "";

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
    } else if (stateType === "SMOKE_ALARM") {
      header = `🚨 <b>BMS SMOKE DETECTED ALERT!</b> 🚨`;
      statusDesc = "🔥 <b>Status:</b> SMOKE / FIRE ALARM DETECTED (TRUE)!";
      readingStr = "⚠️ ACTIVE ALARM";
    } else if (stateType === "SMOKE_NORMAL") {
      header = `✅ <b>BMS ${cleanPoint.toUpperCase()} NORMAL</b> ✅`;
      statusDesc = "🟢 <b>Status:</b> Normal (No Smoke Detected)";
      readingStr = "CLEAR (FALSE)";
    } else if (stateType === "HIGH") {
      header = `🚨 <b>BMS HIGH ${cleanPoint.toUpperCase()} ALERT!</b> 🚨`;
      statusDesc = `🔥 <b>Status:</b> High Limit (> ${highLim.toFixed(1)} °C)`;
      readingStr = `${displayVal} °C`;
    } else if (stateType === "LOW") {
      header = `❄️ <b>BMS LOW ${cleanPoint.toUpperCase()} ALERT!</b> ❄️`;
      statusDesc = `🧊 <b>Status:</b> Low Limit (< ${lowLim.toFixed(1)} °C)`;
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

  private async replyUserQuery(
    queryText: string,
    liveDataMap: Map<string, SensorPoint>
  ): Promise<void> {
    const queryLower = queryText.toLowerCase();

    const validKeywords = [
      "temp",
      "temperature",
      "room",
      "sensor",
      "fire",
      "smoke",
      "heat",
      "alarm",
      "fault",
      "disable",
      "status",
      "all",
      "/",
      "1",
      "2",
      "3",
      "4",
      "5",
    ];

    if (!validKeywords.some((k) => queryLower.includes(k))) {
      console.log(`🛑 Ignored non-BMS chat message: '${queryText}'`);
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
      const cleanName = ptName.replace(/\$20/g, " ");
      const state = pt.state;
      const val = pt.displayValue;
      const dev = pt.deviceName || "BMS";
      const lowLim = pt.lowLimit;
      const highLim = pt.highLimit;

      let icon = "🟢";
      let desc = "NORMAL";

      if (state === "HIGH") {
        icon = "🚨";
        desc = `HIGH (> ${highLim}°C)`;
      } else if (state === "LOW") {
        icon = "❄️";
        desc = `LOW (< ${lowLim}°C)`;
      } else if (state === "SMOKE_ALARM") {
        icon = "🚨";
        desc = "SMOKE DETECTED!";
      } else if (state === "SMOKE_NORMAL") {
        icon = "✅";
        desc = "NO SMOKE";
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
      const cleanName = pt.name.replace(/_/g, " ");
      if (pt.isAlarm()) {
        lines.push(
          `🌡️ <b>${cleanName}:</b> <code>${pt.displayValue}</code> 🔴 (ALARM)`
        );
      } else {
        lines.push(
          `⚙️ <b>${cleanName}:</b> <code>${pt.displayValue}</code> 🟢 (Normal)`
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
