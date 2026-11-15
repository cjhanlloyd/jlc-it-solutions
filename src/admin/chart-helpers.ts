// Pure helpers for the dashboard charts (src/admin/charts.tsx): axis ticks, bucket labels, doughnut arcs, status grouping.

// 0-based "nice" (1-2-5) ticks covering max, at most 6. `integer` keeps steps ≥ 1 for counts.
export function niceTicks(max: number, integer = false): number[] {
  if (!(max > 0)) return [0, 1];
  const mag = 10 ** Math.floor(Math.log10(max / 5));
  let step = [1, 2, 5, 10].map((f) => f * mag).find((s) => Math.ceil(max / s - 1e-9) <= 5) ?? 10 * mag;
  if (integer) step = Math.max(1, step);
  const n = Math.ceil(max / step - 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => +(i * step).toPrecision(12));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-11-12" → "Nov 12", "2026-11" → "Nov 2026"
export function bucketLabel(key: string): string {
  const [y, m, d] = key.split('-');
  return d ? `${MONTHS[+m - 1]} ${+d}` : `${MONTHS[+m - 1]} ${y}`;
}

// Which bucket indexes get an x-axis label, so no more than `max` labels show
export function tickIndexes(n: number, max = 8): number[] {
  const step = Math.ceil(n / max);
  return Array.from({ length: n }, (_, i) => i).filter((i) => i % step === 0);
}

// Axis tick for a centavo amount: ₱500, ₱2.5k
export function moneyTick(centavos: number): string {
  const p = centavos / 100;
  return p >= 1000 ? `₱${+(p / 1000).toFixed(1)}k` : `₱${+p.toFixed(2)}`;
}

// Slice angles (radians, clockwise from 12 o'clock). Zero slices and a zero total produce no arcs.
export function doughnutArcs(values: number[]): { index: number; start: number; end: number }[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return [];
  let at = 0;
  const out: { index: number; start: number; end: number }[] = [];
  values.forEach((v, index) => {
    if (v <= 0) return;
    const start = at;
    at += (v / total) * 2 * Math.PI;
    out.push({ index, start, end: at });
  });
  return out;
}

const pt = (cx: number, cy: number, r: number, a: number) => `${+(cx + r * Math.sin(a)).toFixed(3)} ${+(cy - r * Math.cos(a)).toFixed(3)}`;

// SVG path for a ring segment; a full turn is drawn as two opposite circles so it has a hole and no seam
export function arcPath(cx: number, cy: number, r: number, ri: number, start: number, end: number): string {
  if (end - start >= 2 * Math.PI - 1e-6) {
    return `M${pt(cx, cy, r, 0)}A${r} ${r} 0 1 1 ${pt(cx, cy, r, Math.PI)}A${r} ${r} 0 1 1 ${pt(cx, cy, r, 0)}Z`
      + `M${pt(cx, cy, ri, 0)}A${ri} ${ri} 0 1 0 ${pt(cx, cy, ri, Math.PI)}A${ri} ${ri} 0 1 0 ${pt(cx, cy, ri, 0)}Z`;
  }
  const large = end - start > Math.PI ? 1 : 0;
  return `M${pt(cx, cy, r, start)}A${r} ${r} 0 ${large} 1 ${pt(cx, cy, r, end)}L${pt(cx, cy, ri, end)}A${ri} ${ri} 0 ${large} 0 ${pt(cx, cy, ri, start)}Z`;
}

// The 10 order statuses as 5 fixed slices (chart rules): order and colour never change, zero slices stay listed
const STATUS_SLICES: { label: string; color: string; statuses: string[] }[] = [
  { label: 'Awaiting payment', color: '#2a78d6', statuses: ['pending_payment', 'payment_verification'] },
  { label: 'In progress', color: '#eb6834', statuses: ['payment_confirmed', 'in_production', 'for_review', 'revision_requested', 'completed'] },
  { label: 'Delivered', color: '#1baf7a', statuses: ['delivered'] },
  { label: 'Cancelled', color: '#eda100', statuses: ['cancelled'] },
  { label: 'Refunded', color: '#e87ba4', statuses: ['refunded'] },
];
export function groupStatusMix(mix: { status: string; count: number }[]): { label: string; value: number; color: string }[] {
  return STATUS_SLICES.map(({ label, color, statuses }) => ({
    label, color, value: mix.filter((m) => statuses.includes(m.status)).reduce((a, m) => a + m.count, 0),
  }));
}

// Roving focus inside a chart: the active mark after a key press, or undefined when the key does nothing
export function nextIndex(key: string, current: number | null, n: number): number | undefined {
  if (n <= 0) return undefined;
  const next = ({
    ArrowRight: (current ?? -1) + 1, ArrowDown: (current ?? -1) + 1,
    ArrowLeft: (current ?? n) - 1, ArrowUp: (current ?? n) - 1,
    Home: 0, End: n - 1,
  } as Record<string, number>)[key];
  return next === undefined ? undefined : Math.min(n - 1, Math.max(0, next));
}
