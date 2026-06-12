# Full Stack Deployment Guide

**Frontend → Vercel | Backend + PostgreSQL + Redis → Railway**

---

## Overview

```
Browser → Vercel (React frontend)
             ↓  API calls
          Railway (Express backend)
             ↓
          Railway PostgreSQL + Redis
```

---

## Step 1 — Push to GitHub

If you haven't already:

```bash
git init
git add .
git commit -m "initial commit"
```

Then go to https://github.com/new, create a repo, and run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Deploy Backend on Railway

### 2a. Create Railway project

1. Go to https://railway.app and sign in (GitHub login recommended)
2. Click **New Project → Deploy from GitHub repo**
3. Select your repository
4. Railway will detect `railway.toml` automatically

### 2b. Add PostgreSQL

1. In your Railway project, click **New → Database → Add PostgreSQL**
2. Railway will automatically inject `DATABASE_URL` into your backend service

### 2c. Add Redis

1. Click **New → Database → Add Redis**
2. Railway will automatically inject `REDIS_URL` into your backend service

### 2d. Set environment variables

Go to your **backend service → Variables tab** and add these:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `JWT_SECRET` | Run: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Run: `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Run: `openssl rand -hex 16` |
| `QR_SIGNING_SECRET` | Run: `openssl rand -hex 32` |
| `JWT_EXPIRY` | `15m` |
| `JWT_REFRESH_EXPIRY` | `7d` |
| `FACE_SERVICE_PROVIDER` | `mock` |
| `FACE_CONFIDENCE_THRESHOLD` | `0.85` |
| `GEOFENCE_RADIUS_METERS` | `100` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |
| `LOG_LEVEL` | `info` |
| `CORS_ORIGIN` | `https://YOUR-APP.vercel.app` ← fill after Step 3 |

> `DATABASE_URL` and `REDIS_URL` are injected automatically by Railway plugins.

### 2e. Get your backend URL

After deploy succeeds, go to **Settings → Domains** and copy your Railway URL.
It looks like: `https://your-app-name.up.railway.app`

---

## Step 3 — Deploy Frontend on Vercel

### 3a. Import project

1. Go to https://vercel.com and sign in (GitHub login)
2. Click **Add New → Project**
3. Import your GitHub repository
4. Vercel will detect `vercel.json` automatically

### 3b. Set environment variable

In the Vercel project settings before deploying:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-app-name.up.railway.app` |

> This is your Railway backend URL from Step 2e.

### 3c. Deploy

Click **Deploy**. Vercel builds the React app and serves it globally via CDN.

---

## Step 4 — Connect Frontend ↔ Backend (CORS)

After Vercel gives you a URL (e.g. `https://smart-attendance.vercel.app`):

1. Go back to Railway → backend service → Variables
2. Update `CORS_ORIGIN` to your Vercel URL
3. Railway will auto-redeploy

---

## Step 5 — Run Database Migrations

Migrations run automatically on each deploy via the start command in `railway.toml`:

```
npm run migrate && node dist/index.js
```

You can verify in Railway → backend → **Deployments → Logs**.

---

## Verify Everything Works

```bash
# Health check
curl https://your-app-name.up.railway.app/health

# Expected response:
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

Then open your Vercel URL in a browser — the login page should load.

---

## Generate Secrets (run these in your terminal)

```bash
# JWT Secret
openssl rand -hex 32

# JWT Refresh Secret
openssl rand -hex 32

# Encryption Key (must be 32+ chars)
openssl rand -hex 16

# QR Signing Secret
openssl rand -hex 32
```

---

## Free Tier Limits

| Platform | Free Tier |
|---|---|
| **Vercel** | Unlimited deploys, 100GB bandwidth/month |
| **Railway** | $5 free credit/month (~500 hours of backend runtime) |
| **Railway PostgreSQL** | 1GB storage on free plan |
| **Railway Redis** | 25MB on free plan |

---

## Troubleshooting

**Backend won't start?**
- Check Railway logs → Deployments tab
- Make sure all required env vars are set (JWT_SECRET, ENCRYPTION_KEY, etc.)

**Frontend shows blank page?**
- Check browser console for API errors
- Confirm `VITE_API_URL` in Vercel matches your Railway URL exactly (no trailing slash)

**CORS errors in browser?**
- Make sure `CORS_ORIGIN` in Railway exactly matches your Vercel URL

**Migrations failing?**
- Check Railway logs for SQL errors
- PostGIS extension: Railway's managed Postgres supports it by default
