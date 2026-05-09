import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'otpCode must be a 6-digit code',
  })
  otpCode: string;

  @IsString()
  @Length(8, 128)
  password: string;
}
