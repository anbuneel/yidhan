export type ImportPhase = 'parsing' | 'importing' | 'finalizing';

export interface ImportProgress {
  phase: ImportPhase;
  current: number;
  total: number;
}

const PHASE_LABELS: Record<ImportPhase, (progress: ImportProgress) => string> = {
  parsing: () => 'Parsing file...',
  importing: ({ current, total }) =>
    total > 0 ? `Importing notes... ${current}/${total}` : 'Importing notes...',
  finalizing: ({ current, total }) => `Adding tags... ${current}/${total}`,
};

export function ImportProgressOverlay({ progress }: { progress: ImportProgress }) {
  const percent =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const showBar = progress.total > 0 && progress.phase !== 'parsing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div
        className="px-8 py-6 rounded-lg text-center min-w-[280px]"
        style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <div
          className="size-8 mx-auto mb-4 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
        />
        <p style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
          {PHASE_LABELS[progress.phase](progress)}
        </p>
        {showBar && (
          <div className="mt-3">
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'var(--color-bg-tertiary)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${percent}%`, background: 'var(--color-accent)' }}
              />
            </div>
            <p
              className="text-xs mt-2"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              {percent}% complete
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
