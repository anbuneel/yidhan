import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LandingPage } from './LandingPage';
import { SecurityPage } from './SecurityPage';

// No AuthContext mock: the public shell renders this page with no AuthProvider.

vi.mock('../hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ isInstallable: false, isInstalled: false, triggerInstall: vi.fn() }),
}));

function renderLanding() {
  const props = {
    onStartWriting: vi.fn(),
    onSignIn: vi.fn(),
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
    onDemoClick: vi.fn(),
    onDemoDraftClick: vi.fn(),
    onSecurityClick: vi.fn(),
    onChangelogClick: vi.fn(),
    onRoadmapClick: vi.fn(),
    onPrivacyClick: vi.fn(),
    onTermsClick: vi.fn(),
    onSupportClick: vi.fn(),
  };
  render(<LandingPage {...props} />);
  return props;
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('leads with writing, and says encryption needs an account', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/a notes app built around writing/i);
    expect(screen.getByText(/focus mode/i)).toBeInTheDocument();
    const line = screen.getByText(/encrypted before they leave this one/i);
    expect(line).toHaveTextContent(/with an account/i);
    expect(screen.getByText(/free to use\. no account needed to try\./i)).toBeInTheDocument();
  });

  it('keeps the passphrase, recovery key and visible metadata out of the hero', () => {
    const { container } = render(<LandingPage {...{
      onStartWriting: vi.fn(), onSignIn: vi.fn(), theme: 'dark' as const, onThemeToggle: vi.fn(),
      onDemoClick: vi.fn(), onDemoDraftClick: vi.fn(), onSecurityClick: vi.fn(),
      onChangelogClick: vi.fn(), onRoadmapClick: vi.fn(), onPrivacyClick: vi.fn(),
      onTermsClick: vi.fn(), onSupportClick: vi.fn(),
    }} />);

    const hero = container.querySelector('.landing-intro') as HTMLElement;
    expect(hero).not.toHaveTextContent(/passphrase|recovery key|tag names/i);
  });

  it('the privacy section states what stays visible and the recovery limit, not an absolute', () => {
    renderLanding();

    const section = screen.getByRole('heading', { name: /your writing is private/i }).closest('section') as HTMLElement;
    expect(section).toHaveTextContent(/encrypted on your device before they sync/i);
    expect(section).toHaveTextContent(/dates, note sizes and tag names are not encrypted/i);
    expect(section).toHaveTextContent(/choose a passphrase and get a recovery key/i);
    expect(section).toHaveTextContent(/if you lose both, we can’t get your notes back/i);
    // No claim the security page cannot back: nothing absolute, nothing about audits.
    expect(document.body).not.toHaveTextContent(/not even us/i);
    expect(document.body).not.toHaveTextContent(/nobody else can read/i);
    expect(document.body).not.toHaveTextContent(/audited|independently reviewed/i);
  });

  it('the privacy section links to the security page, in-app on a plain click only', () => {
    const props = renderLanding();
    const link = screen.getByRole('link', { name: /how encryption works/i });
    expect(link).toHaveAttribute('href', '/security');

    fireEvent.click(link, { ctrlKey: true });
    expect(props.onSecurityClick).not.toHaveBeenCalled();

    fireEvent.click(link);
    expect(props.onSecurityClick).toHaveBeenCalledTimes(1);
  });

  it('the security page still backs each thing the privacy section says stays visible', () => {
    render(<SecurityPage
      theme="dark"
      onThemeToggle={vi.fn()}
      onSignIn={vi.fn()}
      onLogoClick={vi.fn()}
      onChangelogClick={vi.fn()}
      onRoadmapClick={vi.fn()}
    />);

    expect(screen.getByText(/what is protected, what is visible, and what we have not solved yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Timestamps\./)).toBeInTheDocument();
    expect(screen.getByText(/Sizes\./)).toBeInTheDocument();
    expect(screen.getByText(/Tag names\./)).toBeInTheDocument();
    expect(screen.getByText(/this has not had one yet/i)).toBeInTheDocument();
  });

  it('holds the draft, the samples, privacy and the closing action in one sheet', () => {
    const { container } = render(<LandingPage {...{
      onStartWriting: vi.fn(), onSignIn: vi.fn(), theme: 'dark' as const, onThemeToggle: vi.fn(),
      onDemoClick: vi.fn(), onDemoDraftClick: vi.fn(), onSecurityClick: vi.fn(),
      onChangelogClick: vi.fn(), onRoadmapClick: vi.fn(), onPrivacyClick: vi.fn(),
      onTermsClick: vi.fn(), onSupportClick: vi.fn(),
    }} />);

    const sheets = container.querySelectorAll('.landing-sheet');
    expect(sheets).toHaveLength(1);
    const sheet = sheets[0] as HTMLElement;
    expect(sheet.querySelector('.landing-manuscript-title')).toHaveTextContent('Opening draft');
    expect(within(sheet).getByRole('heading', { name: /see what writing looks like/i })).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: /your writing is private/i })).toBeInTheDocument();
    expect(within(sheet).getByText('Start with one note.')).toBeInTheDocument();
    // The hero stays on the page, outside the sheet.
    expect(sheet.querySelector('.landing-headline')).toBeNull();
    // No editor toolbar picture, no note cards and no ornament dots in the sheet.
    expect(sheet.querySelector('.landing-manuscript-toolbar, .note-card')).toBeNull();
    expect(sheet).not.toHaveTextContent(/· · ·|•/);
  });

  it('gives each sample a one-line plain-text preview, not markup', () => {
    renderLanding();
    const openers = screen.getAllByRole('button', { name: /^open “.+” in the practice space$/i });
    for (const opener of openers) {
      const preview = opener.querySelector('.landing-sample-preview')!;
      expect(preview.textContent!.length).toBeGreaterThan(0);
      expect(preview.textContent).not.toMatch(/[<>]/);
    }
  });

  it('the index.html shell carries the same hero copy as the page', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    const shell = new DOMParser().parseFromString(html, 'text/html');
    const shellIntro = shell.querySelector('.boot-intro') as HTMLElement;
    const normalise = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

    const { container } = render(<LandingPage {...{
      onStartWriting: vi.fn(), onSignIn: vi.fn(), theme: 'dark' as const, onThemeToggle: vi.fn(),
      onDemoClick: vi.fn(), onDemoDraftClick: vi.fn(), onSecurityClick: vi.fn(),
      onChangelogClick: vi.fn(), onRoadmapClick: vi.fn(), onPrivacyClick: vi.fn(),
      onTermsClick: vi.fn(), onSupportClick: vi.fn(),
    }} />);

    expect(normalise(shellIntro.querySelector('h1')!.textContent)).toBe(
      normalise(container.querySelector('.landing-headline')!.textContent)
    );
    const shellSubs = Array.from(shellIntro.querySelectorAll('p:not(.boot-micro)')).map((p) => normalise(p.textContent));
    const pageSubs = Array.from(container.querySelectorAll('.landing-sub')).map((p) => normalise(p.textContent));
    expect(shellSubs).toEqual(pageSubs);
    expect(normalise(shellIntro.querySelector('.boot-micro')!.textContent)).toBe(
      normalise(container.querySelector('.landing-micro')!.textContent)
    );
    // The security detail lives in the privacy section now; the proof line still links to it.
    expect(shellIntro.querySelector('a[href="/security"]')).toBeNull();
    expect(html).not.toMatch(/not even us/i);
  });

  it('the proof-facts line still links where it did, in the page and the shell', () => {
    const props = renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /^encrypted before it syncs$/i }));
    expect(props.onSecurityClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /^free and open source$/i })).toHaveAttribute(
      'href',
      'https://github.com/anbuneel/yidhan/blob/main/LICENSE'
    );

    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    const proof = new DOMParser().parseFromString(html, 'text/html').querySelector('.boot-proof')!;
    const links = Array.from(proof.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([['Free and open source', 'https://github.com/anbuneel/yidhan/blob/main/LICENSE']]);
  });

  it('every Try writing opens the Practice Space draft and never an in-page editor', () => {
    const props = renderLanding();

    const buttons = screen.getAllByRole('button', { name: /try writing/i });
    // The two labelled buttons plus the preview overlay.
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => fireEvent.click(button));

    expect(props.onDemoDraftClick).toHaveBeenCalledTimes(3);
    expect(props.onStartWriting).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('the keep-and-sync link opens sign-up without also opening the draft', () => {
    const props = renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /create an account to keep and sync/i }));

    expect(props.onStartWriting).toHaveBeenCalledTimes(1);
    expect(props.onDemoDraftClick).not.toHaveBeenCalled();
  });

  it('shows three sample notes, none of them the welcome or the hero note', () => {
    const props = renderLanding();

    const openers = screen.getAllByRole('button', { name: /^open “.+” in the practice space$/i });
    expect(openers).toHaveLength(3);
    expect(screen.queryByText('Welcome to Yidhan')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Opening draft' })).not.toBeInTheDocument();

    fireEvent.click(openers[0]);
    expect(props.onDemoClick).toHaveBeenCalledTimes(1);
  });

  it('routes a plain click on Browse sample notes in-app but leaves a modified click to the browser', () => {
    const props = renderLanding();
    const link = screen.getByRole('link', { name: /browse sample notes/i });
    expect(link).toHaveAttribute('href', '/demo');

    fireEvent.click(link, { metaKey: true });
    expect(props.onDemoClick).not.toHaveBeenCalled();

    fireEvent.click(link);
    expect(props.onDemoClick).toHaveBeenCalledTimes(1);
  });

  it('the encryption fact and the encryption link both reach the security page', () => {
    const props = renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /encrypted before it syncs/i }));
    fireEvent.click(screen.getByRole('link', { name: /how encryption works/i }));

    expect(props.onSecurityClick).toHaveBeenCalledTimes(2);
  });

  it('the open-source fact links to the licence, not just the repository', () => {
    renderLanding();

    expect(screen.getByRole('link', { name: /free and open source/i })).toHaveAttribute(
      'href',
      'https://github.com/anbuneel/yidhan/blob/main/LICENSE'
    );
  });

  it('the header sign-in reaches sign-in, not sign-up', () => {
    const props = renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(props.onSignIn).toHaveBeenCalledTimes(1);
    expect(props.onStartWriting).not.toHaveBeenCalled();
  });
});
