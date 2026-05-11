import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'player@example.com',
    format: 'email',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: '123456',
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d{6}$',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'otpCode must be a 6-digit code',
  })
  otpCode: string;
}

export class ResendEmailVerificationDto {
  @ApiProperty({
    example: 'player@example.com',
    format: 'email',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  email: string;
}
