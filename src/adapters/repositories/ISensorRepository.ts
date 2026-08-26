import { SensorPoint } from "../../domain/entities/SensorPoint";

export interface ISensorRepository {
  saveBatchReadings(points: SensorPoint[]): Promise<void>;
}

