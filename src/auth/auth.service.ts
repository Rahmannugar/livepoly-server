import { ConflictException, Injectable } from '@nestjs/common';
import { AUTH } from './auth.constants';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { generateOtpCode, hashPassword, hashToken } from './utils/utils';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();

    const existingUser = await this.authRepository.findUserByEmailOrUsername(
      email,
      username,
    );

    if (existingUser) {
      throw new ConflictException('Email or username already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    const otpCode = generateOtpCode();
    const otpHash = hashToken(otpCode);
    const otpExpiresAt = new Date(
      Date.now() + AUTH.emailOtpTtlMinutes * 60 * 1000,
    );

    const user = await this.authRepository.createUserWithEmailOtp({
      email,
      username,
      passwordHash,
      otpHash,
      otpExpiresAt,
    });

    await this.mailService.sendEmailVerificationOtp(user.email, otpCode);

    return {
      message: 'Verification code sent',
    };
  }
}
