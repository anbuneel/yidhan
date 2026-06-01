import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import {
  useCallback,
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
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
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
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          padding: '8px',
          boxShadow: 'var(--shadow-sm)',
        }}
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
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: 'var(--shadow-sm)',
        minWidth: '200px',
      }}
    >
      {items.map((item, index) => (
        <button type="button"
          key={item.title}
          onClick={() => selectItem(index)}
          className="w-full text-left px-3 py-2 rounded-md transition-colors duration-150 flex items-start gap-3"
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
