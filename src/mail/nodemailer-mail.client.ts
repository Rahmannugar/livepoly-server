import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import type { MailClient, SendMailInput } from './mail.types';

@Injectable()
export class NodemailerMailClient implements MailClient {
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

  async sendMail(input: SendMailInput) {
    await this.transporter.sendMail({
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  }
}
