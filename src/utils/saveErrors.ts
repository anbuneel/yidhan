export class VaultLockedSaveError extends Error {
  constructor() {
    super('Unlock your notes before retrying. You can copy this draft.');
    this.name = 'VaultLockedSaveError';
  }
}
