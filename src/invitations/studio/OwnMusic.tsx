// Premium: upload your own song from the manage page (raw file body; the server checks the bytes and the rights box).
import React from 'react';

export type CustomMusic = { key: string; title: string };
const MAX = 8_000_000;
const field = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900';

export default function OwnMusic({ api, current, onChange }: { api: (path: string, init?: RequestInit) => Promise<Response>; current: CustomMusic | null; onChange: (m: CustomMusic | null) => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [rights, setRights] = React.useState(false);
  const [busy, setBusy] = React.useState<'upload' | 'remove' | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  React.useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pick = (f: File | undefined) => {
    setMsg(null); setFile(null); setUrl(null);
    if (!f) return;
    if (!/\.(mp3|m4a)$/i.test(f.name) && !/^audio\/(mpeg|mp4|x-m4a)$/.test(f.type)) return setMsg({ ok: false, text: 'Please choose an MP3 or M4A file.' });
    if (f.size > MAX) return setMsg({ ok: false, text: 'The song must be 8 MB or smaller.' });
    setFile(f); setUrl(URL.createObjectURL(f));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 80));
  };
  const upload = async () => {
    if (!file) return setMsg({ ok: false, text: 'Choose a song first.' });
    if (!rights) return setMsg({ ok: false, text: 'Please confirm you have the right to use this music.' });
    setBusy('upload'); setMsg(null);
    try {
      const res = await api('/music', { method: 'POST', body: file, headers: { 'Content-Type': file.type || (/\.m4a$/i.test(file.name) ? 'audio/mp4' : 'audio/mpeg'), 'X-Music-Rights': 'yes', 'X-Music-Title': encodeURIComponent(title.trim() || 'Our song') } });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: d.error || 'Could not upload the song. Please try again.' });
      onChange(d.music); setFile(null); setUrl(null); setRights(false); setTitle('');
      setMsg({ ok: true, text: 'Song uploaded. Choose it in the music list above, then save your changes.' });
    } catch { setMsg({ ok: false, text: 'Could not upload the song. Please check your connection.' }); } finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy('remove'); setMsg(null);
    try {
      const res = await api('/music/remove', { method: 'POST' });
      if (!res.ok) return setMsg({ ok: false, text: 'Could not remove the song. Please try again.' });
      onChange(null);
    } catch { setMsg({ ok: false, text: 'Could not remove the song. Please check your connection.' }); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-800">Upload your own song</p>
      <p className="text-xs text-slate-600">MP3 or M4A, up to 8 MB. {current ? 'Uploading a new song replaces the current one.' : ''}</p>
      <input type="file" accept="audio/mpeg,audio/mp4,.mp3,.m4a" aria-label="Song file" onChange={(e) => pick(e.target.files?.[0])} className="block w-full text-sm text-slate-800" />
      {url && <audio controls src={url} className="w-full" aria-label="Preview of your song" />}
      <label className="block text-xs font-semibold text-slate-800">Song title
        <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1 font-normal`} />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={rights} onChange={(e) => setRights(e.target.checked)} />
        I own this music or have permission to use it.
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={upload} disabled={busy !== null} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-60">{busy === 'upload' ? 'Uploading…' : 'Upload song'}</button>
        {current && <button type="button" onClick={remove} disabled={busy !== null} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-800 cursor-pointer disabled:opacity-60">{busy === 'remove' ? 'Removing…' : 'Remove song'}</button>}
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}
