# DoGNose

DoGNose is a biometric identification system that acts like a fingerprint scanner for dogs. By capturing an image of a dog's nose, the system extracts a unique "nose print" embedding using a custom machine learning pipeline, allowing you to register and subsequently identify dogs non-invasively.

> **Note on Project Scope and Limitations (v1.0)**
> - **Liveness Detection:** Currently relies on standard camera capture frames. Advanced sharpness/variance gating is planned.
> - **Age Constraints:** Nose prints stabilize as dogs mature; the system works best for adult dogs.

## 🌟 Features
- **Biometric Enrollment:** Capture and enroll 5 high-quality nose prints per dog to create a robust biometric profile.
- **Fast Identification:** Search for a dog in real-time by taking a photo of their nose, utilizing highly optimized vector similarity search.
- **Robust ML Pipeline:** Two-stage object detection (Dog -> Nose) followed by a state-of-the-art embedding network.
- **Progressive Web App (PWA):** Works seamlessly on mobile devices with native camera integration.

## 🛠 Tech Stack
- **Frontend:** Next.js 14, React, TailwindCSS, Framer Motion, Lucide Icons.
- **Backend:** FastAPI, Python, Uvicorn.
- **Database:** Supabase (PostgreSQL) with `pgvector`.
- **Machine Learning:** PyTorch, Ultralytics YOLOv8, `timm` (Hugging Face), OpenCV.

## 🧠 ML Pipeline & Architecture

The identification system relies on a sequence of models to isolate and embed the dog's nose print:

1. **Dog Detection (COCO YOLOv8n):** The system first validates that the uploaded image actually contains a dog.
2. **Nose Localization (Custom YOLOv8):** A custom-trained YOLOv8 model (`best.pt` -> `detector.onnx`) strictly isolates and crops the dog's nose from the frame.
3. **Preprocessing (CLAHE):** Optional Contrast Limited Adaptive Histogram Equalization (CLAHE) and bilateral filtering to enhance the ridge texture of the nose.
4. **Feature Extraction (MegaDescriptor):** The cropped nose is passed through `BVRA/MegaDescriptor-T-CNN-288`, an EfficientNet-based embedder fine-tuned with ArcFace loss. It outputs a 1536-dimensional L2-normalized embedding.
5. **Vector Search:** The embedding is sent to Supabase `pgvector`, which calculates cosine similarity against the database to find the closest match above a `0.60` confidence threshold.

## 🗄 Database Setup

The project uses a custom schema `dognose` to isolate its tables from the default `public` schema.

### Tables
- `dognose.dogs`: Stores dog metadata (name, breed, owner details) and the `1536-dim` vector embedding.
- `dognose.scan_logs`: Tracks successful identification matches.

### Security & Permissions
Row Level Security (RLS) is used extensively. To allow the API to function, you **must** grant usage privileges to the Supabase roles on the custom schema:
```sql
GRANT USAGE ON SCHEMA dognose TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA dognose TO anon, authenticated, service_role;
```

## 🚀 Local Setup

### 1. Database (Supabase)
1. Create a new Supabase project.
2. Run `database/01_schema.sql` to initialize the `dognose` schema and tables (ensure the `vector` extension is enabled).
3. Run `database/02_rls_policies.sql` to apply Row Level Security so users only see their own dogs.
4. Execute the schema `GRANT` commands mentioned above.

### 2. Backend (FastAPI)
Requires Python 3.9+.

```bash
cd backend
# Install dependencies
pip install -r requirements.txt

# Create a .env file based on the environment variables section below

# Start the backend server
uvicorn main:app --reload --port 8000
```
> Ensure your custom YOLOv8 nose detector model is placed at `models/detector.onnx`.

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

## 🔐 Environment Variables

**Frontend (`frontend/.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key.
- `NEXT_PUBLIC_API_URL`: Your backend URL (e.g., `http://localhost:8000`).

**Backend (`backend/.env`):**
- `SUPABASE_URL`: Your Supabase Project URL.
- `SUPABASE_ANON_KEY`: Your Supabase Anon Public Key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (for bypassing RLS in certain background jobs).
- `NOSE_MODEL_PATH`: Absolute path to your nose detector model (e.g., `Z:\Santu\IntelliJ\DoGNose\models\detector.onnx`).
- `MATCH_THRESHOLD`: Cosine similarity threshold (Default: `0.60`).
- `DB_SCHEMA`: The Postgres schema used (Default: `dognose`).
- `ENABLE_CLAHE`: Enable/disable CLAHE preprocessing (Default: `false`).
