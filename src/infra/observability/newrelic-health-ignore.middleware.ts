import type { NextFunction, Request, Response } from 'express';
import newrelicModule from 'newrelic';

type NewRelicTransactionHandle = {
  ignore: () => void;
};

type NewRelicAgent = {
  getTransaction: () => NewRelicTransactionHandle;
};

const HEALTH_PATHS = new Set(['/health/live', '/health/ready']);
const newrelic = newrelicModule as NewRelicAgent;

export function ignoreNewRelicHealthTransactions(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (
    process.env.NEW_RELIC_ENABLED === 'true' &&
    HEALTH_PATHS.has(request.path)
  ) {
    newrelic.getTransaction().ignore();
  }

  next();
}
