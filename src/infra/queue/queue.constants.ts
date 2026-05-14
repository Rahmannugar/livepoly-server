export const QUEUES = {
  mail: 'mail',
  users: 'users',
} as const;

export const MAIL_JOBS = {
  sendEmailVerificationOtp: 'send-email-verification-otp',
  sendPasswordResetOtp: 'send-password-reset-otp',
  sendAccountDeletedEmail: 'send-account-deleted-email',
} as const;

export const USER_JOBS = {
  cleanupDeletedUser: 'cleanup-deleted-user',
} as const;
