import { NotFoundException } from '@nestjs/common';
import { createGameEngineState } from '../../engine/tests/game-engine.test-factory';
import type { GameSnapshotService } from '../../snapshots/game-snapshots.service';
import type { GameStateService } from '../../state/game-state.service';
import { GameRecoveryService } from '../game-recovery.service';

type GameStateServiceMock = {
  get: jest.Mock;
};

type GameSnapshotServiceMock = {
  restoreLatestSnapshot: jest.Mock;
};

describe('GameRecoveryService', () => {
  let service: GameRecoveryService;
  let gameStateService: GameStateServiceMock;
  let gameSnapshotService: GameSnapshotServiceMock;

  const state = createGameEngineState({
    phase: 'awaiting_roll',
    turnNumber: 4,
  });

  beforeEach(() => {
    gameStateService = {
      get: jest.fn().mockResolvedValue(state),
    };

    gameSnapshotService = {
      restoreLatestSnapshot: jest.fn().mockResolvedValue(state),
    };

    service = new GameRecoveryService(
      gameStateService as unknown as GameStateService,
      gameSnapshotService as unknown as GameSnapshotService,
    );
  });

  it('returns Redis state when it exists', async () => {
    await expect(service.getOrRecover('game-1')).resolves.toBe(state);

    expect(gameStateService.get).toHaveBeenCalledWith('game-1');
    expect(gameSnapshotService.restoreLatestSnapshot).not.toHaveBeenCalled();
  });

  it('restores latest snapshot when Redis state is missing', async () => {
    gameStateService.get.mockRejectedValue(new NotFoundException());

    await expect(service.getOrRecover('game-1')).resolves.toBe(state);

    expect(gameSnapshotService.restoreLatestSnapshot).toHaveBeenCalledWith(
      'game-1',
    );
  });

  it('throws original missing-state error when no snapshot exists', async () => {
    const error = new NotFoundException('Game state not found');
    gameStateService.get.mockRejectedValue(error);
    gameSnapshotService.restoreLatestSnapshot.mockResolvedValue(null);

    await expect(service.getOrRecover('game-1')).rejects.toThrow(error);
  });

  it('rethrows non-missing Redis errors', async () => {
    const error = new Error('redis down');
    gameStateService.get.mockRejectedValue(error);

    await expect(service.getOrRecover('game-1')).rejects.toThrow(error);

    expect(gameSnapshotService.restoreLatestSnapshot).not.toHaveBeenCalled();
  });

  it('restores or throws when recovery is required', async () => {
    await expect(service.recoverOrThrow('game-1')).resolves.toBe(state);

    expect(gameSnapshotService.restoreLatestSnapshot).toHaveBeenCalledWith(
      'game-1',
    );
  });

  it('throws when required recovery has no snapshot', async () => {
    gameSnapshotService.restoreLatestSnapshot.mockResolvedValue(null);

    await expect(service.recoverOrThrow('game-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
