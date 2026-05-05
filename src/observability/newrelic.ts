const enabled = process.env.NEW_RELIC_ENABLED === 'true';

if (enabled) {
  process.env.NEW_RELIC_APP_NAME =
    process.env.NEW_RELIC_APP_NAME || 'LivePoly Server';
  process.env.NEW_RELIC_LOG_LEVEL = process.env.NEW_RELIC_LOG_LEVEL || 'info';

  require('newrelic');
}
