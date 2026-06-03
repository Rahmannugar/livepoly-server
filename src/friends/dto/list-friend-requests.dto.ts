import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { FRIEND_LIST } from '../friends.constants';

export class ListFriendRequestsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(FRIEND_LIST.maxLimit)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  incomingCursor?: string;

  @IsOptional()
  @IsString()
  outgoingCursor?: string;
}
