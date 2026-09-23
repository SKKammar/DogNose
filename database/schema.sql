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
    behaviour_notes          text,
    emergency_contact_name   text,
    emergency_contact_phone  text,
    vet_name                 text,
    vet_phone                text,
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
    dog_id                  uuid,
    name                    text,
    breed                   text,
    age                     double precision,
    sex                     text,
    color_markings          text,
    owner_name              text,
    owner_phone             text,
    owner_email             text,
    profile_photo_url       text,
    behaviour_notes         text,
    emergency_contact_name  text,
    emergency_contact_phone text,
    vet_name                text,
    vet_phone               text,
    similarity              double precision
)
LANGUAGE sql STABLE
AS $$
    SELECT
        id, name, breed, age, sex, color_markings,
        owner_name, owner_phone, owner_email, profile_photo_url,
        behaviour_notes, emergency_contact_name, emergency_contact_phone,
        vet_name, vet_phone,
        1 - (nose_embedding <=> query_embedding) AS similarity
    FROM dognose.dogs
    WHERE
        embedding_version = p_embedding_version
        AND nose_embedding IS NOT NULL
        AND 1 - (nose_embedding <=> query_embedding) > match_threshold
    ORDER BY nose_embedding <=> query_embedding
    LIMIT match_count;
$$;
-- ============================================================
-- Health Records tables (FIX-D02)
-- ============================================================

CREATE TABLE dognose.allergies (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id      uuid NOT NULL REFERENCES dognose.dogs(id) ON DELETE CASCADE,
    allergen    text NOT NULL,
    severity    text CHECK (severity IN ('mild','moderate','severe')),
    notes       text,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE dognose.vaccinations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id        uuid NOT NULL REFERENCES dognose.dogs(id) ON DELETE CASCADE,
    vaccine_name  text NOT NULL,
    date_given    date,
    next_due      date,
    notes         text,
    created_at    timestamptz DEFAULT now()
);

CREATE TABLE dognose.medications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id      uuid NOT NULL REFERENCES dognose.dogs(id) ON DELETE CASCADE,
    name        text NOT NULL,
    dosage      text,
    frequency   text,
    notes       text,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE dognose.medical_visits (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id      uuid NOT NULL REFERENCES dognose.dogs(id) ON DELETE CASCADE,
    visit_date  date,
    reason      text,
    vet_name    text,
    diagnosis   text,
    notes       text,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE dognose.weight_logs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id       uuid NOT NULL REFERENCES dognose.dogs(id) ON DELETE CASCADE,
    weight_kg    double precision NOT NULL,
    measured_at  date NOT NULL,
    notes        text,
    created_at   timestamptz DEFAULT now()
);

CREATE INDEX allergies_dog_id_idx       ON dognose.allergies(dog_id);
CREATE INDEX vaccinations_dog_id_idx    ON dognose.vaccinations(dog_id);
CREATE INDEX medications_dog_id_idx     ON dognose.medications(dog_id);
CREATE INDEX medical_visits_dog_id_idx  ON dognose.medical_visits(dog_id);
CREATE INDEX weight_logs_dog_id_idx     ON dognose.weight_logs(dog_id);

-- RLS (owner-only via join to dogs.user_id)
ALTER TABLE dognose.allergies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dognose.vaccinations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dognose.medications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dognose.medical_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE dognose.weight_logs    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner access allergies" ON dognose.allergies
  FOR ALL USING (EXISTS (
    SELECT 1 FROM dognose.dogs WHERE dogs.id = allergies.dog_id AND dogs.user_id = auth.uid()
  ));

CREATE POLICY "Owner access vaccinations" ON dognose.vaccinations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM dognose.dogs WHERE dogs.id = vaccinations.dog_id AND dogs.user_id = auth.uid()
  ));

CREATE POLICY "Owner access medications" ON dognose.medications
  FOR ALL USING (EXISTS (
    SELECT 1 FROM dognose.dogs WHERE dogs.id = medications.dog_id AND dogs.user_id = auth.uid()
  ));

CREATE POLICY "Owner access medical_visits" ON dognose.medical_visits
  FOR ALL USING (EXISTS (
    SELECT 1 FROM dognose.dogs WHERE dogs.id = medical_visits.dog_id AND dogs.user_id = auth.uid()
  ));

CREATE POLICY "Owner access weight_logs" ON dognose.weight_logs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM dognose.dogs WHERE dogs.id = weight_logs.dog_id AND dogs.user_id = auth.uid()
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON dognose.allergies      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dognose.vaccinations   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dognose.medications    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dognose.medical_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dognose.weight_logs    TO authenticated;
GRANT ALL ON dognose.allergies      TO service_role;
GRANT ALL ON dognose.vaccinations   TO service_role;
GRANT ALL ON dognose.medications    TO service_role;
GRANT ALL ON dognose.medical_visits TO service_role;
GRANT ALL ON dognose.weight_logs    TO service_role;
