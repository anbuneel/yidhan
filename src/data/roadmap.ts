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
    title: 'Offline Support',
    description: 'Access and edit your notes without an internet connection. Changes sync automatically when you reconnect.',
    status: 'coming-soon',
  },
  {
    id: '2',
    title: 'Image Attachments',
    description: 'Add images, screenshots, and diagrams directly into your notes.',
    status: 'coming-soon',
  },
  {
    id: '3',
    title: 'Virtual Scrolling',
    description: 'Smooth performance with large note collections through optimized rendering.',
    status: 'coming-soon',
  },
  {
    id: '4',
    title: 'Public Garden',
    description: 'Toggle notes as public to create a minimal blog at your own URL. No analytics, no comments — just your words, quietly visible.',
    status: 'exploring',
  },
  {
    id: '5',
    title: 'Additional OAuth Providers',
    description: 'Sign in with GitHub, Apple, and other popular providers.',
    status: 'exploring',
  },
  {
    id: '6',
    title: 'Usage Analytics',
    description: 'Insights into your writing habits and note-taking patterns.',
    status: 'exploring',
  },
  {
    id: '7',
    title: 'Native Mobile Apps',
    description: 'Dedicated iOS and Android apps for a truly native mobile experience with offline support and system integrations.',
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
