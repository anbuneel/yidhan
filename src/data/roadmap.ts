export type RoadmapStatus = 'shipped' | 'in-progress' | 'coming-soon' | 'exploring';

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
}

export const roadmap: RoadmapItem[] = [
  {
    id: '2',
    title: 'Zero-knowledge encryption',
    description: 'End-to-end encryption with Argon2id key derivation and AES-256-GCM. Your notes are encrypted before they leave your device — even we cannot read them.',
    status: 'shipped',
  },
  {
    id: '1',
    title: 'Mobile native feel',
    description: 'iOS-style swipe gestures, pull-to-refresh, spring animations, bottom sheet modals, and iOS Safari install guide.',
    status: 'shipped',
  },
  {
    id: '3',
    title: 'Testing coverage expansion',
    description: 'Comprehensive test coverage across encryption, sync, and authentication layers — ensuring your notes stay safe through every update.',
    status: 'in-progress',
  },
  {
    id: '4',
    title: 'Image attachments',
    description: 'Add images, screenshots, and diagrams directly into your notes.',
    status: 'coming-soon',
  },
  {
    id: '5',
    title: 'Virtual scrolling',
    description: 'Smooth performance with large note collections through optimized rendering.',
    status: 'coming-soon',
  },
  {
    id: '6',
    title: 'Public garden',
    description: 'Toggle notes as public to create a minimal blog at your own URL. No analytics, no comments — just your words, quietly visible.',
    status: 'exploring',
  },
  {
    id: '7',
    title: 'Additional OAuth providers',
    description: 'Sign in with GitHub, Apple, and other popular providers.',
    status: 'exploring',
  },
  {
    id: '8',
    title: 'Usage analytics',
    description: 'Insights into your writing habits and note-taking patterns.',
    status: 'exploring',
  },
  {
    id: '9',
    title: 'App Store distribution',
    description: 'Native iOS and Android apps on the App Store and Play Store for system integrations like widgets and Siri.',
    status: 'exploring',
  },
  {
    id: '10',
    title: 'Live shared letters',
    description: 'Shared letters that stay in sync with the original note — edits reflect automatically for anyone with the link.',
    status: 'exploring',
  },
];

export const statusLabels: Record<RoadmapStatus, string> = {
  'shipped': 'Shipped',
  'in-progress': 'In progress',
  'coming-soon': 'Coming soon',
  'exploring': 'Exploring',
};
