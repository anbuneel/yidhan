import { useEffect, useState } from 'react';
import type { DerivedKeys } from '../lib/encryption';
import { decryptNote } from '../lib/encryption';
import type { ConflictInfo } from '../services/syncEngine';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { ConflictModal } from './ConflictModal';
import { ModalBackdropButton } from './ModalBackdropButton';

interface Props {
  conflict: ConflictInfo | null;
  keys: DerivedKeys | null;
  onResolve: (choice: 'local' | 'server' | 'both') => Promise<void>;
  onDismiss: () => void;
}

export function EncryptedConflictModal({ conflict, keys, onResolve, onDismiss }: Props) {
  const [preview, setPreview] = useState<{ source: ConflictInfo; value?: ConflictInfo; error?: boolean } | null>(null);
  const isNoteConflict = Boolean(conflict && conflict.entityType === 'note');
  const resolvedConflict = preview?.source === conflict ? preview.value ?? null : null;
  const loadingDialogRef = useModalFocusTrap({
    isOpen: isNoteConflict && !resolvedConflict,
    onClose: onDismiss,
  });

  useEffect(() => {
    if (!conflict || conflict.entityType !== 'note') return;
    let cancelled = false;
    const open = async () => {
      try {
        if (!keys) throw new Error('Vault locked');
        const local = conflict.localVersion, server = conflict.serverVersion;
        if (!local.encryptedPayload || !local.encryptionIv) throw new Error('Missing encrypted local version');
        const localText = await decryptNote(local.id, local.userId, { ciphertext: local.encryptedPayload, iv: local.encryptionIv }, keys.encryptionKey);
        if (!server.hard_deleted && (!server.encrypted_payload || !server.encryption_iv)) throw new Error('Missing encrypted remote version');
        const remoteText = server.hard_deleted ? { title: '', content: '' } : await decryptNote(local.id, local.userId,
          { ciphertext: server.encrypted_payload!, iv: server.encryption_iv! }, keys.encryptionKey);
        if (!cancelled) setPreview({ source: conflict, value: { ...conflict,
          localVersion: { ...local, ...localText }, serverVersion: { ...server, ...remoteText } } });
      } catch { if (!cancelled) setPreview({ source: conflict, error: true }); }
    };
    void open();
    return () => { cancelled = true; };
  }, [conflict, keys]);
  if (!isNoteConflict) return null;
  if (resolvedConflict) return <ConflictModal conflict={resolvedConflict} onResolve={onResolve} onDismiss={onDismiss} />;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <ModalBackdropButton label="Dismiss conflict dialog" onClick={onDismiss} />
      <dialog
        open
        ref={loadingDialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-label="Opening conflict"
        className="relative z-10 rounded bg-[var(--color-bg-secondary)] p-6 text-[var(--color-text-primary)] border-0"
        style={{ margin: 0 }}
      >
        <p role="status">{preview?.source === conflict && preview.error ? 'Both versions could not be opened. Unlock your vault and try again.' : 'Opening both versions…'}</p>
        <button type="button" className="mt-4" onClick={onDismiss}>Close</button>
      </dialog>
    </div>
  );
}
