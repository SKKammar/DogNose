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
  - `behaviour_notes` (TEXT)
  - `emergency_contact_name` (TEXT)
  - `emergency_contact_phone` (TEXT)
  - `vet_name` (TEXT)
  - `vet_phone` (TEXT)
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

### Health Records Tables
- **Purpose:** Tracks health-related data for dogs across multiple categories.
- **Tables:** 
  - `allergies`: `id`, `dog_id`, `allergen`, `severity`, `diagnosed_date`, `notes`
  - `vaccinations`: `id`, `dog_id`, `name`, `date_administered`, `next_due_date`, `provider`, `notes`
  - `medications`: `id`, `dog_id`, `name`, `dosage`, `frequency`, `start_date`, `end_date`, `notes`
  - `visits`: `id`, `dog_id`, `date`, `provider`, `reason`, `diagnosis`, `cost`, `notes`
  - `weight_logs`: `id`, `dog_id`, `weight_kg`, `date`, `notes`
- **Relationships:** All tables have a `dog_id` Foreign Key -> `dogs(id)` (1:N).
- **RLS Policies:** Users can only Select, Insert, Update, Delete records for their own dogs.

### RPC Functions
- `match_all_dogs`: Custom pgvector stored procedure that takes a query embedding and returns the closest dogs based on cosine similarity.

## Entity Relationships
`auth.users` ──(1:N)──▶ `dogs` ──(1:N)──▶ `scan_logs`
                      │
                      └──(1:N)──▶ `allergies`, `vaccinations`, `medications`, `visits`, `weight_logs`
