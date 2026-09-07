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

// Billing System Database Types
export interface TenantMeter {
  id?: string;
  meter_name: string;
  obix_href?: string;
  tenant_name: string;
  unit_zone: string;
  demand_charge: number;
  created_at?: string;
}

export interface UtilityRate {
  id?: string;
  rate_name: string;
  rate_per_kwh: number;
  currency: string;
  khr_exchange_rate: number;
  is_active: boolean;
  updated_at?: string;
}

export interface TenantInvoiceDb {
  id?: string;
  invoice_number: string;
  meter_name: string;
  tenant_name: string;
  unit_zone: string;
  kwh_reading: number;
  rate_per_kwh: number;
  demand_charge: number;
  total_cost_usd: number;
  total_cost_khr: number;
  billing_period: string;
  start_date?: string;
  end_date?: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

