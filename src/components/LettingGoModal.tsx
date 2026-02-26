import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { ReAuthModal } from './ReAuthModal';
import {
  exportNotesToJSON,
  downloadMarkdownZip,
  downloadFile,
  exportFullAccountData,
} from '../utils/exportImport';
import { fetchAllNoteShares } from '../services/notes';
import type { Note, Tag } from '../types';

type PendingAction = 'fullBackup' | 'letGo' | null;

interface LettingGoModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  tags: Tag[];
}

export function LettingGoModal({ isOpen, onClose, notes, tags }: LettingGoModalProps) {
  const { initiateOffboarding, signOut, user, isRecentlyReauthed } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingFull, setIsExportingFull] = useState(false);

  // Re-auth state
  const [showReAuthModal, setShowReAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const handleExportJSON = () => {
    const jsonData = exportNotesToJSON(notes, tags);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(jsonData, `yidhan-keepsakes-${date}.json`, 'application/json');
    toast.success('Keepsakes saved (JSON)');
  };

  const handleExportMarkdown = async () => {
    await downloadMarkdownZip(notes);
    toast.success('Keepsakes saved (Markdown)');
  };

  // Initiate full backup - may require re-auth
  const handleExportFullBackup = () => {
    if (!user) return;

    // Check if recently re-authenticated (grace window)
    if (isRecentlyReauthed()) {
      performFullBackup();
    } else {
      // Require re-auth first
      setPendingAction('fullBackup');
      setShowReAuthModal(true);
    }
  };

  // Actually perform the full backup export
  const performFullBackup = async () => {
    if (!user) return;

    setIsExportingFull(true);
    try {
      // Fetch all share links for the user
      const shareLinks = await fetchAllNoteShares();

      // Prepare profile data
      const profile = {
        displayName: user.user_metadata?.full_name || null,
        email: user.email || '',
      };

      // Generate full account export
      const jsonData = exportFullAccountData(notes, tags, shareLinks, profile);
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
      downloadFile(jsonData, `yidhan-full-backup-${date}-${time}.json`, 'application/json');

      toast.success('Full backup saved');
    } catch (error) {
      console.error('Failed to export full backup:', error);
      toast.error('Failed to create backup. Please try again.');
    } finally {
      setIsExportingFull(false);
    }
  };

  // Initiate account departure - requires re-auth
  const handleLetGo = () => {
    // Check if recently re-authenticated (grace window)
    if (isRecentlyReauthed()) {
      performLetGo();
    } else {
      // Require re-auth first
      setPendingAction('letGo');
      setShowReAuthModal(true);
    }
  };

  // Actually perform the account departure
  const performLetGo = async () => {
    setIsLoading(true);
    try {
      const { error } = await initiateOffboarding();
      if (error) {
        toast.error('Something went wrong. Please try again.');
        return;
      }

      // Show farewell toast
      toast('Your account is fading quietly. See you if you return.', {
        duration: 5000,
        style: {
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--glass-border)',
        },
      });

      // Sign out and close modal
      onClose();
      await signOut();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle successful re-authentication
  const handleReAuthSuccess = () => {
    setShowReAuthModal(false);

    // Execute the pending action
    if (pendingAction === 'fullBackup') {
      performFullBackup();
    } else if (pendingAction === 'letGo') {
      performLetGo();
    }

    setPendingAction(null);
  };

  // Handle re-auth cancellation
  const handleReAuthCancel = () => {
    setShowReAuthModal(false);
    setPendingAction(null);
  };

  if (!isOpen) return null;

  // Determine action description for ReAuthModal
  function getActionDescription(): string {
    switch (pendingAction) {
      case 'fullBackup':
        return 'download your full backup';
      case 'letGo':
        return 'begin your departure';
      default:
        return 'continue';
    }
  }

  return (
    <>
      {/* Re-authentication Modal */}
      <ReAuthModal
        isOpen={showReAuthModal}
        onSuccess={handleReAuthSuccess}
        onCancel={handleReAuthCancel}
        actionDescription={getActionDescription()}
      />

      <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="
          w-full max-w-md
          shadow-2xl
          animate-[modal-enter_300ms_ease-out]
        "
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--glass-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-8 py-6 border-b"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          <div className="flex items-center justify-between">
            <h2
              className="text-2xl italic"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              Letting Go
            </h2>
            <button
              onClick={onClose}
              className="
                w-8 h-8
                flex items-center justify-center
                rounded-full
                transition-colors duration-200
              "
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* Gratitude message */}
          <p
            className="text-center text-lg mb-2"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
            }}
          >
            Thank you for the quiet moments.
          </p>

          {/* Explanation */}
          <p
            className="text-center text-sm mb-6"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            Your account will fade for 14 days, then release. You may return anytime before then.
          </p>

          {/* Keepsakes section */}
          <div
            className="p-4 rounded-lg mb-6"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <p
              className="text-sm mb-1"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
              }}
            >
              Take your keepsakes{' '}
              <span style={{ color: 'var(--color-text-tertiary)' }}>(optional)</span>
            </p>
            <p
              className="text-xs mb-3"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Your words belong to you.
            </p>
            <div className="flex gap-2 mb-2">
              <button
                onClick={handleExportMarkdown}
                className="
                  flex-1 py-2 px-3
                  text-sm
                  rounded-lg
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--glass-border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                Markdown
              </button>
              <button
                onClick={handleExportJSON}
                className="
                  flex-1 py-2 px-3
                  text-sm
                  rounded-lg
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--glass-border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                JSON
              </button>
            </div>
            <button
              onClick={handleExportFullBackup}
              disabled={isExportingFull}
              className="
                w-full py-2 px-3
                text-sm
                rounded-lg
                transition-all duration-200
                disabled:opacity-50
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'var(--color-cta-bg)',
                color: 'var(--color-cta-text)',
              }}
              onMouseEnter={(e) => {
                if (!isExportingFull) {
                  e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-cta-bg)';
              }}
            >
              {isExportingFull ? 'Preparing...' : 'Full Backup (includes share links)'}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="
                flex-1 py-3
                rounded-lg
                font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--glass-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              Stay a while
            </button>
            <button
              onClick={handleLetGo}
              disabled={isLoading}
              className="
                flex-1 py-3
                rounded-lg
                font-medium
                transition-all duration-200
                disabled:opacity-50
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'var(--color-destructive)',
                color: 'var(--color-destructive-text)',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.opacity = '0.85';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {isLoading ? 'Letting go...' : 'Let go'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
