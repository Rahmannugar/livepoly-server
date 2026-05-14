import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUser as AuthUserPayload } from '../types/auth-user.type';

export const AuthUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUserPayload => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUserPayload }>();

    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    return request.user;
  },
);
