import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
  type Ref,
} from 'react';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: ReactNode;
  searchTerms: string[];
  command: (props: { editor: SuggestionProps['editor']; range: SuggestionProps['range'] }) => void;
}

export interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface CommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  ref?: Ref<CommandListRef>;
}

export function CommandList({ items, command, ref }: CommandListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  const safeSelectedIndex = items.length > 0 ? selectedIndex % items.length : 0;

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    [items, command]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        if (items.length === 0) return true;
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
        if (items.length === 0) return true;
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }

      if (event.key === 'Enter') {
        selectItem(safeSelectedIndex);
        return true;
      }

      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div
        className="slash-command-menu"
        role="menu"
        aria-label="Editor commands"
      >
        <div
          className="text-sm"
          style={{ color: 'var(--color-text-tertiary)', padding: '4px 8px' }}
        >
          No results
        </div>
      </div>
    );
  }

  return (
    <div
      className="slash-command-menu"
      role="menu"
      aria-label="Editor commands"
    >
      {items.map((item, index) => (
        <button type="button"
          key={item.title}
          onClick={() => selectItem(index)}
          className="slash-command-item"
          role="menuitem"
          aria-current={index === safeSelectedIndex ? 'true' : undefined}
          style={{
            background: index === safeSelectedIndex ? 'var(--color-bg-tertiary)' : 'transparent',
            fontFamily: 'var(--font-body)',
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span
            className="mt-0.5 shrink-0 opacity-60"
            style={{ color: 'var(--color-accent)' }}
          >
            {item.icon}
          </span>
          <div className="min-w-0">
            <div
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {item.title}
            </div>
            <div
              className="text-xs"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {item.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
