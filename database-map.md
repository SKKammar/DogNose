# Database Map

## Schema Definitions

### Table: `dogs`
- **Purpose:** Stores dog profiles linked to their owners, as well as their biometric vector embeddings.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `owner` (UUID, Foreign Key -> `auth.users(id)`)
  - `name` (TEXT)
  - `breed` (TEXT)
  - `age` (DOUBLE PRECISION)
  - `sex` (TEXT)
  - `color_markings` (TEXT)
  - `owner_name` (TEXT)
  - `owner_phone` (TEXT)
  - `owner_email` (TEXT)
  - `profile_photo_url` (TEXT)
  - `nose_embedding` (vector(1536)) - Stores 1536-dimensional pgvector embeddings extracted by the fine-tuned MegaDescriptor model.
  - `embedding_version` (TEXT) - Tracks ML model version (default 'dognose-v2-finetuned')
  - `created_at` (TIMESTAMP)
- **Relationships:**
  - Belongs to `auth.users` (1:N)
- **Indexes:** `hnsw` index on `nose_embedding` using `vector_cosine_ops` for highly optimized similarity search.
- **RLS Policies:** Users can only Select, Insert, Update, Delete their own dogs (`auth.uid() = owner`).

### Table: `scan_logs`
- **Purpose:** Tracks successful biometric identification matches.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `matched_dog_id` (UUID, Foreign Key -> `dogs(id)`)
  - `similarity_score` (DOUBLE PRECISION)
  - `scanner_ip_hash` (TEXT)
  - `scanned_at` (TIMESTAMP)
- **Relationships:**
  - Belongs to `dogs` (1:N)
- **RLS Policies:** Currently accessible for aggregate stats.

### RPC Functions
- `match_all_dogs`: Custom pgvector stored procedure that takes a query embedding and returns the closest dogs based on cosine similarity.

## Entity Relationships
`auth.users` ──(1:N)──▶ `dogs` ──(1:N)──▶ `scan_logs`
