// Music library (#/music): upload MP3s, preview, edit title/credit, show or hide, reorder, delete.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, EmptyState, Spinner, TextField } from '../ui';
import type { Session } from './api';

type Track = { id: number; title: string; credit: string; url: string; active: boolean };
const MAX_BYTES = 8_000_000;

const readAsDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error('Could not read that file.'));
  r.readAsDataURL(f);
});

export default function MusicPage({ session }: { session: Session }) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [credit, setCredit] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<{ id: number; title: string; credit: string } | null>(null);
  const [fileKey, setFileKey] = useState(0); // remounts the file input to clear it

  const load = () => session.api<{ tracks: Track[] }>('/api/admin/music').then((d) => setTracks(d.tracks)).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Runs a change, then reloads the list so it always matches the server
  async function run(body: unknown): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      await session.api('/api/admin/music', body);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return setError('Choose an MP3 file.');
    if (file.size > MAX_BYTES) return setError('Audio must be 8 MB or smaller.');
    setBusy(true);
    setError('');
    let dataUrl: string;
    try { dataUrl = await readAsDataUrl(file); } catch (err) { setBusy(false); return setError((err as Error).message); }
    setBusy(false);
    if (await run({ action: 'create', title, credit, file: dataUrl })) {
      setTitle(''); setCredit(''); setFile(null);
      setFileKey((k) => k + 1);
    }
  }

  function move(i: number, dir: -1 | 1) {
    const ids = tracks!.map((t) => t.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    run({ action: 'reorder', ids });
  }

  return (
    <section>
      <h1 className="font-display text-2xl font-bold">Music</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-700">Upload music you have the rights to use: royalty-free or licensed tracks. Premium customers pick one for their invitation.</p>

      <Card className="mt-4 max-w-2xl">
        <form onSubmit={upload} className="space-y-3">
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
          <TextField label="Credit (optional)" value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={120} hint="Artist and source, shown to guests next to the music button once it plays." />
          <TextField label="MP3 file (up to 8 MB)" type="file" accept="audio/mpeg,.mp3" key={fileKey} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          <Button type="submit" loading={busy} disabled={busy || !title.trim()}>Upload track</Button>
        </form>
      </Card>

      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      {!tracks && !error && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Spinner /> Loading tracks…</p>}
      {tracks && (tracks.length === 0 ? (
        <div className="mt-6"><EmptyState title="No tracks yet">Upload your first track above.</EmptyState></div>
      ) : (
        <ul className="mt-4 space-y-3">
          {tracks.map((t, i) => (
            <li key={t.id}><Card>
              {editing?.id === t.id ? (
                <div className="space-y-3">
                  <TextField label="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={80} />
                  <TextField label="Credit" value={editing.credit} onChange={(e) => setEditing({ ...editing, credit: e.target.value })} maxLength={120} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy || !editing.title.trim()} onClick={async () => { if (await run({ action: 'update', id: t.id, title: editing.title, credit: editing.credit, active: t.active })) setEditing(null); }}>Save</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold">{t.title}</p>
                    {t.credit && <p className="text-sm text-slate-600">{t.credit}</p>}
                  </div>
                  <audio controls preload="none" src={t.url} className="w-full max-w-md" />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="mr-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={t.active} disabled={busy} onChange={() => run({ action: 'update', id: t.id, title: t.title, credit: t.credit, active: !t.active })} aria-label={`Show ${t.title} to customers`} /> Active
                    </label>
                    <Button size="sm" variant="secondary" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${t.title} up`}>Up</Button>
                    <Button size="sm" variant="secondary" disabled={busy || i === tracks.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${t.title} down`}>Down</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing({ id: t.id, title: t.title, credit: t.credit })}>Edit</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => { if (confirm(`Delete "${t.title}"? Invitations using it will play no music.`)) run({ action: 'delete', id: t.id }); }}>Delete</Button>
                  </div>
                </div>
              )}
            </Card></li>
          ))}
        </ul>
      ))}
    </section>
  );
}
