-- database/05_match_all_dogs.sql
-- A match function that searches ALL enrolled dogs (not just lost ones).
-- Used by the /dogs/identify endpoint for general identification.

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

-- Grant access to service_role (backend uses service role key)
GRANT EXECUTE ON FUNCTION public.match_all_dogs(vector(512), float, int, text) TO service_role;
-- Also grant to anon in case it's called with anon key
GRANT EXECUTE ON FUNCTION public.match_all_dogs(vector(512), float, int, text) TO anon;
