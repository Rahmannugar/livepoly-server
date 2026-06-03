import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { USER_SEARCH } from '../users.constants';

export class SearchUsersDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(USER_SEARCH.maxLimit)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
