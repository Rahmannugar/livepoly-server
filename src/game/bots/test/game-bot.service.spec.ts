import {
  createGameEngineProperty,
  createGameEnginePlayer,
  createGameEngineState,
  TEST_BOARD_TILES,
} from '../../engine/tests/game-engine.test-factory';
import type { GameEngineState } from '../../engine/game-engine.types';
import { GameBotService } from '../game-bot.service';

describe('GameBotService', () => {
  let service: GameBotService;

  const createBotState = (
    overrides: Partial<GameEngineState> = {},
  ): GameEngineState => ({
    version: 1,
    roomId: 'room-1',
    roomCode: 'ABC12345',
    boardKey: 'classic',
    mode: 'casual',
    phase: 'awaiting_property_decision',
    turnNumber: 1,
    currentTurnRoomPlayerId: 'bot-player-1',
    consecutiveDoublesCount: 0,
    shouldCurrentPlayerPlayAgain: false,
    lastDiceRoll: null,
    pendingTileKey: 'australia',
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
      createGameEnginePlayer({
        roomPlayerId: 'bot-player-1',
        userId: null,
        username: null,
        playerType: 'bot',
        botDifficulty: 'normal',
        botName: 'Ada',
        seatNumber: 1,
      }),
      createGameEnginePlayer({
        roomPlayerId: 'room-player-2',
        userId: 'user-2',
        username: 'playertwo',
        seatNumber: 2,
      }),
    ],
    properties: [],
    ...overrides,
  });

  beforeEach(() => {
    service = new GameBotService();
  });

  it('does not act when the current player is human', () => {
    const state = createBotState({
      currentTurnRoomPlayerId: 'room-player-2',
    });

    expect(service.chooseDecision(state)).toBeNull();
  });

  it('automatically resolves bot debt before bankruptcy', () => {
    const state = createBotState({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'bot-player-1',
        creditorRoomPlayerId: 'room-player-2',
        amount: 100,
        reason: 'rent',
      },
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'auto_resolve_debt',
        payload: { roomPlayerId: 'bot-player-1' },
      },
    });
  });

  it('easy bot declines expensive property', () => {
    const state = createBotState({
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'easy',
          botName: 'Ada',
          seatNumber: 1,
        }),
      ],
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'decline_property_purchase',
        payload: {
          roomPlayerId: 'bot-player-1',
        },
      },
    });
  });

  it('hard bot buys valuable property', () => {
    const state = createBotState({
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'hard',
          botName: 'Ada',
          seatNumber: 1,
        }),
      ],
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'buy_property',
        payload: {
          roomPlayerId: 'bot-player-1',
        },
      },
    });
  });

  it('hard bot blocks opponent sets', () => {
    const state = createBotState({
      pendingTileKey: 'uk',
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'hard',
          botName: 'Ada',
          seatNumber: 1,
          cash: 760,
        }),
        createGameEnginePlayer({
          roomPlayerId: 'room-player-2',
          userId: 'user-2',
          username: 'playertwo',
          seatNumber: 2,
        }),
      ],
      properties: [
        {
          tileKey: TEST_BOARD_TILES.highValueProperty,
          ownerRoomPlayerId: 'room-player-2',
          houseCount: 0,
          hasHotel: false,
          mortgaged: false,
        },
        {
          tileKey: TEST_BOARD_TILES.highValuePropertyPair,
          ownerRoomPlayerId: 'room-player-2',
          houseCount: 0,
          hasHotel: false,
          mortgaged: false,
        },
      ],
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'buy_property',
        payload: {
          roomPlayerId: 'bot-player-1',
        },
      },
    });
  });

  it('raises auction bids by difficulty-scaled amounts within valuation', () => {
    const state = createBotState({
      phase: 'awaiting_auction_bid',
      pendingTileKey: null,
      auction: {
        tileKey: TEST_BOARD_TILES.airport,
        currentBid: 80,
        highestBidderRoomPlayerId: 'room-player-2',
        currentBidderRoomPlayerId: 'bot-player-1',
        bidExpiresAt: Date.now() + 25_000,
        activeRoomPlayerIds: ['bot-player-1', 'room-player-2'],
        passedRoomPlayerIds: [],
      },
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'normal',
          botName: 'Ada',
          seatNumber: 1,
          cash: 1500,
        }),
        createGameEnginePlayer({
          roomPlayerId: 'room-player-2',
          userId: 'user-2',
          username: 'playertwo',
          seatNumber: 2,
        }),
      ],
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'place_auction_bid',
        payload: {
          roomPlayerId: 'bot-player-1',
          amount: 97,
        },
      },
    });
  });

  it('passes auction bids above its valuation', () => {
    const state = createBotState({
      phase: 'awaiting_auction_bid',
      pendingTileKey: null,
      auction: {
        tileKey: TEST_BOARD_TILES.airport,
        currentBid: 170,
        highestBidderRoomPlayerId: 'room-player-2',
        currentBidderRoomPlayerId: 'bot-player-1',
        bidExpiresAt: Date.now() + 25_000,
        activeRoomPlayerIds: ['bot-player-1', 'room-player-2'],
        passedRoomPlayerIds: [],
      },
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'normal',
          botName: 'Ada',
          seatNumber: 1,
          cash: 1500,
        }),
        createGameEnginePlayer({
          roomPlayerId: 'room-player-2',
          userId: 'user-2',
          username: 'playertwo',
          seatNumber: 2,
        }),
      ],
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'pass_auction_bid',
        payload: {
          roomPlayerId: 'bot-player-1',
        },
      },
    });
  });

  it('unmortgages owned property when cash reserve is protected', () => {
    const state = createBotState({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'normal',
          botName: 'Ada',
          seatNumber: 1,
          cash: 900,
        }),
      ],
      properties: [
        createGameEngineProperty({
          tileKey: TEST_BOARD_TILES.cheapProperty,
          ownerRoomPlayerId: 'bot-player-1',
          mortgaged: true,
        }),
        createGameEngineProperty({
          tileKey: TEST_BOARD_TILES.cheapPropertyPair,
          ownerRoomPlayerId: 'bot-player-1',
        }),
      ],
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'unmortgage_property',
        payload: {
          roomPlayerId: 'bot-player-1',
          tileKey: TEST_BOARD_TILES.cheapProperty,
        },
      },
    });
  });

  it('builds evenly on completed sets by difficulty limit', () => {
    const state = createBotState({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'hard',
          botName: 'Ada',
          seatNumber: 1,
          cash: 1000,
        }),
      ],
      properties: createGameEngineState().properties.map((property) => {
        if (
          property.tileKey === TEST_BOARD_TILES.cheapProperty ||
          property.tileKey === TEST_BOARD_TILES.cheapPropertyPair
        ) {
          return {
            ...property,
            ownerRoomPlayerId: 'bot-player-1',
          };
        }

        return property;
      }),
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'build_property',
        payload: {
          roomPlayerId: 'bot-player-1',
          tileKey: TEST_BOARD_TILES.cheapPropertyPair,
        },
      },
    });
  });

  it('offers cash to complete a property set once per turn', () => {
    const state = createBotState({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'normal',
          botName: 'Ada',
          seatNumber: 1,
          cash: 900,
        }),
        createGameEnginePlayer({
          roomPlayerId: 'room-player-2',
          userId: 'user-2',
          username: 'playertwo',
          seatNumber: 2,
        }),
      ],
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'bot-player-1',
          };
        }

        if (property.tileKey === TEST_BOARD_TILES.cheapPropertyPair) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-2',
          };
        }

        return property;
      }),
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'propose_trade',
        payload: {
          roomPlayerId: 'bot-player-1',
          toRoomPlayerId: 'room-player-2',
          offeredCash: 72,
          requestedCash: 0,
          offeredPropertyKeys: [],
          requestedPropertyKeys: [TEST_BOARD_TILES.cheapPropertyPair],
        },
      },
    });
  });

  it('does not repeat a bot trade offer during the same turn', () => {
    const state = createBotState({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'normal',
          botName: 'Ada',
          seatNumber: 1,
          cash: 900,
          lastBotTradeProposalTurnNumber: 1,
        }),
        createGameEnginePlayer({
          roomPlayerId: 'room-player-2',
          userId: 'user-2',
          username: 'playertwo',
          seatNumber: 2,
        }),
      ],
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'bot-player-1',
          };
        }

        if (property.tileKey === TEST_BOARD_TILES.cheapPropertyPair) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-2',
          };
        }

        return property;
      }),
    });

    expect(service.chooseDecision(state)).toEqual({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'end_turn',
        payload: { roomPlayerId: 'bot-player-1' },
      },
    });
  });
});
