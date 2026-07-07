# Dependency Graph

## Backend Dependencies (Python)
- `backend/main.py`
  - imports `backend.routers.dogs`
- `backend/routers/dogs.py`
  - imports `backend.dependencies.get_supabase`
  - imports `backend.services.inference.extract_embedding`, `match_embedding`
- `backend/services/inference.py`
  - imports `ml.preprocessing.preprocess_image`
  - Uses ONNX models (`detector.onnx`, `embedder.onnx`)
- `backend/dependencies.py`
  - Uses `supabase` python client

## Frontend Dependencies (Next.js)
- `frontend/app/layout.tsx`
  - imports `frontend/app/globals.css`
- `frontend/lib/supabase.ts`
  - Initializes `@supabase/supabase-js` client
- `frontend/app/(pages)`
  - Depend on `frontend/components/*`
  - Depend on `frontend/lib/supabase.ts`
  - Make HTTP requests to FastAPI backend (`/dogs`)

## Critical System Files
- **`backend/services/inference.py`**: The core ML execution pipeline. Handles image decoding, YOLOv8 nose detection, NMS bounding box extraction, and 512D embedding extraction. Modification can break biometric matching.
- **`database/02_rls_policies.sql`**: Security backbone. Ensures users cannot query or modify other users' dog profiles or biometric data.
- **`database/01_schema.sql`**: Defines the `pgvector` schema which must match the 512-dimension output of the embedder model.
