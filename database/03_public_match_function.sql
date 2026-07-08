-- database/03_public_match_function.sql
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
