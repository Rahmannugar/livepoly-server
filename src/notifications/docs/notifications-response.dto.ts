import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d' })
  id: string;

  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  userId: string;

  @ApiProperty({
    example: 'friend_request',
    enum: [
      'friend_request',
      'friend_accepted',
      'room_invite',
      'leaderboard',
      'game_finished',
      'turn_reminder',
      'system',
    ],
  })
  type: string;

  @ApiProperty({ example: 'New friend request' })
  title: string;

  @ApiProperty({ example: 'playerone sent you a friend request' })
  body: string;

  @ApiPropertyOptional({
    example: {
      friendshipId: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      requesterId: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91',
      requesterUsername: 'playerone',
      requesterAvatarUrl:
        'https://pub-example.r2.dev/avatars/user-id/avatar.webp',
      link: '/users/playerone',
    },
    nullable: true,
  })
  data: unknown;

  @ApiProperty({ example: false })
  read: boolean;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: '2026-05-14T12:15:00.000Z', nullable: true })
  readAt: Date | null;
}

export class NotificationsPageResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items: NotificationResponseDto[];

  @ApiPropertyOptional({
    example: '2026-05-14T12:00:00.000Z|9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
    nullable: true,
  })
  nextCursor: string | null;
}
