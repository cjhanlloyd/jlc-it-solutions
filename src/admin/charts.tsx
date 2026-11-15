// Hand-built SVG charts for the dashboard: line, (stacked) bars, horizontal bars and doughnut. Colours and marks follow the dashboard chart rules.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { peso } from '../invitations/kit';
import { arcPath, bucketLabel, doughnutArcs, moneyTick, niceTicks, nextIndex, tickIndexes } from './chart-helpers';

export const SERIES_COLORS = ['#2a78d6', '#eb6834'];
const GRID = '#e2e8f0';
const TICK = '#475569'; // slate-600
const HILITE = '#f1f5f9'; // slate-100 band behind the active bar or row
const EMPTY = 'No orders in this period.';
const H = 220;
const PAD = { l: 52, r: 24, t: 10, b: 28 };
const SVG_FOCUS = 'block max-w-full rounded outline-none focus-visible:outline-2 focus-visible:outline-brand-600';

type Series = { name: string; values: number[]; money?: boolean };
type Tip = { x: number; y: number; title: string; lines: string[] } | null;

const fmt = (v: number, money?: boolean) => (money ? peso(v) : v.toLocaleString('en-PH'));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const range = (buckets: string[]) => (buckets.length ? `${bucketLabel(buckets[0])} to ${bucketLabel(buckets[buckets.length - 1])}` : '');

// Chart width in CSS px, so the viewBox matches the screen and 12px text stays 12px
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

// One tab stop per chart: arrows/Home/End move the active mark, hover or tap picks one.
// A tap keeps its tooltip until the user taps outside the chart; a mouse leaving clears it.
function useRoving(n: number, initial: 'first' | 'last' = 'first') {
  const [active, setActive] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const on = active !== null;
  useEffect(() => {
    if (!on) return;
    const outside = (e: globalThis.PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setActive(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [on]);
  const svg = {
    ref, tabIndex: 0,
    onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
      const next = nextIndex(e.key, active, n);
      if (next === undefined) return;
      e.preventDefault();
      setActive(next);
    },
    onFocus: () => setActive((a) => a ?? (initial === 'first' ? 0 : n - 1)),
    onBlur: () => setActive(null),
    onPointerLeave: (e: PointerEvent<SVGSVGElement>) => { if (e.pointerType === 'mouse') setActive(null); },
  };
  const mark = (i: number) => ({ onPointerEnter: () => setActive(i), onPointerDown: () => setActive(i) });
  return { active: active !== null && active < n ? active : null, setActive, svg, mark };
}

function Legend({ items }: { items: { label: string; color: string; text?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm" style={{ background: it.color }} />
          {it.label}{it.text && <span className="font-semibold text-slate-900">{it.text}</span>}
        </li>
      ))}
    </ul>
  );
}

// Above the mark, or below it when there is no room above, so it stays inside the chart box
function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  const below = tip.y < 24 + 18 * tip.lines.length;
  return (
    <div
      className={`pointer-events-none absolute z-10 -translate-x-1/2 ${below ? '' : '-translate-y-full'} whitespace-nowrap rounded-control border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-card`}
      style={{ left: Math.min(Math.max(tip.x, 70), width - 70), top: below ? tip.y + 10 : tip.y - 6 }}
    >
      <p className="font-semibold">{tip.title}</p>
      {tip.lines.map((l) => <p key={l} className="text-slate-700">{l}</p>)}
    </div>
  );
}

// Screen-reader echo of the active mark (focus stays on the chart, so the mark itself is not announced)
const Live = ({ text }: { text: string }) => <p aria-live="polite" className="sr-only">{text}</p>;

function DataTable({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
    </table>
  );
}

// Title, optional legend, then the chart or the empty message. The measured box stays mounted so width tracking keeps working.
function Frame({ title, legend, empty, children }: { title: string; legend?: ReactNode; empty: boolean; children: (width: number) => ReactNode }) {
  const [ref, width] = useWidth();
  return (
    <div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {!empty && legend && <div className="mt-2">{legend}</div>}
      <div ref={ref} className="relative mt-3">
        {empty ? <p className="py-8 text-center text-sm text-slate-700">{EMPTY}</p> : children(width)}
      </div>
    </div>
  );
}

// Y axis gridlines + tick labels, and thinned x labels at the given centres
function Axes({ width, ticks, y, money, buckets, x }: { width: number; ticks: number[]; y: (v: number) => number; money?: boolean; buckets: string[]; x: (i: number) => number }) {
  const show = tickIndexes(buckets.length, Math.min(8, Math.max(2, Math.floor((width - PAD.l - PAD.r) / 64))));
  return (
    <g fontSize="12" fill={TICK}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
          <text x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end">{money ? moneyTick(t) : t.toLocaleString('en-PH')}</text>
        </g>
      ))}
      {show.map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{bucketLabel(buckets[i])}</text>)}
    </g>
  );
}

// Bar with 4px rounded corners on the data end only (top, or right when horizontal)
function barPath(x: number, y: number, w: number, h: number, round: boolean, horizontal = false) {
  const r = round ? Math.min(4, w / 2, h / 2) : 0;
  if (horizontal) return `M${x} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${r - w}Z`;
  return `M${x} ${y + h}v${r - h}a${r} ${r} 0 0 1 ${r} ${-r}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - r}Z`;
}

const KEYS_HINT = 'Use the arrow keys to read each value.';

export function LineChart({ title, buckets, series }: { title: string; buckets: string[]; series: Series[] }) {
  const n = buckets.length;
  const { active, setActive, svg } = useRoving(n, 'last');
  const all = series.flatMap((s) => s.values);
  const money = series.some((s) => s.money);
  const empty = !n || !all.some((v) => v > 0);
  const total = sum(all);
  const legend = series.length > 1 ? <Legend items={series.map((s, i) => ({ label: s.name, color: SERIES_COLORS[i] }))} /> : undefined;
  return (
    <Frame title={title} legend={legend} empty={empty}>
      {(width) => {
        const ticks = niceTicks(Math.max(...all), !money);
        const top = ticks[ticks.length - 1];
        const plotW = width - PAD.l - PAD.r;
        const x = (i: number) => PAD.l + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
        const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top);
        // Nearest bucket to the pointer; pointerdown covers a tap, which fires no move
        const pick = (e: PointerEvent<SVGSVGElement>) => {
          const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
          setActive(n === 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round(((px - PAD.l) * (n - 1)) / plotW))));
        };
        return (
          <>
            <svg
              {...svg} viewBox={`0 0 ${width} ${H}`} width={width} height={H} className={`${SVG_FOCUS} touch-pan-y`} role="img"
              aria-label={`${title}, ${range(buckets)}, total ${fmt(total, money)}. ${KEYS_HINT}`}
              onPointerMove={pick} onPointerDown={pick}
            >
              <Axes width={width} ticks={ticks} y={y} money={money} buckets={buckets} x={x} />
              {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={H - PAD.b} stroke={TICK} strokeWidth="1" strokeDasharray="3 3" />}
              {series.map((s, si) => (
                <g key={s.name}>
                  <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={SERIES_COLORS[si]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {active !== null && <circle cx={x(active)} cy={y(s.values[active])} r="4.5" fill={SERIES_COLORS[si]} stroke="#fff" strokeWidth="2" />}
                </g>
              ))}
            </svg>
            <Live text={active !== null ? `${bucketLabel(buckets[active])}: ${series.map((s) => `${s.name} ${fmt(s.values[active], s.money)}`).join(', ')}` : ''} />
            <Tooltip width={width} tip={active === null ? null : {
              x: x(active), y: Math.min(...series.map((s) => y(s.values[active]))), title: bucketLabel(buckets[active]),
              lines: series.map((s) => `${s.name}: ${fmt(s.values[active], s.money)}`),
            }} />
            <DataTable title={title} head={['Period', ...series.map((s) => s.name)]} rows={buckets.map((b, i) => [bucketLabel(b), ...series.map((s) => fmt(s.values[i], s.money))])} />
          </>
        );
      }}
    </Frame>
  );
}

export function BarChart({ title, buckets, series, stacked = false }: { title: string; buckets: string[]; series: Series[]; stacked?: boolean }) {
  const n = buckets.length;
  const { active, svg, mark } = useRoving(n);
  const money = series.some((s) => s.money);
  const totals = buckets.map((_, i) => sum(series.map((s) => s.values[i])));
  const empty = !n || !totals.some((v) => v > 0);
  const legend = series.length > 1 ? <Legend items={series.map((s, i) => ({ label: s.name, color: SERIES_COLORS[i] }))} /> : undefined;
  const describe = (i: number) => `${bucketLabel(buckets[i])}: ${series.map((s) => `${fmt(s.values[i], s.money)} ${s.name.toLowerCase()}`).join(', ')}`;
  return (
    <Frame title={title} legend={legend} empty={empty}>
      {(width) => {
        const ticks = niceTicks(Math.max(...(stacked ? totals : series.flatMap((s) => s.values))), !money);
        const top = ticks[ticks.length - 1];
        const plotW = width - PAD.l - PAD.r;
        const plotH = H - PAD.t - PAD.b;
        const band = plotW / n;
        const x = (i: number) => PAD.l + (i + 0.5) * band;
        const y = (v: number) => PAD.t + plotH * (1 - v / top);
        const groupW = Math.max(1, Math.min(band - 2, 28)); // thin bars, 2px gap between neighbours
        const barW = stacked ? groupW : Math.max(1, (groupW - 2 * (series.length - 1)) / series.length);
        const peak = (i: number) => (stacked ? totals[i] : Math.max(...series.map((s) => s.values[i])));
        return (
          <>
            <svg {...svg} viewBox={`0 0 ${width} ${H}`} width={width} height={H} className={SVG_FOCUS} role="img"
              aria-label={`${title}, ${range(buckets)}, total ${fmt(sum(totals), money)}. ${KEYS_HINT}`}>
              {active !== null && <rect x={x(active) - band / 2} y={PAD.t} width={band} height={plotH} fill={HILITE} />}
              <Axes width={width} ticks={ticks} y={y} money={money} buckets={buckets} x={x} />
              {buckets.map((b, i) => {
                const left = x(i) - groupW / 2;
                let base = 0;
                const topSeries = series.map((s) => s.values[i] > 0).lastIndexOf(true);
                return (
                  <g key={b}>
                    {series.map((s, si) => {
                      const v = s.values[i];
                      if (v <= 0) return null;
                      const y0 = stacked ? base : 0;
                      if (stacked) base += v;
                      const gap = stacked && y0 > 0 ? 2 : 0; // 2px white gap between stacked segments
                      const h = Math.max(0.5, y(y0) - y(y0 + v) - gap);
                      const bx = stacked ? left : left + si * (barW + 2);
                      return <path key={s.name} d={barPath(bx, y(y0 + v), barW, h, !stacked || si === topSeries)} fill={SERIES_COLORS[si]} />;
                    })}
                    {/* hit area wider and taller than the bar */}
                    <rect x={x(i) - band / 2} y={PAD.t} width={band} height={plotH} fill="transparent" {...mark(i)} />
                  </g>
                );
              })}
            </svg>
            <Live text={active !== null ? describe(active) : ''} />
            <Tooltip width={width} tip={active === null ? null : {
              x: x(active), y: y(peak(active)), title: bucketLabel(buckets[active]),
              lines: series.map((s) => `${s.name}: ${fmt(s.values[active], s.money)}`),
            }} />
            <DataTable title={title} head={['Period', ...series.map((s) => s.name)]} rows={buckets.map((b, i) => [bucketLabel(b), ...series.map((s) => fmt(s.values[i], s.money))])} />
          </>
        );
      }}
    </Frame>
  );
}

export function HBarChart({ title, rows, unit = '' }: { title: string; rows: { label: string; value: number }[]; unit?: string }) {
  const { active, svg, mark } = useRoving(rows.length);
  const empty = !rows.some((r) => r.value > 0);
  const ROW = 40;
  const text = (v: number) => `${v.toLocaleString('en-PH')}${unit && ` ${unit}`}`;
  return (
    <Frame title={title} empty={empty}>
      {(width) => {
        const ticks = niceTicks(Math.max(...rows.map((r) => r.value)), true);
        const top = ticks[ticks.length - 1];
        const l = 8, r = 16;
        const x = (v: number) => l + ((width - l - r) * v) / top;
        const h = rows.length * ROW + 24;
        return (
          <>
            <svg {...svg} viewBox={`0 0 ${width} ${h}`} width={width} height={h} className={SVG_FOCUS} role="img"
              aria-label={`${title}: ${rows.map((row) => `${row.label} ${text(row.value)}`).join(', ')}. ${KEYS_HINT}`}>
              {active !== null && <rect x={0} y={active * ROW} width={width} height={ROW - 2} fill={HILITE} />}
              <g fontSize="12" fill={TICK}>
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={x(t)} x2={x(t)} y1={0} y2={h - 24} stroke={GRID} strokeWidth="1" />
                    <text x={x(t)} y={h - 8} textAnchor={t === top ? 'end' : t === 0 ? 'start' : 'middle'}>{t}</text>
                  </g>
                ))}
              </g>
              {rows.map((row, i) => {
                const y0 = i * ROW;
                return (
                  <g key={i}>
                    <text x={l} y={y0 + 13} fontSize="12" fill="#334155">{row.label.length > 40 ? `${row.label.slice(0, 39)}…` : row.label}</text>
                    {row.value > 0 && <path d={barPath(x(0), y0 + 18, x(row.value) - x(0), 14, true, true)} fill={SERIES_COLORS[0]} />}
                    <rect x={0} y={y0} width={width} height={ROW - 2} fill="transparent" {...mark(i)} />
                  </g>
                );
              })}
            </svg>
            <Live text={active !== null ? `${rows[active].label}: ${text(rows[active].value)}` : ''} />
            <Tooltip width={width} tip={active === null ? null : {
              x: x(rows[active].value / 2), y: active * ROW + 18, title: rows[active].label, lines: [text(rows[active].value)],
            }} />
            <DataTable title={title} head={['Name', unit || 'Value']} rows={rows.map((row) => [row.label, row.value])} />
          </>
        );
      }}
    </Frame>
  );
}

export function Doughnut({ title, slices, unit }: { title: string; slices: { label: string; value: number; color: string }[]; unit: string }) {
  const arcs = doughnutArcs(slices.map((s) => s.value));
  const { active, svg, mark } = useRoving(arcs.length);
  const total = sum(slices.map((s) => s.value));
  const pct = (v: number) => `${Math.round((v / total) * 100)}%`;
  const legend = <Legend items={slices.map((s) => ({ label: s.label, color: s.color, text: total ? ` ${s.value} (${pct(s.value)})` : '' }))} />;
  const S = 160, R = 76, RI = 46; // inner radius ~60%
  const at = active !== null ? arcs[active] : null;
  const cur = at ? slices[at.index] : null;
  return (
    <Frame title={title} legend={legend} empty={!(total > 0)}>
      {(width) => (
        <>
          <svg {...svg} viewBox={`0 0 ${S} ${S}`} width={S} height={S} className={`${SVG_FOCUS} mx-auto`} role="img"
            aria-label={`${title}, ${total} ${unit}: ${slices.map((s) => `${s.label} ${s.value}`).join(', ')}. ${KEYS_HINT}`}>
            {arcs.map(({ index, start, end }, i) => (
              <path key={slices[index].label} d={arcPath(S / 2, S / 2, active === i ? R + 3 : R, RI, start, end)}
                fill={slices[index].color} stroke="#fff" strokeWidth="2" {...mark(i)} />
            ))}
            <text x={S / 2} y={S / 2 - 4} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">{total.toLocaleString('en-PH')}</text>
            <text x={S / 2} y={S / 2 + 16} textAnchor="middle" fontSize="12" fill="#334155">{unit}</text>
          </svg>
          <Live text={cur ? `${cur.label}: ${cur.value} (${pct(cur.value)})` : ''} />
          <Tooltip width={width} tip={at && cur ? {
            x: width / 2 + Math.sin((at.start + at.end) / 2) * 60, y: S / 2 - Math.cos((at.start + at.end) / 2) * 60,
            title: cur.label, lines: [`${cur.value} ${unit} (${pct(cur.value)})`],
          } : null} />
          <DataTable title={title} head={['Group', 'Count', 'Share']} rows={slices.map((s) => [s.label, s.value, pct(s.value)])} />
        </>
      )}
    </Frame>
  );
}
