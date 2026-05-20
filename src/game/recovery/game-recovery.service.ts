import { Injectable, NotFoundException } from '@nestjs/common';
import type { GameEngineState } from '../engine/game-engine.types';
import { GameSnapshotService } from '../snapshots/game-snapshots.service';
import { GameStateService } from '../state/game-state.service';

@Injectable()
export class GameRecoveryService {
  constructor(
    private readonly gameStateService: GameStateService,
    private readonly gameSnapshotService: GameSnapshotService,
  ) {}

  async getOrRecover(gameId: string): Promise<GameEngineState> {
    try {
      return await this.gameStateService.get(gameId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      const recoveredState =
        await this.gameSnapshotService.restoreLatestSnapshot(gameId);

      if (!recoveredState) {
        throw error;
      }

      return recoveredState;
    }
  }

  async recoverOrThrow(gameId: string): Promise<GameEngineState> {
    const recoveredState =
      await this.gameSnapshotService.restoreLatestSnapshot(gameId);

    if (!recoveredState) {
      throw new NotFoundException('Game state not found');
    }

    return recoveredState;
  }
}
