import { IObixGateway } from "../adapters/gateways/IObixGateway";
import { ITelegramGateway } from "../adapters/gateways/ITelegramGateway";
import { ISensorRepository } from "../adapters/repositories/ISensorRepository";
import { SensorPoint, PointState } from "../domain/entities/SensorPoint";

export class Process10PointObixBatch {
  private lastStates: Map<string, PointState> = new Map();
  private liveDataMap: Map<string, SensorPoint> = new Map();

  constructor(
    private obixGateway: IObixGateway,
    private telegramGateway: ITelegramGateway,
    private sensorRepository: ISensorRepository
  ) {}

  public async execute(): Promise<number> {
    // 1. Poll incoming questions from Telegram group members (2-Way Chatbot)
    await this.telegramGateway.checkIncomingQuestionsAndReply(this.liveDataMap);

    // 2. Fetch points from Niagara oBIX
    const points = await this.obixGateway.fetch10PointBatch();

    if (!points || points.length === 0) {
      return 0;
    }

    // 3. Save readings to Supabase DB & emit Realtime updates
    await this.sensorRepository.saveBatchReadings(points);

    // 4. Process each point, evaluate state changes & trigger Telegram alerts
    for (const pt of points) {
      this.liveDataMap.set(pt.name, pt);
      const keyId = pt.keyId;
      const previousState = this.lastStates.get(keyId);

      console.log(
        `📡 [${pt.deviceName}] -> [${pt.name}]: ${pt.displayValue} | State: [${pt.state}]`
      );

      // Trigger Telegram Alert on state transition
      if (pt.state !== previousState) {
        await this.telegramGateway.sendPointStateAlert(pt);
        this.lastStates.set(keyId, pt.state);
      }
    }

    return points.length;
  }
}
