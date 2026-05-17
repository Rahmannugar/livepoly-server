export const ROOM_DURATIONS = [30, 60, 120, 180] as const;

export type RoomDurationMinutes = (typeof ROOM_DURATIONS)[number];

export const ROOM_CODE_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export const ROOM_CODE_LENGTH = 8;

export const DEFAULT_ROOM_DURATION_MINUTES = 60;

export const ROOM_BOARD_KEY = 'classic';

export const ROOM_MAX_PLAYERS = 4;

export const LIVE_ROOMS_LIMIT = 50;

export const ACTIVE_ROOM_STATUSES = ['waiting', 'active'] as const;
