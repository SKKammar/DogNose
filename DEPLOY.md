# 🚀 CANID (DogNose) — Deployment Guide

Everything you need to go from repo to live, working app. No local testing required.

---

## Prerequisites

You should already have:
- ✅ A [Supabase](https://supabase.com) project created
- ✅ A [Vercel](https://vercel.com) account connected to the GitHub repo
- ✅ A [Render](https://render.com) account
- ✅ Pre-trained models uploaded as a GitHub Release at tag `v0.1.0-models` (files: `detector.onnx`, `embedder.onnx`)

---

## Step 1 — Supabase (Database)

### 1.1 Run the schema
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor** → **New Query**
3. Copy the **entire** contents of [`database/schema.sql`](database/schema.sql) and paste it
4. Click **Run** (or press Ctrl+Enter)
5. You should see `Success. No rows returned` — that's correct

This creates:
- `dogs` and `nose_prints` tables
- pgvector index for fast similarity search
- Row Level Security policies
- `match_all_dogs()` and `match_lost_dogs()` functions

### 1.2 Copy your credentials
1. Go to **Settings → API**
2. Copy these values (you'll need them in Steps 2 and 3):

| What | Where to find |
|------|--------------|
| **Project URL** | `Settings → API → Project URL` |
| **anon key** | `Settings → API → Project API keys → anon public` |
| **service_role key** | `Settings → API → Project API keys → service_role` (click to reveal) |
| **JWT Secret** | `Settings → API → JWT Settings → JWT Secret` |

> ⚠️ **Never commit** the `service_role` key or JWT secret to your repo. They go in environment variables only.

---

## Step 2 — Render (Backend)

### 2.1 Create the service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New → Web Service**
3. Connect your GitHub repo: `SKKammar/DogNose`
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `dognose-backend` |
| **Root Directory** | `backend` |
| **Environment** | `Python` |
| **Build Command** | `pip install -r requirements.txt && chmod +x ../scripts/download_models.sh && cd .. && ./scripts/download_models.sh && cd backend` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | Free |

### 2.2 Add environment variables
In the Render dashboard, go to **Environment** and add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `SUPABASE_JWT_SECRET` | Your Supabase JWT secret |

### 2.3 Deploy
1. Click **Create Web Service** (or trigger a manual deploy)
2. Wait for the build to complete (5–10 minutes on first deploy)
3. Verify: visit `https://dognose-backend.onrender.com/health`
   - Expected response: `{"status":"ok","inference_ready":true}`
   - If `inference_ready` is `false`, the ONNX models failed to download — check the build logs
4. **Copy your Render URL** — you'll need it in Step 3

> 💡 The free tier will sleep after 15 minutes of inactivity. The first request after sleep takes 20–30 seconds. This is expected and the frontend UI handles it with a "Waking up…" message.

---

## Step 3 — Vercel (Frontend)

### 3.1 Import the project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New → Project**
3. Import your GitHub repo: `SKKammar/DogNose`
4. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Framework Preset** | Next.js (auto-detected) |

### 3.2 Add environment variables
In **Settings → Environment Variables**, add:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Your Render URL from Step 2 (e.g., `https://dognose-backend.onrender.com`) |

> ⚠️ Do **not** include a trailing slash in `NEXT_PUBLIC_API_URL`.

### 3.3 Deploy
1. Click **Deploy**
2. Vercel will build and assign an HTTPS URL (e.g., `https://dog-nose.vercel.app`)
3. HTTPS is required for camera access — Vercel provides this automatically

---

## Step 4 — GitHub Secrets (Keepalive)

To prevent Supabase from pausing your project after 7 days of inactivity:

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Add these secrets:

| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |

The `.github/workflows/supabase_keepalive.yml` will ping both Supabase and Render every 3 days automatically.

---

## Step 5 — Test End-to-End

### 5.1 Sign up
1. Open your Vercel URL
2. Click **Sign In** → Toggle to **Sign Up**
3. Enter an email and password → click **Register Identity**
4. You should be redirected to the Enroll page

### 5.2 Enroll a dog
1. Enter dog name (e.g., "Buddy") and breed → click **Next**
2. Allow camera access when prompted
3. Capture 3 clear photos of the dog's nose
4. Click **Submit 3 Photos**
5. Wait for each photo to process → you should see "Enrolled Successfully ✓"

### 5.3 Identify
1. Go to the **Identify** page (no sign-in needed)
2. Take a photo of the same dog's nose
3. You should see match results with confidence scores

### 5.4 Test no-match
1. Take a photo of a different object (your hand, a wall, etc.)
2. You should see either "🐾 Dog Not Enrolled" (if a nose was detected but didn't match) or an error if no nose was found

---

## Troubleshooting

### "Waking up the matching engine…" message
This is normal on Render's free tier. The backend spins down after 15 minutes of inactivity. The first request wakes it up in 20–30 seconds.

### "no_nose_detected" error
The ML model couldn't find a dog's nose in the photo. Tips:
- Get closer to the nose
- Ensure good lighting
- Keep the nose centered in the frame
- Make sure only one dog is in frame

### CORS errors in browser console
1. Verify `NEXT_PUBLIC_API_URL` in Vercel matches your Render URL exactly
2. The backend CORS is set to allow all origins (`*`), so this shouldn't happen
3. If it persists, try redeploying the backend on Render

### "Supabase configuration missing" error
One or more environment variables are missing on Render. Double-check that `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET` are all set.

### Build fails on Render
Check that the build command runs from the `backend` root directory. The ONNX model download script needs to access `../scripts/download_models.sh`.

### Frontend shows blank/loading forever
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel
3. Redeploy the frontend after adding environment variables

---

## Architecture Summary

```
┌──────────────┐     HTTPS     ┌──────────────────────┐
│   Browser    │ ──────────── │   Vercel (Frontend)   │
│  (Camera)    │               │   Next.js + Tailwind  │
└──────┬───────┘               └──────────────────────┘
       │
       │ REST API (HTTPS)
       │
┌──────▼───────────────────────┐
│   Render (Backend)            │
│   FastAPI + ONNX Runtime     │
│   • YOLOv8n nose detection   │
│   • EfficientNet-B3 embedder │
└──────┬───────────────────────┘
       │
       │ Supabase Client (HTTPS)
       │
┌──────▼───────────────────────┐
│   Supabase                    │
│   • PostgreSQL + pgvector     │
│   • Auth (JWT)                │
│   • RLS policies              │
└──────────────────────────────┘
```

---

## What's NOT in the MVP

- ❌ Liveness/motion detection
- ❌ Image storage to Supabase Storage
- ❌ Dog profile edit/delete
- ❌ Email verification
- ❌ CMC/ROC evaluation charts
- ❌ Service worker caching (PWA is shell-only)
