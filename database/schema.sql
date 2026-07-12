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
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed TEXT,
    is_lost BOOLEAN NOT NULL DEFAULT false,
    lost_since TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create nose_prints table with 512-dim vector embeddings
CREATE TABLE IF NOT EXISTS nose_prints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
    embedding vector(512) NOT NULL,
    embedding_version TEXT NOT NULL DEFAULT 'v1',
    image_url TEXT,
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create pgvector index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS nose_prints_embedding_idx
    ON nose_prints USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- 5. Row Level Security
-- =============================================================================

ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nose_prints ENABLE ROW LEVEL SECURITY;

-- Dogs: users can only manage their own dogs
CREATE POLICY "Users can view their own dogs"
    ON dogs FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own dogs"
    ON dogs FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own dogs"
    ON dogs FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own dogs"
    ON dogs FOR DELETE
    USING (auth.uid() = owner_id);

-- Nose prints: users can only manage prints for their own dogs
CREATE POLICY "Users can view their dogs nose prints"
    ON nose_prints FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their dogs nose prints"
    ON nose_prints FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their dogs nose prints"
    ON nose_prints FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their dogs nose prints"
    ON nose_prints FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    );

-- =============================================================================
-- 6. Match functions (SECURITY DEFINER — bypass RLS for server-side queries)
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
            1 - (np.embedding <=> query_embedding) AS similarity,
            ROW_NUMBER() OVER (
                PARTITION BY d.id
                ORDER BY np.embedding <=> query_embedding ASC
            ) AS rn
        FROM nose_prints np
        JOIN dogs d ON d.id = np.dog_id
        WHERE np.embedding_version = p_embedding_version
          AND 1 - (np.embedding <=> query_embedding) >= match_threshold
    )
    SELECT
        rm.dog_id,
        rm.name,
        rm.breed,
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
            1 - (np.embedding <=> query_embedding) AS confidence
        FROM nose_prints np
        JOIN dogs d ON d.id = np.dog_id
        WHERE d.is_lost = true
          AND np.embedding_version = p_embedding_version
          AND 1 - (np.embedding <=> query_embedding) >= match_threshold
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
