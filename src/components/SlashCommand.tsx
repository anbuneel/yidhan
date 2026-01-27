import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

// Timestamp formatting functions
function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateTime(): string {
  return `${formatDate()} at ${formatTime()}`;
}

// Slash command icons
const icons = {
  heading1: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8" />
    </svg>
  ),
  heading2: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10" />
    </svg>
  ),
  heading3: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h6" />
    </svg>
  ),
  bulletList: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h.01M8 6h12M4 12h.01M8 12h12M4 18h.01M8 18h12" />
    </svg>
  ),
  numberedList: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h.01M8 6h12M4 12h.01M8 12h12M4 18h.01M8 18h12" />
      <text x="2" y="7" fontSize="5" fill="currentColor" stroke="none">1</text>
    </svg>
  ),
  todoList: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  quote: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
    </svg>
  ),
  code: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  highlight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  divider: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
    </svg>
  ),
  date: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  time: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  now: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// Slash command items
interface SlashCommandItem {
  title: string;
  description: string;
  icon: ReactNode;
  searchTerms: string[];
  command: (props: { editor: SuggestionProps['editor']; range: SuggestionProps['range'] }) => void;
}

const slashCommandItems: SlashCommandItem[] = [
  // Headings
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: icons.heading1,
    searchTerms: ['h1', 'heading', 'title', 'large'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: icons.heading2,
    searchTerms: ['h2', 'heading', 'subtitle', 'medium'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: icons.heading3,
    searchTerms: ['h3', 'heading', 'small'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  // Lists
  {
    title: 'Bullet List',
    description: 'Create a bullet point list',
    icon: icons.bulletList,
    searchTerms: ['bullet', 'list', 'unordered', 'ul'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: icons.numberedList,
    searchTerms: ['numbered', 'list', 'ordered', 'ol', 'number'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Todo List',
    description: 'Create a task checklist',
    icon: icons.todoList,
    searchTerms: ['todo', 'task', 'checkbox', 'check', 'checklist'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  // Block formatting
  {
    title: 'Quote',
    description: 'Add a block quote',
    icon: icons.quote,
    searchTerms: ['quote', 'blockquote', 'callout'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Add a code snippet',
    icon: icons.code,
    searchTerms: ['code', 'codeblock', 'pre', 'snippet'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Highlight',
    description: 'Highlight text with color',
    icon: icons.highlight,
    searchTerms: ['highlight', 'mark', 'background', 'color'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHighlight().run();
    },
  },
  // Divider
  {
    title: 'Divider',
    description: 'Insert horizontal line',
    icon: icons.divider,
    searchTerms: ['divider', 'hr', 'line', 'separator'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  // Timestamps
  {
    title: 'Date',
    description: 'Insert current date',
    icon: icons.date,
    searchTerms: ['date', 'today', 'day'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(formatDate()).run();
    },
  },
  {
    title: 'Time',
    description: 'Insert current time',
    icon: icons.time,
    searchTerms: ['time', 'clock', 'hour'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(formatTime()).run();
    },
  },
  {
    title: 'Now',
    description: 'Insert date and time',
    icon: icons.now,
    searchTerms: ['now', 'timestamp', 'datetime'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(formatDateTime()).run();
    },
  },
];

// Filter items based on query
function filterItems(query: string): SlashCommandItem[] {
  const lowerQuery = query.toLowerCase();
  return slashCommandItems.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(lowerQuery);
    const searchMatch = item.searchTerms.some((term) => term.includes(lowerQuery));
    return titleMatch || searchMatch;
  });
}

// Command list component ref type
interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

// Command list props
interface CommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

// Command list dropdown component
const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Ensure selected index is always valid
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
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: '200px',
        }}
      >
        {items.map((item, index) => (
          <button
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
);

CommandList.displayName = 'CommandList';

// Create the slash command extension
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({
          editor,
          range,
          props,
        }: {
          editor: SuggestionProps['editor'];
          range: SuggestionProps['range'];
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => filterItems(query),
        render: () => {
          let component: ReactRenderer<CommandListRef> | null = null;
          let popup: HTMLDivElement | null = null;

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(CommandList, {
                props: {
                  items: props.items as SlashCommandItem[],
                  command: (item: SlashCommandItem) => {
                    props.command(item);
                  },
                },
                editor: props.editor,
              });

              popup = document.createElement('div');
              popup.style.position = 'fixed';
              popup.style.zIndex = '50';
              document.body.appendChild(popup);
              popup.appendChild(component.element);

              const rect = props.clientRect?.();
              if (rect) {
                popup.style.left = `${rect.left}px`;
                popup.style.top = `${rect.bottom + 8}px`;
              }
            },

            onUpdate: (props: SuggestionProps) => {
              if (component) {
                component.updateProps({
                  items: props.items as SlashCommandItem[],
                  command: (item: SlashCommandItem) => {
                    props.command(item);
                  },
                });
              }

              if (popup && props.clientRect) {
                const rect = props.clientRect();
                if (rect) {
                  popup.style.left = `${rect.left}px`;
                  popup.style.top = `${rect.bottom + 8}px`;
                }
              }
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                popup?.remove();
                component?.destroy();
                return true;
              }

              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              popup?.remove();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
