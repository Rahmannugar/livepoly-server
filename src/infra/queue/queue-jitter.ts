import type { JobsOptions } from 'bullmq';

type BackoffWithJitterInput = {
  delay: number;
  jitter?: number;
};

export function exponentialBackoffWithJitter({
  delay,
  jitter = 0.2,
}: BackoffWithJitterInput): NonNullable<JobsOptions['backoff']> {
  return {
    type: 'exponential',
    delay,
    jitter,
  };
}
