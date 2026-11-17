// Design tab: the design itself (other designs of the same occasion), font pair (radio cards, each sampled in its own font) and colours (the design's schemes or Custom).
import React from 'react';
import { FONT_PAIRS, contrast, deriveScheme, type FontKey, type InvitationStyle } from '../../../shared/invitation-style';
import { useStyleFonts, type Scheme } from '../parts';
import { resolveOrderPackage } from '../../../shared/packages';
import { peso } from '../kit';
import { LivePreview } from '../../site/DesignCard';
import type { Design } from '../../site/designs-api';
import { isPremium } from '../../site/design-tier';
import type { Tier } from '../../../shared/tiers';
import PremiumExtras, { type Tracks } from './PremiumExtras';

const legendCls = 'text-sm font-extrabold text-slate-900 font-display pr-3';
const cardCls = 'relative block rounded-2xl border border-slate-200 p-3 cursor-pointer hover:border-slate-400 has-[:checked]:border-slate-900 has-[:checked]:ring-1 has-[:checked]:ring-slate-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-900';

function FontCard({ value, label, serif, sans, checked, load, onPick }: { key?: string; value: FontKey | ''; label: string; serif?: string; sans?: string; checked: boolean; load: boolean; onPick: () => void }) {
  useStyleFonts(load && value ? { font: value } : undefined);
  return (
    <label className={cardCls}>
      <input type="radio" name="studio-font" className="sr-only" checked={checked} onChange={onPick} />
      <span className="block text-2xl leading-tight text-slate-900 truncate" style={serif ? { fontFamily: `'${serif}', Georgia, serif` } : undefined}>Anna &amp; Ben</span>
      <span className="block text-xs text-slate-600 truncate" style={sans ? { fontFamily: `'${sans}', system-ui, sans-serif` } : undefined}>{label}</span>
    </label>
  );
}

// Without designs (the manage page), there is no switcher: switching design after payment changes the product.
type Props = { designs?: Design[]; slug?: string; packageKey?: string; onSwitch?: (d: Design) => void; schemes: Scheme[]; scheme: string; onScheme: (name: string) => void; style: InvitationStyle; onStyle: (s: InvitationStyle) => void; active: boolean; tier?: Tier; tracks?: Tracks };

export default function DesignTab({ designs, slug, packageKey, onSwitch, schemes, scheme, onScheme, style, onStyle, active, tier, tracks = null }: Props) {
  // Sample fonts load the first time the tab is shown, not on every page view.
  const [load, setLoad] = React.useState(active);
  React.useEffect(() => { if (active) setLoad(true); }, [active]);
  const custom = scheme === 'Custom' && style.colors;
  const pickScheme = (name: string) => {
    const { colors: _c, ...rest } = style;
    if (name !== 'Custom') { onScheme(name); onStyle(rest); return; }
    const base = schemes.find((s) => s.name === scheme) ?? schemes[0];
    onStyle({ ...rest, colors: style.colors ?? { primary: base?.primary ?? '#7a1f3d', accent: base?.accent ?? '#d4af37' } });
    onScheme('Custom');
  };
  const setColor = (k: 'primary' | 'accent', v: string) => style.colors && onStyle({ ...style, colors: { ...style.colors, [k]: v } });
  const derived = custom ? deriveScheme(custom.primary, custom.accent) : null;
  const ratio = derived ? contrast(derived.text, derived.background) : 0;
  const { font, ...noFont } = style;
  const premiumNames = (designs ?? []).filter(isPremium).map((d) => d.name).join(', ');

  return (
    <div className="space-y-6">
      {designs && designs.length > 1 && onSwitch && (
        <fieldset className="space-y-3">
          <legend className={legendCls}>Design</legend>
          <p className="text-xs text-slate-600">Switch designs any time: your details, photos and style stay.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {designs.map((d) => {
              const on = d.slug === slug;
              const price = resolveOrderPackage(d.packages, packageKey)?.priceCentavos;
              return (
                <button key={d.slug} type="button" aria-pressed={on} aria-label={price !== undefined ? `${d.name}, ${peso(price)}` : d.name} onClick={() => !on && onSwitch(d)}
                  className={`text-left rounded-2xl border p-2 cursor-pointer ${on ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'}`}>
                  <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
                    {d.previewImages[0] ? <img src={d.previewImages[0]} alt="" loading="lazy" className="h-full w-full object-cover" /> : <LivePreview design={d} />}
                  </span>
                  <span className="block mt-1.5 text-xs font-bold text-slate-900 truncate">{d.name}</span>
                  {price !== undefined && <span className="block text-xs text-slate-600">{peso(price)}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {tier === 'premium' && <PremiumExtras tracks={tracks} style={style} onStyle={onStyle} active={active} />}
      {tier === 'standard' && premiumNames && (
        <p className="text-xs text-slate-600">Opening animation and background music come with Premium designs: {premiumNames}.</p>
      )}

      <fieldset className="space-y-3">
        <legend className={legendCls}>Fonts</legend>
        <div className="grid grid-cols-2 gap-2">
          <FontCard value="" label="Design default" checked={!font} load={false} onPick={() => onStyle(noFont)} />
          {(Object.keys(FONT_PAIRS) as FontKey[]).map((k) => (
            <FontCard key={k} value={k} label={FONT_PAIRS[k].label} serif={FONT_PAIRS[k].serif} sans={FONT_PAIRS[k].sans} checked={font === k} load={load} onPick={() => onStyle({ ...style, font: k })} />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={legendCls}>Colours</legend>
        <div className="flex flex-wrap gap-3">
          {[...schemes, { name: 'Custom' } as Scheme].map((s) => {
            const sw = s.name === 'Custom' ? (derived ? [derived.background, derived.primary, derived.accent] : ['#ffffff', '#f43f5e', '#3b82f6']) : [s.background, s.primary, s.accent];
            const on = s.name === scheme;
            return (
              <button key={s.name} type="button" onClick={() => pickScheme(s.name!)} aria-pressed={on}
                className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer ${on ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'}`}>
                <span className="flex -space-x-1.5" aria-hidden="true">
                  {sw.map((c, i) => <span key={i} className="w-5 h-5 rounded-full border border-slate-300" style={{ background: c }} />)}
                </span>
                {s.name}
              </button>
            );
          })}
        </div>
        {custom && derived && (
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap gap-4">
              {(['primary', 'accent'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="color" value={custom[k]} onChange={(e) => setColor(k, e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-white" />
                  {k === 'primary' ? 'Main colour' : 'Accent colour'}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: derived.background, color: derived.text }}>
              <span className="text-lg font-semibold" style={{ color: derived.primary }}>Heading</span>
              <span className="text-sm">Body text</span>
              <span className="ml-auto h-5 w-5 rounded-full" style={{ background: derived.accent }} aria-hidden="true" />
            </div>
            {ratio >= 4.5
              ? <p className="text-xs text-slate-600">We set the background and text colours from your picks so the text stays easy to read (contrast {ratio.toFixed(1)}:1).</p>
              : <p role="alert" className="text-xs text-red-600">These colours make text hard to read (contrast {ratio.toFixed(1)}:1, at least 4.5:1 is needed). Please pick a different main colour.</p>}
          </div>
        )}
      </fieldset>
    </div>
  );
}
