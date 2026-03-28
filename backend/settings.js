// ============================================================
//  SETTINGS MODULE — Railway-compatible
//
//  Railway has an ephemeral filesystem: writing to .env has no
//  effect across restarts. All persistent config must live in
//  Railway's Environment Variables dashboard.
//
//  This module:
//   - Reads config from process.env (set via Railway dashboard)
//   - Keeps in-memory overrides for the current session
//   - Falls back to settings.json IF it exists (local dev only)
//   - No longer writes .env at runtime
// ============================================================

const fs   = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// In-memory store for runtime overrides (survives within one dyno session)
let _memSettings = null;

// Load current settings
function loadSettings() {
  if (_memSettings) return _memSettings;

  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (_) {}

  return buildFromEnv();
}

function buildFromEnv() {
  return {
    wpUrl:           process.env.WORDPRESS_URL       || '',
    wpUser:          process.env.WORDPRESS_USERNAME  || '',
    gscSite:         process.env.GSC_SITE_URL        || '',
    language:        process.env.CONTENT_LANGUAGE    || 'de',
    minWords:        parseInt(process.env.MIN_WORD_COUNT) || 1500,
    postStatus:      process.env.WP_POST_STATUS      || 'draft',
    openaiModel:     process.env.OPENAI_MODEL        || 'gpt-4o',
    perplexityModel: process.env.PERPLEXITY_MODEL    || 'sonar-pro',
  };
}

// Save settings — updates process.env in-memory for this session.
// To make changes permanent on Railway, update Environment Variables
// in your Railway service dashboard.
function saveSettings(cfg) {
  const envMap = {
    openaiKey:       'OPENAI_API_KEY',
    openaiModel:     'OPENAI_MODEL',
    perplexityKey:   'PERPLEXITY_API_KEY',
    perplexityModel: 'PERPLEXITY_MODEL',
    wpUrl:           'WORDPRESS_URL',
    wpUser:          'WORDPRESS_USERNAME',
    wpPass:          'WORDPRESS_APP_PASSWORD',
    slackWebhook:    'SLACK_WEBHOOK_URL',
    gscCredentials:  'GSC_CREDENTIALS_PATH',
    gscSite:         'GSC_SITE_URL',
    language:        'CONTENT_LANGUAGE',
    postStatus:      'WP_POST_STATUS',
  };

  Object.entries(envMap).forEach(([cfgKey, envKey]) => {
    if (cfg[cfgKey]) process.env[envKey] = cfg[cfgKey];
  });
  if (cfg.minWords) process.env.MIN_WORD_COUNT = String(cfg.minWords);

  const safe = {
    wpUrl:           cfg.wpUrl           || process.env.WORDPRESS_URL       || '',
    wpUser:          cfg.wpUser          || process.env.WORDPRESS_USERNAME   || '',
    gscSite:         cfg.gscSite         || process.env.GSC_SITE_URL         || '',
    language:        cfg.language        || process.env.CONTENT_LANGUAGE     || 'de',
    minWords:        cfg.minWords        || parseInt(process.env.MIN_WORD_COUNT) || 1500,
    postStatus:      cfg.postStatus      || process.env.WP_POST_STATUS        || 'draft',
    openaiModel:     cfg.openaiModel     || process.env.OPENAI_MODEL          || 'gpt-4o',
    perplexityModel: cfg.perplexityModel || process.env.PERPLEXITY_MODEL      || 'sonar-pro',
  };

  _memSettings = safe;

  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(safe, null, 2));
  } catch (_) {
    // Railway ephemeral filesystem — expected, not an error
  }
}

module.exports = { loadSettings, saveSettings };
