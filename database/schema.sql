-- DogNose Database Schema
-- Run on a fresh Supabase project to set up the full schema.
-- Requires pgvector extension to be enabled first.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS dognose;

GRANT SELECT, INSERT, UPDATE, DELETE ON dognose.dogs TO authenticated;
GRANT SELECT ON dognose.dogs TO anon;
GRANT ALL ON dognose.scan_logs TO service_role;

-- Table: dognose.dogs
CREATE TABLE dognose.dogs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name                text NOT NULL,
    breed               text,
    age                 double precision,
    sex                 text,
    color_markings      text,
    owner_name          text,
    owner_phone         text,
    owner_email         text,
    profile_photo_url   text,
    nose_embedding      vector(1536),
    embedding_version   text DEFAULT 'dognose-v2-finetuned',
    created_at          timestamptz DEFAULT now()
);

CREATE INDEX dogs_embedding_idx
    ON dognose.dogs
    USING hnsw (nose_embedding vector_cosine_ops);

ALTER TABLE dognose.dogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dogs"
    ON dognose.dogs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dogs"
    ON dognose.dogs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dogs"
    ON dognose.dogs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dogs"
    ON dognose.dogs FOR DELETE
    USING (auth.uid() = user_id);

-- Table: dognose.scan_logs
CREATE TABLE dognose.scan_logs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    matched_dog_id      uuid REFERENCES dognose.dogs(id) ON DELETE SET NULL,
    similarity_score    double precision,
    scanner_ip_hash     text,
    scanned_at          timestamptz DEFAULT now()
);

ALTER TABLE dognose.scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to scan_logs"
    ON dognose.scan_logs FOR ALL
    USING (true)
    WITH CHECK (true);

GRANT ALL ON dognose.scan_logs TO service_role;

-- RPC: dognose.match_all_dogs
DROP FUNCTION IF EXISTS dognose.match_all_dogs(vector, double precision, integer, text);

CREATE OR REPLACE FUNCTION dognose.match_all_dogs(
    query_embedding     vector,
    match_threshold     double precision,
    match_count         integer,
    p_embedding_version text
)
RETURNS TABLE (
    dog_id              uuid,
    name                text,
    breed               text,
    age                 double precision,
    sex                 text,
    color_markings      text,
    owner_name          text,
    owner_phone         text,
    owner_email         text,
    profile_photo_url   text,
    similarity          double precision
)
LANGUAGE sql STABLE
AS $$
    SELECT
        id              AS dog_id,
        name,
        breed,
        age,
        sex,
        color_markings,
        owner_name,
        owner_phone,
        owner_email,
        profile_photo_url,
        1 - (nose_embedding <=> query_embedding) AS similarity
    FROM dognose.dogs
    WHERE
        embedding_version = p_embedding_version
        AND nose_embedding IS NOT NULL
        AND 1 - (nose_embedding <=> query_embedding) > match_threshold
    ORDER BY nose_embedding <=> query_embedding
    LIMIT match_count;
$$;
