import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LettingGoModal } from './LettingGoModal';
import type { Note, Tag } from '../types';

const {
  featureFlags,
  mockInitiateOffboarding,
  mockSignOut,
  mockIsRecentlyReauthed,
  mockFetchAllNoteShares,
  mockExportNotesToJSON,
  mockDownloadMarkdownZip,
  mockDownloadFile,
  mockExportFullAccountData,
  mockToast,
} = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  });

  return {
    featureFlags: { reauthForSensitiveActions: false },
    mockInitiateOffboarding: vi.fn(),
    mockSignOut: vi.fn(),
    mockIsRecentlyReauthed: vi.fn(),
    mockFetchAllNoteShares: vi.fn(),
    mockExportNotesToJSON: vi.fn(),
    mockDownloadMarkdownZip: vi.fn(),
    mockDownloadFile: vi.fn(),
    mockExportFullAccountData: vi.fn(),
    mockToast: toast,
  };
});

vi.mock('../config/featureFlags', () => ({
  get REAUTH_FOR_SENSITIVE_ACTIONS() {
    return featureFlags.reauthForSensitiveActions;
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    initiateOffboarding: mockInitiateOffboarding,
    signOut: mockSignOut,
    user: {
      id: 'user-123',
      email: 'user@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Test User' },
    },
    isRecentlyReauthed: mockIsRecentlyReauthed,
  }),
}));

vi.mock('../services/notes', () => ({
  fetchAllNoteShares: mockFetchAllNoteShares,
}));

vi.mock('../utils/exportImport', () => ({
  exportNotesToJSON: mockExportNotesToJSON,
  downloadMarkdownZip: mockDownloadMarkdownZip,
  downloadFile: mockDownloadFile,
  exportFullAccountData: mockExportFullAccountData,
}));

vi.mock('react-hot-toast', () => ({
  default: mockToast,
}));

const testDate = new Date('2024-01-15T12:00:00Z');

const notes: Note[] = [
  {
    id: 'note-1',
    title: 'Test Note',
    content: '<p>Test content</p>',
    createdAt: testDate,
    updatedAt: testDate,
    tags: [],
    pinned: false,
    deletedAt: null,
  },
];

const tags: Tag[] = [];

function renderLettingGoModal() {
  return render(
    <LettingGoModal
      isOpen
      onClose={vi.fn()}
      notes={notes}
      tags={tags}
    />
  );
}

describe('LettingGoModal re-auth feature switch', () => {
  beforeEach(() => {
    featureFlags.reauthForSensitiveActions = false;
    mockIsRecentlyReauthed.mockReturnValue(false);
    mockInitiateOffboarding.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue(undefined);
    mockFetchAllNoteShares.mockResolvedValue([]);
    mockExportNotesToJSON.mockReturnValue('json-export');
    mockDownloadMarkdownZip.mockResolvedValue(undefined);
    mockExportFullAccountData.mockReturnValue('full-account-export');
  });

  it('exports the full backup without re-auth when the switch is off', async () => {
    const user = userEvent.setup();
    renderLettingGoModal();

    await user.click(screen.getByRole('button', { name: 'Full Backup' }));

    await waitFor(() => {
      expect(mockFetchAllNoteShares).toHaveBeenCalledOnce();
    });

    expect(screen.queryByText('A Moment of Verification')).not.toBeInTheDocument();
    expect(mockIsRecentlyReauthed).not.toHaveBeenCalled();
    expect(mockExportFullAccountData).toHaveBeenCalledWith(
      notes,
      tags,
      [],
      { displayName: 'Test User', email: 'user@example.com' }
    );
    expect(mockDownloadFile).toHaveBeenCalledWith(
      'full-account-export',
      expect.stringContaining('yidhan-full-backup-'),
      'application/json'
    );
  });

  it('requires re-auth before full backup when the switch is on', async () => {
    featureFlags.reauthForSensitiveActions = true;
    const user = userEvent.setup();
    renderLettingGoModal();

    await user.click(screen.getByRole('button', { name: 'Full Backup' }));

    expect(await screen.findByText('A Moment of Verification')).toBeInTheDocument();
    expect(screen.getByText(/download your full backup/)).toBeInTheDocument();
    expect(mockIsRecentlyReauthed).toHaveBeenCalledOnce();
    expect(mockFetchAllNoteShares).not.toHaveBeenCalled();
    expect(mockDownloadFile).not.toHaveBeenCalled();
  });

  it('starts account departure without re-auth when the switch is off', async () => {
    const user = userEvent.setup();
    renderLettingGoModal();

    await user.click(screen.getByRole('button', { name: 'Let go' }));

    await waitFor(() => {
      expect(mockInitiateOffboarding).toHaveBeenCalledOnce();
    });

    expect(screen.queryByText('A Moment of Verification')).not.toBeInTheDocument();
    expect(mockIsRecentlyReauthed).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('requires re-auth before account departure when the switch is on', async () => {
    featureFlags.reauthForSensitiveActions = true;
    const user = userEvent.setup();
    renderLettingGoModal();

    await user.click(screen.getByRole('button', { name: 'Let go' }));

    expect(await screen.findByText('A Moment of Verification')).toBeInTheDocument();
    expect(screen.getByText(/begin your departure/)).toBeInTheDocument();
    expect(mockIsRecentlyReauthed).toHaveBeenCalledOnce();
    expect(mockInitiateOffboarding).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
