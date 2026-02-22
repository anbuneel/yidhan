-- Migration: Add encryption columns for E2EE
-- These columns store encrypted note data alongside the (soon-to-be-empty) plaintext columns.

ALTER TABLE notes ADD COLUMN encrypted_payload text;
ALTER TABLE notes ADD COLUMN encryption_iv text;
ALTER TABLE notes ADD COLUMN encryption_version integer;
ALTER TABLE notes ADD COLUMN content_hash text;

-- Index on content_hash for conflict detection queries
CREATE INDEX idx_notes_content_hash ON notes (content_hash);

-- All-or-nothing constraint: encryption fields must all be set or all be null.
-- Prevents partial encryption state (e.g., payload without IV) which would
-- indicate data corruption.
ALTER TABLE notes ADD CONSTRAINT chk_encryption_all_or_nothing CHECK (
  (encrypted_payload IS NULL AND encryption_iv IS NULL AND encryption_version IS NULL AND content_hash IS NULL)
  OR
  (encrypted_payload IS NOT NULL AND encryption_iv IS NOT NULL AND encryption_version IS NOT NULL AND content_hash IS NOT NULL)
);
