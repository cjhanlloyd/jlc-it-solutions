// Manage page "Photo booth" (Premium): switch the guest page's booth on or off and choose the frame it opens with.
// The thumbnails are drawn by the same frame functions as the guests' photos, in this invitation's colours and names.
import React from 'react';
import { BOOTH_FRAMES, type BoothFrame, type Extras } from '../../../shared/extras';
import { FRAMES, type FrameOpts } from '../booth/frames';
import FrameThumb from '../booth/FrameThumb';
import { Alert } from '../kit';
import { btnCls, ghostBtn, OFFLINE, postJson, type Api } from './shared';

export default function BoothTab({ api, extras, onExtras, opts }: { api: Api; extras: Extras; onExtras: (e: Extras) => void; opts: FrameOpts }) {
  const enabled = extras.booth?.enabled === true;
  const [frame, setFrame] = React.useState<BoothFrame>(extras.booth?.frame ?? 'classic');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function save(booth: { enabled: boolean; frame: BoothFrame }, done: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await postJson(api, '/extras', { extras: { ...extras, booth } });
      const b = await res.json().catch(() => ({}));
      if (res.ok) { onExtras(b.extras); setMsg({ kind: 'success', text: done }); } else setMsg({ kind: 'error', text: b.error || 'Something went wrong. Please try again.' });
    } catch { setMsg({ kind: 'error', text: OFFLINE }); }
    setBusy(false);
  }
  const toggle = () => save({ enabled: !enabled, frame }, enabled ? 'The photo booth is off.' : 'The photo booth is on. Guests see a "Photo booth" button by your gallery.');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-800">The photo booth is <strong>{enabled ? 'on' : 'off'}</strong>.</p>
        <button type="button" disabled={busy} onClick={toggle} className={ghostBtn} aria-pressed={enabled}>{enabled ? 'Turn off' : 'Turn on'}</button>
      </div>
      <p className="text-sm text-slate-700">Guests take a framed selfie with their phone's front camera, then save or share it. Photos stay on their phone unless they add them to your gallery (only when Guest photos is on, and you approve each one).</p>
      <form onSubmit={(e) => { e.preventDefault(); save({ enabled, frame }, 'Saved. Guests will start with this frame and can switch to any other.'); }} className="space-y-4">
        <fieldset>
          <legend className="text-sm font-bold text-slate-900 mb-2">Starting frame</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BOOTH_FRAMES.map((f) => (
              <label key={f} className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-slate-200 p-3 has-[:checked]:border-slate-900 has-[:checked]:ring-2 has-[:checked]:ring-slate-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-900">
                <input type="radio" name="booth-frame" value={f} checked={frame === f} onChange={() => setFrame(f)} className="sr-only" />
                <FrameThumb frame={f} opts={opts} className="w-full max-w-32 rounded-lg" />
                <span className="text-sm font-semibold text-slate-900">{FRAMES[f].label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={busy} className={btnCls}>Save frame</button>
      </form>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </div>
  );
}
