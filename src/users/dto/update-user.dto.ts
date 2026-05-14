import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'rahmannugar',
    minLength: 3,
    maxLength: 24,
    pattern: '^[a-z0-9_]+$',
  })
  @IsOptional()
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'username can only contain lowercase letters, numbers, and underscores',
  })
  username?: string;

  @ApiPropertyOptional({
    example: 'I bankrupt friends and foes.',
    maxLength: 160,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;
}
