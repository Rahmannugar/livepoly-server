import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrivateUserProfileResponseDto {
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

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-14T12:15:00.000Z' })
  updatedAt: Date;
}

export class PublicUserProfileResponseDto {
  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  id: string;

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

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: Date;
}
