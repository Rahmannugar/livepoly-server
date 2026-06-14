import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { BOT_DIFFICULTIES, type BotDifficulty } from '../rooms.constants';

export class StartRoomDto {
  @ApiPropertyOptional({
    enum: BOT_DIFFICULTIES,
    example: 'normal',
    description: 'Difficulty used for bot-filled seats in casual rooms.',
  })
  @IsOptional()
  @IsIn(BOT_DIFFICULTIES)
  botDifficulty?: BotDifficulty;
}
