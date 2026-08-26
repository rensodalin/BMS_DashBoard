export type PointState =
  | "HIGH"
  | "LOW"
  | "NORMAL"
  | "SMOKE_ALARM"
  | "SMOKE_NORMAL"
  | "ENUM_ALARM"
  | "ENUM_FAULT"
  | "ENUM_DISABLE"
  | "ENUM_NORMAL";

export interface RoomLimit {
  low: number;
  high: number;
}

export const ROOM_LIMITS: Record<string, RoomLimit> = {
  "Room1_Temp": { low: 18.0, high: 25.0 },
  "Room2_Temp": { low: 12.0, high: 22.0 },
  "Room3_Temp": { low: 20.0, high: 30.0 },
  "Sensor Test": { low: 20.0, high: 30.0 },
  "DEFAULT": { low: 20.0, high: 30.0 },
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

  public get keyId(): string {
    return `${this.deviceName}_${this.name}`;
  }

  public isAlarm(): boolean {
    return [
      "HIGH",
      "LOW",
      "SMOKE_ALARM",
      "ENUM_ALARM",
      "ENUM_FAULT",
      "ENUM_DISABLE",
    ].includes(this.state);
  }

  public static evaluatePoint(
    deviceName: string,
    ptName: string,
    displayStr: string
  ): SensorPoint {
    const cleanPtName = ptName.replace(/\$20/g, " ").replace(/%20/g, " ");
    const displayClean = displayStr.toLowerCase();

    // Smart lookup in ROOM_LIMITS (ignores case, spaces, and underscores)
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

    // TYPE 1: ENUM POINT
    if (
      ["normal", "alarm", "fault", "disable", "disabled"].some((k) =>
        displayClean.includes(k)
      ) &&
      !displayClean.includes("true") &&
      !displayClean.includes("false")
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
    // TYPE 2: BOOLEAN POINT
    else if (displayClean.includes("true") || displayClean.includes("false")) {
      state = displayClean.includes("true") ? "SMOKE_ALARM" : "SMOKE_NORMAL";
    }
    // TYPE 3: NUMERIC POINT
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
