# DoGNose

DoGNose is a biometric identification system that acts like a fingerprint scanner for dogs. By capturing an image of a dog's nose, the system extracts a unique "nose print" embedding using machine learning, allowing you to register and subsequently identify dogs non-invasively.

> **Note on Project Scope and Limitations (v0.1.0 MVP)**
> - **Liveness Detection:** Currently relies on standard camera capture frames. Advanced sharpness/variance gating is planned for v1.1.
> - **Age Constraints:** Nose prints stabilize as dogs mature; the system works best for adult dogs.
## Upgrading the Embedder

To deploy a new embedder version (e.g., `v2`):
1. Add the new `.onnx` model to the `/models` directory.
2. Update the `backend/services/inference.py` to load the new version into `embedder_sessions`.
3. Set the environment variable `ACTIVE_EMBEDDING_VERSION=v2`.
4. Existing dogs enrolled with `v1` will still have their data in the database, but they will not match against new `v2` queries since they exist in different vector spaces. To make them matchable again under `v2`, they must be re-enrolled using the frontend. They do not automatically disappear, but they need the new biometric signature to be recognized by the new active model.

## Local Setup

### 1. Database (Supabase)
1. Create a new Supabase project.
2. Run `database/01_schema.sql` to initialize the `dogs` and `nose_prints` tables (ensure the `vector` extension is enabled).
3. Run `database/02_rls_policies.sql` to apply Row Level Security so users only see their own dogs.

### 2. Backend (FastAPI)
Requires Python 3.9+.

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Download ONNX models (ensure models are placed in the /models directory)
chmod +x scripts/download_models.sh
./scripts/download_models.sh

# Start the backend server
uvicorn backend.main:app --reload
```

### 3. Frontend (Next.js)
Requires Node.js 18+.

```bash
cd frontend
npm install

# Copy env template and fill in your Supabase credentials
cp .env.example .env.local

# Start the frontend dev server
npm run dev
```
The frontend will be available at `http://localhost:3000`.

## Environment Variables
Reference `.env.example` for the required keys. You must provide:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (in `frontend/.env.local` for the client, and `.env` for the backend).
- `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000` locally, set to your deployed backend URL in production).

## Deployment Guide

### Deploying the Backend (Render)
You can deploy the backend easily using Render's native Python Web Service without needing a Dockerfile.
1. Create a new **Web Service** on Render connected to this repository.
2. **Environment:** Python
3. **Build Command:**
   ```bash
   pip install -r backend/requirements.txt && chmod +x scripts/download_models.sh && ./scripts/download_models.sh
   ```
4. **Start Command:**
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```
5. Add your Supabase environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) in the Render dashboard.
6. **Crucial:** Add `ALLOWED_ORIGINS` in the Render dashboard environment variables and set it to your exact frontend URL (e.g. `https://dog-nose.vercel.app`), without a trailing slash, to fix CORS errors.

### Deploying the Frontend (Vercel)
1. Import the `frontend/` directory as a new project on Vercel.
2. Add your `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_URL` (pointing to your Render URL) to the Vercel environment variables.
3. Deploy!

## Live Demo
*Update this section with your live frontend URL once deployed.*
