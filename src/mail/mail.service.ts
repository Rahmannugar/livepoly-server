import { Inject, Injectable } from '@nestjs/common';
import { MAIL_CLIENT } from './mail.types';
import type { MailClient } from './mail.types';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_CLIENT)
    private readonly mailClient: MailClient,
  ) {}

  async sendEmailVerificationOtp(email: string, otpCode: string) {
    await this.mailClient.sendMail({
      to: email,
      subject: 'Verify your LivePoly account',
      text: `Your LivePoly verification code is ${otpCode}. It expires in 15 minutes.`,
    });
  }

  async sendPasswordResetOtp(email: string, otpCode: string) {
    await this.mailClient.sendMail({
      to: email,
      subject: 'Reset your LivePoly password',
      text: `Your LivePoly password reset code is ${otpCode}. It expires in 5 minutes.`,
    });
  }

  async sendAccountDeletedEmail(email: string, username: string) {
    await this.mailClient.sendMail({
      to: email,
      subject: 'Your LivePoly account was deleted',
      text: `Hello ${username},

Your LivePoly account has been deleted.

If this was not you, please contact support immediately.`,
    });
  }
}
