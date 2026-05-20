import { Injectable } from '@nestjs/common';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import type { GameEngineState } from '../engine/game-engine.types';
import { GAME_SNAPSHOTS } from '../game.constants';
import { GameStateService } from '../state/game-state.service';
import { GameSnapshotRepository } from './game-snapshots.repository';
import type { GameSnapshotType } from './game-snapshots.types';

@Injectable()
export class GameSnapshotService {
  constructor(
    private readonly gameSnapshotRepository: GameSnapshotRepository,
    private readonly gameStateService: GameStateService,
  ) {}

  async createStartSnapshot(
    gameId: string,
    state: GameEngineState,
    executor?: DatabaseExecutor,
  ): Promise<void> {
    await this.createSnapshot(gameId, 'start', state, executor);
  }

  async createFinalSnapshot(
    gameId: string,
    state: GameEngineState,
    executor?: DatabaseExecutor,
  ): Promise<void> {
    await this.createSnapshot(gameId, 'final', state, executor);
  }

  async createSnapshotAfterCommand(
    gameId: string,
    state: GameEngineState,
  ): Promise<void> {
    if (state.phase === 'finished' || state.phase === 'cancelled') {
      await this.createFinalSnapshot(gameId, state);
      return;
    }

    if (state.turnNumber % GAME_SNAPSHOTS.everyNTurns !== 0) {
      return;
    }

    await this.createSnapshot(gameId, 'turn', state);
  }

  async restoreLatestSnapshot(gameId: string): Promise<GameEngineState | null> {
    const snapshot =
      await this.gameSnapshotRepository.findLatestByGameId(gameId);

    if (!snapshot) {
      return null;
    }

    await this.gameStateService.set(gameId, snapshot.state);

    return snapshot.state;
  }

  private async createSnapshot(
    gameId: string,
    snapshotType: GameSnapshotType,
    state: GameEngineState,
    executor?: DatabaseExecutor,
  ): Promise<void> {
    await this.gameSnapshotRepository.create(
      {
        gameId,
        roomId: state.roomId,
        snapshotType,
        state,
      },
      executor,
    );
  }
}
