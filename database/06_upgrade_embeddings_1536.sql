-- ============================================================
-- DogNose: Migrate embedding dimension 512 → 1536
-- Run this ONCE in Supabase SQL Editor before redeploying.
-- WARNING: Existing embeddings are wiped (incompatible dims).
--          Re-enroll all dogs after deploying the new backend.
-- ============================================================

-- 1. Drop old vector index
DROP INDEX IF EXISTS dogs_embedding_idx;

-- 2. Alter column: set to NULL first (old 512-dim values are incompatible)
ALTER TABLE dogs
  ALTER COLUMN embedding TYPE vector(1536) USING NULL;

-- 3. Recreate HNSW index for cosine similarity (faster than IVFFlat for small datasets)
CREATE INDEX dogs_embedding_idx
  ON dogs USING hnsw (embedding vector_cosine_ops);

-- 4. Replace the match_all_dogs function with 1536-dim signature
DROP FUNCTION IF EXISTS public.match_all_dogs(vector(512), float, int, text);

CREATE OR REPLACE FUNCTION public.match_all_dogs(
    query_embedding vector(1536),
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

GRANT EXECUTE ON FUNCTION public.match_all_dogs(vector(1536), float, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_all_dogs(vector(1536), float, int, text) TO anon;

-- 5. Replace the match_lost_dogs function with 1536-dim signature
DROP FUNCTION IF EXISTS public.match_lost_dogs(vector(512), float, int, text);

CREATE OR REPLACE FUNCTION public.match_lost_dogs(
    query_embedding vector(1536),
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

GRANT EXECUTE ON FUNCTION public.match_lost_dogs(vector(1536), float, int, text) TO anon;
GRANT EXECUTE ON FUNCTION public.match_lost_dogs(vector(1536), float, int, text) TO service_role;

-- 6. Verify the migration
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'dogs' AND column_name = 'embedding';
