import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoomPlayerDto {
  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  id: string;

  @ApiProperty({ example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d' })
  roomId: string;

  @ApiPropertyOptional({
    example: '8a68f23e-2d53-41da-a9d8-0f429dbd3734',
    nullable: true,
  })
  userId: string | null;

  @ApiPropertyOptional({ example: 'playerone', nullable: true })
  username: string | null;

  @ApiProperty({ example: 'human', enum: ['human', 'bot'] })
  playerType: string;

  @ApiPropertyOptional({ example: 'medium', nullable: true })
  botDifficulty: string | null;

  @ApiPropertyOptional({ example: 'Banker Bot', nullable: true })
  botName: string | null;

  @ApiProperty({ example: 1 })
  seatNumber: number;

  @ApiProperty({ example: 'joined', enum: ['joined', 'left'] })
  status: string;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  joinedAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  leftAt: Date | null;
}

export class RoomResponseDto {
  @ApiProperty({ example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d' })
  id: string;

  @ApiProperty({ example: 'AbC23xYz' })
  code: string;

  @ApiProperty({ example: '8a68f23e-2d53-41da-a9d8-0f429dbd3734' })
  hostUserId: string;

  @ApiProperty({
    example: 'waiting',
    enum: ['waiting', 'active', 'completed', 'cancelled'],
  })
  status: string;

  @ApiProperty({ example: 4 })
  maxPlayers: number;

  @ApiProperty({ example: 60 })
  durationMinutes: number;

  @ApiProperty({ example: 'classic' })
  boardKey: string;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  startedAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  endedAt: Date | null;

  @ApiProperty({ type: [RoomPlayerDto] })
  players: RoomPlayerDto[];
}

export class RoomMessageResponseDto {
  @ApiProperty({ example: 'Room left' })
  message: string;
}

export class RoomInviteResponseDto {
  @ApiProperty({ example: 'Room invite sent' })
  message: string;

  @ApiProperty({ example: 'AbC23xYz' })
  roomCode: string;
}
