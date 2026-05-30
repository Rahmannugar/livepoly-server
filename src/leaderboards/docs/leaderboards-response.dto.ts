import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeaderboardEntryResponseDto {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  userId: string;

  @ApiProperty({ example: 'playerone' })
  username: string;

  @ApiPropertyOptional({
    example: 'https://pub-example.r2.dev/avatars/user-id/avatar.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ example: 560 })
  rating: number;

  @ApiProperty({ example: 4 })
  gamesPlayed: number;

  @ApiProperty({ example: 2 })
  wins: number;

  @ApiProperty({ example: 1.75 })
  averagePlacement: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ example: 'weekly', enum: ['weekly', 'monthly'] })
  period: string;

  @ApiProperty({ example: '2026-05-23T12:00:00.000Z' })
  periodStart: string;

  @ApiProperty({ example: '2026-05-30T12:00:00.000Z' })
  periodEnd: string;

  @ApiProperty({ type: [LeaderboardEntryResponseDto] })
  entries: LeaderboardEntryResponseDto[];
}
