import { SensorPoint } from "../../domain/entities/SensorPoint";

export interface IObixGateway {
  fetch10PointBatch(): Promise<SensorPoint[]>;
}

