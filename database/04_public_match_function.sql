-- Create a function to securely match against only lost dogs
CREATE OR REPLACE FUNCTION match_lost_dogs(
  query_embedding vector(512),
  match_threshold float,
  match_count int
) RETURNS TABLE(dog_id uuid, name text, breed text, confidence float)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS dog_id,
    d.name,
    d.breed,
    1 - (n.embedding <=> query_embedding) AS confidence
  FROM nose_prints n
  JOIN dogs d ON d.id = n.dog_id
  WHERE d.is_lost = true
  AND 1 - (n.embedding <=> query_embedding) >= match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant access to anon role so unauthenticated users can call it
GRANT EXECUTE ON FUNCTION match_lost_dogs TO anon;
