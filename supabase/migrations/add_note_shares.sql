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

-- Users can manage their own shares (create, read, update, delete).
-- Policies are split by operation so INSERT/UPDATE ownership is enforced
-- with WITH CHECK, not only a read-time USING predicate.
CREATE POLICY "Users can read their own shares"
  ON note_shares FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shares"
  ON note_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shares"
  ON note_shares FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shares"
  ON note_shares FOR DELETE
  USING (auth.uid() = user_id);

-- Public share reads are intentionally not granted through a blanket SELECT
-- policy. E2EE sharing now uses the fetch_shared_note RPC, which returns only
-- encrypted payloads for valid, non-expired, non-revoked tokens.

-- Create index for fast token lookups
CREATE INDEX idx_note_shares_token ON note_shares(share_token);

-- Create index for checking expiration
CREATE INDEX idx_note_shares_expires_at ON note_shares(expires_at) WHERE expires_at IS NOT NULL;
