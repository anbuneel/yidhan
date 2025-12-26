import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { Note, NoteShare } from '../types';
import {
  createNoteShare,
  getNoteShare,
  updateNoteShareExpiration,
  deleteNoteShare,
} from '../services/notes';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  userId: string;
}

type ExpirationOption = 1 | 7 | 30 | null;

const EXPIRATION_OPTIONS: { value: ExpirationOption; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: null, label: 'Never' },
];

export function ShareModal({ isOpen, onClose, note, userId }: ShareModalProps) {
  const [share, setShare] = useState<NoteShare | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [selectedExpiration, setSelectedExpiration] = useState<ExpirationOption>(7);
  const [copied, setCopied] = useState(false);

  // Generate share URL
  const getShareUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?s=${token}`;
  };

  // Fetch existing share on modal open
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setCopied(false);
    getNoteShare(note.id)
      .then((existingShare) => {
        setShare(existingShare);
        if (existingShare?.expiresAt) {
          // Calculate approximate expiration days from now
          const daysRemaining = Math.ceil(
            (existingShare.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          );
          if (daysRemaining <= 1) setSelectedExpiration(1);
          else if (daysRemaining <= 7) setSelectedExpiration(7);
          else if (daysRemaining <= 30) setSelectedExpiration(30);
          else setSelectedExpiration(null);
        } else if (existingShare) {
          setSelectedExpiration(null);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [isOpen, note.id]);

  // Create new share
  const handleCreateShare = async () => {
    setIsCreating(true);
    try {
      const newShare = await createNoteShare(note.id, userId, selectedExpiration);
      setShare(newShare);
    } catch (error) {
      console.error('Failed to create share:', error);
      toast.error('Failed to create share link');
    } finally {
      setIsCreating(false);
    }
  };

  // Update expiration
  const handleExpirationChange = async (value: ExpirationOption) => {
    setSelectedExpiration(value);
    if (share) {
      try {
        const updatedShare = await updateNoteShareExpiration(note.id, value);
        setShare(updatedShare);
      } catch (error) {
        console.error('Failed to update expiration:', error);
        toast.error('Failed to update expiration');
      }
    }
  };

  // Copy link to clipboard
  const handleCopy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(getShareUrl(share.shareToken));
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // Revoke share
  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      await deleteNoteShare(note.id);
      setShare(null);
      toast.success('Share link revoked');
      onClose();
    } catch (error) {
      console.error('Failed to revoke share:', error);
      toast.error('Failed to revoke share link');
    } finally {
      setIsRevoking(false);
    }
  };

  if (!isOpen) return null;

  const isProcessing = isLoading || isCreating || isRevoking;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={isProcessing ? undefined : onClose}
    >
      <div
        className="
          w-[420px]
          p-8
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
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-xl font-semibold"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
            }}
          >
            Share as Letter
          </h3>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="
              w-8 h-8
              rounded-full
              flex items-center justify-center
              transition-colors duration-200
              disabled:opacity-50
            "
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p
          className="mb-6 text-sm"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
          }}
        >
          Create a gentle, read-only view for someone to receive.
        </p>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {/* No share exists - show create button */}
        {!isLoading && !share && (
          <div className="space-y-6">
            {/* Expiration selector */}
            <div>
              <label
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Link expires in
              </label>
              <div className="flex gap-2 flex-wrap">
                {EXPIRATION_OPTIONS.map((option) => (
                  <button
                    key={option.value ?? 'never'}
                    onClick={() => setSelectedExpiration(option.value)}
                    className="
                      px-3 py-1.5
                      text-sm
                      rounded-lg
                      transition-all duration-200
                    "
                    style={{
                      fontFamily: 'var(--font-body)',
                      background:
                        selectedExpiration === option.value
                          ? 'var(--color-accent)'
                          : 'var(--color-bg-secondary)',
                      color:
                        selectedExpiration === option.value
                          ? 'var(--color-bg-primary)'
                          : 'var(--color-text-primary)',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreateShare}
              disabled={isCreating}
              className="
                w-full
                px-5 py-3
                rounded-lg
                text-sm font-medium
                transition-all duration-200
                disabled:opacity-50
                flex items-center justify-center gap-2
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-bg-primary)',
                background: 'var(--color-accent)',
              }}
              onMouseEnter={(e) => {
                if (!isCreating) {
                  e.currentTarget.style.background = 'var(--color-accent-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-accent)';
              }}
            >
              {isCreating && (
                <span
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-bg-primary)', borderTopColor: 'transparent' }}
                />
              )}
              {isCreating ? 'Creating...' : 'Create Share Link'}
            </button>
          </div>
        )}

        {/* Share exists - show link and options */}
        {!isLoading && share && (
          <div className="space-y-6">
            {/* Share link */}
            <div>
              <label
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Share link
              </label>
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <input
                  type="text"
                  value={getShareUrl(share.shareToken)}
                  readOnly
                  className="flex-1 text-sm bg-transparent outline-none truncate"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-primary)',
                  }}
                />
                <button
                  onClick={handleCopy}
                  className="
                    px-3 py-1.5
                    text-sm font-medium
                    rounded-lg
                    transition-all duration-200
                    shrink-0
                  "
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: copied ? 'var(--color-success)' : 'var(--color-accent)',
                    color: 'var(--color-bg-primary)',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Expiration selector */}
            <div>
              <label
                className="block text-sm mb-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Expires in
              </label>
              <div className="flex gap-2 flex-wrap">
                {EXPIRATION_OPTIONS.map((option) => (
                  <button
                    key={option.value ?? 'never'}
                    onClick={() => handleExpirationChange(option.value)}
                    className="
                      px-3 py-1.5
                      text-sm
                      rounded-lg
                      transition-all duration-200
                    "
                    style={{
                      fontFamily: 'var(--font-body)',
                      background:
                        selectedExpiration === option.value
                          ? 'var(--color-accent)'
                          : 'var(--color-bg-secondary)',
                      color:
                        selectedExpiration === option.value
                          ? 'var(--color-bg-primary)'
                          : 'var(--color-text-primary)',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleRevoke}
                disabled={isRevoking}
                className="
                  px-4 py-2
                  text-sm font-medium
                  transition-colors duration-200
                  rounded-lg
                  disabled:opacity-50
                  flex items-center gap-2
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-destructive)',
                }}
                onMouseEnter={(e) => {
                  if (!isRevoking) {
                    e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {isRevoking && (
                  <span
                    className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-destructive)', borderTopColor: 'transparent' }}
                  />
                )}
                {isRevoking ? 'Revoking...' : 'Revoke Link'}
              </button>
              <button
                onClick={onClose}
                className="
                  px-5 py-2.5
                  rounded-lg
                  text-sm font-medium
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-bg-primary)',
                  background: 'var(--color-accent)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)';
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
