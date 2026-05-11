import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @ApiProperty({
    example: 'player@example.com',
    format: 'email',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'rahmannugar',
    minLength: 3,
    maxLength: 24,
    pattern: '^[a-z0-9_]+$',
  })
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'username can only contain lowercase letters, numbers, and underscores',
  })
  username: string;

  @ApiProperty({
    example: 'StrongPass123',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
