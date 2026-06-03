import type { GameLiveAccess } from '../realtime/game-realtime.types';

export type GamePresenceEntry = {
  gameId: string;
  userId: string;
  socketId: string;
  access: GameLiveAccess;
  lastSeenAt: string;
};

export type GamePresenceSummary = {
  gameId: string;
  onlineUsers: {
    userId: string;
    access: GameLiveAccess;
    socketCount: number;
    lastSeenAt: string;
  }[];
  playersOnline: number;
  spectatorsOnline: number;
};
