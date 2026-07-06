import { createRequire } from 'node:module';

const requireModule = createRequire(__filename);

if (process.env.NEW_RELIC_ENABLED === 'true') {
  requireModule('newrelic');
}
