import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListNotificationsDto {
  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA1LTE0VDEyOjAwOjAwLjAwMFoiLCJpZCI6IjliNGYwZWE0LTBlNzYtNGRkNS04NjA2LWI2MWRjMzhiODEzZCJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
