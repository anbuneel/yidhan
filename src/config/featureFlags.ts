// Hardcoded pre-launch toggles. Flip when the product is ready for the extra friction.
export const REAUTH_FOR_SENSITIVE_ACTIONS = false;

// Disabled until account deletion is backed by a server-owned workflow.
// The existing metadata-only "departing_at" flow is not a deletion guarantee.
export const ACCOUNT_OFFBOARDING_ENABLED = false;

// Temporary pre-launch repair tool. Enable in production only for a short-lived
// repair session with VITE_ENABLE_LEGACY_REPAIR=true, then disable again.
export const LEGACY_PLAINTEXT_REPAIR_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_LEGACY_REPAIR === 'true';
