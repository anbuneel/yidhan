export interface Tag {
  id: string;
  name: string;
  color: TagColor;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags: Tag[];
  pinned: boolean;
  deletedAt?: Date | null;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  // E2EE fields are required for persisted launch notes. They remain nullable
  // because generated Supabase row types are nullable and transient decrypted UI
  // notes can exist before persistence.
  encryptedPayload?: string | null;
  encryptionIv?: string | null;
  encryptionVersion?: number | null;
  contentHash?: string | null;
  confirmedContentHash?: string | null;
  /**
   * The ciphertext would not open. Title and content are empty by construction; the
   * note renders as a locked card rather than as a blank one, and is excluded from
   * exports with a count reported (item 41).
   *
   * This is never set for a note that is not encrypted at all — that is a violation of
   * the launch invariant and still fails the whole read, closed.
   */
  decryptionFailed?: boolean;
}

/**
 * Deletes a note from its current surface. `false` or a rejected promise lets a
 * card restore itself and offer another attempt. Every successful completion
 * reports a boolean so a promise-dropping wrapper cannot satisfy the contract.
 */
export type NoteDeleteHandler = (
  id: string
) => boolean | Promise<boolean>;

export type ViewMode = 'library' | 'editor' | 'changelog' | 'roadmap' | 'faded' | 'privacy' | 'terms' | 'support' | 'security';

export interface NoteShare {
  id: string;
  noteId: string;
  userId: string;
  shareToken: string;
  expiresAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}
export type Theme = 'light' | 'dark';

// Curated wabi-sabi color palette for tags
export type TagColor =
  | 'terracotta'
  | 'gold'
  | 'forest'
  | 'stone'
  | 'indigo'
  | 'clay'
  | 'sage'
  | 'plum';

export const TAG_COLORS: Record<TagColor, string> = {
  // Earthy mid-tones that reach 3:1 on both the light and the dark page and card, so
  // one value serves both themes. The keys are stored with each tag; keep them.
  terracotta: '#B5643F',
  gold: '#9C7A26',
  forest: '#4B8659',
  stone: '#837E72',
  indigo: '#6577A2',
  clay: '#A07253',
  sage: '#71905F',
  plum: '#9A6B86',
};
