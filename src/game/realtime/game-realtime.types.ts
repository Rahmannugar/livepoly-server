import type { Socket } from 'socket.io';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { DiceRoll, GameEngineState } from '../engine/game-engine.types';

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

export type GameErrorEvent = {
  message: string;
  code?: string;
};
