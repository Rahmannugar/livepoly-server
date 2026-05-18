export const AUTH = {
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 7,
  emailOtpTtlMinutes: 15,
  passwordResetOtpTtlMinutes: 5,
  maxActiveSessions: 3,
} as const;

export const AUTH_EVENTS = {
  signupRequested: 'SignupRequested',
  signupFailed: 'SignupFailed',
  signupSucceeded: 'SignupSucceeded',
  emailVerificationFailed: 'EmailVerificationFailed',
  emailVerificationSucceeded: 'EmailVerificationSucceeded',
  emailVerificationResendSkipped: 'EmailVerificationResendSkipped',
  emailVerificationResent: 'EmailVerificationResent',
  loginFailed: 'LoginFailed',
  loginSucceeded: 'LoginSucceeded',
  refreshFailed: 'RefreshFailed',
  refreshSucceeded: 'RefreshSucceeded',
  logoutSucceeded: 'LogoutSucceeded',
  passwordResetRequested: 'PasswordResetRequested',
  passwordResetFailed: 'PasswordResetFailed',
  passwordResetSucceeded: 'PasswordResetSucceeded',
  oauthStartRequested: 'OAuthStartRequested',
  oauthFailed: 'OAuthFailed',
  oauthSucceeded: 'OAuthSucceeded',
} as const;
