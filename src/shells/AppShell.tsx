/**
 * The app shell: auth, the vault, the sync engine and every signed-in screen. Loaded
 * lazily by src/shells/Root.tsx (item 61, step 5), so none of it, Supabase included,
 * is on the landing page's critical path. It still renders the landing and public
 * pages for a signed-out visitor who reached it, exactly as before the split.
 */

import { Toaster } from 'react-hot-toast';
import App from '../App';
import { AuthProvider } from '../contexts/AuthContext';
import { EncryptionProvider } from '../contexts/EncryptionContext';
import type { AppStart } from './PublicShell';

export default function AppShell({ start }: { start: AppStart }) {
  return (
    <AuthProvider>
      <EncryptionProvider>
        <App fromPublicShell={start.fromPublicShell} initialAuthModal={start.authModal} />
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--glass-border)',
              fontFamily: 'var(--font-body)',
              borderRadius: '8px',
            },
            success: {
              iconTheme: {
                primary: 'var(--color-accent)',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--color-destructive)',
                secondary: '#fff',
              },
              duration: 5000,
            },
          }}
        />
      </EncryptionProvider>
    </AuthProvider>
  );
}
