import { reloadWithPreservedShareContext } from './shareRoute';

/**
 * Shows a persistent banner prompting user to refresh when the app has been updated.
 * Used by both main.tsx (for global chunk errors) and lazyWithRetry.ts (for lazy load failures).
 *
 * This replaces hard auto-reload to give users control over when to refresh,
 * preventing disruption when they're mid-task.
 */
export function showUpdateBanner(): void {
  // Don't show multiple banners
  if (document.getElementById('chunk-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'chunk-update-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--glass-border);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--color-text-secondary);
  `;

  const message = document.createElement('span');
  message.textContent = 'Yidhan has been updated.';

  const button = document.createElement('button');
  button.textContent = 'Refresh to continue';
  button.style.cssText = `
    background: var(--color-cta-bg);
    color: var(--color-cta-text);
    border: none;
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  `;
  button.onclick = () => reloadWithPreservedShareContext();

  banner.appendChild(message);
  banner.appendChild(button);
  document.body.prepend(banner);
}
