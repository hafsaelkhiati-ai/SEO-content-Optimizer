// ============================================================
//  SETTINGS MODULE — Render-compatible
//  Render has an ephemeral filesystem. All persistent config
//  must live in Render's Environment Variables dashboard.
// ============================================================

const fs   = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'settings.json');
let _memSettings = null;

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
    wpUrl:           cfg.wpUrl           || process.env.WORDPRESS_URL      || '',
    wpUser:          cfg.wpUser          || process.env.WORDPRESS_USERNAME  || '',
    gscSite:         cfg.gscSite         || process.env.GSC_SITE_URL        || '',
    language:        cfg.language        || process.env.CONTENT_LANGUAGE    || 'de',
    minWords:        cfg.minWords        || parseInt(process.env.MIN_WORD_COUNT) || 1500,
    postStatus:      cfg.postStatus      || process.env.WP_POST_STATUS      || 'draft',
    openaiModel:     cfg.openaiModel     || process.env.OPENAI_MODEL        || 'gpt-4o',
    perplexityModel: cfg.perplexityModel || process.env.PERPLEXITY_MODEL    || 'sonar-pro',
  };
  _memSettings = safe;
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(safe, null, 2)); } catch (_) {}
}

module.exports = { loadSettings, saveSettings };
