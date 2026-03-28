# 🚀 Railway Deployment Guide

> Deploy time: ~5 minutes

## Step 1 — Push to GitHub

Make sure this repo is pushed to your GitHub account.

## Step 2 — Create Railway Project

1. Go to [railway.com](https://railway.com) → **New Project**
2. Click **Deploy from GitHub repo**
3. Select `SEO-content-Optimizer`
4. Railway will detect Node.js and start building automatically

## Step 3 — Add Environment Variables

In your Railway service → **Variables** tab, add these:

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | `sk-proj-...` |
| `OPENAI_MODEL` | `gpt-4o` |
| `PERPLEXITY_API_KEY` | `pplx-...` |
| `PERPLEXITY_MODEL` | `sonar-pro` |
| `WORDPRESS_URL` | `https://yoursite.com` |
| `WORDPRESS_USERNAME` | `admin` |
| `WORDPRESS_APP_PASSWORD` | `AbCd EfGh IjKl MnOp...` |
| `CONTENT_LANGUAGE` | `de` |
| `MIN_WORD_COUNT` | `1500` |
| `WP_POST_STATUS` | `draft` |
| `SLACK_WEBHOOK_URL` | *(optional)* |
| `GSC_CREDENTIALS_JSON` | *(optional — paste full JSON)* |
| `GSC_SITE_URL` | *(optional — e.g. sc-domain:yoursite.com)* |

> ⚠️ Do NOT add `PORT` — Railway sets this automatically.

## Step 4 — Get Your Public URL

After deploy, Railway gives you a URL like:
`https://seo-content-optimizer-production.up.railway.app`

Then add one more variable:
| `FRONTEND_URL` | `https://your-app.up.railway.app` |

## Step 5 — Verify

Open your Railway URL → you should see the dashboard.

Click **Settings → Test All Connections** to verify your API keys.

---

## Key Differences from VPS Setup

| VPS | Railway |
|-----|---------|
| PM2 process manager | Railway manages the process |
| Nginx reverse proxy | Railway's built-in proxy |
| Certbot SSL | Automatic HTTPS by Railway |
| `.env` file on disk | Environment Variables in dashboard |
| Upload GSC JSON file | Paste JSON as `GSC_CREDENTIALS_JSON` env var |
| Manual restarts | Auto-restarts on crash |

## Settings Persistence Note

On Railway, settings saved through the UI (Settings page) are
kept **in memory for the current session only**. After a redeploy
or restart, the values from your Railway Environment Variables
will be used again.

For permanent changes, always update the Railway dashboard variables.
