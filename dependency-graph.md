# Dependency Graph

## Backend Dependencies (Python)
- `backend/main.py`
  - imports `backend.routers.dogs`, `backend.routers.stats`, `backend.routers.validate`, `backend.routers.report`
- `backend/routers/dogs.py`
  - imports `backend.dependencies.get_service_supabase`, `get_current_user_id`
  - imports `backend.services.inference.get_nose_detector`, `run_full_validation`, `get_embedding`
- `backend/services/inference.py`
  - Uses ONNX runtime for `best.pt` (Object Detection - YOLOv8)
  - Uses PyTorch (`timm`) for `dognose_megadescriptor_finetuned.pth` (MegaDescriptor Feature Extraction)
- `backend/dependencies.py`
  - Initializes `supabase` python client

## Frontend Dependencies (Next.js)
- `frontend/app/layout.tsx`
  - imports `frontend/app/globals.css`
- `frontend/lib/supabase.ts`
  - Initializes `@supabase/supabase-js` client
- `frontend/lib/api.ts`
  - Handles HTTP requests to FastAPI backend (`/api/*`)
- `frontend/app/(pages)`
  - Depend on `frontend/components/*`
  - Depend on `frontend/lib/supabase.ts` and `frontend/lib/api.ts`

## Critical System Files
- **`backend/services/inference.py`**: The core ML execution pipeline. Handles image decoding, YOLOv8 nose detection, NMS bounding box extraction, and 1536-dimensional L2-normalized embedding extraction. Modification can break biometric matching.
- **`backend/embedder.py`**: The wrapper class (`NormalizedModel`) for the fine-tuned `timm` model. Essential for correctly loading the `dognose_megadescriptor_finetuned.pth` checkpoint weights.
- **`database/02_rls_policies.sql`**: Security backbone. Ensures users cannot query or modify other users' dog profiles or biometric data.
- **`database/01_schema.sql`**: Defines the `pgvector` schema which must match the 1536-dimension output of the embedder model.
