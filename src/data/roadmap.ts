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
    id: '4',
    title: 'Image attachments',
    description: 'Add images, screenshots, and diagrams directly into your notes.',
    status: 'exploring',
  },
  {
    id: '5',
    title: 'Virtual scrolling',
    description: 'Smooth performance with large note collections through optimized rendering.',
    status: 'exploring',
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
    description: 'Sign in with Apple and other providers.',
    status: 'exploring',
  },
  {
    id: '8',
    title: 'On-device writing stats',
    description: 'Optional summaries of your writing habits, computed locally on your device. Nothing leaves your browser or reaches our servers.',
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
  {
    id: '11',
    title: 'Encrypted tag names',
    description: 'Encrypt tag names alongside note titles and content so tags are no longer stored in plaintext on the server.',
    status: 'exploring',
  },
];

export const statusLabels: Record<RoadmapStatus, string> = {
  'shipped': 'Shipped',
  'in-progress': 'In progress',
  'coming-soon': 'Coming soon',
  'exploring': 'Exploring',
};
