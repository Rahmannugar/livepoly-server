import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { NotificationsDocs } from './docs/notifications.swagger';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NOTIFICATIONS_RATE_LIMIT_RULES } from './notifications.rate-limit.rules';
import { NotificationsStreamService } from './notifications-stream.service';
import { NotificationsService } from './notifications.service';

@NotificationsDocs.Controller()
@UseGuards(AuthGuard, RateLimitGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsStreamService: NotificationsStreamService,
  ) {}

  @NotificationsDocs.Stream()
  @RateLimit(...NOTIFICATIONS_RATE_LIMIT_RULES.read)
  @Get('stream')
  stream(
    @AuthUserDecorator() authUser: AuthUser,
    @Res() response: Response,
  ): void {
    this.notificationsStreamService.streamForUser(authUser.id, response);
  }

  @NotificationsDocs.List()
  @RateLimit(...NOTIFICATIONS_RATE_LIMIT_RULES.read)
  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @AuthUserDecorator() authUser: AuthUser,
    @Query() dto: ListNotificationsDto,
  ) {
    return this.notificationsService.list(authUser, dto);
  }

  @NotificationsDocs.MarkAllAsRead()
  @RateLimit(...NOTIFICATIONS_RATE_LIMIT_RULES.mutation)
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@AuthUserDecorator() authUser: AuthUser) {
    return this.notificationsService.markAllAsRead(authUser);
  }

  @NotificationsDocs.MarkAsRead()
  @RateLimit(...NOTIFICATIONS_RATE_LIMIT_RULES.mutation)
  @Patch(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(authUser, notificationId);
  }
}
