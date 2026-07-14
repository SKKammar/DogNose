-- =============================================================================
-- DogNose (CANID) — Complete Database Schema
-- =============================================================================
-- Run this ENTIRE file in your Supabase Dashboard → SQL Editor → New Query → Run
-- This creates all tables, indexes, RLS policies, and match functions.
-- =============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create dogs table
CREATE TABLE IF NOT EXISTS dogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed TEXT,
    age NUMERIC,
    sex TEXT,
    color_markings TEXT,
    owner_name TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    microchip_id TEXT,
    notes TEXT,
    embedding vector(512),
    embedding_version TEXT DEFAULT 'v1',
    is_lost BOOLEAN NOT NULL DEFAULT false,
    lost_since TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create pgvector index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS dogs_embedding_idx
    ON dogs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- 4. Row Level Security
-- =============================================================================

ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;

-- Dogs: users can only manage their own dogs
CREATE POLICY "Users can view their own dogs"
    ON dogs FOR SELECT
    USING (auth.uid() = owner);

CREATE POLICY "Users can insert their own dogs"
    ON dogs FOR INSERT
    WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can update their own dogs"
    ON dogs FOR UPDATE
    USING (auth.uid() = owner)
    WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can delete their own dogs"
    ON dogs FOR DELETE
    USING (auth.uid() = owner);

-- =============================================================================
-- 5. Match functions (SECURITY DEFINER — bypass RLS for server-side queries)
-- =============================================================================

-- Match ALL enrolled dogs (used by /dogs/identify endpoint)
CREATE OR REPLACE FUNCTION public.match_all_dogs(
    query_embedding vector(512),
    match_threshold float,
    match_count int,
    p_embedding_version text
)
RETURNS TABLE (
    dog_id UUID,
    name TEXT,
    breed TEXT,
    age NUMERIC,
    sex TEXT,
    color_markings TEXT,
    owner_name TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    similarity FLOAT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_matches AS (
        SELECT
            d.id AS dog_id,
            d.name,
            d.breed,
            d.age,
            d.sex,
            d.color_markings,
            d.owner_name,
            d.owner_phone,
            d.owner_email,
            1 - (d.embedding <=> query_embedding) AS similarity,
            ROW_NUMBER() OVER (
                PARTITION BY d.id
                ORDER BY d.embedding <=> query_embedding ASC
            ) AS rn
        FROM dogs d
        WHERE d.embedding IS NOT NULL
          AND d.embedding_version = p_embedding_version
          AND 1 - (d.embedding <=> query_embedding) >= match_threshold
    )
    SELECT
        rm.dog_id,
        rm.name,
        rm.breed,
        rm.age,
        rm.sex,
        rm.color_markings,
        rm.owner_name,
        rm.owner_phone,
        rm.owner_email,
        rm.similarity
    FROM ranked_matches rm
    WHERE rm.rn = 1
    ORDER BY rm.similarity DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_all_dogs(vector(512), float, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_all_dogs(vector(512), float, int, text) TO anon;

-- Match only LOST dogs (used by the lost-dog finder feature)
CREATE OR REPLACE FUNCTION public.match_lost_dogs(
    query_embedding vector(512),
    match_threshold float,
    match_count int,
    p_embedding_version text
)
RETURNS TABLE (
    dog_id UUID,
    name TEXT,
    breed TEXT,
    confidence FLOAT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH matches AS (
        SELECT
            d.id AS dog_id,
            d.name,
            d.breed,
            1 - (d.embedding <=> query_embedding) AS confidence
        FROM dogs d
        WHERE d.is_lost = true
          AND d.embedding IS NOT NULL
          AND d.embedding_version = p_embedding_version
          AND 1 - (d.embedding <=> query_embedding) >= match_threshold
    ),
    best_matches AS (
        SELECT
            m.dog_id,
            m.name,
            m.breed,
            MAX(m.confidence) AS confidence
        FROM matches m
        GROUP BY m.dog_id, m.name, m.breed
    )
    SELECT
        bm.dog_id,
        bm.name,
        bm.breed,
        bm.confidence
    FROM best_matches bm
    ORDER BY bm.confidence DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_lost_dogs(vector(512), float, int, text) TO anon;
GRANT EXECUTE ON FUNCTION public.match_lost_dogs(vector(512), float, int, text) TO service_role;
