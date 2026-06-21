import { Inject, Injectable } from '@nestjs/common';
import {
  accountDeletedTemplate,
  emailVerificationOtpTemplate,
  passwordResetOtpTemplate,
} from './mail.template';
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
      ...emailVerificationOtpTemplate(otpCode),
    });
  }

  async sendPasswordResetOtp(email: string, otpCode: string) {
    await this.mailClient.sendMail({
      to: email,
      ...passwordResetOtpTemplate(otpCode),
    });
  }

  async sendAccountDeletedEmail(email: string, username: string) {
    await this.mailClient.sendMail({
      to: email,
      ...accountDeletedTemplate(username),
    });
  }
}
