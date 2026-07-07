# Database Map

## Schema Definitions

### Table: `dogs`
- **Purpose:** Stores dog profiles linked to their owners.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `owner_id` (UUID, Foreign Key -> `auth.users(id)`)
  - `name` (TEXT)
  - `breed` (TEXT)
  - `created_at` (TIMESTAMP)
- **Relationships:**
  - Belongs to `auth.users` (1:N)
  - Has many `nose_prints` (1:N)
- **RLS Policies:** Users can only Select, Insert, Update, Delete their own dogs (`auth.uid() = owner_id`).

### Table: `nose_prints`
- **Purpose:** Stores vector embeddings of dog nose prints for biometric matching.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `dog_id` (UUID, Foreign Key -> `dogs(id)`)
  - `embedding` (vector(512)) - Stores 512-dimensional pgvector embeddings
  - `embedding_version` (TEXT) - Tracks ML model version (default 'v1')
  - `image_url` (TEXT) - Optional reference to raw image
  - `captured_at` (TIMESTAMP)
- **Relationships:**
  - Belongs to `dogs` (1:N)
- **Indexes:** `ivfflat` index on `embedding` using `vector_cosine_ops` for fast similarity search.
- **RLS Policies:** Users can only Select, Insert, Update, Delete nose prints linked to dogs they own.

## Entity Relationships
`auth.users` ──(1:N)──▶ `dogs` ──(1:N)──▶ `nose_prints`
