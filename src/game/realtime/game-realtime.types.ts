import type { Socket } from 'socket.io';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type {
  DiceRoll,
  GameEngineErrorCode,
  GameEngineEvent,
  GameEngineState,
} from '../engine/game-engine.types';
import type { GameEventRecoveryResponse } from '../events/game-events.types';

export type AuthenticatedGameSocket = Socket & {
  data: Socket['data'] & {
    user: AuthUser;
    gameId?: string;
  };
};

export type JoinGamePayload = {
  gameId: string;
};

export type RollAndMovePayload = {
  gameId: string;
  dice?: DiceRoll;
};

export type EndTurnPayload = {
  gameId: string;
};

export type BuyPropertyPayload = {
  gameId: string;
};

export type DeclinePropertyPurchasePayload = {
  gameId: string;
};

export type PlaceAuctionBidPayload = {
  gameId: string;
  amount: number;
};

export type PassAuctionBidPayload = {
  gameId: string;
};

export type PayDebtPayload = {
  gameId: string;
};

export type DeclareBankruptcyPayload = {
  gameId: string;
};

export type GameJoinedEvent = {
  gameId: string;
  access: GameLiveAccess;
  state: GameEngineState;
  roomPlayerId?: string;
  spectatorId?: string;
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

export type RecoverGameEventsPayload = {
  gameId: string;
  cursor?: string;
};

export type GameEventsRecoveredEvent = GameEventRecoveryResponse & {
  gameId: string;
};

export type GameActorInput = {
  gameId: string;
  userId: string;
};

export type RollAndMoveInput = GameActorInput & {
  dice?: DiceRoll;
};

export type PlaceAuctionBidInput = GameActorInput & {
  amount: number;
};

export const GAME_LIVE_ACCESS = {
  player: 'player',
  spectator: 'spectator',
} as const;

export type GameLiveAccess =
  (typeof GAME_LIVE_ACCESS)[keyof typeof GAME_LIVE_ACCESS];

export type GameHeartbeatPayload = {
  gameId: string;
};

export type GameHeartbeatAcknowledgedEvent = {
  gameId: string;
  receivedAt: string;
  ttlSeconds: number;
};

export type GamePresenceGetPayload = {
  gameId: string;
};

export type GamePresenceUser = {
  userId: string;
  access: GameLiveAccess;
  socketCount: number;
  lastSeenAt: string;
};

export type GamePresenceEvent = {
  gameId: string;
  onlineUsers: GamePresenceUser[];
  playersOnline: number;
  spectatorsOnline: number;
};
