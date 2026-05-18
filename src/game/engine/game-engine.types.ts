import type { GameBoardKey } from './game-board.types';

export type GameMode = 'ranked' | 'casual';

export type GamePhase =
  | 'awaiting_first_turn'
  | 'awaiting_roll'
  | 'awaiting_turn_end'
  | 'finished'
  | 'cancelled';

export type PlayerType = 'human' | 'bot';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export type DiceRoll = readonly [number, number];

export type GameEnginePlayer = {
  roomPlayerId: string;
  userId: string | null;
  username: string | null;
  playerType: PlayerType;
  botDifficulty: BotDifficulty | null;
  botName: string | null;
  seatNumber: number;
  cash: number;
  position: number;
  properties: string[];
  inJail: boolean;
  bankrupt: boolean;
};

export type GameEngineState = {
  version: 1;
  roomId: string;
  roomCode: string;
  boardKey: GameBoardKey;
  mode: GameMode;
  phase: GamePhase;
  turnNumber: number;
  currentTurnRoomPlayerId: string;
  lastDiceRoll?: DiceRoll | null;
  players: GameEnginePlayer[];
};

export type RollAndMoveInput = {
  roomPlayerId: string;
  dice: DiceRoll;
};

export type EndTurnInput = {
  roomPlayerId: string;
};

export type GameEngineErrorCode =
  | 'GAME_NOT_ACTIVE'
  | 'PLAYER_NOT_FOUND'
  | 'NOT_CURRENT_TURN'
  | 'INVALID_DICE'
  | 'ROLL_NOT_ALLOWED'
  | 'TURN_END_NOT_ALLOWED'
  | 'NO_ACTIVE_PLAYERS';

export class GameEngineError extends Error {
  constructor(
    public readonly code: GameEngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameEngineError';
  }
}
