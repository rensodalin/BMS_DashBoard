/**
 * ============================================================================
 * SENSOR POINT ENTITY & DOMAIN EVALUATION ENGINE
 * ============================================================================
 * This file defines the core SensorPoint entity and state evaluation rules.
 * 
 * 💡 HOW TO CUSTOMIZE ROOM LIMITS:
 * Add or modify room entries in the `ROOM_LIMITS` dictionary below.
 * Point names are matched automatically (spaces and underscores are ignored).
 */

export type PointState =
  | "HIGH"          // Numeric value exceeds high temperature limit
  | "LOW"           // Numeric value is below low temperature limit
  | "NORMAL"        // Numeric value is within normal temperature range
  | "SMOKE_ALARM"   // Smoke/Fire Boolean point triggered (true/on/run)
  | "SMOKE_NORMAL"  // Smoke/Fire Boolean point clear (false/off/stop)
  | "BOOL_ON"       // General Equipment Boolean point active (true/on/run/running)
  | "BOOL_OFF"      // General Equipment Boolean point inactive (false/off/stop/stopped)
  | "ENUM_ALARM"    // Enum point status code 2 or "Alarm"
  | "ENUM_FAULT"    // Enum point status code 3 or "Fault"
  | "ENUM_DISABLE"  // Enum point status code 4 or "Disabled"
  | "ENUM_NORMAL";  // Enum point status code 1 or "Normal"

export interface RoomLimit {
  low: number;   // Minimum acceptable temperature (°C)
  high: number;  // Maximum acceptable temperature (°C)
}

/**
 * 🛠️ CUSTOMIZABLE ROOM TEMPERATURE THRESHOLDS
 * You can add new room definitions here anytime!
 * Example: "Server_Room_1": { low: 16.0, high: 24.0 },
 */
export const ROOM_LIMITS: Record<string, RoomLimit> = {
  "Room1_Temp": { low: 18.0, high: 25.0 },   // Server Room Limits
  "Room2_Temp": { low: 12.0, high: 22.0 },   // Cold Room Limits
  "Room3_Temp": { low: 20.0, high: 30.0 },   // Office Room Limits
  "Sensor Test": { low: 20.0, high: 30.0 },  // Test Sensor Limits
  "DEFAULT":     { low: 20.0, high: 30.0 },  // Default fallback limit
};

export interface SensorPointProps {
  deviceName: string;
  name: string;
  displayValue: string;
  numericValue?: number;
  lowLimit: number;
  highLimit: number;
  state: PointState;
}

export class SensorPoint {
  public readonly deviceName: string;
  public readonly name: string;
  public readonly displayValue: string;
  public readonly numericValue: number;
  public readonly lowLimit: number;
  public readonly highLimit: number;
  public readonly state: PointState;

  constructor(props: SensorPointProps) {
    this.deviceName = props.deviceName;
    this.name = props.name;
    this.displayValue = props.displayValue;
    this.numericValue = props.numericValue ?? 0;
    this.lowLimit = props.lowLimit;
    this.highLimit = props.highLimit;
    this.state = props.state;
  }

  /**
   * Unique state tracking key combining device name & point name
   */
  public get keyId(): string {
    return `${this.deviceName}_${this.name}`;
  }

  /**
   * Checks if point is currently in an active alarm/fault/warning condition
   */
  public isAlarm(): boolean {
    return [
      "HIGH",
      "LOW",
      "SMOKE_ALARM",
      "BOOL_ON",
      "ENUM_ALARM",
      "ENUM_FAULT",
      "ENUM_DISABLE",
    ].includes(this.state);
  }

  /**
   * ==========================================================================
   * DYNAMIC POINT EVALUATION FACTORY METHOD
   * ==========================================================================
   * Inspects live display value from Niagara and categorizes it into:
   *  - TYPE 1: ENUM POINT (Alarm 2, Fault 3, Disabled 4, Normal 1)
   *  - TYPE 2: BOOLEAN POINT (true/false, on/off, run/stop)
   *  - TYPE 3: NUMERIC POINT (temperature vs low/high room thresholds)
   */
  public static evaluatePoint(
    deviceName: string,
    ptName: string,
    displayStr: string
  ): SensorPoint {
    // 1. Clean encoding characters from point name ($20 / %20 -> spaces)
    const cleanPtName = ptName.replace(/\$20/g, " ").replace(/%20/g, " ");
    const displayClean = displayStr.toLowerCase();

    // 2. Smart lookup in ROOM_LIMITS (ignores case, spaces, and underscores)
    const normKey = cleanPtName.toLowerCase().replace(/[\s_]+/g, "");
    let limits: RoomLimit | undefined =
      ROOM_LIMITS[cleanPtName] || ROOM_LIMITS[ptName];

    if (!limits) {
      for (const [key, lim] of Object.entries(ROOM_LIMITS)) {
        if (key.toLowerCase().replace(/[\s_]+/g, "") === normKey) {
          limits = lim;
          break;
        }
      }
    }

    limits = limits || ROOM_LIMITS["DEFAULT"];
    const lowLim = limits.low;
    const highLim = limits.high;

    let state: PointState = "NORMAL";
    let numericVal: number | undefined = undefined;
    let valOut = displayStr;

    // ------------------------------------------------------------------------
    // TYPE 1: ENUM POINT (e.g. Alarm, Fault, Disabled, Normal)
    // ------------------------------------------------------------------------
    if (
      ["normal", "alarm", "fault", "disable", "disabled"].some((k) =>
        displayClean.includes(k)
      ) &&
      !displayClean.includes("true") &&
      !displayClean.includes("false") &&
      !/\b(on|off|run|running|stop|stopped)\b/i.test(displayClean)
    ) {
      if (displayClean.includes("alarm") || displayClean.includes("2")) {
        state = "ENUM_ALARM";
      } else if (displayClean.includes("fault") || displayClean.includes("3")) {
        state = "ENUM_FAULT";
      } else if (
        displayClean.includes("disable") ||
        displayClean.includes("disabled") ||
        displayClean.includes("4")
      ) {
        state = "ENUM_DISABLE";
      } else {
        state = "ENUM_NORMAL";
      }
    }
    // ------------------------------------------------------------------------
    // TYPE 2: BOOLEAN POINT (true/false, on/off, run/running, stop/stopped)
    // ------------------------------------------------------------------------
    else if (
      displayClean.includes("true") ||
      displayClean.includes("false") ||
      /\b(on|off|run|running|stop|stopped)\b/i.test(displayClean)
    ) {
      const isSmokeOrFire =
        cleanPtName.toLowerCase().includes("smoke") ||
        cleanPtName.toLowerCase().includes("fire") ||
        cleanPtName.toLowerCase().includes("alarm");

      const isOnOrRun =
        displayClean.includes("true") ||
        /\b(on|run|running)\b/i.test(displayClean);

      if (isSmokeOrFire) {
        state = isOnOrRun ? "SMOKE_ALARM" : "SMOKE_NORMAL";
      } else {
        state = isOnOrRun ? "BOOL_ON" : "BOOL_OFF";
      }
    }
    // ------------------------------------------------------------------------
    // TYPE 3: NUMERIC POINT (Temperature, Pressure, Humidity, kWh numbers)
    // ------------------------------------------------------------------------
    else {
      const numMatch = displayStr.match(/([0-9.-]+)/);
      if (numMatch) {
        numericVal = parseFloat(numMatch[1]);
        valOut = numericVal.toFixed(1);

        if (numericVal > highLim) {
          state = "HIGH";
        } else if (numericVal < lowLim) {
          state = "LOW";
        } else {
          state = "NORMAL";
        }
      }
    }

    return new SensorPoint({
      deviceName,
      name: cleanPtName,
      displayValue: valOut,
      numericValue: numericVal,
      lowLimit: lowLim,
      highLimit: highLim,
      state,
    });
  }
}
