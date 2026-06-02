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

  @ApiPropertyOptional({ example: 'normal', nullable: true })
  botDifficulty: string | null;

  @ApiPropertyOptional({ example: 'Atlas', nullable: true })
  botName: string | null;

  @ApiProperty({ example: 1 })
  seatNumber: number;

  @ApiProperty({ example: 'joined', enum: ['joined', 'left', 'kicked'] })
  status: string;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  joinedAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  leftAt: Date | null;
}

export class RoomSpectatorDto {
  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  id: string;

  @ApiProperty({ example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d' })
  roomId: string;

  @ApiProperty({ example: '8a68f23e-2d53-41da-a9d8-0f429dbd3734' })
  userId: string;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  joinedAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  leftAt: Date | null;
}

export class RoomSpectatorResponseDto {
  @ApiProperty({ example: 'Spectating room' })
  message: string;

  @ApiProperty({ type: RoomSpectatorDto })
  spectator: RoomSpectatorDto;
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
    enum: ['waiting', 'active', 'finished', 'cancelled'],
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

export class GameResponseDto {
  @ApiProperty({ example: '2d53f23e-7c6e-4d8a-a9d8-0f429dbd3734' })
  id: string;

  @ApiProperty({ example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d' })
  roomId: string;

  @ApiProperty({ example: 'ranked', enum: ['ranked', 'casual'] })
  mode: string;

  @ApiProperty({ example: 'active', enum: ['active', 'finished', 'cancelled'] })
  status: string;

  @ApiProperty({ example: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91' })
  currentTurnRoomPlayerId: string;

  @ApiProperty({ example: 1 })
  turnNumber: number;

  @ApiProperty({
    example: {
      version: 1,
      roomId: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      roomCode: 'AbC23xYz',
      mode: 'ranked',
      phase: 'awaiting_first_turn',
      turnNumber: 1,
      currentTurnRoomPlayerId: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91',
      players: [],
    },
  })
  state: Record<string, unknown>;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  startedAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  finishedAt: Date | null;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  updatedAt: Date;
}

export class StartRoomResponseDto {
  @ApiProperty({ type: RoomResponseDto })
  room: RoomResponseDto;

  @ApiProperty({ type: GameResponseDto })
  game: GameResponseDto;
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
