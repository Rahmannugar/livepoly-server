import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthRepository } from '../auth.repository';
import { AuthTokenVersionCacheService } from '../auth-token-version-cache.service';
import { AuthUser } from '../types/auth-user.type';

type AccessTokenPayload = {
  sub: string;
  sid: string;
  tv: number;
  email: string;
  username: string;
};

type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly authTokenVersionCacheService: AuthTokenVersionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const payload = await this.verifyToken(token);
    const cachedTokenVersion = await this.getValidCachedTokenVersion(
      payload.sub,
      payload.tv,
    );

    const user = await this.authRepository.findUserByIdForAuthToken(
      payload.sub,
    );

    if (
      !user ||
      !user.emailVerified ||
      user.status !== 'active' ||
      user.deletedAt ||
      user.tokenVersion !== payload.tv
    ) {
      if (user && user.tokenVersion !== payload.tv) {
        await this.authTokenVersionCacheService.set(
          user.id,
          user.tokenVersion,
        );
      }

      throw new UnauthorizedException('Authentication required');
    }

    if (
      cachedTokenVersion === null ||
      cachedTokenVersion === undefined ||
      cachedTokenVersion !== user.tokenVersion
    ) {
      await this.authTokenVersionCacheService.set(user.id, user.tokenVersion);
    }

    request.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      sessionId: payload.sid,
      tokenVersion: user.tokenVersion,
    };

    return true;
  }

  private getBearerToken(request: Request): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private async verifyToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Authentication required');
    }
  }

  private async getValidCachedTokenVersion(
    userId: string,
    tokenVersion: number,
  ): Promise<number | null | undefined> {
    const cachedTokenVersion =
      await this.authTokenVersionCacheService.get(userId);

    if (
      cachedTokenVersion !== null &&
      cachedTokenVersion !== undefined &&
      cachedTokenVersion !== tokenVersion
    ) {
      throw new UnauthorizedException('Authentication required');
    }

    return cachedTokenVersion;
  }
}
