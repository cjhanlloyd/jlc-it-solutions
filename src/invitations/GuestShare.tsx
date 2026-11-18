// Guest page "Share your photos" (Premium, guest photos on): name, up to 5 photos resized in the browser, Turnstile.
// Uploads wait for the hosts' approval before anyone sees them. Guest page only: never import from src/components/ here.
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { GUEST_UPLOAD_PER_BATCH } from '../../shared/extras';
import { LIMITS } from '../../shared/invitation-fields';
import { resizePhoto } from './studio/resize';
import { useTurnstile } from './turnstile';

const OFFLINE = 'We could not reach the server. Please check your connection and try again.';

export default function GuestShare({ slug, guestName, guestToken }: { slug: string; guestName?: string; guestToken?: string }) {
  const [name, setName] = useState(guestName ?? '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const turnstile = useTurnstile();

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    setError('');
    if (files.length > GUEST_UPLOAD_PER_BATCH) setError(`Only the first ${GUEST_UPLOAD_PER_BATCH} photos were added.`);
    setReading(true);
    const out: string[] = [];
    for (const f of files.slice(0, GUEST_UPLOAD_PER_BATCH)) {
      try {
        const p = await resizePhoto(f);
        if (p.length <= LIMITS.photoChars) out.push(p); else setError('A photo was too large and was skipped.');
      } catch { setError('We could not read one of the photos. Please use JPEG, PNG or WebP images.'); }
    }
    setPhotos(out);
    setReading(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!photos.length) return setError('Please choose at least one photo.');
    if (!turnstile.token) return setError('Please wait for the anti-spam check to finish, then try again.');
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/invitations/i/${slug}/photos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, photos, turnstileToken: turnstile.token, ...(guestToken ? { guestToken } : {}) }),
      });
      const b = await res.json().catch(() => null);
      if (res.ok) {
        setPhotos([]);
        if (!b?.saved) setError('Sorry, this gallery is full.');
        else setDone(b.full ? `Thanks! ${b.saved} of your photos were saved; the gallery is now full. They will appear once the couple approves them.` : 'Thanks! Your photos will appear once the couple approves them.');
      } else setError(b?.error || 'Something went wrong. Please try again.');
    } catch {
      setError(OFFLINE);
    } finally {
      setSending(false);
    }
    turnstile.reset();
  }

  return (
    <form className="rsvp inv-share" onSubmit={submit} aria-labelledby="share-h">
      <h3 id="share-h">Share your photos</h3>
      {done && <p className="rsvp-done" role="status">{done}</p>}
      <div>
        <label htmlFor="share-name">Your name</label>
        {guestName
          ? <input id="share-name" type="text" readOnly value={name} />
          : <input id="share-name" type="text" required maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
      </div>
      <div>
        <label htmlFor="share-files">Photos (up to {GUEST_UPLOAD_PER_BATCH})</label>
        <input id="share-files" type="file" accept="image/*" multiple disabled={reading || sending} onChange={pick} aria-describedby="share-note" />
        <p id="share-note" className="rsvp-note">Your name and photos are shared with the couple and shown on the invitation once they approve them. See our <a href="/privacy">Privacy Notice</a>.</p>
      </div>
      {reading && <p role="status">Preparing your photos…</p>}
      {photos.length > 0 && (
        <ul className="inv-share-previews" aria-label="Photos to upload">
          {photos.map((p, i) => <li key={i}><img src={p} alt={`Photo ${i + 1} to upload`} /></li>)}
        </ul>
      )}
      {/* The anti-spam check loads only once photos are picked, so the page keeps one widget until then */}
      {photos.length > 0 && (
        <div>
          <div ref={turnstile.ref} className="rsvp-turnstile" />
          {turnstile.error && <p className="rsvp-error">{turnstile.error}</p>}
        </div>
      )}
      {sending && <progress aria-label="Uploading your photos" />}
      {error && <p className="rsvp-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-solid" disabled={sending || reading}>{sending ? 'Uploading…' : 'Upload photos'}</button>
    </form>
  );
}
