// Tags in the filter row are words, not chips: no border, fill or blur. The active
// filter is the only coloured item, in --color-accent-text with an underline.
export const tagWordClass = `
  relative
  inline-flex items-center
  min-h-11 sm:min-h-9
  px-1
  text-sm
  underline-offset-[6px] decoration-1
  transition-colors duration-150
  focus-ring
  shrink-0
`;

export function tagWordStyle(isActive: boolean) {
  return {
    fontFamily: 'var(--font-body)',
    color: isActive ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
    textDecorationLine: isActive ? 'underline' : 'none',
  } as const;
}
