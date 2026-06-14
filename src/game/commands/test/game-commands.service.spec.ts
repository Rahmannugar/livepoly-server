import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GameCommandsService } from '../game-commands.service';
import { GAME_COMMANDS } from '../../game.constants';
import type { GameEngineState } from '../../engine/game-engine.types';

describe('GameCommandsService', () => {
  const gameId = 'game-1';
  const roomPlayerId = 'room-player-1';

  const makeState = (overrides: Partial<GameEngineState> = {}) =>
    ({
      version: 1,
      roomId: 'room-1',
      roomCode: 'ABCD12',
      boardKey: 'classic',
      mode: 'ranked',
      startedAt: 1_000,
      durationMinutes: 60,
      expiresAt: 3_601_000,
      phase: 'awaiting_first_turn',
      turnNumber: 1,
      currentTurnRoomPlayerId: roomPlayerId,
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
      lastDiceRoll: null,
      pendingTileKey: null,
      auction: null,
      debt: null,
      decks: {
        chance: {
          drawPile: [],
          discardPile: [],
        },
        worldFund: {
          drawPile: [],
          discardPile: [],
        },
      },
      players: [
        {
          roomPlayerId,
          userId: 'user-1',
          username: 'player-one',
          playerType: 'human',
          botDifficulty: null,
          botName: null,
          seatNumber: 1,
          cash: 1500,
          position: 0,
          inJail: false,
          jailTurnCount: 0,
          getOutOfJailFreeCards: 0,
          consecutiveMissedTurns: 0,
          bankrupt: false,
        },
        {
          roomPlayerId: 'room-player-2',
          userId: 'user-2',
          username: 'player-two',
          playerType: 'human',
          botDifficulty: null,
          botName: null,
          seatNumber: 2,
          cash: 1500,
          position: 0,
          inJail: false,
          jailTurnCount: 0,
          getOutOfJailFreeCards: 0,
          consecutiveMissedTurns: 0,
          bankrupt: false,
        },
      ],
      properties: [],
      ...overrides,
    }) as GameEngineState;

  const makeService = (state = makeState()) => {
    let storedState = state;

    const gameStateService = {
      update: jest.fn(async (_gameId, reducer) => {
        storedState = reducer(storedState);
        return storedState;
      }),
    };

    const observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    const gameSnapshotService = {
      createSnapshotAfterCommand: jest.fn(),
    };

    const gameRecoveryService = {
      recoverOrThrow: jest.fn(),
    };

    const gameResultsService = {
      finalizeFinishedGame: jest.fn(),
    };

    const gameEventsService = {
      appendEvents: jest.fn(),
    };

    const service = new GameCommandsService(
      gameStateService as never,
      observabilityService as never,
      gameSnapshotService as never,
      gameRecoveryService as never,
      gameResultsService as never,
      gameEventsService as never,
    );

    return {
      service,
      gameStateService,
      observabilityService,
      gameSnapshotService,
      gameRecoveryService,
      gameResultsService,
      gameEventsService,
      getStoredState: () => storedState,
    };
  };

  it('rolls and moves the current player', async () => {
    const {
      service,
      gameSnapshotService,
      gameResultsService,
      gameEventsService,
    } = makeService();

    const result = await service.rollAndMove({
      gameId,
      roomPlayerId,
      dice: [1, 2],
    });

    expect(result.intentType).toBe(GAME_COMMANDS.rollAndMove);
    expect(result.state.players[0].position).toBe(3);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'player_moved',
          roomPlayerId,
          fromPosition: 0,
          toPosition: 3,
          dice: [1, 2],
        }),
        expect.objectContaining({
          type: 'player_landed_on_tile',
          roomPlayerId,
          tileKind: 'property',
        }),
      ]),
    );
    expect(gameSnapshotService.createSnapshotAfterCommand).toHaveBeenCalledWith(
      gameId,
      result.state,
    );
    expect(gameResultsService.finalizeFinishedGame).not.toHaveBeenCalled();

    expect(gameEventsService.appendEvents).toHaveBeenCalledWith(
      gameId,
      result.events,
    );
  });

  it('ends the current turn', async () => {
    const { service } = makeService(
      makeState({
        phase: 'awaiting_turn_end',
        lastDiceRoll: [1, 2],
      }),
    );

    const result = await service.endTurn({
      gameId,
      roomPlayerId,
    });

    expect(result.intentType).toBe(GAME_COMMANDS.endTurn);
    expect(result.state.currentTurnRoomPlayerId).toBe('room-player-2');
    expect(result.events).toEqual([
      {
        type: 'turn_ended',
        roomPlayerId,
        nextRoomPlayerId: 'room-player-2',
        turnNumber: 2,
      },
    ]);
  });

  it('rejects a command when the actor does not match the intent player', async () => {
    const { service, gameStateService } = makeService();

    await expect(
      service.executeIntent({
        gameId,
        roomPlayerId: 'room-player-2',
        intent: {
          type: 'roll_and_move',
          payload: {
            roomPlayerId,
            dice: [1, 2],
          },
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(gameStateService.update).not.toHaveBeenCalled();
  });

  it('recovers missing Redis state once before retrying the command', async () => {
    const state = makeState();
    const gameStateService = {
      update: jest
        .fn()
        .mockRejectedValueOnce(new NotFoundException('Game state not found'))
        .mockImplementationOnce(async (_gameId, reducer) => reducer(state)),
    };

    const observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    const gameSnapshotService = {
      createSnapshotAfterCommand: jest.fn(),
    };

    const gameRecoveryService = {
      recoverOrThrow: jest.fn(),
    };

    const gameResultsService = {
      finalizeFinishedGame: jest.fn(),
    };

    const gameEventsService = {
      appendEvents: jest.fn(),
    };

    const service = new GameCommandsService(
      gameStateService as never,
      observabilityService as never,
      gameSnapshotService as never,
      gameRecoveryService as never,
      gameResultsService as never,
      gameEventsService as never,
    );

    await service.rollAndMove({
      gameId,
      roomPlayerId,
      dice: [1, 2],
    });

    expect(gameRecoveryService.recoverOrThrow).toHaveBeenCalledWith(gameId);
    expect(gameStateService.update).toHaveBeenCalledTimes(2);
  });

  it('resets missed turns after a player command', async () => {
    const { service } = makeService(
      makeState({
        players: [
          {
            ...makeState().players[0],
            consecutiveMissedTurns: 2,
          },
          makeState().players[1],
        ],
      }),
    );

    const result = await service.rollAndMove({
      gameId,
      roomPlayerId,
      dice: [1, 2],
    });

    expect(result.state.players[0].consecutiveMissedTurns).toBe(0);
  });

  it('increments missed turns after a timer command', async () => {
    const { service } = makeService();

    const result = await service.executeIntent({
      gameId,
      roomPlayerId,
      source: 'timer',
      intent: {
        type: 'roll_and_move',
        payload: {
          roomPlayerId,
          dice: [1, 2],
        },
      },
    });

    expect(result.state.players[0].consecutiveMissedTurns).toBe(1);
  });

  it('does not increment missed turns after a bot command', async () => {
    const { service } = makeService(
      makeState({
        players: [
          {
            ...makeState().players[0],
            playerType: 'bot',
            botDifficulty: 'normal',
            botName: 'Atlas',
            userId: null,
            username: null,
          },
          makeState().players[1],
        ],
      }),
    );

    const result = await service.executeIntent({
      gameId,
      roomPlayerId,
      source: 'bot',
      intent: {
        type: 'roll_and_move',
        payload: {
          roomPlayerId,
          dice: [1, 2],
        },
      },
    });

    expect(result.state.players[0].consecutiveMissedTurns).toBe(0);
  });

  it('persists results after a game has expired', async () => {
    const expirableState = makeState({
      phase: 'awaiting_first_turn',
      expiresAt: 1_000,
    });

    const { service, gameResultsService } = makeService(expirableState);

    const result = await service.executeIntent({
      gameId,
      intent: {
        type: 'finish_game_by_time',
        payload: {
          finishedAt: 2_000,
        },
      },
    });

    expect(result.intentType).toBe(GAME_COMMANDS.finishGameByTime);
    expect(result.state.phase).toBe('finished');
    expect(gameResultsService.finalizeFinishedGame).toHaveBeenCalledWith({
      gameId,
      state: result.state,
      events: result.events,
    });
  });
});
