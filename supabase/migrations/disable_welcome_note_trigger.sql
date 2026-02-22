-- Migration: Disable welcome note trigger for E2EE
-- The server-side trigger creates plaintext notes, which is incompatible
-- with E2EE. Welcome notes will be created client-side after passphrase setup.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.create_welcome_note();
