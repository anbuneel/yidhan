import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { exitSuggestion } from '@tiptap/suggestion';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { SLASH_EDITOR_COMMANDS } from '../editor/editorCommands';
import { getSlashMenuPosition } from '../editor/slashMenuPosition';
import { CommandList, type CommandListRef, type SlashCommandItem } from './SlashCommandList';

const slashCommandItems: SlashCommandItem[] = SLASH_EDITOR_COMMANDS.map((definition) => ({
  title: definition.label,
  description: definition.description,
  icon: definition.shortLabel,
  searchTerms: [definition.id, ...definition.searchTerms],
  command: ({ editor, range }) => definition.run({ editor }, range),
}));

function filterItems(query: string): SlashCommandItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return slashCommandItems.filter((item) => (
    item.title.toLocaleLowerCase().includes(normalizedQuery)
    || item.searchTerms.some((term) => term.toLocaleLowerCase().includes(normalizedQuery))
  ));
}

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
        }) => props.command({ editor, range }),
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
          let latestProps: SuggestionProps | null = null;

          const positionPopup = () => {
            const anchor = latestProps?.clientRect?.();
            if (!popup || !anchor) return;
            const menu = popup.getBoundingClientRect();
            const position = getSlashMenuPosition(anchor, menu, {
              width: window.innerWidth,
              height: window.innerHeight,
            });
            popup.style.left = `${position.left}px`;
            popup.style.top = `${position.top}px`;
            popup.style.maxHeight = `${position.maxHeight}px`;
            popup.dataset.placement = position.placement;
          };

          const destroyPopup = () => {
            document.removeEventListener('scroll', positionPopup, true);
            window.removeEventListener('resize', positionPopup);
            popup?.remove();
            component?.destroy();
            popup = null;
            component = null;
            latestProps = null;
          };

          const updateComponent = (props: SuggestionProps) => {
            latestProps = props;
            component?.updateProps({
              items: props.items as SlashCommandItem[],
              command: (item: SlashCommandItem) => props.command(item),
            });
            positionPopup();
          };

          return {
            onStart: (props: SuggestionProps) => {
              latestProps = props;
              component = new ReactRenderer(CommandList, {
                props: {
                  items: props.items as SlashCommandItem[],
                  command: (item: SlashCommandItem) => props.command(item),
                },
                editor: props.editor,
              });
              popup = document.createElement('div');
              popup.dataset.editorPopover = 'slash';
              popup.className = 'slash-command-popup';
              popup.style.position = 'fixed';
              popup.style.zIndex = '50';
              popup.appendChild(component.element);
              document.body.appendChild(popup);
              document.addEventListener('scroll', positionPopup, true);
              window.addEventListener('resize', positionPopup);
              positionPopup();
              requestAnimationFrame(positionPopup);
            },
            onUpdate: updateComponent,
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                props.event.preventDefault();
                props.event.stopPropagation();
                exitSuggestion(props.view);
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: destroyPopup,
          };
        },
      }),
    ];
  },
});
