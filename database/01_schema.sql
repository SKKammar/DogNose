-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Create dogs table
CREATE TABLE IF NOT EXISTS dogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create nose_prints table
CREATE TABLE IF NOT EXISTS nose_prints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
    embedding vector(512) NOT NULL,
    embedding_version TEXT NOT NULL DEFAULT 'v1',
    image_url TEXT,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ivfflat index on the embedding column for cosine similarity search
CREATE INDEX ON nose_prints USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
