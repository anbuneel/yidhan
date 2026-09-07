import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SharedNoteView } from './SharedNoteView';
import { encryptSharePayload, generateShareKey, generateShareToken, toBase64Url } from '../lib/encryption';
import { parseShareRoute } from '../utils/shareRoute';
import { fetchSharedNote } from '../services/notes';
vi.mock('../services/notes', () => ({ fetchSharedNote: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); });
it('opens an anonymous /s/token/slug letter using its fragment and fails closed without it', async () => {
  const token = generateShareToken(), key = generateShareKey();
  // Carry tags and block-level content: the deleted sharing e2e spec was the
  // only thing exercising either rendering path.
  const ciphertext = await encryptSharePayload(token, key, { version: 1, title: 'A private letter', content: '<h1>Heading</h1><ul><li>Only the recipient can open these words.</li></ul><blockquote>Quoted</blockquote>', tags: [{ name: 'quiet', color: 'sage' }, { name: 'letters', color: 'not-a-colour' }], sharedAt: new Date().toISOString() });
  vi.mocked(fetchSharedNote).mockResolvedValue(ciphertext);
  const route = parseShareRoute('/s/'+token+'/a-private-letter', '#k='+toBase64Url(key))!;
  expect(route.token).toBe(token);
  const view = (shareKey: Uint8Array) => <SharedNoteView token={token} shareKey={shareKey} theme="light" onThemeToggle={vi.fn()} onInvalidToken={vi.fn()} onChangelogClick={vi.fn()} onRoadmapClick={vi.fn()} />;
  render(view(route.shareKey));
  expect(await screen.findByText('Only the recipient can open these words.')).toBeVisible();
  expect(screen.getByText('A private letter')).toBeVisible();
  expect(screen.getByText('quiet')).toBeVisible();
  // An unrecognised colour must fall back rather than break the render.
  expect(screen.getByText('letters')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Heading' })).toBeVisible();
  expect(screen.getByText('Quoted')).toBeVisible();
  cleanup(); sessionStorage.clear(); vi.mocked(fetchSharedNote).mockClear();
  const incomplete = parseShareRoute('/s/'+token+'/a-private-letter', '')!;
  render(view(incomplete.shareKey));
  expect(screen.queryByText('A private letter')).toBeNull();
  expect(screen.getByText(/incomplete/i)).toBeVisible();
  expect(fetchSharedNote).not.toHaveBeenCalled();
});

it('shows the faded letter message when the token no longer resolves', async () => {
  // The deleted sharing e2e spec was the only cover for this branch.
  vi.mocked(fetchSharedNote).mockResolvedValue(null);
  const token = generateShareToken(), key = generateShareKey();
  render(<SharedNoteView token={token} shareKey={key} theme="light" onThemeToggle={vi.fn()}
    onInvalidToken={vi.fn()} onChangelogClick={vi.fn()} onRoadmapClick={vi.fn()} />);
  expect(await screen.findByText('This letter has faded')).toBeVisible();
});

it('reports a failure rather than a fade when the lookup itself errors', async () => {
  vi.mocked(fetchSharedNote).mockRejectedValue(new Error('Network unreachable'));
  const token = generateShareToken(), key = generateShareKey();
  render(<SharedNoteView token={token} shareKey={key} theme="light" onThemeToggle={vi.fn()}
    onInvalidToken={vi.fn()} onChangelogClick={vi.fn()} onRoadmapClick={vi.fn()} />);
  expect(await screen.findByText('Something went wrong')).toBeVisible();
});
