import { type ComponentProps, type ReactNode } from 'react';
import { Header } from './Header';
import { TagFilterBar } from './TagFilterBar';
import { ChapteredLibrary } from './ChapteredLibrary';
import { Footer } from './Footer';

/**
 * The library screen: header, tag filter, the chaptered notes, footer.
 *
 * Each region takes its component's own props verbatim rather than a flattened list,
 * so adding a prop to `Header` never means adding it here too. Everything that floats
 * above the screen arrives through `modals`, which is how the editor view shares the
 * same stack without this component knowing what is in it.
 */
export interface LibraryScreenProps {
  header: ComponentProps<typeof Header>;
  tagFilter: ComponentProps<typeof TagFilterBar>;
  library: ComponentProps<typeof ChapteredLibrary>;
  footer: ComponentProps<typeof Footer>;
  modals?: ReactNode;
}

export function LibraryScreen({ header, tagFilter, library, footer, modals }: LibraryScreenProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <Header {...header} />
      <div
        id="main-content"
        className="w-full flex-1 flex flex-col"
        style={{ maxWidth: '1400px', margin: '0 auto' }}
      >
        <TagFilterBar {...tagFilter} />
        <ChapteredLibrary {...library} />
      </div>
      <Footer {...footer} />
      {modals}
    </div>
  );
}
