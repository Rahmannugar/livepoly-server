import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { NotificationsDocs } from './docs/notifications.swagger';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@NotificationsDocs.Controller()
@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @NotificationsDocs.List()
  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @AuthUserDecorator() authUser: AuthUser,
    @Query() dto: ListNotificationsDto,
    @Req() request: Request,
  ) {
    return this.notificationsService.list(authUser, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @NotificationsDocs.MarkAllAsRead()
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(
    @AuthUserDecorator() authUser: AuthUser,
    @Req() request: Request,
  ) {
    return this.notificationsService.markAllAsRead(authUser, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @NotificationsDocs.MarkAsRead()
  @Patch(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('notificationId') notificationId: string,
    @Req() request: Request,
  ) {
    return this.notificationsService.markAsRead(authUser, notificationId, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
