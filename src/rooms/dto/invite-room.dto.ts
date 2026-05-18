import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class InviteRoomDto {
  @ApiProperty({ example: 'player_two' })
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-z0-9_]+$/)
  username: string;
}
