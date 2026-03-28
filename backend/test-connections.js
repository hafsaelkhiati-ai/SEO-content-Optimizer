// ============================================================
//  CONNECTION TESTS
//  Tests each API integration independently.
//  Called from: GET /api/test/:service
// ============================================================

const axios = require('axios');

// ─── OPENAI ──────────────────────────────────────────────────
async function testOpenAI() {
  // 🔑 Uses OPENAI_API_KEY from .env
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-your')) {
    return { ok: false, message: 'API key not configured' };
  }
  try {
    const { data } = await axios.get('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 8000,
    });
    const has4o = data.data?.some(m => m.id.includes('gpt-4o'));
    return { ok: true, message: `Connected · ${has4o ? 'GPT-4o available' : 'Connected'}` };
  } catch (err) {
    return { ok: false, message: err.response?.data?.error?.message || err.message };
  }
}

// ─── PERPLEXITY ──────────────────────────────────────────────
async function testPerplexity() {
  // 🔑 Uses PERPLEXITY_API_KEY from .env
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey || apiKey.startsWith('pplx-your')) {
    return { ok: false, message: 'API key not configured' };
  }
  try {
    const { data } = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar',
        messages: [{ role: 'user', content: 'Reply with the word: OK' }],
        max_tokens: 5,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return { ok: true, message: 'Connected · SERP research ready' };
  } catch (err) {
    return { ok: false, message: err.response?.data?.error?.message || err.message };
  }
}

// ─── WORDPRESS ───────────────────────────────────────────────
async function testWordPress() {
  const wpUrl  = process.env.WORDPRESS_URL;
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPass = process.env.WORDPRESS_APP_PASSWORD;

  if (!wpUrl || !wpUser || !wpPass || wpUrl.includes('yoursite')) {
    return { ok: false, message: 'WordPress credentials not configured' };
  }

  try {
    // 🔑 Uses WordPress Application Password auth
    const token = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
    const { data } = await axios.get(`${wpUrl}/wp-json/wp/v2/users/me`, {
      headers: { 'Authorization': `Basic ${token}` },
      timeout: 10000,
    });
    return { ok: true, message: `Connected as ${data.name} · REST API ready` };
  } catch (err) {
    const msg = err.response?.status === 401
      ? 'Invalid credentials — check Application Password'
      : err.response?.status === 404
        ? 'WP REST API not found — is WordPress installed?'
        : err.message;
    return { ok: false, message: msg };
  }
}

// ─── SLACK ───────────────────────────────────────────────────
async function testSlack() {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook || webhook.includes('T00000000')) {
    return { ok: false, message: 'Webhook URL not configured (optional)' };
  }
  try {
    await axios.post(webhook, { text: '🟢 GEO Content Agent connected to Slack' }, { timeout: 8000 });
    return { ok: true, message: 'Connected · Test message sent' };
  } catch (err) {
    return { ok: false, message: err.response?.data || err.message };
  }
}

// ─── GOOGLE SEARCH CONSOLE ───────────────────────────────────
async function testGSC() {
  const credPath = process.env.GSC_CREDENTIALS_PATH;
  const siteUrl  = process.env.GSC_SITE_URL;

  if (!credPath || !siteUrl || credPath.includes('/path/to/')) {
    return { ok: false, message: 'GSC not configured (optional)' };
  }

  const fs = require('fs');
  if (!fs.existsSync(credPath)) {
    return { ok: false, message: `Service account file not found: ${credPath}` };
  }

  try {
    const { google } = require('googleapis');
    // 🔑 Uses GSC_CREDENTIALS_PATH — path to service account JSON
    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const client = await auth.getClient();
    return { ok: true, message: `Service account connected · Site: ${siteUrl}` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = { testOpenAI, testPerplexity, testWordPress, testSlack, testGSC };
