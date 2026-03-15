# GEO Content Agent — VPS Deployment Guide

> **Stack:** Node.js 18 + Nginx + PM2 · Ubuntu 22.04 LTS  
> **Time to go live:** ~45 minutes  
> **Tested on:** Hetzner CX21, DigitalOcean Droplet, Contabo VPS

---

## Table of Contents

1. [VPS Requirements](#1-vps-requirements)
2. [Initial Server Setup](#2-initial-server-setup)
3. [Install Node.js & Dependencies](#3-install-nodejs--dependencies)
4. [Upload Your Project Files](#4-upload-your-project-files)
5. [Configure Environment Variables (API Keys)](#5-configure-environment-variables-api-keys)
6. [Install & Start with PM2](#6-install--start-with-pm2)
7. [Configure Nginx Reverse Proxy](#7-configure-nginx-reverse-proxy)
8. [SSL Certificate (HTTPS)](#8-ssl-certificate-https)
9. [WordPress Application Password Setup](#9-wordpress-application-password-setup)
10. [Perplexity API Key](#10-perplexity-api-key)
11. [OpenAI API Key](#11-openai-api-key)
12. [Slack Webhook (Optional)](#12-slack-webhook-optional)
13. [Google Search Console (Optional)](#13-google-search-console-optional)
14. [Test Everything](#14-test-everything)
15. [Firewall & Security](#15-firewall--security)
16. [Troubleshooting](#16-troubleshooting)
17. [Cost Summary](#17-cost-summary)

---

## 1. VPS Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Disk | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Node | 18+ | 20 LTS |

**Recommended providers (DACH-friendly):**
- **Hetzner** (Germany/Finland) — CX21 = €4.51/mo — best value
- **DigitalOcean** — Basic Droplet = $6/mo
- **Contabo** — VPS S = €4.99/mo

---

## 2. Initial Server Setup

SSH into your VPS as root:

```bash
ssh root@YOUR_SERVER_IP
```

Create a non-root user (security best practice):

```bash
adduser seoagent
usermod -aG sudo seoagent
# Copy SSH keys to new user
rsync --archive --chown=seoagent:seoagent ~/.ssh /home/seoagent
```

Switch to your new user:

```bash
su - seoagent
```

Update the system:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential
```

---

## 3. Install Node.js & Dependencies

Install Node.js 20 LTS via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

Install PM2 (process manager — keeps your app running):

```bash
sudo npm install -g pm2
```

Install Nginx:

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 4. Upload Your Project Files

**Option A: Clone from Git (recommended)**

```bash
cd /home/seoagent
git clone https://github.com/YOUR_USERNAME/geo-content-agent.git seo-agent
cd seo-agent
```

**Option B: Upload via SCP (from your local machine)**

```bash
# Run this on YOUR LOCAL MACHINE, not the server:
scp -r /path/to/seo-agent seoagent@YOUR_SERVER_IP:/home/seoagent/
```

**Option C: Upload via SFTP**  
Use FileZilla or Cyberduck to drag and drop the project folder.

---

Install backend Node.js dependencies:

```bash
cd /home/seoagent/seo-agent/backend
npm install
```

---

## 5. Configure Environment Variables (API Keys)

This is where you add all your API keys. They live in a `.env` file that is **never uploaded to Git**.

```bash
cd /home/seoagent/seo-agent/backend
cp .env.example .env
nano .env
```

Fill in each value (see sections 9–13 below for where to get each key):

```env
# ─── SERVER ─────────────────────────────────────────
PORT=3000
FRONTEND_URL=https://yourdomain.de

# ─── OPENAI ─────────────────────────────────────────
# 🔑 Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o

# ─── PERPLEXITY ─────────────────────────────────────
# 🔑 Get from: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxx
PERPLEXITY_MODEL=sonar-pro

# ─── WORDPRESS ──────────────────────────────────────
# 🔑 Your live WordPress site URL (no trailing slash)
WORDPRESS_URL=https://yoursite.de
WORDPRESS_USERNAME=admin
# 🔑 Application Password from WP Admin → Users → Profile
WORDPRESS_APP_PASSWORD=AbCd EfGh IjKl MnOp QrSt UvWx

# ─── SLACK (optional) ────────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# ─── GOOGLE SEARCH CONSOLE (optional) ───────────────
GSC_CREDENTIALS_PATH=/home/seoagent/seo-agent/gsc-service-account.json
GSC_SITE_URL=sc-domain:yoursite.de

# ─── CONTENT SETTINGS ───────────────────────────────
CONTENT_LANGUAGE=de
MIN_WORD_COUNT=1500
WP_POST_STATUS=draft
DEFAULT_CATEGORY_ID=1
```

Save with `Ctrl+O`, then `Ctrl+X`.

**Protect the file:**

```bash
chmod 600 /home/seoagent/seo-agent/backend/.env
```

---

## 6. Install & Start with PM2

Start the backend:

```bash
cd /home/seoagent/seo-agent/backend
pm2 start server.js --name "geo-agent-backend"
```

Save PM2 config so it restarts on server reboot:

```bash
pm2 save
pm2 startup
# Copy and run the command it outputs (starts with: sudo env PATH=...)
```

Useful PM2 commands:

```bash
pm2 status              # Check if running
pm2 logs geo-agent-backend   # View live logs
pm2 restart geo-agent-backend  # Restart after changes
pm2 stop geo-agent-backend     # Stop
```

**Quick test** — the backend should respond:

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

## 7. Configure Nginx Reverse Proxy

Nginx will:
- Serve the frontend HTML/CSS/JS files
- Proxy `/api/*` requests to the Node.js backend on port 3000
- Handle HTTPS/SSL

Create an Nginx config file:

```bash
sudo nano /etc/nginx/sites-available/geo-agent
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.de www.yourdomain.de;

    # ─── Frontend (static files) ──────────────────────────
    root /home/seoagent/seo-agent/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # ─── Backend API (proxy to Node.js port 3000) ─────────
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Required for SSE (Server-Sent Events) streaming
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for long AI generation requests
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # ─── Security headers ─────────────────────────────────
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/geo-agent /etc/nginx/sites-enabled/
sudo nginx -t        # Test config — should say "syntax is ok"
sudo systemctl reload nginx
```

Point your domain's DNS A record to your server's IP address.  
(At Hetzner/DigitalOcean: DNS panel → A record → @ → YOUR_SERVER_IP)

---

## 8. SSL Certificate (HTTPS)

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Get a free Let's Encrypt certificate:

```bash
sudo certbot --nginx -d yourdomain.de -d www.yourdomain.de
```

Follow the prompts (enter your email, agree to terms).

Certbot auto-renews every 90 days. Test renewal:

```bash
sudo certbot renew --dry-run
```

After SSL, update your `.env`:

```bash
nano /home/seoagent/seo-agent/backend/.env
# Change FRONTEND_URL to https://yourdomain.de
```

And update `app.js` in the frontend:

```javascript
// In frontend/app.js, line 1:
const API_BASE = 'https://yourdomain.de';
```

Restart PM2:

```bash
pm2 restart geo-agent-backend
```

---

## 9. WordPress Application Password Setup

WordPress Application Passwords are a secure way to authenticate with the REST API — they are separate from your admin login password.

**Steps:**

1. Log into your WordPress admin: `yoursite.de/wp-admin`
2. Go to **Users → Your Profile** (or **Users → All Users → Edit your user**)
3. Scroll down to **Application Passwords**
4. In the "New Application Password Name" field, type: `GEO Content Agent`
5. Click **Add New Application Password**
6. **Copy the generated password immediately** — it looks like: `AbCd EfGh IjKl MnOp QrSt UvWx`
7. Paste it into your `.env` as `WORDPRESS_APP_PASSWORD`

> ⚠️ The password includes spaces — that's correct, keep them in.

**Enable REST API (if needed):**  
Most WordPress installations have REST API enabled by default. If it doesn't work, check:
- WP Admin → Settings → Permalinks → Save (just click Save to flush rewrite rules)
- Disable any "Disable REST API" security plugins temporarily

**Get your Category IDs:**

```bash
curl -s https://yoursite.de/wp-json/wp/v2/categories | python3 -m json.tool | grep -E '"id"|"name"'
```

Set `DEFAULT_CATEGORY_ID` in `.env` to the ID of your blog category.

---

## 10. Perplexity API Key

Perplexity is used for real-time SERP research.

**Steps:**

1. Go to: https://www.perplexity.ai/settings/api
2. Sign in or create an account
3. Click **Generate** to create a new API key
4. Copy the key (starts with `pplx-`)
5. Add to `.env`: `PERPLEXITY_API_KEY=pplx-your-key-here`

**Pricing:**
- sonar-pro: ~$3 per 1,000 requests  
- At 100 articles/month = ~$0.30 total for SERP research

**Recommended model:**  
Use `sonar-pro` for better SERP research. Switch to `sonar` to reduce costs.

---

## 11. OpenAI API Key

OpenAI GPT-4o is used for gap analysis, outline, and article writing.

**Steps:**

1. Go to: https://platform.openai.com/api-keys
2. Click **Create new secret key**
3. Name it: `GEO Content Agent`
4. Copy the key (starts with `sk-proj-` or `sk-`)
5. Add to `.env`: `OPENAI_API_KEY=sk-your-key-here`

**Set a spending limit** to avoid surprise bills:

1. Go to: https://platform.openai.com/account/billing/limits
2. Set a monthly limit (e.g. $20/month is plenty)

**Pricing for GPT-4o (as of 2025):**
- ~$0.01–0.03 per article (input + output tokens combined)
- 100 articles/month ≈ $2–3

---

## 12. Slack Webhook (Optional)

Get notified in Slack when a new article draft is ready.

**Steps:**

1. Go to: https://api.slack.com/apps
2. Click **Create New App → From scratch**
3. Name: `GEO Content Agent`, select your workspace
4. Click **Incoming Webhooks → Activate Incoming Webhooks** → toggle On
5. Click **Add New Webhook to Workspace**
6. Select the channel (e.g. `#content` or `#seo`)
7. Copy the Webhook URL (starts with `https://hooks.slack.com/services/`)
8. Add to `.env`: `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...`

---

## 13. Google Search Console (Optional)

GSC integration lets the agent check if a keyword already has rankings before writing.

**Steps:**

1. Go to: https://console.cloud.google.com
2. Create a new project (or use existing)
3. Enable the **Search Console API**:
   - APIs & Services → Enable APIs → search "Search Console API" → Enable
4. Create a Service Account:
   - IAM & Admin → Service Accounts → Create Service Account
   - Name: `geo-content-agent`
   - Role: leave blank (we set permissions in GSC directly)
   - Click Done
5. Click on the service account → Keys → Add Key → JSON
6. Download the JSON file
7. Upload it to your VPS:

```bash
# From your local machine:
scp gsc-service-account.json seoagent@YOUR_SERVER_IP:/home/seoagent/seo-agent/
```

8. In Google Search Console (search.google.com/search-console):
   - Go to Settings → Users and permissions → Add user
   - Enter the service account email (looks like `geo-content-agent@project-id.iam.gserviceaccount.com`)
   - Permission: Restricted

9. Update `.env`:

```env
GSC_CREDENTIALS_PATH=/home/seoagent/seo-agent/gsc-service-account.json
GSC_SITE_URL=sc-domain:yoursite.de
```

---

## 14. Test Everything

**1. Backend health check:**

```bash
curl https://yourdomain.de/health
```

**2. Test API connections via the UI:**

- Open `https://yourdomain.de`
- Click **Settings**
- Fill in your credentials
- Click **Test All Connections**

**3. Test a full article generation:**

- Click **Generate**
- Enter a keyword: `GEO Optimierung für Agenturen`
- Uncheck "Auto-publish" for your first test
- Click **Run Agent**
- Watch the pipeline stages complete
- Review the generated outline, gaps, and draft

**4. Check PM2 logs for errors:**

```bash
pm2 logs geo-agent-backend --lines 50
```

---

## 15. Firewall & Security

Set up UFW firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Port 3000 (Node.js) should NOT be publicly accessible — only Nginx should proxy to it:

```bash
# Verify port 3000 is only accessible locally
sudo ufw deny 3000
```

**Optional: Add HTTP Basic Auth to protect the dashboard** (if it's a private tool):

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd yourusername
```

Add to your Nginx config:

```nginx
location / {
    auth_basic "GEO Agent";
    auth_basic_user_file /etc/nginx/.htpasswd;
    try_files $uri $uri/ /index.html;
}
```

Then reload Nginx:

```bash
sudo systemctl reload nginx
```

---

## 16. Troubleshooting

**Backend not starting:**

```bash
pm2 logs geo-agent-backend
# Look for "Error: Cannot find module" → run: npm install
# Look for "EADDRINUSE" → another process using port 3000: kill it with: fuser -k 3000/tcp
```

**Nginx 502 Bad Gateway:**

```bash
# Is the Node.js backend actually running?
pm2 status
curl http://localhost:3000/health

# Check Nginx error log:
sudo tail -f /var/log/nginx/error.log
```

**WordPress 401 Unauthorized:**

```bash
# Test directly:
curl -u "admin:AbCd EfGh IjKl MnOp" https://yoursite.de/wp-json/wp/v2/users/me
# If 401: regenerate Application Password in WP Admin
# If 404: verify WordPress URL is correct
```

**SSE streaming not working (progress bar stuck):**

Check Nginx config has `proxy_buffering off;` in the `/api/` location block. This is required for Server-Sent Events.

**Perplexity returns empty SERP data:**

```bash
# Test the API key directly:
curl -X POST https://api.perplexity.ai/chat/completions \
  -H "Authorization: Bearer pplx-YOUR-KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"sonar","messages":[{"role":"user","content":"Hello"}],"max_tokens":10}'
```

**OpenAI rate limit errors:**

Switch to `gpt-4o-mini` in Settings for cheaper, faster generation. Update `OPENAI_MODEL=gpt-4o-mini` in `.env` and restart PM2.

**After any `.env` change:**

```bash
pm2 restart geo-agent-backend
```

---

## 17. Cost Summary

| Service | Cost | Notes |
|---------|------|-------|
| Hetzner VPS CX21 | €4.51/mo | Runs everything |
| OpenAI GPT-4o | ~$0.02/article | 100 articles = ~$2/mo |
| Perplexity sonar-pro | ~$0.005/article | 100 articles = ~$0.50/mo |
| WordPress hosting | Existing | Use your current WP host |
| SSL (Let's Encrypt) | Free | Auto-renewed |
| **Total for 100 articles/mo** | **~€7/mo** | |

---

## Deployment Checklist

```
[ ] VPS provisioned & SSH access working
[ ] Node.js 20 installed
[ ] PM2 installed globally
[ ] Nginx installed
[ ] Project files uploaded to /home/seoagent/seo-agent/
[ ] npm install run in backend/
[ ] .env created from .env.example
[ ] OPENAI_API_KEY added to .env
[ ] PERPLEXITY_API_KEY added to .env
[ ] WORDPRESS_URL, USERNAME, APP_PASSWORD added to .env
[ ] Slack webhook added (optional)
[ ] GSC service account configured (optional)
[ ] PM2 started: pm2 start server.js --name geo-agent-backend
[ ] PM2 startup configured: pm2 startup && pm2 save
[ ] Nginx config created and enabled
[ ] Domain DNS A record pointing to server IP
[ ] SSL certificate issued via certbot
[ ] Firewall enabled (UFW)
[ ] Health check passing: curl https://yourdomain.de/health
[ ] Test article generated successfully
[ ] WordPress draft visible in WP Admin
```

---

*Built with n8n workflow logic adapted into Node.js for direct VPS deployment.*  
*Compatible with any WordPress site — self-hosted or managed hosting.*
