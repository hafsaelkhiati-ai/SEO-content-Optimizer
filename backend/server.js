// ============================================================
//  GEO CONTENT AGENT — BACKEND SERVER
//  Express.js · Node 18+
//  Run: node server.js  (or npm start)
// ============================================================

require('dotenv').config();   // loads .env file
const express = require('express');
const cors = require('cors');
const path = require('path');

// Internal modules
const { generateArticle, generateArticleSync } = require('./agent');
const { saveSettings, loadSettings } = require('./settings');
const { testOpenAI, testPerplexity, testWordPress, testSlack, testGSC } = require('./test-connections');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:8080',
    ].filter(Boolean);
    if (allowed.includes(origin) || origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true,
}));

app.use(express.json());

// Optional: simple API key protection
// Set API_SECRET in .env to enable
app.use((req, res, next) => {
  const secret = process.env.API_SECRET;
  if (!secret) return next();                         // no auth configured
  if (req.path === '/health') return next();          // always allow health
  const key = req.headers['x-api-key'];
  if (key === secret) return next();
  return res.status(401).json({ error: 'Unauthorised' });
});

// Serve frontend static files (optional — use Nginx in production)
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── HEALTH CHECK ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── GENERATE (SSE STREAMING) ───────────────────────────────
// GET /api/generate?keyword=...&publish=true&notify=true&checkGsc=false
// Returns Server-Sent Events so the frontend gets live stage updates.
app.get('/api/generate', async (req, res) => {
  const { keyword, publish, notify, checkGsc } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'keyword is required' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await generateArticle({
      keyword,
      publish: publish === 'true',
      notify: notify === 'true',
      checkGsc: checkGsc === 'true',
      onStageStart: (stage) => send({ type: 'stage_start', stage }),
      onStageDone: (stage) => send({ type: 'stage_done', stage }),
    });

    send({ type: 'done', result });
  } catch (err) {
    console.error('[Agent error]', err.message);
    send({ type: 'error', message: err.message, stage: err.stage || 'unknown' });
  } finally {
    res.end();
  }
});

// ─── GENERATE (SYNC — for bulk queue) ───────────────────────
// POST /api/generate-sync
// Body: { keyword, publish, notify, checkGsc }
app.post('/api/generate-sync', async (req, res) => {
  const { keyword, publish, notify, checkGsc } = req.body;
  if (!keyword) return res.status(400).json({ error: 'keyword is required' });

  try {
    const result = await generateArticleSync({ keyword, publish, notify, checkGsc });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SETTINGS ────────────────────────────────────────────────
// GET /api/settings  — returns non-secret config (no API keys)
app.get('/api/settings', (req, res) => {
  const cfg = loadSettings();
  // Strip secrets before sending to frontend
  const safe = { ...cfg };
  delete safe.openaiKey;
  delete safe.perplexityKey;
  delete safe.wpPass;
  delete safe.slackWebhook;
  res.json(safe);
});

// POST /api/settings  — saves config to .env / settings.json
app.post('/api/settings', (req, res) => {
  try {
    saveSettings(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CONNECTION TESTS ────────────────────────────────────────
app.get('/api/test/openai',     async (_, res) => res.json(await testOpenAI()));
app.get('/api/test/perplexity', async (_, res) => res.json(await testPerplexity()));
app.get('/api/test/wordpress',  async (_, res) => res.json(await testWordPress()));
app.get('/api/test/slack',      async (_, res) => res.json(await testSlack()));
app.get('/api/test/gsc',        async (_, res) => res.json(await testGSC()));

// ─── 404 ─────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ─── START ───────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🟢 GEO Content Agent backend running`);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}/index.html`);
  console.log(`   Health:   http://localhost:${PORT}/health\n`);
});
