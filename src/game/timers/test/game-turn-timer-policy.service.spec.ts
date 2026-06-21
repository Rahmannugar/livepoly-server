import {
  createGameEngineState,
  TEST_BOARD_TILES,
} from '../../engine/tests/game-engine.test-factory';
import { GameTurnTimerPolicyService } from '../game-turn-timer-policy.service';

describe('GameTurnTimerPolicyService', () => {
  let service: GameTurnTimerPolicyService;
  let mathRandomSpy: jest.SpyInstance;
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new GameTurnTimerPolicyService();
    mathRandomSpy = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99);
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  it('returns no intent for terminal games', () => {
    expect(
      service.chooseTimeoutIntent(
        createGameEngineState({
          phase: 'finished',
        }),
      ),
    ).toBeNull();

    expect(
      service.chooseTimeoutIntent(
        createGameEngineState({
          phase: 'cancelled',
        }),
      ),
    ).toBeNull();
  });

  it('returns no intent when the current player cannot act', () => {
    expect(
      service.chooseTimeoutIntent(
        createGameEngineState({
          currentTurnRoomPlayerId: 'missing-player',
        }),
      ),
    ).toBeNull();

    expect(
      service.chooseTimeoutIntent(
        createGameEngineState({
          players: [
            {
              ...createGameEngineState().players[0],
              bankrupt: true,
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('auto-rolls when a player times out before rolling', () => {
    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_roll',
      }),
    );

    expect(intent).toEqual({
      type: 'roll_and_move',
      payload: {
        roomPlayerId: 'room-player-1',
        dice: [1, 6],
      },
    });
  });

  it('finishes by time once the match duration has elapsed', () => {
    dateNowSpy.mockReturnValue(1_801_000);

    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_roll',
        expiresAt: 1_800_000,
      }),
    );

    expect(intent).toEqual({
      type: 'finish_game_by_time',
      payload: {
        finishedAt: 1_801_000,
      },
    });
  });

  it('declines purchase when a player times out on property decision', () => {
    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_property_decision',
        pendingTileKey: TEST_BOARD_TILES.cheapProperty,
      }),
    );

    expect(intent).toEqual({
      type: 'decline_property_purchase',
      payload: {
        roomPlayerId: 'room-player-1',
      },
    });
  });

  it('auto-passes the next pending auction bidder', () => {
    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_auction_bid',
        auction: {
          tileKey: TEST_BOARD_TILES.cheapProperty,
          activeRoomPlayerIds: [
            'room-player-1',
            'room-player-2',
            'room-player-3',
          ],
          passedRoomPlayerIds: ['room-player-1'],
          highestBidderRoomPlayerId: null,
          currentBidderRoomPlayerId: 'room-player-2',
          currentBid: 0,
        },
      }),
    );

    expect(intent).toEqual({
      type: 'pass_auction_bid',
      payload: {
        roomPlayerId: 'room-player-2',
      },
    });
  });

  it('returns no intent when every auction bidder has passed', () => {
    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_auction_bid',
        auction: {
          tileKey: TEST_BOARD_TILES.cheapProperty,
          activeRoomPlayerIds: ['room-player-1', 'room-player-2'],
          passedRoomPlayerIds: ['room-player-1', 'room-player-2'],
          highestBidderRoomPlayerId: null,
          currentBidderRoomPlayerId: null,
          currentBid: 0,
        },
      }),
    );

    expect(intent).toBeNull();
  });

  it('automatically liquidates assets when a player times out in debt', () => {
    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_debt_resolution',
        debt: {
          roomPlayerId: 'room-player-1',
          creditorRoomPlayerId: 'room-player-2',
          amount: 100,
          reason: 'rent',
        },
      }),
    );

    expect(intent).toEqual({
      type: 'auto_resolve_debt',
      payload: {
        roomPlayerId: 'room-player-1',
      },
    });
  });

  it('resolves debt before applying the missed-turn forfeiture', () => {
    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_debt_resolution',
        debt: {
          roomPlayerId: 'room-player-1',
          creditorRoomPlayerId: 'room-player-2',
          amount: 100,
          reason: 'rent',
        },
        players: [
          {
            ...createGameEngineState().players[0],
            consecutiveMissedTurns: 3,
          },
          ...createGameEngineState().players.slice(1),
        ],
      }),
    );

    expect(intent).toEqual({
      type: 'auto_resolve_debt',
      payload: { roomPlayerId: 'room-player-1' },
    });
  });

  it('ends turn when a player times out after acting', () => {
    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_turn_end',
      }),
    );

    expect(intent).toEqual({
      type: 'end_turn',
      payload: {
        roomPlayerId: 'room-player-1',
      },
    });
  });

  it('declares bankruptcy after three consecutive missed turns', () => {
    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_roll',
        players: [
          {
            ...createGameEngineState().players[0],
            consecutiveMissedTurns: 3,
          },
          createGameEngineState().players[1],
          createGameEngineState().players[2],
        ],
      }),
    );

    expect(intent).toEqual({
      type: 'declare_bankruptcy',
      payload: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
      },
    });
  });

  it('does not forfeit bots by missed-turn count', () => {
    const intent = service.chooseTimeoutIntent(
      createGameEngineState({
        phase: 'awaiting_roll',
        players: [
          {
            ...createGameEngineState().players[0],
            playerType: 'bot',
            botDifficulty: 'normal',
            botName: 'Atlas',
            userId: null,
            username: null,
            consecutiveMissedTurns: 3,
          },
          createGameEngineState().players[1],
          createGameEngineState().players[2],
        ],
      }),
    );

    expect(intent).toEqual({
      type: 'roll_and_move',
      payload: {
        roomPlayerId: 'room-player-1',
        dice: [1, 6],
      },
    });
  });
});
