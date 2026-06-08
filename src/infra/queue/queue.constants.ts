export const QUEUES = {
  mail: 'mail',
  users: 'users',
  outbox: 'outbox',
  game: 'game',
} as const;

export const MAIL_JOBS = {
  sendEmailVerificationOtp: 'send-email-verification-otp',
  sendPasswordResetOtp: 'send-password-reset-otp',
  sendAccountDeletedEmail: 'send-account-deleted-email',
} as const;

export const USER_JOBS = {
  cleanupDeletedUser: 'cleanup-deleted-user',
  deleteAvatar: 'delete-avatar',
  verifyAvatarUpload: 'verify-avatar-upload',
} as const;

export const OUTBOX_JOBS = {
  publishEvent: 'publish-event',
} as const;

export const GAME_JOBS = {
  executeBotTurn: 'execute-bot-turn',
  executeTurnTimeout: 'execute-turn-timeout',
  finishExpiredGame: 'finish-expired-game',
} as const;

export const LEADERBOARD_JOBS = {
  refreshSnapshots: 'refresh-leaderboard-snapshots',
} as const;
