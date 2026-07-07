-- Add is_lost and lost_since to dogs table
ALTER TABLE dogs ADD COLUMN is_lost BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE dogs ADD COLUMN lost_since TIMESTAMPTZ;
