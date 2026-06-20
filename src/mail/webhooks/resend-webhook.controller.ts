import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ResendWebhookService } from './resend-webhook.service';

@Controller('webhooks/resend')
export class ResendWebhookController {
  constructor(private readonly webhookService: ResendWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('svix-id') id?: string,
    @Headers('svix-timestamp') timestamp?: string,
    @Headers('svix-signature') signature?: string,
  ) {
    if (!request.rawBody || !id || !timestamp || !signature) {
      throw new BadRequestException('Invalid Resend webhook request');
    }

    await this.webhookService.handle({
      id,
      timestamp,
      signature,
      payload: request.rawBody.toString('utf8'),
    });

    return { received: true };
  }
}
