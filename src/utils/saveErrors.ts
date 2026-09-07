export class VaultLockedSaveError extends Error {
  constructor() {
    super('Unlock your vault before retrying. You can copy this draft.');
    this.name = 'VaultLockedSaveError';
  }
}
