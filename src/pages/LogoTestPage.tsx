import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import lockupSrc from '../assets/brand/yidhan-logo-lockup-tight-1200.webp';
import markSrc from '../assets/brand/yidhan-logo-mark-512.webp';
import type { Theme } from '../types';

interface LogoTestPageProps {
  theme: Theme;
  onThemeToggle?: () => void;
}

const HEIGHT_SAMPLES = [24, 32, 40, 52] as const;
const WIDTH_SAMPLES = [560, 420, 320, 260, 220] as const;

const PALETTES: Record<
  Theme,
  {
    pageBackground: string;
    shellBackground: string;
    stageBackground: string;
    stageGlow: string;
    panelBackground: string;
    panelSecondary: string;
    border: string;
    text: string;
    muted: string;
    quiet: string;
    accent: string;
    shadow: string;
    chipBackground: string;
  }
> = {
  light: {
    pageBackground:
      'radial-gradient(circle at 12% 12%, rgba(212, 175, 55, 0.18), transparent 24%), radial-gradient(circle at 88% 10%, rgba(194, 86, 52, 0.14), transparent 20%), linear-gradient(180deg, #f8f1e8 0%, #efe4d5 100%)',
    shellBackground: 'rgba(251, 246, 239, 0.84)',
    stageBackground:
      'linear-gradient(150deg, rgba(250, 244, 236, 0.96) 0%, rgba(238, 226, 212, 0.96) 100%)',
    stageGlow:
      'radial-gradient(circle at 50% 28%, rgba(212, 175, 55, 0.18), transparent 30%), radial-gradient(circle at 78% 78%, rgba(194, 86, 52, 0.14), transparent 28%)',
    panelBackground: 'rgba(252, 247, 240, 0.92)',
    panelSecondary: 'rgba(242, 233, 221, 0.9)',
    border: 'rgba(101, 73, 52, 0.18)',
    text: '#35271d',
    muted: 'rgba(53, 39, 29, 0.72)',
    quiet: 'rgba(53, 39, 29, 0.48)',
    accent: '#8f4d2e',
    shadow: '0 32px 70px rgba(95, 63, 36, 0.14)',
    chipBackground: 'rgba(143, 77, 46, 0.08)',
  },
  dark: {
    pageBackground:
      'radial-gradient(circle at 14% 12%, rgba(212, 175, 55, 0.16), transparent 24%), radial-gradient(circle at 88% 12%, rgba(194, 86, 52, 0.14), transparent 20%), linear-gradient(180deg, #121815 0%, #1d241f 100%)',
    shellBackground: 'rgba(26, 31, 28, 0.82)',
    stageBackground:
      'linear-gradient(145deg, rgba(30, 37, 33, 0.98) 0%, rgba(18, 22, 20, 0.98) 100%)',
    stageGlow:
      'radial-gradient(circle at 50% 24%, rgba(212, 175, 55, 0.14), transparent 28%), radial-gradient(circle at 84% 76%, rgba(194, 86, 52, 0.16), transparent 26%)',
    panelBackground: 'rgba(27, 33, 30, 0.9)',
    panelSecondary: 'rgba(22, 27, 25, 0.92)',
    border: 'rgba(237, 226, 214, 0.14)',
    text: '#f2e7d8',
    muted: 'rgba(242, 231, 216, 0.74)',
    quiet: 'rgba(242, 231, 216, 0.48)',
    accent: '#d4af37',
    shadow: '0 34px 84px rgba(5, 7, 6, 0.42)',
    chipBackground: 'rgba(212, 175, 55, 0.1)',
  },
};

const SURFACES = [
  {
    label: 'Paper',
    background:
      'linear-gradient(180deg, rgba(249, 241, 230, 0.98) 0%, rgba(237, 226, 212, 0.98) 100%)',
    note: 'Closest to the intended brand texture.',
  },
  {
    label: 'Charcoal',
    background:
      'linear-gradient(160deg, rgba(28, 34, 31, 0.98) 0%, rgba(14, 17, 16, 0.98) 100%)',
    note: 'Gold and terracotta lift cleanly on dark ground.',
  },
  {
    label: 'Clay',
    background:
      'linear-gradient(160deg, rgba(192, 120, 84, 0.86) 0%, rgba(138, 78, 52, 0.92) 100%)',
    note: 'Good for campaign moments, weaker for utility UI.',
  },
  {
    label: 'Mist',
    background:
      'linear-gradient(155deg, rgba(223, 226, 220, 0.96) 0%, rgba(197, 204, 197, 0.94) 100%)',
    note: 'Neutral enough to reveal edge softness.',
  },
] as const;

function SectionLabel({
  children,
  color,
}: {
  children: string;
  color: string;
}) {
  return (
    <p
      className="text-[0.72rem] uppercase tracking-[0.28em]"
      style={{ color, fontFamily: 'var(--font-body)' }}
    >
      {children}
    </p>
  );
}

function Panel({
  background,
  border,
  shadow,
  children,
  className = '',
}: {
  background: string;
  border: string;
  shadow: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[24px] ${className}`}
      style={{
        background,
        border: `1px solid ${border}`,
        boxShadow: shadow,
      }}
    >
      {children}
    </section>
  );
}

function BrandLockup({
  alt,
  className = '',
  style,
}: {
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={lockupSrc}
      alt={alt}
      className={className}
      decoding="async"
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}

function BrandMark({
  alt,
  className = '',
  style,
}: {
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={markSrc}
      alt={alt}
      className={className}
      decoding="async"
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}

function HeaderReadout({
  height,
  palette,
}: {
  height: number;
  palette: (typeof PALETTES)[Theme];
}) {
  return (
    <div
      className="rounded-[18px] px-4 sm:px-5"
      style={{
        background: palette.panelSecondary,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div className="flex h-20 items-center justify-between gap-4">
        <div className="min-w-0">
          <p
            className="text-xs uppercase tracking-[0.22em]"
            style={{ color: palette.quiet, fontFamily: 'var(--font-body)' }}
          >
            Header lockup
          </p>
          <p
            className="mt-1 text-sm"
            style={{ color: palette.muted, fontFamily: 'var(--font-body)' }}
          >
            {height}px render height
          </p>
        </div>

        <div className="shrink-0">
          <BrandLockup
            alt={`Brand lockup at ${height}px height`}
            style={{ height, width: 'auto', maxWidth: 'min(42vw, 260px)' }}
          />
        </div>
      </div>
    </div>
  );
}

function CropStudy({
  palette,
  background,
}: {
  palette: (typeof PALETTES)[Theme];
  background: string;
}) {
  return (
    <div
      className="relative aspect-square overflow-hidden rounded-[24px]"
      style={{
        background,
        border: `1px solid ${palette.border}`,
      }}
    >
      <BrandMark
        alt="Compact mark study from the Gemini logo"
        style={{
          width: '74%',
          height: '74%',
          objectFit: 'contain',
          position: 'absolute',
          inset: '50% auto auto 50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}

export function LogoTestPage({ theme }: LogoTestPageProps) {
  const [localTheme, setLocalTheme] = useState<Theme>(theme);
  const palette = PALETTES[localTheme];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localTheme);
  }, [localTheme]);

  return (
    <div
      className="min-h-screen px-4 py-5 sm:px-6 lg:px-10 lg:py-8"
      style={{ background: palette.pageBackground, color: palette.text }}
    >
      <div className="mx-auto max-w-[1380px]">
        <Panel
          background={palette.shellBackground}
          border={palette.border}
          shadow={palette.shadow}
          className="backdrop-blur-sm"
        >
          <div className="border-b px-5 py-5 sm:px-8 lg:px-10" style={{ borderColor: palette.border }}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <SectionLabel color={palette.accent}>Logo Rendering Study</SectionLabel>
                <h1
                  className="mt-3 text-[clamp(2rem,4vw,4.4rem)] leading-[0.95]"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
                >
                  The branded lockup, tested as a real asset system instead of a forced SVG.
                </h1>
                <p
                  className="mt-4 max-w-2xl text-[1rem] leading-7 sm:text-[1.08rem]"
                  style={{ color: palette.muted, fontFamily: 'var(--font-body)' }}
                >
                  This page stays local to the logo study. It compares the shipped lockup and the
                  extracted compact mark, tests where each one reads cleanly, and keeps a visual QA
                  surface for future brand decisions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {['Raster lockup', 'Compact mark', 'Responsive WebP', 'SVG bypassed'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.16em]"
                    style={{
                      color: palette.muted,
                      background: palette.chipBackground,
                      border: `1px solid ${palette.border}`,
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {chip}
                  </span>
                ))}

                <div
                  className="ml-0 flex rounded-full p-1 sm:ml-2"
                  style={{
                    background: palette.panelSecondary,
                    border: `1px solid ${palette.border}`,
                  }}
                >
                  {(['light', 'dark'] as const).map((mode) => {
                    const active = localTheme === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setLocalTheme(mode)}
                        className="rounded-full px-4 py-2 text-sm transition-colors duration-200"
                        style={{
                          background: active ? palette.accent : 'transparent',
                          color: active ? '#f7efe5' : palette.muted,
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        {mode === 'light' ? 'Light Lab' : 'Dark Lab'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-5 py-5 sm:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] lg:px-10 lg:py-8">
            <Panel
              background={`${palette.stageGlow}, ${palette.stageBackground}`}
              border={palette.border}
              shadow={palette.shadow}
            >
              <div className="flex h-full flex-col justify-between gap-8 p-6 sm:p-8">
                <div>
                  <SectionLabel color={palette.accent}>Primary Stage</SectionLabel>
                  <h2
                    className="mt-3 text-[clamp(1.8rem,3vw,3rem)] leading-tight"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
                  >
                    The full lockup reads best when it is allowed to breathe.
                  </h2>
                  <p
                    className="mt-3 max-w-xl text-[0.98rem] leading-7"
                    style={{ color: palette.muted, fontFamily: 'var(--font-body)' }}
                  >
                    This is the use case the PNG wants: landing surfaces, launch moments, and any
                    brand panel where the brush texture and parchment edge can stay intact.
                  </p>
                </div>

                <div className="rounded-[28px] px-5 py-10 sm:px-10 sm:py-14">
                  <BrandLockup
                    alt="Yidhan painted lockup"
                    className="mx-auto"
                    style={{ maxWidth: 'min(76vw, 720px)' }}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    'Use raster for the full lockup',
                    'Avoid tiny placements for the full mark',
                    'Plan a separate icon-only asset later',
                  ].map((note) => (
                    <div
                      key={note}
                      className="rounded-[18px] px-4 py-3"
                      style={{
                        background: palette.panelBackground,
                        border: `1px solid ${palette.border}`,
                      }}
                    >
                      <p
                        className="text-sm leading-6"
                        style={{ color: palette.muted, fontFamily: 'var(--font-body)' }}
                      >
                        {note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <div className="grid gap-6">
              <Panel background={palette.panelBackground} border={palette.border} shadow={palette.shadow}>
                <div className="p-6 sm:p-7">
                  <SectionLabel color={palette.accent}>Reading Notes</SectionLabel>
                  <div className="mt-4 space-y-4" style={{ fontFamily: 'var(--font-body)' }}>
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em]" style={{ color: palette.quiet }}>
                        Strength
                      </p>
                      <p className="mt-1 text-[1rem] leading-7" style={{ color: palette.muted }}>
                        The painterly arc, gold wordmark, and paper field feel coherent in raster.
                        The lockup finally looks like one object instead of three separate browser
                        effects.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em]" style={{ color: palette.quiet }}>
                        Safe UI range
                      </p>
                      <p className="mt-1 text-[1rem] leading-7" style={{ color: palette.muted }}>
                        Roughly 32-40px tall for a header lockup. Below that, the wordmark softens
                        faster than the icon area.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em]" style={{ color: palette.quiet }}>
                        Later extraction
                      </p>
                      <p className="mt-1 text-[1rem] leading-7" style={{ color: palette.muted }}>
                        The top crop is promising, but the favicon and app icon still deserve a
                        deliberate icon-only file rather than a blind crop.
                      </p>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel background={palette.panelBackground} border={palette.border} shadow={palette.shadow}>
                <div className="p-6 sm:p-7">
                  <SectionLabel color={palette.accent}>Icon Crop Study</SectionLabel>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <CropStudy
                      palette={palette}
                      background="linear-gradient(180deg, rgba(245, 238, 227, 0.98) 0%, rgba(226, 216, 201, 0.96) 100%)"
                    />
                    <CropStudy
                      palette={palette}
                      background="linear-gradient(160deg, rgba(24, 29, 27, 0.98) 0%, rgba(10, 12, 11, 0.98) 100%)"
                    />
                  </div>
                  <p
                    className="mt-4 text-sm leading-6"
                    style={{ color: palette.muted, fontFamily: 'var(--font-body)' }}
                  >
                    This crop is useful for visual direction only. It is not a production icon
                    yet.
                  </p>
                </div>
              </Panel>
            </div>
          </div>

          <div className="border-t px-5 py-5 sm:px-8 lg:px-10 lg:py-8" style={{ borderColor: palette.border }}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Panel background={palette.panelBackground} border={palette.border} shadow={palette.shadow}>
                <div className="p-6 sm:p-7">
                  <SectionLabel color={palette.accent}>Header Stress Test</SectionLabel>
                  <div className="mt-5 space-y-3">
                    {HEIGHT_SAMPLES.map((height) => (
                      <HeaderReadout key={height} height={height} palette={palette} />
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel background={palette.panelBackground} border={palette.border} shadow={palette.shadow}>
                <div className="p-6 sm:p-7">
                  <SectionLabel color={palette.accent}>Width Thresholds</SectionLabel>
                  <div className="mt-5 space-y-4">
                    {WIDTH_SAMPLES.map((width) => (
                      <div
                        key={width}
                        className="rounded-[18px] px-4 py-5"
                        style={{
                          background: palette.panelSecondary,
                          border: `1px solid ${palette.border}`,
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p
                            className="text-xs uppercase tracking-[0.2em]"
                            style={{ color: palette.quiet, fontFamily: 'var(--font-body)' }}
                          >
                            {width}px wide
                          </p>
                          <div
                            className="h-px flex-1"
                            style={{ background: palette.border, minWidth: '32px' }}
                          />
                        </div>
                        <div className="mt-4">
                          <BrandLockup
                            alt={`Brand lockup at ${width}px width`}
                            style={{ width: `${width}px`, maxWidth: '100%' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </div>
          </div>

          <div className="border-t px-5 py-5 sm:px-8 lg:px-10 lg:py-8" style={{ borderColor: palette.border }}>
            <SectionLabel color={palette.accent}>Surface Comparison</SectionLabel>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {SURFACES.map((surface) => (
                <Panel
                  key={surface.label}
                  background={palette.panelBackground}
                  border={palette.border}
                  shadow={palette.shadow}
                >
                  <div className="p-4">
                    <div
                      className="rounded-[22px] px-4 py-6"
                      style={{
                        background: surface.background,
                        border: `1px solid ${palette.border}`,
                      }}
                    >
                      <BrandLockup
                        alt={`Brand lockup on ${surface.label.toLowerCase()} background`}
                        style={{ maxWidth: '100%' }}
                      />
                    </div>
                    <div className="mt-4">
                      <p
                        className="text-sm uppercase tracking-[0.18em]"
                        style={{ color: palette.text, fontFamily: 'var(--font-body)' }}
                      >
                        {surface.label}
                      </p>
                      <p
                        className="mt-1 text-sm leading-6"
                        style={{ color: palette.muted, fontFamily: 'var(--font-body)' }}
                      >
                        {surface.note}
                      </p>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
