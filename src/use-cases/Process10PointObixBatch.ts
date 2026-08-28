/**
 * ============================================================================
 * PROCESS OBIX BATCH USE CASE (WORKFLOW ORCHESTRATOR)
 * ============================================================================
 * Coordinates the 4 main operations on every cycle:
 *  1. Checks for incoming Telegram questions from chat members (2-Way Chatbot).
 *  2. Reads live points from Niagara oBIX HTTP API.
 *  3. Persists readings into Supabase tables (live + time-series).
 *  4. Evaluates state transitions and triggers Telegram alerts on state change.
 */

import { IObixGateway } from "../adapters/gateways/IObixGateway";
import { ITelegramGateway } from "../adapters/gateways/ITelegramGateway";
import { ISensorRepository } from "../adapters/repositories/ISensorRepository";
import { SensorPoint, PointState } from "../domain/entities/SensorPoint";

export class Process10PointObixBatch {
  // Cache of previous states to prevent Telegram chat spamming
  private lastStates: Map<string, PointState> = new Map();
  // Live in-memory cache of current point states for 2-way chatbot replies
  private liveDataMap: Map<string, SensorPoint> = new Map();

  constructor(
    private obixGateway: IObixGateway,
    private telegramGateway: ITelegramGateway,
    private sensorRepository: ISensorRepository
  ) {}

  public async execute(): Promise<number> {
    // Step 1: Poll incoming questions typed in Telegram group by users
    await this.telegramGateway.checkIncomingQuestionsAndReply(this.liveDataMap);

    // Step 2: Fetch points from Niagara oBIX
    const points = await this.obixGateway.fetch10PointBatch();

    if (!points || points.length === 0) {
      return 0;
    }

    // Step 3: Save readings to Supabase DB & emit Realtime updates
    await this.sensorRepository.saveBatchReadings(points);

    // Step 4: Process each point, evaluate state changes & trigger Telegram alerts
    for (const pt of points) {
      this.liveDataMap.set(pt.name, pt);
      const keyId = pt.keyId;
      const previousState = this.lastStates.get(keyId);

      // Console output matching Python script format
      console.log(
        `📡 [${pt.deviceName}] -> [${pt.name}]: ${pt.displayValue} | State: [${pt.state}]`
      );

      // Trigger Telegram Alert only when state transitions
      if (pt.state !== previousState) {
        await this.telegramGateway.sendPointStateAlert(pt);
        this.lastStates.set(keyId, pt.state);
      }
    }

    return points.length;
  }
}
