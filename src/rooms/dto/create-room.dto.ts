import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ROOM_DURATIONS, type RoomDurationMinutes } from '../rooms.constants';

export class CreateRoomDto {
  @ApiPropertyOptional({
    example: 60,
    enum: ROOM_DURATIONS,
    description: 'Timed game duration in minutes.',
  })
  @IsOptional()
  @IsIn(ROOM_DURATIONS)
  durationMinutes?: RoomDurationMinutes;
}
