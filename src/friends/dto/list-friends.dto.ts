import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { FRIEND_LIST } from '../friends.constants';

export class ListFriendsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(FRIEND_LIST.maxLimit)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
