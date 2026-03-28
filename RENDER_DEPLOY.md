# 🚀 Render Deployment Guide (Free)

## Step 1 — Push to GitHub
Make sure this repo is on your GitHub account.

## Step 2 — Create Render Account
Go to https://render.com → Sign up free (no credit card needed)

## Step 3 — New Web Service
1. Click **New +** → **Web Service**
2. Connect your GitHub account
3. Select `SEO-content-Optimizer` repo
4. Render auto-detects the `render.yaml` — click **Apply**

## Step 4 — Add Environment Variables
In your Render service → **Environment** tab, add:

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | `sk-proj-...` |
| `OPENAI_MODEL` | `gpt-4o` |
| `PERPLEXITY_API_KEY` | `pplx-...` |
| `PERPLEXITY_MODEL` | `sonar-pro` |
| `WORDPRESS_URL` | `https://yoursite.com` |
| `WORDPRESS_USERNAME` | `admin` |
| `WORDPRESS_APP_PASSWORD` | `AbCd EfGh...` |
| `CONTENT_LANGUAGE` | `de` |
| `MIN_WORD_COUNT` | `1500` |
| `WP_POST_STATUS` | `draft` |
| `SLACK_WEBHOOK_URL` | *(optional)* |
| `GSC_CREDENTIALS_JSON` | *(optional)* |
| `GSC_SITE_URL` | *(optional)* |

> ⚠️ Do NOT add PORT — Render sets it automatically.

## Step 5 — Get Your Public URL
After deploy, Render gives you:
`https://seo-content-optimizer.onrender.com`

Add one more variable:
| `FRONTEND_URL` | `https://seo-content-optimizer.onrender.com` |

## Step 6 — Verify
Open your Render URL → Settings → Test All Connections ✅

---

## Free Plan Note
The app sleeps after 15 min of inactivity.
First request after sleep takes ~30 seconds to wake up.
This is normal on the free plan.
