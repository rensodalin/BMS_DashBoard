export type PointState =
  | 'HIGH'
  | 'LOW'
  | 'NORMAL'
  | 'SMOKE_ALARM'
  | 'SMOKE_NORMAL'
  | 'BOOL_ON'
  | 'BOOL_OFF'
  | 'ENUM_ALARM'
  | 'ENUM_FAULT'
  | 'ENUM_DISABLE'
  | 'ENUM_NORMAL';

export interface SensorPoint {
  id?: string;
  point_name: string;
  device_name?: string;
  obix_url?: string;
  current_value: number;
  display_value?: string;
  alert_threshold: number;
  low_limit?: number;
  high_limit?: number;
  is_alarm: boolean;
  state?: PointState;
  updated_at: string;
}

export interface PointReading {
  id: number;
  point_name: string;
  value: number;
  recorded_at: string;
}

export type FilterCategory = 'ALL' | 'ALARMS' | 'RUNNING' | 'TEMPERATURES' | 'ENUMS';
