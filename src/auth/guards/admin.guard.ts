import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../types/auth-user.type';

type RequestWithUser = {
  user?: AuthUser;
};

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
