import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { MailClient, SendMailInput } from './mail.types';

@Injectable()
export class ResendMailClient implements MailClient {
  private readonly client: Resend;
  private readonly from: string;

  constructor(configService: ConfigService) {
    this.client = new Resend(
      configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.from = configService.getOrThrow<string>('MAIL_FROM');
  }

  async sendMail(input: SendMailInput): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });

    if (error) {
      throw new Error(`Resend rejected email: ${error.message}`);
    }
  }
}
