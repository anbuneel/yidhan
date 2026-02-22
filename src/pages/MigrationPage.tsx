/**
 * E2EE Migration Page (temporary)
 *
 * One-time page at /migrate for encrypting existing plaintext notes.
 * Can be removed after all users have migrated.
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEncryption } from '../contexts/EncryptionContext';
import { migrateExistingNotes, type MigrationResult } from '../utils/migrationE2EE';
import { exportNotesToJSON, downloadFile } from '../utils/exportImport';
import { pauseSync, resumeSync } from '../services/syncEngine';
import type { Note, Tag } from '../types';

interface MigrationPageProps {
  notes: Note[];
  tags: Tag[];
  onBack: () => void;
  onMigrationComplete: () => void;
}

export function MigrationPage({ notes, tags, onBack, onMigrationComplete }: MigrationPageProps) {
  const { user } = useAuth();
  const { keys } = useEncryption();
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState('');

  const handleExportBackup = () => {
    const json = exportNotesToJSON(notes, tags);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(json, `yidhan-backup-${timestamp}.json`, 'application/json');
  };

  const handleMigrate = async () => {
    if (!user || !keys) return;

    setIsMigrating(true);
    setError('');
    setProgress({ completed: 0, total: 0 });

    // Pause sync during migration
    pauseSync();

    try {
      const migrationResult = await migrateExistingNotes(
        user.id,
        keys,
        (completed, total) => setProgress({ completed, total })
      );

      setResult(migrationResult);

      // Refresh notes in IndexedDB from the now-encrypted Supabase data
      // by re-fetching (the sync engine will pick up changes on resume)
      if (migrationResult.migrated > 0) {
        onMigrationComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      resumeSync();
      setIsMigrating(false);
    }
  };

  const progressPercent = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <div
        className="w-full max-w-lg p-8"
        style={{
          background: 'var(--color-bg-secondary)',
          borderRadius: '2px 24px 4px 24px',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h1
          className="text-2xl mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
            fontWeight: 500,
          }}
        >
          Encrypt Existing Notes
        </h1>
        <p
          className="mb-6 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          This will encrypt all your existing notes with your passphrase.
          Already-encrypted notes will be skipped.
        </p>

        {/* Warning */}
        <div
          className="mb-6 p-4 text-sm"
          style={{
            background: 'var(--color-bg-primary)',
            borderRadius: '2px 12px 4px 12px',
            border: '1px solid var(--glass-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <p className="font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Before you begin
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Close other browser tabs with Yidhan open</li>
            <li>Export a backup of your notes first</li>
            <li>Do not close this tab during migration</li>
          </ul>
        </div>

        {!result && (
          <div className="space-y-4">
            {/* Step 1: Export Backup */}
            <div>
              <button
                onClick={handleExportBackup}
                disabled={isMigrating}
                className="w-full px-4 py-2 text-sm transition-opacity"
                style={{
                  background: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '2px 12px 4px 12px',
                  fontFamily: 'var(--font-body)',
                  cursor: isMigrating ? 'not-allowed' : 'pointer',
                  opacity: isMigrating ? 0.5 : 1,
                }}
              >
                Export Backup (JSON)
              </button>
            </div>

            {/* Step 2: Confirm backup */}
            <label
              className="flex items-start gap-2 text-sm cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={backupConfirmed}
                onChange={(e) => setBackupConfirmed(e.target.checked)}
                disabled={isMigrating}
                className="mt-0.5"
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <span>I have saved my backup</span>
            </label>

            {/* Step 3: Migrate */}
            <button
              onClick={handleMigrate}
              disabled={!backupConfirmed || isMigrating || !keys}
              className="w-full px-4 py-3 text-sm font-medium transition-opacity"
              style={{
                background: 'var(--color-accent)',
                color: '#fff',
                borderRadius: '2px 12px 4px 12px',
                border: 'none',
                fontFamily: 'var(--font-body)',
                cursor: !backupConfirmed || isMigrating ? 'not-allowed' : 'pointer',
                opacity: !backupConfirmed || isMigrating ? 0.5 : 1,
              }}
            >
              {isMigrating ? 'Migrating...' : 'Migrate Notes'}
            </button>

            {/* Progress bar */}
            {isMigrating && (
              <div>
                <div
                  className="w-full h-2 overflow-hidden"
                  style={{
                    background: 'var(--color-bg-primary)',
                    borderRadius: '4px',
                  }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${progressPercent}%`,
                      background: 'var(--color-accent)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <p
                  className="text-xs mt-1 text-center"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {progress.completed} / {progress.total} notes ({progressPercent}%)
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
                {error}
              </p>
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div
              className="p-4 text-sm space-y-2"
              style={{
                background: 'var(--color-bg-primary)',
                borderRadius: '2px 12px 4px 12px',
                border: '1px solid var(--glass-border)',
              }}
            >
              <p style={{ color: 'var(--color-text-primary)' }}>
                Migration complete
              </p>
              <ul className="space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                <li>Encrypted: {result.migrated}</li>
                <li>Already encrypted: {result.skipped}</li>
                {result.failed > 0 && (
                  <li style={{ color: 'var(--color-destructive)' }}>
                    Failed: {result.failed}
                  </li>
                )}
              </ul>
              {result.errors.length > 0 && (
                <details className="mt-2">
                  <summary
                    className="text-xs cursor-pointer"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Error details
                  </summary>
                  <ul className="text-xs mt-1 space-y-1" style={{ color: 'var(--color-destructive)' }}>
                    {result.errors.map((e, i) => (
                      <li key={i}>Note {e.noteId.slice(0, 8)}...: {e.error}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            <button
              onClick={onBack}
              className="w-full px-4 py-3 text-sm font-medium"
              style={{
                background: 'var(--color-accent)',
                color: '#fff',
                borderRadius: '2px 12px 4px 12px',
                border: 'none',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              Return to Library
            </button>
          </div>
        )}

        {/* Back link (only when not migrating) */}
        {!isMigrating && !result && (
          <button
            onClick={onBack}
            className="mt-4 w-full text-center text-sm"
            style={{
              color: 'var(--color-text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Back to library
          </button>
        )}
      </div>
    </div>
  );
}
