export const QUEUES = {
  mail: 'mail',
} as const;

export const MAIL_JOBS = {
  sendEmailVerificationOtp: 'send-email-verification-otp',
  sendPasswordResetOtp: 'send-password-reset-otp',
} as const;
