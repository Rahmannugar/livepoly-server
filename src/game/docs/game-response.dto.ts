import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GameResultPlayerDto {
  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  roomPlayerId: string;

  @ApiPropertyOptional({
    example: '8a68f23e-2d53-41da-a9d8-0f429dbd3734',
    nullable: true,
  })
  userId: string | null;

  @ApiPropertyOptional({ example: 'playerone', nullable: true })
  username: string | null;

  @ApiProperty({ example: 'human', enum: ['human', 'bot'] })
  playerType: string;

  @ApiPropertyOptional({ example: 'Nova', nullable: true })
  botName: string | null;

  @ApiProperty({ example: 1 })
  seatNumber: number;

  @ApiProperty({ example: 1500 })
  startingCash: number;

  @ApiProperty({ example: 1680 })
  finalCash: number;

  @ApiProperty({ example: 2140 })
  finalNetWorth: number;

  @ApiProperty({ example: 1 })
  placement: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  bankruptAt: Date | null;
}

export class GameResultResponseDto {
  @ApiProperty({ example: '2d53f23e-7c6e-4d8a-a9d8-0f429dbd3734' })
  gameId: string;

  @ApiProperty({ example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d' })
  roomId: string;

  @ApiProperty({ example: 'AbC23xYz' })
  roomCode: string;

  @ApiProperty({ example: 'casual', enum: ['ranked', 'casual'] })
  mode: string;

  @ApiProperty({
    example: 'time_elapsed',
    enum: ['bankruptcy', 'time_elapsed', 'cancelled'],
  })
  endReason: string;

  @ApiPropertyOptional({
    example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91',
    nullable: true,
  })
  winnerRoomPlayerId: string | null;

  @ApiPropertyOptional({
    example: '8a68f23e-2d53-41da-a9d8-0f429dbd3734',
    nullable: true,
  })
  winnerUserId: string | null;

  @ApiProperty({ example: 3600 })
  durationSeconds: number;

  @ApiProperty({ example: '2026-05-14T13:00:00.000Z' })
  completedAt: Date;

  @ApiProperty({ type: [GameResultPlayerDto] })
  players: GameResultPlayerDto[];
}
