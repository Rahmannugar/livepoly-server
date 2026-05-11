import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProfile } from './auth.types';

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
};

type DiscordTokenResponse = {
  access_token?: string;
};

type DiscordUser = {
  id: string;
  username: string;
  email: string | null;
  verified?: boolean;
};

@Injectable()
export class OAuthClientService {
  constructor(private readonly configService: ConfigService) {}

  buildGoogleAuthorizationUrl(state: string) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    url.searchParams.set(
      'client_id',
      this.configService.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID'),
    );
    url.searchParams.set(
      'redirect_uri',
      this.configService.getOrThrow<string>('GOOGLE_OAUTH_REDIRECT_URI'),
    );
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');

    return url.toString();
  }

  buildDiscordAuthorizationUrl(state: string) {
    const url = new URL('https://discord.com/oauth2/authorize');

    url.searchParams.set(
      'client_id',
      this.configService.getOrThrow<string>('DISCORD_OAUTH_CLIENT_ID'),
    );
    url.searchParams.set(
      'redirect_uri',
      this.configService.getOrThrow<string>('DISCORD_OAUTH_REDIRECT_URI'),
    );
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify email');
    url.searchParams.set('state', state);

    return url.toString();
  }

  async exchangeGoogleCodeForProfile(code: string): Promise<OAuthProfile> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.configService.getOrThrow<string>(
          'GOOGLE_OAUTH_CLIENT_ID',
        ),
        client_secret: this.configService.getOrThrow<string>(
          'GOOGLE_OAUTH_CLIENT_SECRET',
        ),
        redirect_uri: this.configService.getOrThrow<string>(
          'GOOGLE_OAUTH_REDIRECT_URI',
        ),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new BadRequestException('Google OAuth token exchange failed');
    }

    const token = (await tokenResponse.json()) as GoogleTokenResponse;

    if (!token.access_token) {
      throw new BadRequestException('Google OAuth token missing');
    }

    const userResponse = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: { authorization: `Bearer ${token.access_token}` },
      },
    );

    if (!userResponse.ok) {
      throw new BadRequestException('Google OAuth profile fetch failed');
    }

    const profile = (await userResponse.json()) as GoogleUserInfo;

    return {
      provider: 'google',
      providerAccountId: profile.sub,
      email: profile.email.trim().toLowerCase(),
      emailVerified: profile.email_verified,
      usernameSeed: profile.name || profile.email.split('@')[0],
    };
  }

  async exchangeDiscordCodeForProfile(code: string): Promise<OAuthProfile> {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.configService.getOrThrow<string>(
          'DISCORD_OAUTH_CLIENT_ID',
        ),
        client_secret: this.configService.getOrThrow<string>(
          'DISCORD_OAUTH_CLIENT_SECRET',
        ),
        redirect_uri: this.configService.getOrThrow<string>(
          'DISCORD_OAUTH_REDIRECT_URI',
        ),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new BadRequestException('Discord OAuth token exchange failed');
    }

    const token = (await tokenResponse.json()) as DiscordTokenResponse;

    if (!token.access_token) {
      throw new BadRequestException('Discord OAuth token missing');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${token.access_token}` },
    });

    if (!userResponse.ok) {
      throw new BadRequestException('Discord OAuth profile fetch failed');
    }

    const profile = (await userResponse.json()) as DiscordUser;

    if (!profile.email) {
      throw new BadRequestException('Discord account has no email');
    }

    return {
      provider: 'discord',
      providerAccountId: profile.id,
      email: profile.email.trim().toLowerCase(),
      emailVerified: profile.verified === true,
      usernameSeed: profile.username,
    };
  }
}
