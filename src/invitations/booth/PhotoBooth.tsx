// Guest page photo booth (Premium): a full-screen dialog. The camera starts only when the guest taps "Start camera",
// and nothing leaves the phone unless they tap "Add to the gallery". Lazy-loaded by guest-main.tsx.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { BOOTH_FRAMES, type BoothFrame } from '../../../shared/extras';
import { LIMITS } from '../../../shared/invitation-fields';
import { useTurnstile } from '../turnstile';
import { CAMERA, cameraError, cameraUnavailable } from './camera';
import { BOOTH_H, BOOTH_W, drawPhoto, drawPlaceholder, FRAMES, photoRect, type FrameOpts } from './frames';
import FrameThumb from './FrameThumb';
import './booth.css';

type Phase = 'idle' | 'starting' | 'live' | 'countdown' | 'shot' | 'error';
type Props = {
  style: CSSProperties; colors: { primary: string; accent: string; background: string; text: string };
  card: { headline: string; kicker: string; dateLine: string }; defaultFrame?: BoothFrame;
  slug: string; canAdd: boolean; guestName?: string; guestToken?: string; onClose: () => void;
};

const OFFLINE = 'We could not reach the server. Please check your connection and try again.';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function PhotoBooth({ style, colors: colorsProp, card: cardProp, defaultFrame, slug, canAdd, guestName, guestToken, onClose }: Props) {
  // Fixed for the dialog's life, so the drawing effects don't rerun when the page re-renders
  const [colors] = useState(colorsProp);
  const [card] = useState(cardProp);
  const dialog = useRef<HTMLDialogElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement | null>(null);
  const raw = useRef<HTMLCanvasElement | null>(null); // the captured camera frame, unframed, so the frame can still change
  const stream = useRef<MediaStream | null>(null);
  const live = useRef(true);
  const [frame, setFrame] = useState<BoothFrame>(defaultFrame ?? 'classic');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [count, setCount] = useState(3);
  const [shots, setShots] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
  const [serif, setSerif] = useState('');
  const reduced = useMemo(reducedMotion, []);
  const canShare = useMemo(() => {
    try { return !!navigator.canShare?.({ files: [new File([''], 'photo-booth.png', { type: 'image/png' })] }); } catch { return false; }
  }, []);
  const opts: FrameOpts = useMemo(() => ({ ...colors, headline: card.headline, kicker: card.kicker, date: card.dateLine, serif }), [colors, card, serif]);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  };

  // Open as a modal (focus trap, Escape), lock the page scroll, load the invitation's serif for canvas text, and on unmount
  // stop the camera and give focus back. The dialog is not closed in cleanup: StrictMode's test unmount would then close it.
  useEffect(() => {
    const d = dialog.current!;
    const back = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal();
    d.querySelector<HTMLElement>('.booth-start .btn')?.focus();
    live.current = true;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const s = getComputedStyle(d).getPropertyValue('--serif').trim();
    if (s) Promise.resolve(document.fonts?.load(`italic 500 80px ${s}`)).then(() => document.fonts?.ready).catch(() => {}).then(() => { if (live.current) setSerif(s); });
    return () => {
      live.current = false;
      stop();
      document.body.style.overflow = overflow;
      back?.focus();
    };
  }, []);

  // The frame drawn once onto its own canvas, then laid over every preview frame.
  useEffect(() => {
    const c = (overlay.current ??= document.createElement('canvas'));
    c.width = BOOTH_W;
    c.height = BOOTH_H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    FRAMES[frame].draw(ctx, BOOTH_W, BOOTH_H, opts);
  }, [frame, opts]);

  // Paints photo + frame: every animation frame while the camera runs, once otherwise (placeholder or the captured shot).
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const r = photoRect(frame, BOOTH_W, BOOTH_H);
    const paint = () => {
      ctx.fillStyle = colors.background;
      ctx.fillRect(0, 0, BOOTH_W, BOOTH_H);
      const v = video.current;
      if (phase === 'shot' && raw.current) drawPhoto(ctx, raw.current, raw.current.width, raw.current.height, r);
      else if ((phase === 'live' || phase === 'countdown') && v && v.videoWidth) drawPhoto(ctx, v, v.videoWidth, v.videoHeight, r);
      else drawPlaceholder(ctx, r, colors);
      if (overlay.current) ctx.drawImage(overlay.current, 0, 0);
    };
    paint();
    if (phase === 'shot') {
      setBlob(null);
      canvas.current!.toBlob((b) => { if (live.current) setBlob(b); }, 'image/png');
      return;
    }
    if (phase !== 'live' && phase !== 'countdown') return;
    let id = 0;
    const loop = () => { paint(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [phase, frame, opts, colors]);

  // Keep focus on a control as the buttons change: the shutter once the camera is on, Download after a capture.
  useEffect(() => {
    if (phase === 'live') controls.current?.querySelector<HTMLElement>('.booth-shutter')?.focus();
    if (phase === 'shot') controls.current?.querySelector<HTMLElement>('.btn-solid')?.focus();
  }, [phase]);

  // 3-2-1, one step a second; with reduced motion a single still "Get ready" instead.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const t = setTimeout(() => (count > 1 ? setCount(count - 1) : capture()), 1000);
    return () => clearTimeout(t);
  }, [phase, count]);

  async function start() {
    setError('');
    setNote('');
    setAdding(false);
    const why = cameraUnavailable(window.isSecureContext, !!navigator.mediaDevices?.getUserMedia);
    if (why) { setError(why); setPhase('error'); return; }
    setPhase('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia(CAMERA);
      if (!live.current) { s.getTracks().forEach((t) => t.stop()); return; }
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setPhase('live');
    } catch (e) {
      stop();
      setError(cameraError(e));
      setPhase('error');
    }
  }

  function shoot() {
    if (phase !== 'live') return;
    setCount(reduced ? 1 : 3);
    setPhase('countdown');
  }

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return setPhase('live');
    const c = (raw.current ??= document.createElement('canvas'));
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    stop();
    setShots((n) => n + 1);
    setPhase('shot');
  }

  function download() {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photo-booth.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  // The blob is made right after capture, so share() runs inside the tap (Safari drops the share sheet after an await).
  async function share() {
    if (!blob) return;
    try {
      await navigator.share({ files: [new File([blob], 'photo-booth.png', { type: 'image/png' })], title: card.headline || 'Photo booth' });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setNote('Sharing did not work on this device. Please use Download instead.');
    }
  }

  const label = FRAMES[frame].label;
  const status = phase === 'starting' ? 'Starting the camera…'
    : phase === 'live' ? `Camera on. Tap the round button to take a photo with the ${label} frame.`
    : phase === 'countdown' ? (reduced ? 'Get ready…' : String(count))
    : phase === 'shot' ? 'Photo taken.' : '';
  const showStart = phase === 'idle' || phase === 'starting' || phase === 'error';

  return (
    <dialog ref={dialog} className="inv booth" style={style} aria-labelledby="booth-h" aria-modal="true" onClose={onClose}>
      <div className="booth-wrap">
        <header className="booth-top">
          <h2 id="booth-h">Photo booth</h2>
          <button type="button" className="booth-x" onClick={() => dialog.current?.close()} aria-label="Close photo booth">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="booth-main">
          <div className="booth-stage">
            <canvas ref={canvas} width={BOOTH_W} height={BOOTH_H} className="booth-canvas" role="img"
              aria-label={phase === 'shot' ? `Your photo with the ${label} frame` : phase === 'live' || phase === 'countdown' ? `Live camera preview with the ${label} frame` : `${label} frame preview`} />
            <video ref={video} className="booth-video" muted playsInline aria-hidden="true" />
            {phase === 'countdown' && <div key={count} className={reduced ? 'booth-count booth-count-still' : 'booth-count'} aria-hidden="true">{reduced ? 'Get ready' : count}</div>}
            {phase === 'shot' && <div key={shots} className="booth-flash" aria-hidden="true" />}
            {showStart && (
              <div className="booth-start">
                <p>{error || 'Strike a pose! Your photo stays on your phone unless you choose to share it.'}</p>
                <button type="button" className="btn btn-solid" onClick={start} disabled={phase === 'starting'} autoFocus>
                  {phase === 'starting' ? 'Starting…' : phase === 'error' ? 'Try again' : 'Start camera'}
                </button>
              </div>
            )}
          </div>

          <div className="booth-side">
            <p className="inv-sr" role="status" aria-live="polite">{status}</p>
            <div className="booth-controls" ref={controls}>
              {(phase === 'live' || phase === 'countdown') && (
                <button type="button" className="booth-shutter" onClick={shoot} aria-disabled={phase === 'countdown'} aria-label="Take photo"><span aria-hidden="true" /></button>
              )}
              {phase === 'shot' && (
                <>
                  <button type="button" className="btn" onClick={start}>Retake</button>
                  <button type="button" className="btn btn-solid" onClick={download}>Download</button>
                  {canShare && <button type="button" className="btn" onClick={share}>Share</button>}
                  {canAdd && !adding && <button type="button" className="btn" onClick={() => setAdding(true)}>Add to the gallery</button>}
                </>
              )}
            </div>
            {note && <p className="rsvp-error" role="alert">{note}</p>}

            <fieldset className="booth-frames">
              <legend>Frame</legend>
              <div className="booth-frame-list">
                {BOOTH_FRAMES.map((f) => (
                  <label key={f} className="booth-frame">
                    <input type="radio" name="booth-frame" className="inv-sr" checked={frame === f} onChange={() => setFrame(f)} />
                    <FrameThumb frame={f} opts={opts} className="booth-thumb" />
                    <span>{FRAMES[f].label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {adding && phase === 'shot' && canvas.current && (
              <AddToGallery canvas={canvas.current} slug={slug} guestName={guestName} guestToken={guestToken} />
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}

// "Add to the gallery": name (locked with a guest link) and Turnstile, then the same upload as "Share your photos".
function AddToGallery({ canvas, slug, guestName, guestToken }: { canvas: HTMLCanvasElement; slug: string; guestName?: string; guestToken?: string }) {
  const [name, setName] = useState(guestName ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const turnstile = useTurnstile();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.scrollIntoView({ block: 'nearest' }); form.current?.querySelector<HTMLElement>('input, button')?.focus(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!turnstile.token) return setError('Please wait for the anti-spam check to finish, then try again.');
    // The booth canvas is 1080×1350, already inside the 1600 px long edge guest uploads use
    const photo = canvas.toDataURL('image/jpeg', 0.85);
    if (photo.length > LIMITS.photoChars) return setError('This photo is too large to upload. Please use Download instead.');
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/invitations/i/${slug}/photos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, photos: [photo], turnstileToken: turnstile.token, ...(guestToken ? { guestToken } : {}) }),
      });
      const b = await res.json().catch(() => null);
      if (res.ok && b?.saved) return setDone('Thanks! It will appear once the couple approves it.');
      setError(res.ok ? 'Sorry, this gallery is full.' : b?.error || 'Something went wrong. Please try again.');
    } catch {
      setError(OFFLINE);
    } finally {
      setSending(false);
    }
    turnstile.reset();
  }

  if (done) return <p className="rsvp-done booth-done" role="status">{done}</p>;
  return (
    <form ref={form} className="rsvp booth-add" onSubmit={submit} aria-labelledby="booth-add-h">
      <h3 id="booth-add-h">Add to the gallery</h3>
      <div>
        <label htmlFor="booth-name">Your name</label>
        {guestName
          ? <input id="booth-name" type="text" readOnly value={name} aria-describedby="booth-name-note" />
          : <input id="booth-name" type="text" required maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-describedby="booth-name-note" />}
        <p id="booth-name-note" className="rsvp-note">The hosts approve each photo before it appears on the invitation.</p>
      </div>
      <div>
        <div ref={turnstile.ref} className="rsvp-turnstile" />
        {turnstile.error && <p className="rsvp-error">{turnstile.error}</p>}
      </div>
      {error && <p className="rsvp-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-solid" disabled={sending}>{sending ? 'Uploading…' : 'Send photo'}</button>
    </form>
  );
}
