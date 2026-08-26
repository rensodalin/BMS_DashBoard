import { SensorPoint } from "../../domain/entities/SensorPoint";

export interface ITelegramGateway {
  sendReportCard(points: SensorPoint[], hasAlarm: boolean): Promise<boolean>;
  sendPointStateAlert(point: SensorPoint): Promise<boolean>;
  checkIncomingQuestionsAndReply(liveDataMap: Map<string, SensorPoint>): Promise<void>;
}
