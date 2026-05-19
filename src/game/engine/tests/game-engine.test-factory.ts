import { createInitialDeckState } from '../game-engine-cards';
import { createInitialPropertyState } from '../game-engine-properties';
import type {
  GameEnginePlayer,
  GameEngineProperty,
  GameEngineState,
} from '../game-engine.types';

export function createGameEnginePlayer(
  overrides: Partial<GameEnginePlayer> = {},
): GameEnginePlayer {
  return {
    roomPlayerId: 'room-player-1',
    userId: 'user-1',
    username: 'playerone',
    playerType: 'human',
    botDifficulty: null,
    botName: null,
    seatNumber: 1,
    cash: 1500,
    position: 0,
    inJail: false,
    jailTurnCount: 0,
    getOutOfJailFreeCards: 0,
    bankrupt: false,
    ...overrides,
  };
}

export function createGameEngineProperty(
  overrides: Partial<GameEngineProperty> = {},
): GameEngineProperty {
  return {
    tileKey: 'nigeria',
    ownerRoomPlayerId: null,
    houseCount: 0,
    hasHotel: false,
    mortgaged: false,
    ...overrides,
  };
}

export function createGameEngineState(
  overrides: Partial<GameEngineState> = {},
): GameEngineState {
  const baseState: GameEngineState = {
    version: 1,
    roomId: 'room-1',
    roomCode: 'ABC12345',
    boardKey: 'classic',
    mode: 'ranked',
    phase: 'awaiting_first_turn',
    turnNumber: 1,
    currentTurnRoomPlayerId: 'room-player-1',
    consecutiveDoublesCount: 0,
    shouldCurrentPlayerPlayAgain: false,
    lastDiceRoll: null,
    pendingTileKey: null,
    auction: null,
    debt: null,
    decks: createInitialDeckState(),
    players: [
      createGameEnginePlayer(),
      createGameEnginePlayer({
        roomPlayerId: 'room-player-2',
        userId: 'user-2',
        username: 'playertwo',
        seatNumber: 2,
      }),
      createGameEnginePlayer({
        roomPlayerId: 'room-player-3',
        userId: 'user-3',
        username: 'playerthree',
        seatNumber: 3,
      }),
    ],
    properties: [],
  };

  baseState.properties = createInitialPropertyState(baseState);

  return {
    ...baseState,
    ...overrides,
  };
}
