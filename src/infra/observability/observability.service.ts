import { createRequire } from 'node:module';
import { Injectable } from '@nestjs/common';

type ObservabilityAttributeValue = string | number | boolean | null | undefined;

type ObservabilityAttributes = Record<string, ObservabilityAttributeValue>;

type NewRelicTransaction = {
  ignore: () => void;
  end: () => void;
};

type NewRelicAgent = {
  recordCustomEvent: (
    eventName: string,
    attributes: Record<string, string | number | boolean | null>,
  ) => void;
  incrementMetric: (metricName: string, value?: number) => void;
  recordMetric: (metricName: string, value: number) => void;
  getTransaction: () => NewRelicTransaction;
  endTransaction: () => void;
  setTransactionName: (name: string) => void;
  addCustomAttributes: (
    attributes: Record<string, string | number | boolean | null>,
  ) => void;
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

const requireModule = createRequire(__filename);

function loadNewRelicAgent(): NewRelicAgent {
  return requireModule('newrelic') as NewRelicAgent;
}

@Injectable()
export class ObservabilityService {
  private readonly enabled = process.env.NEW_RELIC_ENABLED === 'true';

  private readonly newrelic: NewRelicAgent | null = this.enabled
    ? loadNewRelicAgent()
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

  ignoreCurrentTransaction(): void {
    if (!this.newrelic) {
      return;
    }

    const transaction = this.newrelic.getTransaction();
    transaction.ignore();
    transaction.end();
  }

  nameCurrentTransaction(
    name: string,
    attributes: ObservabilityAttributes = {},
  ): void {
    if (!this.newrelic) {
      return;
    }

    this.newrelic.setTransactionName(name);
    this.newrelic.addCustomAttributes(this.clean(attributes));
  }

  endCurrentTransaction(): void {
    this.newrelic?.endTransaction();
  }

  recordDurationMetric(metricName: string, durationMs: number): void {
    if (!this.newrelic || !Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }

    this.newrelic.recordMetric(metricName, durationMs / 1_000);
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
