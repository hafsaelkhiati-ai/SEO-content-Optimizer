'use strict'

// ─── NEW RELIC — US region (one.newrelic.com) ────────────────
exports.config = {
  app_name:    [process.env.NEW_RELIC_APP_NAME || 'SEO Content Optimizer'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',

  // Targets one.newrelic.com (US)
  host: 'collector.newrelic.com',
  port: 443,

  logging:             { level: 'info', filepath: 'stdout' },
  distributed_tracing: { enabled: true },
  error_collector:     { enabled: true, ignore_status_codes: [404] },
  transaction_tracer:  { enabled: true, transaction_threshold: 500 },
  allow_all_headers: true,
  attributes: {
    exclude: ['request.headers.cookie', 'request.headers.authorization'],
  },
}
