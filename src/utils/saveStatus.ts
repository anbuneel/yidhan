interface SaveState {
  localSaved: boolean;
  synced: boolean;
  matchesDraft: boolean;
  hash?: string | null;
  confirmedHash?: string | null;
}

export function getSaveLabel(state: SaveState): 'Not saved' | 'Saved here' | 'Synced' {
  if (!state.localSaved) return 'Not saved';
  return state.synced && state.matchesDraft && !!state.hash && state.hash === state.confirmedHash
    ? 'Synced' : 'Saved here';
}
