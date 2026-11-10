/**
 * WCAG 2 contrast for the theme tokens. Used by the token tests; not shipped.
 *
 * Colours are `#rgb`, `#rrggbb` or `rgba(r, g, b, a)`. A translucent colour is blended
 * over the surface it sits on before the ratio is taken.
 */

export type Rgba = [number, number, number, number];

export function parseColor(value: string): Rgba {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  throw new Error(`Not a colour the contrast check reads: ${value}`);
}

/** `top` over an opaque `bottom`. */
export function blend(top: string, bottom: string): string {
  const [r, g, b, a] = parseColor(top);
  const [r2, g2, b2, a2] = parseColor(bottom);
  if (a2 !== 1) throw new Error(`Blend base must be opaque: ${bottom}`);
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(mix(r, r2))}${hex(mix(g, g2))}${hex(mix(b, b2))}`;
}

function luminance(value: string): number {
  const [r, g, b, a] = parseColor(value);
  if (a !== 1) throw new Error(`Blend translucent colours first: ${value}`);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(foreground: string, background: string): number {
  const fg = parseColor(foreground)[3] === 1 ? foreground : blend(foreground, background);
  const a = luminance(fg);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
