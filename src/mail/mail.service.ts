import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpPort = this.configService.getOrThrow<number>('SMTP_PORT');

    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async sendEmailVerificationOtp(email: string, otpCode: string) {
    await this.transporter.sendMail({
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      to: email,
      subject: 'Verify your LivePoly account',
      text: `Your LivePoly verification code is ${otpCode}. It expires in 15 minutes.`,
    });
  }

  async sendPasswordResetOtp(email: string, otpCode: string) {
    await this.transporter.sendMail({
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      to: email,
      subject: 'Reset your LivePoly password',
      text: `Your LivePoly password reset code is ${otpCode}. It expires in 5 minutes.`,
    });
  }

  async sendAccountDeletedEmail(email: string, username: string) {
    await this.transporter.sendMail({
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      to: email,
      subject: 'Your LivePoly account was deleted',
      text: `Hello ${username},

Your LivePoly account has been deleted.

If this was not you, please contact support immediately.`,
    });
  }
}
