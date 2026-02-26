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
  // E2EE fields — all-or-nothing: either all are set (encrypted note)
  // or all are null/undefined (unencrypted/legacy note).
  // Using `| null` (not `| undefined`) to match Supabase row shape.
  encryptedPayload?: string | null;
  encryptionIv?: string | null;
  encryptionVersion?: number | null;
  contentHash?: string | null;
}

export type ViewMode = 'library' | 'editor' | 'changelog' | 'roadmap' | 'faded';

export interface NoteShare {
  id: string;
  noteId: string;
  userId: string;
  shareToken: string;
  expiresAt: Date | null;
  createdAt: Date;
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
