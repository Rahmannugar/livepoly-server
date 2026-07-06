import type { Job } from 'bullmq';

type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly string[];

type LogAttributes = Record<string, LogValue>;

type LogEventInput = {
  name: string;
  outcome?: 'success' | 'failure' | 'skipped' | 'started' | 'queued';
  reason?: string;
};

type LogErrorOptions = {
  includeStack?: boolean;
  code?: string;
};

export function logEvent(input: LogEventInput): { event: LogAttributes } {
  return {
    event: cleanLogAttributes({
      name: input.name,
      outcome: input.outcome,
      reason: input.reason,
    }),
  };
}

export function logEntity(attributes: LogAttributes): {
  entity?: LogAttributes;
} {
  const entity = cleanLogAttributes(attributes);

  return Object.keys(entity).length > 0 ? { entity } : {};
}

export function logError(
  error: unknown,
  options: LogErrorOptions = {},
): { error: LogAttributes } {
  const errorObject = error instanceof Error ? error : null;

  return {
    error: cleanLogAttributes({
      name: errorObject?.name,
      message: errorObject?.message ?? String(error),
      code: options.code,
      stack: options.includeStack ? errorObject?.stack : undefined,
    }),
  };
}

export function logJob(queueName: string, job: Job): { job: LogAttributes } {
  return {
    job: cleanLogAttributes({
      queueName,
      jobName: job.name,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    }),
  };
}

export function cleanLogAttributes(attributes: LogAttributes): LogAttributes {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  );
}
