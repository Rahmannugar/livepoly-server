import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserStatsResponseDto {
  @ApiProperty({ example: 42 })
  gamesPlayed: number;

  @ApiProperty({ example: 12 })
  gamesWon: number;

  @ApiPropertyOptional({ example: 2.35, nullable: true })
  averagePlacement: number | null;

  @ApiPropertyOptional({ example: 1530, nullable: true })
  rating: number | null;
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
    example:
      'avatars/7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp',
  })
  objectKey: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds: number;
}
