# DoGNose - Codebase Intelligence & Memory

## Project Overview
**DoGNose** is a biometric identification system designed for dogs. It utilizes computer vision and machine learning to detect and extract unique "nose prints" (similar to human fingerprints) from photos of dogs.

## Business Purpose
To provide a reliable, non-invasive method of identifying dogs. It allows users to register their pets and later identify them by taking a picture of their nose. This is useful for finding lost pets, verifying ownership, and veterinary record keeping.

## Tech Stack
- **Frontend:** Next.js 15 (React 18), Tailwind CSS, Framer Motion, Lucide React
- **Backend:** FastAPI (Python), Uvicorn, SlowAPI
- **Machine Learning:** ONNX Runtime, OpenCV, NumPy (YOLOv8 for detection, custom embedder for feature extraction)
- **Database & Auth:** Supabase (PostgreSQL with `pgvector` extension)

## Repository Structure
- `/frontend`: Next.js web application
- `/backend`: FastAPI service handling ML inference and API routes
- `/database`: SQL scripts for schema setup and Row Level Security (RLS) policies
- `/ml`: Python scripts for training models, preprocessing, and exporting to ONNX

## System Architecture
The application follows a decoupled client-server architecture.
- **Frontend (Next.js):** Handles UI, user authentication via Supabase, and capturing images.
- **Backend (FastAPI):** Exposes endpoints to enroll and identify dogs. It receives images, validates them, runs ML inference, and writes/queries embeddings.
- **Database (Supabase):** Stores user data, dog profiles, and pgvector embeddings. RLS ensures strict data isolation between users.

*(See architecture.md for a detailed diagram)*

## Routing Map
*(See routes.md and api-map.md for a detailed list of frontend and backend routes)*

## Frontend Architecture
The frontend uses the Next.js App Router with an overarching `layout.tsx` providing a dark-themed UI. The pages are modularized into components (`/components`), with separate directories for main workflows: `/login`, `/enroll`, and `/identify`. It communicates with Supabase directly for auth, and the FastAPI backend for ML processing.

## Backend Architecture
The backend is structured around a FastAPI app (`main.py`) with routers (`routers/dogs.py`). It uses dependency injection (`dependencies.py`) to verify Supabase JWT tokens for protected routes. ML inference is abstracted into `services/inference.py`.

## Database Architecture
*(See database-map.md for full details)*
The database uses the `vector` extension. The `nose_prints` table stores 512-dimensional embeddings and uses an `ivfflat` index for fast cosine similarity lookups.

## Authentication Flow
1. User authenticates on the frontend using Supabase Auth.
2. Frontend receives a JWT.
3. Frontend sends the JWT in the `Authorization: Bearer <token>` header to the FastAPI backend.
4. `backend/dependencies.py` extracts the token and initializes a scoped Supabase client `supabase.postgrest.auth(token)`, allowing backend queries to be filtered by Supabase's RLS policies.

## Data Flow Diagrams
**Enrollment Flow:**
User Action (Upload Photo) ──▶ Frontend ──▶ API (`POST /dogs/{id}/enroll`) ──▶ Validate File ──▶ `inference.py` (Detect Nose -> Crop -> Preprocess -> Embed) ──▶ API ──▶ Database (Insert embedding) ──▶ Response (Success)

**Identification Flow:**
User Action (Upload Photo) ──▶ Frontend ──▶ API (`POST /dogs/identify`) ──▶ Validate File ──▶ `inference.py` (Extract Embedding) ──▶ API ──▶ Database (Vector Cosine Similarity Search) ──▶ Return Top Candidates (Match/No Match)

## Environment Variables
- `DETECTOR_MODEL_PATH` / `EMBEDDER_MODEL_PATH`: Paths to ONNX model files.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`: Credentials for database and auth access.
- `ALLOWED_ORIGINS`: CORS configuration.
- `MAX_FILE_SIZE_MB`, `MATCH_THRESHOLD`: Inference and upload limits.

## Feature Inventory
- **User Authentication:** Login/Signup via Supabase.
- **Dog Registration:** Creating a profile for a dog.
- **Nose Print Enrollment:** Extracting and storing a biometric signature from an image.
- **Dog Identification:** Uploading an image to find the matching dog profile based on similarity threshold (>0.65).

## Performance Notes
- **Inference Limitations:** Model inference is performed synchronously on the backend CPU (via ONNXRuntime). Heavy concurrent usage might require migrating to asynchronous background workers (e.g., Celery) or GPU-backed instances.
- **Database Scaling:** The `ivfflat` index needs to be rebuilt periodically or switched to `hnsw` as the dataset grows significantly for optimal recall and performance.
- **Rate Limiting:** IP-based rate limiting is implemented via SlowAPI (default 10 requests/minute for identification) to prevent abuse.

## Technical Debt & Known Risks
- **Model Availability:** If ONNX models are missing at startup, the backend boots but disables inference endpoints (returns 503). Models must be placed in the correct directory.
- **Vector Search Fallback:** Currently, `match_embedding` pulls embeddings for the user's dogs into Python and calculates cosine similarity in memory. This is fine for small N (due to RLS filtering), but true pgvector search `ORDER BY embedding <=> query_embedding` should be executed in the SQL query itself for better scalability.

## Future Recommendations
- **Direct PGVector Query:** Update `backend/services/inference.py` to use a Supabase RPC function for cosine similarity matching directly on the database instead of computing it in Python.
- **HNSW Index:** Consider upgrading the `ivfflat` index to `hnsw` in PostgreSQL for better accuracy-performance trade-offs as the dog database grows.
