export interface Tag {
  id: string;
  name: string;
  color: TagColor;
  createdAt: Date;
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
}

export type ViewMode = 'library' | 'editor' | 'changelog' | 'roadmap' | 'faded';
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
