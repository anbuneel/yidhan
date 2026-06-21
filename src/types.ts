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
}

export type ViewMode = 'library' | 'editor' | 'changelog' | 'roadmap' | 'faded' | 'privacy' | 'terms' | 'support';

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
  terracotta: '#C25634',
  gold: '#D4AF37',
  forest: '#3D5A3D',
  stone: '#8B8178',
  indigo: '#4A5568',
  clay: '#A67B5B',
  sage: '#87A878',
  plum: '#6B4C5A',
};
