// Pure cover-photo rules for the studio: drag and keyboard positioning, following photo moves, text readability.
import { contrast, remapCover, type Cover, type InvitationStyle } from '../../../shared/invitation-style.ts';
import { MIN_OVERLAY, coverText, resolveCoverIndex } from '../style-render.ts';

type Focus = { x: number; y: number };
const clamp = (n: number) => Math.min(100, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

// The photo follows the pointer, so the focal point moves the other way. dx/dy are screen px; w/h are the hero's
// unscaled size, so dividing by the preview scale turns screen px into render px.
export const dragFocus = (start: Focus, dx: number, dy: number, scale: number, w: number, h: number): Focus => ({
  x: round1(clamp(start.x - (dx / scale / w) * 100)),
  y: round1(clamp(start.y - (dy / scale / h) * 100)),
});

const NUDGE: Record<string, [number, number]> = { ArrowLeft: [2, 0], ArrowRight: [-2, 0], ArrowUp: [0, 2], ArrowDown: [0, -2] };
// Arrow keys move the photo 2% in the arrow's direction; null for any other key.
export function nudgeFocus(f: Focus, key: string): Focus | null {
  const d = NUDGE[key];
  return d ? { x: clamp(f.x + d[0]), y: clamp(f.y + d[1]) } : null;
}

// Photos were reordered, added or removed: the cover index follows the same photo, or the cover is dropped.
export const followCover = (style: InvitationStyle, oldPhotos: string[], newPhotos: string[]): InvitationStyle =>
  resolveCoverIndex(remapCover(style, oldPhotos, newPhotos), newPhotos);

export const READABLE = 4.5;
const MAX_STRENGTH = 0.8;

export function averageRgb(data: ArrayLike<number>): number[] {
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += data[i + c];
  const n = Math.max(1, data.length / 4);
  return sum.map((v) => v / n);
}

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// Hero text against the photo's average colour under the overlay, as the browser composites it (sRGB alpha blend).
export function coverContrast(avg: number[], c: Pick<Cover, 'tone' | 'strength'>, primary: string): number {
  const s = Math.max(c.strength, MIN_OVERLAY);
  const tone = c.tone === 'dark' ? [0, 0, 0] : c.tone === 'light' ? [255, 255, 255] : rgb(primary);
  return contrast(coverText(c.tone, primary).color, hex(avg.map((v, i) => v * (1 - s) + tone[i] * s)));
}

// The smallest overlay, in 5% steps, that makes the text readable; the maximum when none does.
export function strengthToRead(avg: number[], c: Pick<Cover, 'tone' | 'strength'>, primary: string): number {
  for (let s = Math.max(c.strength, MIN_OVERLAY); s < MAX_STRENGTH; s = Math.round((s + 0.05) * 100) / 100) {
    if (coverContrast(avg, { tone: c.tone, strength: s }, primary) >= READABLE) return s;
  }
  return MAX_STRENGTH;
}
