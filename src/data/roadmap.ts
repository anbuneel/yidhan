export type RoadmapStatus = 'in-progress' | 'coming-soon' | 'exploring';

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
}

export const roadmap: RoadmapItem[] = [
  {
    id: '1',
    title: 'Mobile Native Feel',
    description: 'iOS-style swipe gestures, pull-to-refresh, spring animations, and iOS Safari install guide. Available now on mobile!',
    status: 'in-progress',
  },
  {
    id: '2',
    title: 'Zero-Knowledge Encryption',
    description: 'End-to-end encryption for all your notes. Even we cannot read them — your thoughts remain truly private.',
    status: 'coming-soon',
  },
  {
    id: '3',
    title: 'Image Attachments',
    description: 'Add images, screenshots, and diagrams directly into your notes.',
    status: 'coming-soon',
  },
  {
    id: '4',
    title: 'Virtual Scrolling',
    description: 'Smooth performance with large note collections through optimized rendering.',
    status: 'coming-soon',
  },
  {
    id: '5',
    title: 'Public Garden',
    description: 'Toggle notes as public to create a minimal blog at your own URL. No analytics, no comments — just your words, quietly visible.',
    status: 'exploring',
  },
  {
    id: '6',
    title: 'Additional OAuth Providers',
    description: 'Sign in with GitHub, Apple, and other popular providers.',
    status: 'exploring',
  },
  {
    id: '7',
    title: 'Usage Analytics',
    description: 'Insights into your writing habits and note-taking patterns.',
    status: 'exploring',
  },
  {
    id: '8',
    title: 'App Store Distribution',
    description: 'Native iOS and Android apps on the App Store and Play Store for system integrations like widgets and Siri.',
    status: 'exploring',
  },
];

export const statusLabels: Record<RoadmapStatus, string> = {
  'in-progress': 'In Progress',
  'coming-soon': 'Coming Soon',
  'exploring': 'Exploring',
};

export const statusColors: Record<RoadmapStatus, { bg: string; text: string }> = {
  'in-progress': { bg: 'color-mix(in srgb, var(--color-status-progress) 15%, transparent)', text: 'var(--color-status-progress)' },
  'coming-soon': { bg: 'color-mix(in srgb, var(--color-status-coming) 15%, transparent)', text: 'var(--color-status-coming)' },
  'exploring': { bg: 'color-mix(in srgb, var(--color-status-exploring) 15%, transparent)', text: 'var(--color-status-exploring)' },
};
