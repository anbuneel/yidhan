-- ============================================================================
-- SECURITY AUDIT CHECKLIST FOR ZENOTE
-- ============================================================================
-- This file documents security configurations that should be verified in
-- the Supabase Dashboard. Run these queries to audit your RLS policies.
-- ============================================================================

-- ============================================================================
-- 1. ROW LEVEL SECURITY (RLS) AUDIT
-- ============================================================================

-- Verify RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('notes', 'tags', 'note_tags');
-- Expected: All should show rowsecurity = true

-- List all RLS policies on notes table
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'notes';
-- Expected policies:
-- - SELECT: Users can only read their own notes (auth.uid() = user_id)
-- - INSERT: Users can only insert notes with their own user_id
-- - UPDATE: Users can only update their own notes
-- - DELETE: Users can only delete their own notes

-- List all RLS policies on tags table
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'tags';
-- Expected: Same pattern as notes

-- List all RLS policies on note_tags table
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'note_tags';
-- Expected: Users can only manage note_tags for their own notes/tags

-- ============================================================================
-- 2. SAMPLE RLS POLICIES (if not already created)
-- ============================================================================

-- Enable RLS on all tables (if not already enabled)
-- ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;

-- Notes table policies
-- CREATE POLICY "Users can view own notes" ON notes
--   FOR SELECT USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can insert own notes" ON notes
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "Users can update own notes" ON notes
--   FOR UPDATE USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can delete own notes" ON notes
--   FOR DELETE USING (auth.uid() = user_id);

-- Tags table policies
-- CREATE POLICY "Users can view own tags" ON tags
--   FOR SELECT USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can insert own tags" ON tags
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "Users can update own tags" ON tags
--   FOR UPDATE USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can delete own tags" ON tags
--   FOR DELETE USING (auth.uid() = user_id);

-- Note_tags junction table policies
-- CREATE POLICY "Users can view own note_tags" ON note_tags
--   FOR SELECT USING (
--     EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid())
--   );
--
-- CREATE POLICY "Users can insert own note_tags" ON note_tags
--   FOR INSERT WITH CHECK (
--     EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid())
--     AND EXISTS (SELECT 1 FROM tags WHERE tags.id = note_tags.tag_id AND tags.user_id = auth.uid())
--   );
--
-- CREATE POLICY "Users can delete own note_tags" ON note_tags
--   FOR DELETE USING (
--     EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid())
--   );

-- ============================================================================
-- 3. RATE LIMITING
-- ============================================================================
--
-- Supabase provides built-in rate limiting. Configure in Dashboard:
--
-- Authentication → Settings → Rate Limits:
-- - Email sign-ups: 3 per hour (default)
-- - Password sign-in attempts: 30 per 5 minutes (default)
-- - Token refreshes: 360 per hour (default)
--
-- Database → Settings → API Settings:
-- - Requests per second: Configure based on your plan
--
-- For additional protection, consider:
-- 1. Supabase Edge Functions with custom rate limiting
-- 2. Cloudflare or similar WAF in front of your app
--
-- ============================================================================

-- ============================================================================
-- 4. ACCESS CONTROL TESTING QUERIES
-- ============================================================================

-- Test query: Attempt to access another user's notes
-- This should return 0 rows if RLS is working correctly
-- Replace 'other-user-uuid' with an actual UUID from another account
-- SELECT * FROM notes WHERE user_id = 'other-user-uuid';

-- Test query: Attempt to insert note for another user
-- This should fail if RLS is working correctly
-- INSERT INTO notes (user_id, title, content)
-- VALUES ('other-user-uuid', 'Test', 'Should fail');

-- ============================================================================
-- 5. DATABASE CONSTRAINTS
-- ============================================================================

-- Verify foreign key constraints exist
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('notes', 'tags', 'note_tags');

-- Verify ON DELETE CASCADE is set up correctly
-- This ensures data is cleaned up when users are deleted
