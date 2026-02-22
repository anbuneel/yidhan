-- Migration: Add encryption columns for E2EE
-- These columns store encrypted note data alongside the (soon-to-be-empty) plaintext columns.

ALTER TABLE notes ADD COLUMN encrypted_payload text;
ALTER TABLE notes ADD COLUMN encryption_iv text;
ALTER TABLE notes ADD COLUMN encryption_version integer;
ALTER TABLE notes ADD COLUMN content_hash text;

-- Index on content_hash for conflict detection queries
CREATE INDEX idx_notes_content_hash ON notes (content_hash);
