import type { Socket } from 'socket.io';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type {
  DiceRoll,
  GameEngineErrorCode,
  GameEngineEvent,
  GameEngineState,
} from '../engine/game-engine.types';

export type AuthenticatedGameSocket = Socket & {
  data: Socket['data'] & {
    user: AuthUser;
  };
};

export type JoinGamePayload = {
  gameId: string;
};

export type RollAndMovePayload = {
  gameId: string;
  dice: DiceRoll;
};

export type EndTurnPayload = {
  gameId: string;
};

export type GameJoinedEvent = {
  gameId: string;
  roomPlayerId: string;
};

export type GameStateEvent = {
  gameId: string;
  state: GameEngineState;
};

export type GameEventsEvent = {
  gameId: string;
  events: GameEngineEvent[];
};

export type GameCommandRejectedEvent = {
  gameId: string;
  command: string;
  code?: GameEngineErrorCode;
  message: string;
};

export type GameErrorEvent = {
  message: string;
  code?: string;
};
