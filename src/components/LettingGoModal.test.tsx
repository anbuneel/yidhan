import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LettingGoModal } from './LettingGoModal';
import { formatDeletionDate } from '../utils/deletionCopy';
import type { Note, Tag } from '../types';

const {
  featureFlags,
  mockConfirmAccountDeletion,
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
    mockConfirmAccountDeletion: vi.fn(),
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
    confirmAccountDeletion: mockConfirmAccountDeletion,
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
    vi.clearAllMocks();
    featureFlags.reauthForSensitiveActions = false;
    mockIsRecentlyReauthed.mockReturnValue(false);
    mockConfirmAccountDeletion.mockResolvedValue({
      success: true,
      confirmationToken: 'confirmation-token',
    });
    mockInitiateOffboarding.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue(undefined);
    mockFetchAllNoteShares.mockResolvedValue([]);
    mockExportNotesToJSON.mockReturnValue('json-export');
    mockDownloadMarkdownZip.mockResolvedValue(undefined);
    mockExportFullAccountData.mockReturnValue('full-account-export');
  });

  it('exports the full backup without re-auth when the switch is off', async () => {
    const user = userEvent.setup({ delay: null });
    renderLettingGoModal();

    await user.click(screen.getByRole('button', { name: 'Full backup' }));

    await waitFor(() => {
      expect(mockFetchAllNoteShares).toHaveBeenCalledOnce();
    });

    expect(screen.queryByText("Confirm it's you")).not.toBeInTheDocument();
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
    const user = userEvent.setup({ delay: null });
    renderLettingGoModal();

    await user.click(screen.getByRole('button', { name: 'Full backup' }));

    expect(await screen.findByText("Confirm it's you")).toBeInTheDocument();
    expect(screen.getByText(/download your full backup/)).toBeInTheDocument();
    expect(mockIsRecentlyReauthed).toHaveBeenCalledOnce();
    expect(mockFetchAllNoteShares).not.toHaveBeenCalled();
    expect(mockDownloadFile).not.toHaveBeenCalled();
  });

  it('requires server confirmation before account departure when the switch is off', async () => {
    const user = userEvent.setup({ delay: null });
    renderLettingGoModal();

    await user.click(screen.getByRole('button', { name: 'Let go' }));
    expect(await screen.findByText("Confirm it's you")).toBeInTheDocument();
    expect(screen.getByText(/begin your departure/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Your password'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockConfirmAccountDeletion).toHaveBeenCalledWith('correct horse battery staple');
    });

    expect(mockInitiateOffboarding).toHaveBeenCalledWith('confirmation-token');
    expect(mockIsRecentlyReauthed).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('requires server confirmation before account departure when the switch is on', async () => {
    featureFlags.reauthForSensitiveActions = true;
    const user = userEvent.setup({ delay: null });
    renderLettingGoModal();

    await user.click(screen.getByRole('button', { name: 'Let go' }));

    expect(await screen.findByText("Confirm it's you")).toBeInTheDocument();
    expect(screen.getByText(/begin your departure/)).toBeInTheDocument();
    expect(mockIsRecentlyReauthed).not.toHaveBeenCalled();
    expect(mockInitiateOffboarding).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe('LettingGoModal copy (design critique G3)', () => {
  it('names the deletion date, 14 days out', () => {
    const from = new Date(2026, 10, 26, 12);
    expect(formatDeletionDate(from)).toBe(
      new Date(2026, 11, 10, 12).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    );
  });

  it('says when the account and notes are deleted, and how to cancel', () => {
    renderLettingGoModal();
    expect(
      screen.getByText(`Your account and notes will be deleted on ${formatDeletionDate()}.`)
    ).toBeInTheDocument();
    expect(screen.getByText(/sign back in and choose "Stay" to cancel/)).toBeInTheDocument();
    expect(screen.queryByText(/quiet moments/i)).toBeNull();
    expect(screen.queryByText(/fade|release/i)).toBeNull();
  });
});
