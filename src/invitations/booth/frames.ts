// Photo booth frames as pure drawing on a 2D context, so the live preview, the saved photo and the organiser's thumbnails match.
// Every frame paints only its border and text: the photo underneath shows through wherever a frame draws nothing.
import type { BoothFrame } from '../../../shared/extras';

export const BOOTH_W = 1080;
export const BOOTH_H = 1350;
export type FrameOpts = { primary: string; accent: string; background: string; text: string; headline: string; kicker: string; date: string; serif?: string };
export type Rect = { x: number; y: number; w: number; h: number };
type Ctx = CanvasRenderingContext2D;

const SANS = "'Jost', 'Segoe UI', system-ui, sans-serif";
const serifOf = (o: FrameOpts) => o.serif || "Georgia, 'Times New Roman', serif";

// The centred part of a srcW×srcH image that fills dstW×dstH without stretching (CSS object-fit: cover).
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  if (!(srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0)) return { sx: 0, sy: 0, sw: Math.max(srcW, 0), sh: Math.max(srcH, 0) };
  const k = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / k, sh = dstH / k;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

// The largest size from maxPx down to minPx (2 px steps) where text fits maxW; at minPx, the text is cut with an ellipsis.
export function fitText(ctx: Pick<Ctx, 'font' | 'measureText'>, text: string, maxW: number, maxPx: number, minPx: number, font: (px: number) => string) {
  for (let px = maxPx; ; px = Math.max(minPx, px - 2)) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= maxW) return { px, text };
    if (px <= minPx) break;
  }
  ctx.font = font(minPx);
  const chars = Array.from(text);
  while (chars.length && ctx.measureText(chars.join('').trimEnd() + '…').width > maxW) chars.pop();
  return { px: minPx, text: chars.length ? chars.join('').trimEnd() + '…' : '' };
}

// Where the photo goes: the whole canvas, except inside the polaroid's white border.
export function photoRect(frame: BoothFrame, w: number, h: number): Rect {
  if (frame !== 'polaroid') return { x: 0, y: 0, w, h };
  const b = Math.round(w * 0.06);
  return { x: b, y: b, w: w - 2 * b, h: h - b - Math.round(h * 0.2) };
}

// Draws a camera frame (or any image) cover-cropped into r, mirrored like a selfie camera by default.
export function drawPhoto(ctx: Ctx, src: CanvasImageSource, srcW: number, srcH: number, r: Rect, mirror = true) {
  const c = coverCrop(srcW, srcH, r.w, r.h);
  ctx.save();
  ctx.translate(r.x + (mirror ? r.w : 0), r.y);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(src, c.sx, c.sy, c.sw, c.sh, 0, 0, r.w, r.h);
  ctx.restore();
}

// One centred line, shrunk (then cut) to fit maxW; returns nothing for empty text.
function line(ctx: Ctx, text: string, cx: number, y: number, maxW: number, maxPx: number, font: (px: number) => string, color: string) {
  if (!text) return;
  const f = fitText(ctx, text, maxW, maxPx, Math.min(maxPx, Math.max(10, Math.round(maxPx * 0.45))), font);
  ctx.font = font(f.px);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(f.text, cx, y);
}

// A translucent band in the scheme's background colour with kicker, headline and date, for classic and floral.
// Text sits between top and h - inset, so a border along the bottom edge stays clear of it.
function titleBand(ctx: Ctx, w: number, h: number, o: FrameOpts, top: number, inset: number, maxW: number, italic: boolean, kicker: boolean) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = o.background;
  ctx.fillRect(0, top, w, h - top);
  ctx.restore();
  const bh = h - inset - top, cx = w / 2;
  const headline = o.headline || 'Celebrate';
  const hasKicker = kicker && !!o.kicker;
  if (hasKicker) line(ctx, o.kicker.toUpperCase(), cx, top + bh * 0.26, maxW, Math.round(w * 0.026), (px) => `600 ${px}px ${SANS}`, o.text);
  line(ctx, headline, cx, top + bh * (hasKicker ? 0.64 : 0.56), maxW, Math.round(w * 0.075), (px) => `${italic ? 'italic ' : ''}500 ${px}px ${serifOf(o)}`, o.text);
  line(ctx, o.date, cx, top + bh * (hasKicker ? 0.9 : 0.86), maxW, Math.round(w * 0.03), (px) => `500 ${px}px ${SANS}`, o.text);
}

function classic(ctx: Ctx, w: number, h: number, o: FrameOpts) {
  titleBand(ctx, w, h, o, Math.round(h * 0.75), w * 0.075, w * 0.78, false, true);
  const m = w * 0.035, m2 = m + w * 0.022;
  ctx.strokeStyle = o.accent;
  ctx.lineWidth = w * 0.008;
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  ctx.lineWidth = w * 0.003;
  ctx.strokeRect(m2, m2, w - 2 * m2, h - 2 * m2);
}

function polaroid(ctx: Ctx, w: number, h: number, o: FrameOpts) {
  const r = photoRect('polaroid', w, h);
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, w, r.y);
  ctx.fillRect(0, r.y + r.h, w, h - r.y - r.h);
  ctx.fillRect(0, r.y, r.x, r.h);
  ctx.fillRect(r.x + r.w, r.y, w - r.x - r.w, r.h);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  const bottom = r.y + r.h, bh = h - bottom, maxW = r.w * 0.92;
  line(ctx, o.headline || 'Celebrate', w / 2, bottom + bh * 0.5, maxW, Math.round(w * 0.08), (px) => `italic 500 ${px}px ${serifOf(o)}`, '#2d2a26');
  line(ctx, o.date, w / 2, bottom + bh * 0.8, maxW, Math.round(w * 0.03), (px) => `500 ${px}px ${SANS}`, '#4f4a44');
}

function film(ctx: Ctx, w: number, h: number, o: FrameOpts) {
  const s = Math.round(w * 0.085), bar = Math.round(w * 0.025);
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, s, h);
  ctx.fillRect(w - s, 0, s, h);
  ctx.fillRect(s, 0, w - 2 * s, bar);
  ctx.fillRect(s, h - bar, w - 2 * s, bar);
  // Sprocket holes, evenly spaced down both strips
  const hw = s * 0.46, hh = s * 0.32, step = s * 0.78;
  const n = Math.floor((h - hh) / step);
  const y0 = (h - (n - 1) * step - hh) / 2;
  ctx.fillStyle = '#e9e4da';
  for (let i = 0; i < n; i++) {
    const y = y0 + i * step;
    ctx.fillRect((s - hw) / 2, y, hw, hh);
    ctx.fillRect(w - s + (s - hw) / 2, y, hw, hh);
  }
  // The orange date stamp of an old film camera, bottom right
  const right = w - s - w * 0.04, maxW = w - 2 * s - w * 0.08;
  ctx.fillStyle = '#ff9d3c';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  const mono = (px: number) => `700 ${px}px 'Courier New', ui-monospace, monospace`;
  const stamp = [o.headline, o.date].filter(Boolean);
  stamp.forEach((t, i) => {
    const f = fitText(ctx, t, maxW, Math.round(w * (i === stamp.length - 1 ? 0.034 : 0.042)), 12, mono);
    ctx.font = mono(f.px);
    ctx.fillText(f.text, right, h - bar - w * 0.04 - (stamp.length - 1 - i) * w * 0.055);
  });
}

// One corner's flourish, drawn for the top-left corner and mirrored into the others with sx, sy.
function flourish(ctx: Ctx, x: number, y: number, sx: number, sy: number, u: number, o: FrameOpts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.strokeStyle = o.accent;
  ctx.lineWidth = u * 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(u * 0.3, u * 4.2);
  ctx.bezierCurveTo(u * 0.4, u * 2.2, u * 1.2, u * 1.0, u * 2.6, u * 0.6);
  ctx.bezierCurveTo(u * 3.2, u * 0.45, u * 3.8, u * 0.4, u * 4.4, u * 0.3);
  ctx.moveTo(u * 1.05, u * 1.6);
  ctx.bezierCurveTo(u * 1.6, u * 1.9, u * 2.0, u * 2.3, u * 2.1, u * 2.9);
  ctx.stroke();
  // Leaves along the vine
  ctx.fillStyle = o.primary;
  for (const [lx, ly, rot] of [[0.62, 3.2, -1.2], [0.75, 2.3, -0.5], [1.75, 0.85, 0.5], [2.6, 0.95, -0.3], [3.5, 0.62, 0.2], [2.1, 2.5, 1.2], [1.55, 1.95, 0.8]]) {
    ctx.beginPath();
    ctx.ellipse(u * lx, u * ly, u * 0.4, u * 0.2, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  // A five-petal flower where the vines meet
  ctx.fillStyle = o.accent;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(u * 1.0 + Math.cos(a) * u * 0.32, u * 1.0 + Math.sin(a) * u * 0.32, u * 0.3, u * 0.17, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = o.background;
  ctx.beginPath();
  ctx.arc(u * 1.0, u * 1.0, u * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function floral(ctx: Ctx, w: number, h: number, o: FrameOpts) {
  titleBand(ctx, w, h, o, Math.round(h * 0.79), w * 0.03, w * 0.56, true, false);
  const u = w * 0.07, b = u * 0.72, m = w * 0.02; // smaller bottom corners keep clear of the title
  flourish(ctx, m, m, 1, 1, u, o);
  flourish(ctx, w - m, m, -1, 1, u, o);
  flourish(ctx, m, h - m, 1, -1, b, o);
  flourish(ctx, w - m, h - m, -1, -1, b, o);
}

export const FRAMES: Record<BoothFrame, { label: string; draw: (ctx: Ctx, w: number, h: number, o: FrameOpts) => void }> = {
  classic: { label: 'Classic', draw: classic },
  polaroid: { label: 'Polaroid', draw: polaroid },
  film: { label: 'Film strip', draw: film },
  floral: { label: 'Floral', draw: floral },
};

// A soft gradient standing in for a photo in thumbnails, before the camera starts.
export function drawPlaceholder(ctx: Ctx, r: Rect, o: Pick<FrameOpts, 'primary' | 'accent' | 'background'>) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, o.background);
  g.addColorStop(0.55, o.accent);
  g.addColorStop(1, o.primary);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}
