// ============================================================
//  SETTINGS MODULE
//  Saves runtime config to settings.json on disk.
//  API keys are written to .env and never returned to frontend.
// ============================================================

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const ENV_FILE      = path.join(__dirname, '.env');

// Load current settings (non-secret fields only returned to frontend)
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (_) {}
  // Return defaults from environment
  return {
    wpUrl:          process.env.WORDPRESS_URL || '',
    wpUser:         process.env.WORDPRESS_USERNAME || '',
    gscSite:        process.env.GSC_SITE_URL || '',
    language:       process.env.CONTENT_LANGUAGE || 'de',
    minWords:       parseInt(process.env.MIN_WORD_COUNT) || 1500,
    postStatus:     process.env.WP_POST_STATUS || 'draft',
    openaiModel:    process.env.OPENAI_MODEL || 'gpt-4o',
    perplexityModel:process.env.PERPLEXITY_MODEL || 'sonar-pro',
  };
}

// Save settings — API keys go to .env, rest to settings.json
function saveSettings(cfg) {
  // Update .env for API keys (only if provided — empty = don't overwrite)
  const envUpdates = {};

  if (cfg.openaiKey)      envUpdates.OPENAI_API_KEY          = cfg.openaiKey;
  if (cfg.openaiModel)    envUpdates.OPENAI_MODEL             = cfg.openaiModel;
  if (cfg.perplexityKey)  envUpdates.PERPLEXITY_API_KEY       = cfg.perplexityKey;
  if (cfg.perplexityModel)envUpdates.PERPLEXITY_MODEL         = cfg.perplexityModel;
  if (cfg.wpUrl)          envUpdates.WORDPRESS_URL            = cfg.wpUrl;
  if (cfg.wpUser)         envUpdates.WORDPRESS_USERNAME       = cfg.wpUser;
  if (cfg.wpPass)         envUpdates.WORDPRESS_APP_PASSWORD   = cfg.wpPass;
  if (cfg.slackWebhook)   envUpdates.SLACK_WEBHOOK_URL        = cfg.slackWebhook;
  if (cfg.gscCredentials) envUpdates.GSC_CREDENTIALS_PATH     = cfg.gscCredentials;
  if (cfg.gscSite)        envUpdates.GSC_SITE_URL             = cfg.gscSite;
  if (cfg.language)       envUpdates.CONTENT_LANGUAGE        = cfg.language;
  if (cfg.minWords)       envUpdates.MIN_WORD_COUNT           = String(cfg.minWords);
  if (cfg.postStatus)     envUpdates.WP_POST_STATUS           = cfg.postStatus;

  updateEnvFile(envUpdates);

  // Also update process.env so changes take effect without restart
  Object.entries(envUpdates).forEach(([k, v]) => { process.env[k] = v; });

  // Save non-secret settings to settings.json for persistence
  const safe = {
    wpUrl:          cfg.wpUrl          || process.env.WORDPRESS_URL || '',
    wpUser:         cfg.wpUser         || process.env.WORDPRESS_USERNAME || '',
    gscSite:        cfg.gscSite        || process.env.GSC_SITE_URL || '',
    language:       cfg.language       || process.env.CONTENT_LANGUAGE || 'de',
    minWords:       cfg.minWords       || parseInt(process.env.MIN_WORD_COUNT) || 1500,
    postStatus:     cfg.postStatus     || process.env.WP_POST_STATUS || 'draft',
    openaiModel:    cfg.openaiModel    || process.env.OPENAI_MODEL || 'gpt-4o',
    perplexityModel:cfg.perplexityModel|| process.env.PERPLEXITY_MODEL || 'sonar-pro',
  };

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(safe, null, 2));
}

// Updates or adds key=value lines in .env file
function updateEnvFile(updates) {
  if (!Object.keys(updates).length) return;

  let content = '';
  try {
    content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  } catch (_) {}

  const lines = content.split('\n');

  Object.entries(updates).forEach(([key, value]) => {
    const escapedValue = value.includes(' ') ? `"${value}"` : value;
    const lineIdx = lines.findIndex(l => l.startsWith(key + '='));
    if (lineIdx >= 0) {
      lines[lineIdx] = `${key}=${escapedValue}`;
    } else {
      lines.push(`${key}=${escapedValue}`);
    }
  });

  fs.writeFileSync(ENV_FILE, lines.join('\n'));
}

module.exports = { loadSettings, saveSettings };
