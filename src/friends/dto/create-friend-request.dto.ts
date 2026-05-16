import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateFriendRequestDto {
  @ApiProperty({ example: 'player-two' })
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-z0-9_]+$/)
  username: string;
}
