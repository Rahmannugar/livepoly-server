import { Injectable } from '@nestjs/common';

type ObservabilityAttributeValue = string | number | boolean | null | undefined;

type ObservabilityAttributes = Record<string, ObservabilityAttributeValue>;

type NewRelicAgent = {
  recordCustomEvent: (
    eventName: string,
    attributes: Record<string, string | number | boolean | null>,
  ) => void;
  incrementMetric: (metricName: string, value?: number) => void;
};

type RateLimitExceededInput = {
  scope: string;
  count: number;
  limit: number;
  retryAfterSeconds: number;
};

const OBSERVABILITY_EVENTS = {
  rateLimitExceeded: 'RateLimitExceeded',
} as const;

const OBSERVABILITY_METRICS = {
  rateLimitExceeded: (scope: string) => `Custom/RateLimit/Exceeded/${scope}`,
} as const;

@Injectable()
export class ObservabilityService {
  private readonly enabled = process.env.NEW_RELIC_ENABLED === 'true';

  private readonly newrelic: NewRelicAgent | null = this.enabled
    ? (require('newrelic') as NewRelicAgent)
    : null;

  recordEvent(
    eventName: string,
    attributes: ObservabilityAttributes = {},
  ): void {
    if (!this.newrelic) {
      return;
    }

    this.newrelic.recordCustomEvent(eventName, this.clean(attributes));
  }

  recordMetric(metricName: string, value?: number): void {
    if (!this.newrelic) {
      return;
    }

    this.newrelic.incrementMetric(metricName, value);
  }

  recordSecurityEvent(
    eventName: string,
    attributes: ObservabilityAttributes = {},
  ): void {
    this.recordEvent(eventName, attributes);
    this.recordMetric(`Custom/Security/${eventName}`);
  }

  recordRateLimitExceeded(input: RateLimitExceededInput): void {
    this.recordEvent(OBSERVABILITY_EVENTS.rateLimitExceeded, {
      scope: input.scope,
      count: input.count,
      limit: input.limit,
      retryAfterSeconds: input.retryAfterSeconds,
    });

    this.recordMetric(OBSERVABILITY_METRICS.rateLimitExceeded(input.scope));
  }

  private clean(
    attributes: ObservabilityAttributes,
  ): Record<string, string | number | boolean | null> {
    return Object.fromEntries(
      Object.entries(attributes).filter(([, value]) => value !== undefined),
    ) as Record<string, string | number | boolean | null>;
  }
}
