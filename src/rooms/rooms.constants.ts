export const ROOM_DURATIONS = [60, 90, 120, 180] as const;

export type RoomDurationMinutes = (typeof ROOM_DURATIONS)[number];

export const ROOM_CODE_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export const ROOM_CODE_LENGTH = 8;

export const DEFAULT_ROOM_DURATION_MINUTES = 60;

export const ROOM_BOARD_KEY = 'classic';

export const ROOM_MAX_PLAYERS = 4;

export const ROOM_MIN_RANKED_HUMANS = 3;

export const LIVE_ROOMS_LIMIT = 50;

export const ACTIVE_ROOM_STATUSES = ['waiting', 'active'] as const;

export const ROOM_MAX_SPECTATORS = 20;

export const BOT_NAMES = [
  'Atlas',
  'Nova',
  'Midas',
  'Echo',
  'Rook',
  'Pixel',
] as const;

export const BOT_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;

export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'normal';

export const STARTING_CASH = 1500;

export const ROOM_EVENTS = {
  created: 'RoomCreated',
  joined: 'RoomJoined',
  left: 'RoomLeft',
  finishedAfterLastHumanLeft: 'RoomFinishedAfterLastHumanLeft',
  finishAfterLastHumanLeftFailed: 'RoomFinishAfterLastHumanLeftFailed',
  cancelled: 'RoomCancelled',
  inviteSent: 'RoomInviteSent',
  started: 'RoomStarted',
  spectatorJoined: 'RoomSpectatorJoined',
  spectatorLeft: 'RoomSpectatorLeft',
} as const;

export const ROOM_METRICS = {
  created: 'Custom/Room/Created',
  joined: 'Custom/Room/Joined',
  left: 'Custom/Room/Left',
  finishedAfterLastHumanLeft: 'Custom/Room/FinishedAfterLastHumanLeft',
  finishAfterLastHumanLeftFailed:
    'Custom/Room/FinishAfterLastHumanLeftFailed',
  cancelled: 'Custom/Room/Cancelled',
  inviteSent: 'Custom/Room/InviteSent',
  started: (mode: string) => `Custom/Room/Started/${mode}`,
  spectatorJoined: 'Custom/Room/Spectator/Joined',
  spectatorLeft: 'Custom/Room/Spectator/Left',
} as const;
