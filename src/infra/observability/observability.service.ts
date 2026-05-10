import { Injectable } from '@nestjs/common';

type RateLimitExceededInput = {
  scope: string;
  count: number;
  limit: number;
  retryAfterSeconds: number;
};

@Injectable()
export class ObservabilityService {
  private readonly enabled = process.env.NEW_RELIC_ENABLED === 'true';

  recordRateLimitExceeded(input: RateLimitExceededInput): void {
    if (!this.enabled) {
      return;
    }

    const newrelic = require('newrelic');

    newrelic.recordCustomEvent('RateLimitExceeded', {
      scope: input.scope,
      count: input.count,
      limit: input.limit,
      retryAfterSeconds: input.retryAfterSeconds,
    });

    newrelic.incrementMetric(`Custom/RateLimit/Exceeded/${input.scope}`);
  }
}
