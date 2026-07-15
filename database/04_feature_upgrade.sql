-- Profile photo on dogs table
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Scan logs
CREATE TABLE IF NOT EXISTS scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matched_dog_id UUID REFERENCES dogs(id) ON DELETE SET NULL,
  similarity_score FLOAT NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  scanner_ip_hash TEXT
);

-- Incorrect match reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id UUID REFERENCES dogs(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (display name)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
-- scan_logs: owners can only read logs for their own dogs
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_scan_logs" ON scan_logs
  FOR SELECT USING (
    matched_dog_id IN (SELECT id FROM dogs WHERE owner_id = auth.uid())
  );

-- profiles: users can only read/write their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON profiles
  FOR ALL USING (id = auth.uid());
