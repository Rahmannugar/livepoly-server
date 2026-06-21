'use strict';

exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'LivePoly Server'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
  },
  distributed_tracing: {
    enabled: true,
  },
  application_logging: {
    forwarding: {
      enabled:
        process.env.NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED !==
        'false',
    },
    metrics: {
      enabled: true,
    },
    local_decorating: {
      enabled:
        process.env.NEW_RELIC_APPLICATION_LOGGING_LOCAL_DECORATING_ENABLED ===
        'true',
    },
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.authorization',
      'request.headers.cookie',
      'response.headers.setCookie',
      'response.headers["set-cookie"]',
    ],
  },
};
