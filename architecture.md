# Architecture Map

## System Architecture

```text
Browser (Next.js Frontend) 
       │
       ├──(Auth & Data)──▶ Supabase (PostgreSQL + Auth + pgvector)
       │
       └──(Inference)────▶ FastAPI Backend (Python)
                                  │
                                  ├──▶ Detector Model (ONNX - YOLOv8)
                                  │
                                  └──▶ Embedder Model (ONNX)
```

## Frontend Architecture
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **State Management:** React state & contexts, Supabase hooks
- **Authentication:** Supabase Auth (JWT)

## Backend Architecture
- **Framework:** FastAPI
- **Rate Limiting:** SlowAPI (limit by IP)
- **ML Engine:** ONNXRuntime with OpenCV for image preprocessing
- **Authentication:** HTTPBearer token verification via Supabase client

## Database Architecture
- **Engine:** PostgreSQL (hosted on Supabase)
- **Extensions:** pgvector (for vector similarity search)
- **Tables:** `dogs`, `nose_prints`
- **Security:** Row Level Security (RLS) applied to ensure data privacy per user
