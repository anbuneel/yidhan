-- Add note_shares table for "Share as Letter" feature
-- Allows users to create temporary, read-only share links for their notes

CREATE TABLE note_shares (
  id uuid default gen_random_uuid() primary key,
  note_id uuid references notes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  share_token varchar(32) unique not null,
  expires_at timestamptz,
  created_at timestamptz default now() not null,
  unique(note_id)  -- One active share per note
);

-- RLS policies
ALTER TABLE note_shares ENABLE ROW LEVEL SECURITY;

-- Users can manage their own shares (create, read, update, delete)
CREATE POLICY "Users can manage their own shares"
  ON note_shares FOR ALL
  USING (auth.uid() = user_id);

-- Public access to read share tokens (for fetching shared notes)
-- This allows unauthenticated users to validate share tokens
CREATE POLICY "Anyone can read share tokens"
  ON note_shares FOR SELECT
  USING (true);

-- Create index for fast token lookups
CREATE INDEX idx_note_shares_token ON note_shares(share_token);

-- Create index for checking expiration
CREATE INDEX idx_note_shares_expires_at ON note_shares(expires_at) WHERE expires_at IS NOT NULL;
