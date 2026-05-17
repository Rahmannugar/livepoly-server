import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import type { Request } from 'express';
import type { AuthUser } from '../auth/types/auth-user.type';
import {
  RATE_LIMIT_RULES_KEY,
  RateLimitIdentifier,
  RateLimitRule,
} from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

type RequestWithUser = Request & {
  user?: AuthUser;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules =
      this.reflector.getAllAndOverride<RateLimitRule[]>(RATE_LIMIT_RULES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (rules.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    for (const rule of rules) {
      const rawIdentifier = this.resolveIdentifier(request, rule.identifier);
      const identifier = this.hashIdentifier(rawIdentifier);

      await this.rateLimitService.consume({
        scope: rule.scope,
        identifier,
        limit: rule.limit,
        windowSeconds: rule.windowSeconds,
        burstLimit: rule.burstLimit,
      });
    }

    return true;
  }

  private resolveIdentifier(
    request: RequestWithUser,
    identifier: RateLimitIdentifier,
  ): string {
    switch (identifier.type) {
      case 'ip':
        return request.ip || 'unknown';

      case 'user':
        if (!request.user?.id) {
          throw new UnauthorizedException('Authentication required');
        }

        return request.user.id;

      case 'body':
        return this.normalizeValue(
          this.readField(request.body, identifier.field),
          identifier.normalize,
        );

      case 'query':
        return this.normalizeValue(
          this.readField(request.query, identifier.field),
          identifier.normalize,
        );

      case 'param':
        return this.normalizeValue(
          this.readField(request.params, identifier.field),
          identifier.normalize,
        );

      case 'cookie':
        return this.normalizeValue(
          this.readField(request.cookies, identifier.field),
          identifier.normalize,
        );

      case 'compound':
        return identifier.parts
          .map((part) => this.resolveIdentifier(request, part))
          .join(':');
    }
  }

  private readField(source: unknown, field: string): string {
    if (!source || typeof source !== 'object') {
      return 'missing';
    }

    const value = (source as Record<string, unknown>)[field];

    if (typeof value !== 'string') {
      return 'missing';
    }

    return value;
  }

  private normalizeValue(value: string, mode?: 'trim' | 'lowercase' | 'email') {
    if (mode === 'email') {
      return value.trim().toLowerCase();
    }

    if (mode === 'lowercase') {
      return value.toLowerCase();
    }

    if (mode === 'trim') {
      return value.trim();
    }

    return value;
  }

  private hashIdentifier(identifier: string) {
    return createHash('sha256').update(identifier).digest('hex');
  }
}
