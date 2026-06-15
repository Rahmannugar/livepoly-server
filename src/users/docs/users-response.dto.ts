import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserStatsResponseDto {
  @ApiProperty({ example: 42 })
  gamesPlayed: number;

  @ApiProperty({ example: 12 })
  gamesWon: number;

  @ApiPropertyOptional({ example: 2.35, nullable: true })
  averagePlacement: number | null;

  @ApiProperty({ example: 500 })
  rating: number;
}

export class UserSearchItemResponseDto {
  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  id: string;

  @ApiProperty({ example: 'rahmannugar' })
  username: string;

  @ApiPropertyOptional({
    example: 'https://pub-example.r2.dev/avatars/user-id/avatar.webp',
    nullable: true,
  })
  avatarUrl: string | null;
}

export class UserSearchResponseDto {
  @ApiProperty({ type: [UserSearchItemResponseDto] })
  items: UserSearchItemResponseDto[];

  @ApiPropertyOptional({
    example:
      'eyJ2IjoxLCJ1c2VybmFtZSI6InJhaG1hbm51Z2FyIiwidXNlcklkIjoiN2M2ZTBmNGUtN2Y4ZC00YzE4LWEwY2YtOTA2ZjRjOGIyYjkxIn0',
    nullable: true,
  })
  nextCursor: string | null;
}

export class UserMatchHistoryItemResponseDto {
  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  gameId: string;

  @ApiProperty({ example: '25fc577e-a4a9-4b22-b113-a0efacdc6470' })
  roomId: string;

  @ApiProperty({ example: 'ABC12345' })
  roomCode: string;

  @ApiProperty({ enum: ['ranked', 'casual'], example: 'ranked' })
  mode: 'ranked' | 'casual';

  @ApiProperty({ example: 1 })
  placement: number;

  @ApiProperty({ example: 4 })
  playerCount: number;

  @ApiProperty({ example: true })
  won: boolean;

  @ApiProperty({
    enum: ['bankruptcy', 'time_elapsed', 'abandoned', 'cancelled'],
    example: 'time_elapsed',
  })
  endReason: 'bankruptcy' | 'time_elapsed' | 'abandoned' | 'cancelled';

  @ApiProperty({ example: 1800 })
  finalCash: number;

  @ApiProperty({ example: 2350 })
  finalNetWorth: number;

  @ApiPropertyOptional({
    example: '2026-05-14T12:40:00.000Z',
    nullable: true,
  })
  bankruptAt: string | null;

  @ApiPropertyOptional({ example: 500, nullable: true })
  ratingBefore: number | null;

  @ApiPropertyOptional({ example: 532, nullable: true })
  ratingAfter: number | null;

  @ApiPropertyOptional({ example: 32, nullable: true })
  ratingDelta: number | null;

  @ApiProperty({ example: 1800 })
  durationSeconds: number;

  @ApiProperty({ example: '2026-05-14T12:45:00.000Z' })
  completedAt: string;
}

export class UserMatchHistoryResponseDto {
  @ApiProperty({ type: [UserMatchHistoryItemResponseDto] })
  items: UserMatchHistoryItemResponseDto[];

  @ApiPropertyOptional({
    example:
      'eyJ2IjoxLCJjb21wbGV0ZWRBdCI6IjIwMjYtMDUtMTRUMTI6NDU6MDAuMDAwWiIsInJvb21SZXN1bHRJZCI6IjI1ZmM1NzdlLWE0YTktNGIyMi1iMTEzLWEwZWZhY2RjNjQ3MCJ9',
    nullable: true,
  })
  nextCursor: string | null;
}

export class UserProfileResponseDto {
  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  id: string;

  @ApiProperty({ example: 'player@example.com' })
  email: string;

  @ApiProperty({ example: 'rahmannugar' })
  username: string;

  @ApiPropertyOptional({
    example: 'I bankrupt friends and foes.',
    nullable: true,
  })
  bio: string | null;

  @ApiPropertyOptional({
    example: 'https://pub-example.r2.dev/avatars/user-id/avatar.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ type: UserStatsResponseDto })
  stats: UserStatsResponseDto;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-14T12:15:00.000Z' })
  updatedAt: Date;
}

export class AvatarUploadUrlResponseDto {
  @ApiProperty({
    example:
      'https://example.r2.cloudflarestorage.com/livepoly-user-image/avatars/user-id/avatar.webp?...',
  })
  uploadUrl: string;

  @ApiProperty({
    example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91',
  })
  uploadId: string;

  @ApiProperty({
    example: 'avatars/7c6e0f4e-7f8d-4c18-a0cf-906f4c8f5b9e.webp',
  })
  objectKey: string;

  @ApiProperty({
    example:
      'https://pub-example.r2.dev/avatars/user-id/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp',
  })
  avatarUrl: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds: number;
}
