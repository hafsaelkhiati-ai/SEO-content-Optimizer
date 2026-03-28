/* ============================================
   GEO CONTENT AGENT — FRONTEND JAVASCRIPT
   Talks to the Node.js backend at /api/*
   ============================================ */

// ─── CONFIG ────────────────────────────────────────────────
// Change this if your backend runs on a different host/port
const API_BASE = 'http://localhost:3000';
// ───────────────────────────────────────────────────────────

let currentResult = null;
let statsTotal = 0;

// ─── PAGE NAV ───────────────────────────────────────────────
document.querySelectorAll('.nav-pill-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;
    document.querySelectorAll('.nav-pill-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    link.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// ─── TAB SWITCH ─────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.otab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
  document.querySelector(`.otab[data-tab="${name}"]`).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

// ─── BULK KEYWORD ESTIMATE ──────────────────────────────────
document.getElementById('bulk-keywords').addEventListener('input', function() {
  const lines = this.value.split('\n').filter(l => l.trim()).length;
  const el = document.getElementById('bulk-est');
  if (lines > 0) {
    el.textContent = `${lines} keywords · ~${lines * 10} min · ~€${(lines * 0.30).toFixed(2)} cost`;
  } else {
    el.textContent = '';
  }
});

// ─── RUN SINGLE AGENT ───────────────────────────────────────
async function runAgent() {
  const keyword = document.getElementById('keyword-input').value.trim();
  if (!keyword) { showToast('Please enter a keyword', 'error'); return; }

  const options = {
    keyword,
    publish: document.getElementById('opt-publish').checked,
    notify: document.getElementById('opt-notify').checked,
    checkGsc: document.getElementById('opt-gsc').checked,
  };

  // Reset UI
  resetPipeline();
  document.getElementById('output-panel').style.display = 'none';
  document.getElementById('run-btn').disabled = true;
  document.getElementById('status-text').textContent = 'Agent Running…';

  try {
    // Kick off streaming pipeline
    await runPipeline(options);
  } catch (err) {
    showToast('Agent error: ' + err.message, 'error');
    document.getElementById('status-text').textContent = 'Agent Error';
  } finally {
    document.getElementById('run-btn').disabled = false;
    document.getElementById('status-text').textContent = 'Agent Online';
  }
}

// ─── STREAMING PIPELINE ─────────────────────────────────────
async function runPipeline(options) {
  const stages = ['serp', 'gap', 'outline', 'draft', 'publish'];

  // Use SSE for real-time stage updates
  const params = new URLSearchParams({ ...options });
  const evtSource = new EventSource(`${API_BASE}/api/generate?${params}`);

  return new Promise((resolve, reject) => {
    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handlePipelineEvent(data);
        if (data.type === 'done') {
          evtSource.close();
          currentResult = data.result;
          showResult(data.result);
          statsTotal++;
          document.getElementById('stat-total').textContent = statsTotal;
          showToast('Article generated!', 'success');
          resolve();
        }
        if (data.type === 'error') {
          evtSource.close();
          markStageError(data.stage);
          reject(new Error(data.message));
        }
      } catch (_) {}
    };

    evtSource.onerror = () => {
      evtSource.close();
      reject(new Error('Connection to backend lost'));
    };
  });
}

const STAGE_ORDER = ['serp', 'gap', 'outline', 'draft', 'publish'];
const STAGE_LABELS = { serp: 'SERP Research', gap: 'Gap Analysis', outline: 'Outline', draft: 'Draft Writing', publish: 'Publishing' };

function handlePipelineEvent(data) {
  if (data.type === 'stage_start') {
    setStageRunning(data.stage);
    const idx = STAGE_ORDER.indexOf(data.stage);
    updateProgress(true, `Running: ${STAGE_LABELS[data.stage] || data.stage}…`, Math.round((idx / STAGE_ORDER.length) * 100));
  }
  if (data.type === 'stage_done') {
    setStagesDone(data.stage);
    const idx = STAGE_ORDER.indexOf(data.stage);
    updateProgress(true, `✓ ${STAGE_LABELS[data.stage] || data.stage} complete`, Math.round(((idx + 1) / STAGE_ORDER.length) * 100));
  }
}

function updateProgress(show, label, pct) {
  const el = document.getElementById('overall-progress');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  const lbl = document.getElementById('prog-label');
  const pctEl = document.getElementById('prog-pct');
  const bar = document.getElementById('prog-bar');
  if (lbl) lbl.textContent = label;
  if (pctEl) pctEl.textContent = pct + '%';
  if (bar) bar.style.width = pct + '%';
}

function setStageRunning(stageKey) {
  const el = document.getElementById('stage-' + stageKey);
  if (el) el.classList.add('running');
}

function setStagesDone(stageKey) {
  const el = document.getElementById('stage-' + stageKey);
  if (el) { el.classList.remove('running'); el.classList.add('done'); }
}

function markStageError(stageKey) {
  const el = document.getElementById('stage-' + stageKey);
  if (el) { el.classList.remove('running'); el.classList.add('error'); }
}

function resetPipeline() {
  STAGE_ORDER.forEach(s => {
    const el = document.getElementById('stage-' + s);
    if (el) { el.classList.remove('running', 'done', 'error'); }
  });
  updateProgress(false, '', 0);
}

// ─── SHOW RESULT ────────────────────────────────────────────
function showResult(result) {
  const panel = document.getElementById('output-panel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('output-meta').textContent =
    `${result.wordCount || 0} words · ${result.readingTime || 0} min read · ${result.cost || ''}`;

  // Outline tab
  document.getElementById('outline-content').textContent = result.outline || '';

  // Draft tab (markdown rendered as plain text, keep it simple)
  document.getElementById('draft-content').textContent = result.draft || '';

  // Gaps tab
  document.getElementById('gaps-content').textContent = result.gapAnalysis || '';

  // Raw JSON
  document.getElementById('raw-content').textContent = JSON.stringify(result, null, 2);

  // WordPress link
  if (result.wpUrl) {
    const wpLink = document.getElementById('wp-link');
    wpLink.href = result.wpUrl;
    wpLink.style.display = 'inline-flex';
  }
}

// ─── COPY / DOWNLOAD ────────────────────────────────────────
function copyDraft() {
  if (!currentResult?.draft) { showToast('No draft yet', 'error'); return; }
  navigator.clipboard.writeText(currentResult.draft);
  showToast('Draft copied to clipboard', 'success');
}

function downloadDraft() {
  if (!currentResult?.draft) { showToast('No draft yet', 'error'); return; }
  const keyword = document.getElementById('keyword-input').value.trim().replace(/\s+/g, '-');
  const blob = new Blob([currentResult.draft], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `geo-draft-${keyword}.md`;
  a.click();
  showToast('Downloaded!', 'success');
}

// ─── BULK RUN ───────────────────────────────────────────────
const queueJobs = [];

async function runBulk() {
  const raw = document.getElementById('bulk-keywords').value;
  const keywords = raw.split('\n').map(k => k.trim()).filter(Boolean);
  if (!keywords.length) { showToast('Add keywords first', 'error'); return; }

  const list = document.getElementById('queue-list');
  list.innerHTML = '';

  keywords.forEach(kw => {
    const job = { keyword: kw, status: 'pending', id: Math.random().toString(36).slice(2) };
    queueJobs.push(job);
    list.insertAdjacentHTML('beforeend', renderQueueItem(job));
  });

  for (const job of queueJobs) {
    updateQueueItem(job.id, 'running', 'SERP Research…');
    try {
      const resp = await fetch(`${API_BASE}/api/generate-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: job.keyword, publish: true, notify: true, checkGsc: false })
      });
      if (!resp.ok) throw new Error(await resp.text());
      const result = await resp.json();
      updateQueueItem(job.id, 'done', `${result.wordCount} words · ${result.cost}`);
      statsTotal++;
      document.getElementById('stat-total').textContent = statsTotal;
    } catch (err) {
      updateQueueItem(job.id, 'error', err.message);
    }
  }
  showToast('Batch complete!', 'success');
}

function renderQueueItem(job) {
  return `
    <div class="queue-item" id="qi-${job.id}">
      <div class="qi-dot pending" id="qd-${job.id}"></div>
      <div class="qi-keyword">${job.keyword}</div>
      <div class="qi-stage" id="qs-${job.id}">Pending</div>
      <div class="qi-time" id="qt-${job.id}"></div>
    </div>`;
}

function updateQueueItem(id, status, stageText) {
  const item = document.getElementById('qi-' + id);
  if (!item) return;
  const dot = document.getElementById('qd-' + id);
  if (dot) dot.className = 'qi-dot ' + status;
  const stageEl = document.getElementById('qs-' + id);
  if (stageEl) stageEl.textContent = stageText;
  if (status === 'done') {
    const timeEl = document.getElementById('qt-' + id);
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();
  }
}

// ─── SETTINGS ───────────────────────────────────────────────
async function saveSettings() {
  const cfg = {
    openaiKey: document.getElementById('cfg-openai').value,
    openaiModel: document.getElementById('cfg-model').value,
    perplexityKey: document.getElementById('cfg-perplexity').value,
    perplexityModel: document.getElementById('cfg-pplx-model').value,
    wpUrl: document.getElementById('cfg-wp-url').value,
    wpUser: document.getElementById('cfg-wp-user').value,
    wpPass: document.getElementById('cfg-wp-pass').value,
    slackWebhook: document.getElementById('cfg-slack').value,
    gscCredentials: document.getElementById('cfg-gsc').value,
    gscSite: document.getElementById('cfg-gsc-site').value,
    language: document.getElementById('cfg-lang').value,
    minWords: parseInt(document.getElementById('cfg-words').value) || 1500,
    postStatus: document.getElementById('cfg-status').value,
  };

  try {
    const resp = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg)
    });
    if (!resp.ok) throw new Error(await resp.text());
    showToast('Settings saved!', 'success');
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

async function testConnections() {
  const results = document.getElementById('test-results');
  results.innerHTML = '';

  const services = [
    { name: 'OpenAI', key: 'openai' },
    { name: 'Perplexity', key: 'perplexity' },
    { name: 'WordPress', key: 'wordpress' },
    { name: 'Slack', key: 'slack' },
    { name: 'Google Search Console', key: 'gsc' },
  ];

  for (const svc of services) {
    results.insertAdjacentHTML('beforeend',
      `<div class="test-result-row checking" id="tr-${svc.key}"><i class="bi bi-hourglass-split me-2"></i>Testing ${svc.name}…</div>`);
    try {
      const resp = await fetch(`${API_BASE}/api/test/${svc.key}`);
      const data = await resp.json();
      document.getElementById('tr-' + svc.key).className = 'test-result-row ' + (data.ok ? 'ok' : 'fail');
      document.getElementById('tr-' + svc.key).innerHTML =
        `<i class="bi ${data.ok ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-2"></i>${svc.name} — ${data.message}`;
    } catch {
      document.getElementById('tr-' + svc.key).className = 'test-result-row fail';
      document.getElementById('tr-' + svc.key).innerHTML = `<i class="bi bi-x-circle-fill me-2"></i>${svc.name} — Could not reach backend`;
    }
  }
}

// ─── LOAD SETTINGS ON STARTUP ───────────────────────────────
async function loadSettings() {
  try {
    const resp = await fetch(`${API_BASE}/api/settings`);
    if (!resp.ok) return;
    const cfg = await resp.json();
    if (cfg.wpUrl) document.getElementById('cfg-wp-url').value = cfg.wpUrl;
    if (cfg.wpUser) document.getElementById('cfg-wp-user').value = cfg.wpUser;
    if (cfg.gscSite) document.getElementById('cfg-gsc-site').value = cfg.gscSite;
    if (cfg.language) document.getElementById('cfg-lang').value = cfg.language;
    if (cfg.minWords) document.getElementById('cfg-words').value = cfg.minWords;
    if (cfg.postStatus) document.getElementById('cfg-status').value = cfg.postStatus;
    if (cfg.openaiModel) document.getElementById('cfg-model').value = cfg.openaiModel;
    if (cfg.perplexityModel) document.getElementById('cfg-pplx-model').value = cfg.perplexityModel;
    // Note: API keys are never sent back to the frontend for security
  } catch (_) {}
}

let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-msg');
  if (!el) return;
  msgEl.textContent = msg;
  if (icon) {
    icon.className = type === 'success' ? 'bi bi-check-circle-fill' :
                     type === 'error'   ? 'bi bi-x-circle-fill' :
                     'bi bi-info-circle';
  }
  el.className = 'toast-wrap show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast-wrap'; }, 3200);
}

// ─── INIT ────────────────────────────────────────────────────
loadSettings();
