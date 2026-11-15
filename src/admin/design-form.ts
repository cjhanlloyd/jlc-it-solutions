// Pure helpers for the portal design editor (React-free so tests can import them).

/** "Rose & Gold Wedding!" → "rose-gold-wedding", cut to max without a trailing dash. */
export function slugify(s: string, max = 60): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}

/** Peso text from an input ("1,499.50") → integer centavos; blank or not a number → NaN (validatePackages rejects it). */
export function pesosToCentavos(text: string): number {
  const t = text.replace(/[,\s₱]/g, '');
  return t && /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : NaN;
}

export const centavosToPesos = (c: number) => String(c / 100);

/** Copy of list with item i moved by d (-1 up, +1 down); out-of-range moves return the list unchanged. */
export function move<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (i < 0 || j < 0 || i >= list.length || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
