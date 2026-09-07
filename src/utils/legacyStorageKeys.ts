/**
 * Migrate localStorage keys from old 'zenote-' prefix to new 'yidhan-' prefix
 * This ensures existing users don't lose their preferences during the rebrand
 */
export function migrateLocalStorageKeys(): void {
  const keyMappings: [string, string][] = [
    ['zenote-theme', 'yidhan-theme'],
    ['zenote-engagement', 'yidhan-engagement'],
    ['zenote-install-dismissed', 'yidhan-install-dismissed'],
    ['zenote-install-prompted', 'yidhan-install-prompted'],
    ['zenote-ios-guide-dismissed', 'yidhan-ios-guide-dismissed'],
    ['zenote-demo-state', 'yidhan-demo-state'],
    ['zenote-demo-content', 'yidhan-demo-content'],
    ['zenote-shared-content', 'yidhan-shared-content'],
    ['zenote-ribbon-seen', 'yidhan-ribbon-seen'],
  ];

  keyMappings.forEach(([oldKey, newKey]) => {
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, oldValue);
      localStorage.removeItem(oldKey);
    }
  });
}
