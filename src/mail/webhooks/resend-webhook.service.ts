import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend, type WebhookEventPayload } from 'resend';
import { CacheService } from '../../infra/cache/cache.service';
import { ObservabilityService } from '../../infra/observability/observability.service';

const WEBHOOK_EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;

type HandleResendWebhookInput = {
  id: string;
  timestamp: string;
  signature: string;
  payload: string;
};

@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);
  private readonly client: Resend;
  private readonly webhookSecret: string;

  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly observabilityService: ObservabilityService,
  ) {
    this.client = new Resend(
      configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.webhookSecret = configService.getOrThrow<string>(
      'RESEND_WEBHOOK_SECRET',
    );
  }

  async handle(input: HandleResendWebhookInput): Promise<void> {
    const event = this.verify(input);
    const key = `webhook:resend:${input.id}`;
    const accepted = await this.cacheService
      .getClient()
      .set(key, '1', 'EX', WEBHOOK_EVENT_TTL_SECONDS, 'NX');

    if (accepted !== 'OK') {
      return;
    }

    this.record(event, input.id);
  }

  private verify(input: HandleResendWebhookInput): WebhookEventPayload {
    try {
      return this.client.webhooks.verify({
        payload: input.payload,
        headers: {
          id: input.id,
          timestamp: input.timestamp,
          signature: input.signature,
        },
        webhookSecret: this.webhookSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid Resend webhook signature');
    }
  }

  private record(event: WebhookEventPayload, webhookId: string): void {
    const emailId = 'email_id' in event.data ? event.data.email_id : undefined;

    this.logger.log({
      message: 'mail.webhook.received',
      provider: 'resend',
      webhookId,
      eventType: event.type,
      emailId,
    });
    this.observabilityService.recordEvent('MailWebhookReceived', {
      provider: 'resend',
      webhookId,
      eventType: event.type,
      emailId,
    });
    this.observabilityService.recordMetric(`Custom/Mail/Webhook/${event.type}`);
  }
}
