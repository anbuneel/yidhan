-- Migration: make ownership fields server-owned by default
--
-- Browser clients should not send user_id as an authorization claim. These
-- defaults let authenticated inserts rely on auth.uid(), while existing RLS
-- WITH CHECK policies still reject cross-user writes.

ALTER TABLE public.notes
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.tags
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.note_shares
  ALTER COLUMN user_id SET DEFAULT auth.uid();
