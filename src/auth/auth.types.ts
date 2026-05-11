export type OAuthProvider = 'google' | 'discord';

export type OAuthProfile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  usernameSeed: string;
};
