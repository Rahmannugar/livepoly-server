import { createGameEnginePlayer } from '../../engine/tests/game-engine.test-factory';
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

  it('easy bot declines expensive non-strategic property', () => {
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

  it('hard bot buys valuable property that easy bot would decline', () => {
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

  it('hard bot values blocking an opponent set', () => {
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
          tileKey: 'spain',
          ownerRoomPlayerId: 'room-player-2',
          houseCount: 0,
          hasHotel: false,
          mortgaged: false,
        },
        {
          tileKey: 'france',
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
});
