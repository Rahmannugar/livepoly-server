import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  NotificationResponseDto,
  NotificationsPageResponseDto,
} from './notifications-response.dto';

const messageResponseSchema = (message: string) => ({
  schema: {
    example: {
      message,
    },
    properties: {
      message: { type: 'string', example: message },
    },
    required: ['message'],
  },
});

export const NotificationsDocs = {
  Controller: () => applyDecorators(ApiTags('Notifications')),

  List: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'List notifications' }),
      ApiQuery({
        name: 'limit',
        required: false,
        example: 50,
        description: 'Page size from 1 to 100',
      }),
      ApiQuery({
        name: 'cursor',
        required: false,
        example:
          '2026-05-14T12:00:00.000Z|9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiOkResponse({ type: NotificationsPageResponseDto }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  MarkAsRead: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Mark notification as read' }),
      ApiParam({
        name: 'notificationId',
        example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiOkResponse({ type: NotificationResponseDto }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Notification not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  MarkAllAsRead: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Mark all notifications as read' }),
      ApiOkResponse({
        description: 'Notifications marked as read',
        ...messageResponseSchema('Notifications marked as read'),
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),
};
