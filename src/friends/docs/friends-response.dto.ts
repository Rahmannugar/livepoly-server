import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FriendshipResponseDto {
  @ApiProperty({ example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d' })
  id: string;

  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  requesterId: string;

  @ApiProperty({ example: '8a68f23e-2d53-41da-a9d8-0f429dbd3734' })
  addresseeId: string;

  @ApiProperty({ example: 'pending', enum: ['pending', 'accepted', 'blocked'] })
  status: string;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-14T12:15:00.000Z' })
  updatedAt: Date;
}

export class FriendSummaryDto {
  @ApiProperty({ example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d' })
  friendshipId: string;

  @ApiProperty({ example: '8a68f23e-2d53-41da-a9d8-0f429dbd3734' })
  userId: string;

  @ApiProperty({ example: 'friend@example.com' })
  email: string;

  @ApiProperty({ example: 'friendone' })
  username: string;

  @ApiPropertyOptional({
    example: 'avatars/user-id/avatar.webp',
    nullable: true,
  })
  avatarObjectKey: string | null;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-14T12:15:00.000Z' })
  updatedAt: Date;
}

export class FriendRequestSummaryDto {
  @ApiProperty({ example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d' })
  friendshipId: string;

  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  requesterId: string;

  @ApiProperty({ example: '8a68f23e-2d53-41da-a9d8-0f429dbd3734' })
  addresseeId: string;

  @ApiProperty({ example: 'playerone' })
  requesterUsername: string;

  @ApiPropertyOptional({
    example: 'avatars/requester-id/avatar.webp',
    nullable: true,
  })
  requesterAvatarObjectKey: string | null;

  @ApiProperty({ example: 'friendone' })
  addresseeUsername: string;

  @ApiPropertyOptional({
    example: 'avatars/addressee-id/avatar.webp',
    nullable: true,
  })
  addresseeAvatarObjectKey: string | null;

  @ApiProperty({ example: 'pending', enum: ['pending'] })
  status: string;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-14T12:15:00.000Z' })
  updatedAt: Date;
}

export class FriendRequestsResponseDto {
  @ApiProperty({ type: [FriendRequestSummaryDto] })
  incoming: FriendRequestSummaryDto[];

  @ApiProperty({ type: [FriendRequestSummaryDto] })
  outgoing: FriendRequestSummaryDto[];
}
