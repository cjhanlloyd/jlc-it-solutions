// Manage page "Gallery": the layout every photo block uses (all tiers), saved as extras.gallery.layout.
import React from 'react';
import type { Extras, GalleryLayout } from '../../../shared/extras';
import { Alert } from '../kit';
import GalleryPicker from './GalleryPicker';
import { btnCls, OFFLINE, postJson, type Api } from './shared';

export default function GalleryTab({ api, extras, onExtras }: { api: Api; extras: Extras; onExtras: (e: Extras) => void }) {
  const [layout, setLayout] = React.useState<GalleryLayout>(extras.gallery?.layout ?? 'grid');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await postJson(api, '/extras', { extras: { ...extras, gallery: { layout } } });
      const b = await res.json().catch(() => ({}));
      if (res.ok) { onExtras(b.extras); setMsg({ kind: 'success', text: 'Saved. Your guests see the new gallery right away.' }); }
      else setMsg({ kind: 'error', text: b.error || 'Something went wrong. Please try again.' });
    } catch { setMsg({ kind: 'error', text: OFFLINE }); }
    setBusy(false);
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <GalleryPicker value={layout} onChange={setLayout} name="manage-gallery" />
      <button type="submit" disabled={busy} className={btnCls}>Save gallery</button>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </form>
  );
}
