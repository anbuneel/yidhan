-- Read-only preflight before applying supabase/migrations/launch_security_hardening.sql.
-- Run this in Supabase SQL Editor after taking backups.
--
-- Expected for a clean launch migration:
-- - unsafe_notes = 0
-- - unsafe_shares = 0
-- If either count is nonzero, the strict hardening migration will fail by design.

SELECT
  'notes' AS table_name,
  COUNT(*) AS total_rows
FROM public.notes
UNION ALL
SELECT 'tags', COUNT(*) FROM public.tags
UNION ALL
SELECT 'note_tags', COUNT(*) FROM public.note_tags
UNION ALL
SELECT 'note_shares', COUNT(*) FROM public.note_shares;

SELECT
  COUNT(*) AS unsafe_notes
FROM public.notes
WHERE encrypted_payload IS NULL
  OR length(encrypted_payload) = 0
  OR encryption_iv IS NULL
  OR length(encryption_iv) = 0
  OR encryption_version IS NULL
  OR encryption_version < 1
  OR content_hash IS NULL
  OR length(content_hash) = 0
  OR COALESCE(title, '') <> ''
  OR COALESCE(content, '') <> '';

SELECT
  id,
  user_id,
  created_at,
  updated_at,
  encrypted_payload IS NOT NULL AS has_encrypted_payload,
  encryption_iv IS NOT NULL AS has_encryption_iv,
  encryption_version,
  content_hash IS NOT NULL AS has_content_hash,
  length(COALESCE(title, '')) AS plaintext_title_length,
  length(COALESCE(content, '')) AS plaintext_content_length
FROM public.notes
WHERE encrypted_payload IS NULL
  OR length(encrypted_payload) = 0
  OR encryption_iv IS NULL
  OR length(encryption_iv) = 0
  OR encryption_version IS NULL
  OR encryption_version < 1
  OR content_hash IS NULL
  OR length(content_hash) = 0
  OR COALESCE(title, '') <> ''
  OR COALESCE(content, '') <> ''
ORDER BY updated_at DESC
LIMIT 50;

SELECT
  COUNT(*) AS unsafe_shares
FROM public.note_shares
WHERE encrypted_payload IS NULL
  OR length(encrypted_payload) = 0
  OR iv IS NULL
  OR length(iv) = 0
  OR encryption_version IS NULL
  OR encryption_version < 1
  OR expires_at IS NULL
  OR expires_at > now() + INTERVAL '30 days';

SELECT
  id,
  note_id,
  user_id,
  expires_at,
  encrypted_payload IS NOT NULL AS has_encrypted_payload,
  iv IS NOT NULL AS has_iv,
  encryption_version
FROM public.note_shares
WHERE encrypted_payload IS NULL
  OR length(encrypted_payload) = 0
  OR iv IS NULL
  OR length(iv) = 0
  OR encryption_version IS NULL
  OR encryption_version < 1
  OR expires_at IS NULL
  OR expires_at > now() + INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 50;
