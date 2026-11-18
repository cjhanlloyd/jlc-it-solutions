// Door-phone pages: /checkin (set up this phone, optional camera scanner) and /c/<code> (the result of scanning a guest's entry pass).
// Both render without the site chrome: staff need big, plain screens.
import React from 'react';
import { go } from './kit';

const KEY = 'jlc_checkin';
type Stored = { invitationId: number; key: string };

function readStored(): Stored | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && Number.isInteger(s.invitationId) && typeof s.key === 'string' ? s : null;
  } catch { return null; }
}
const post = (path: string, body: unknown) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const OFFLINE = 'We could not reach the server. Please check your connection and try again.';
const manila = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
const btn = 'inline-flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-slate-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';
const ghost = 'inline-flex min-h-12 items-center justify-center rounded-full border border-slate-400 bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';

// Only a same-origin /c/<code> link is followed; anything else a code might say is ignored.
export function passPath(text: string, origin = window.location.origin): string | null {
  try {
    const u = new URL(text);
    return u.origin === origin && /^\/c\/[\w-]{1,40}$/.test(u.pathname) ? u.pathname : null;
  } catch { return null; }
}

// Camera scanner: BarcodeDetector reads the QR; the camera is requested only after the staff member taps "Scan".
function Scanner({ onClose }: { onClose: () => void }) {
  const video = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stopped) return;
          const found = await detector.detect(v).catch(() => []);
          const path = found.map((f: any) => passPath(String(f.rawValue))).find(Boolean);
          if (path) { stopped = true; stream?.getTracks().forEach((t) => t.stop()); return go(path); }
          setTimeout(tick, 250);
        };
        tick();
      } catch {
        setError('The camera could not start. Allow camera access for this site, or scan passes with your phone\'s camera app instead.');
      }
    })();
    return () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div className="space-y-3">
      <video ref={video} muted playsInline aria-label="Camera view for scanning entry passes" className="w-full rounded-2xl bg-slate-900" />
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <p role="status" className="text-sm text-slate-700">Point the camera at a guest's entry pass.</p>}
      <button type="button" onClick={onClose} className={ghost}>Stop scanning</button>
    </div>
  );
}

export function CheckinPage() {
  const [state, setState] = React.useState<{ s: 'loading' } | { s: 'ready'; title: string } | { s: 'none' } | { s: 'bad' } | { s: 'offline' }>({ s: 'loading' });
  const [scanning, setScanning] = React.useState(false);
  React.useEffect(() => {
    // The key arrives in the #fragment (never sent to a server); keep it on this phone and clear the address bar.
    const m = window.location.hash.match(/^#(\d{1,15})\.([\w-]{20,100})$/);
    if (m) {
      try { localStorage.setItem(KEY, JSON.stringify({ invitationId: Number(m[1]), key: m[2] })); } catch { /* verified below from memory */ }
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    const stored: Stored | null = m ? { invitationId: Number(m[1]), key: m[2] } : readStored();
    if (!stored) return setState({ s: 'none' });
    post('/api/checkin/verify', stored).then(async (res) => {
      if (res.ok) setState({ s: 'ready', title: (await res.json()).title });
      else if (res.status === 401) { try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ } setState({ s: 'bad' }); }
      else setState({ s: 'offline' });
    }, () => setState({ s: 'offline' }));
  }, []);
  const canScan = 'BarcodeDetector' in window;
  return (
    <main className="mx-auto max-w-md px-4 py-12 space-y-5 text-slate-900 select-text">
      <h1 className="text-2xl font-extrabold font-display">Guest check-in</h1>
      {state.s === 'loading' && <p role="status" className="text-sm text-slate-700">Checking this phone…</p>}
      {state.s === 'ready' && (
        <>
          <p role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-base font-semibold text-emerald-900">This phone is ready for check-in at {state.title}.</p>
          <p className="text-sm text-slate-700">Scan guests' entry passes with this phone's camera app. Each scan opens a screen that says whether the guest is welcome.</p>
          {canScan && !scanning && <button type="button" onClick={() => setScanning(true)} className={btn}>Scan</button>}
          {scanning && <Scanner onClose={() => setScanning(false)} />}
          {!canScan && <p className="text-sm text-slate-700">This browser can't scan inside the page, so use the camera app.</p>}
          <button type="button" className={ghost} onClick={() => { try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ } setState({ s: 'none' }); }}>Forget this phone</button>
        </>
      )}
      {state.s === 'none' && <p className="text-sm text-slate-700">This phone is not set up for check-in. The organiser can open "Check-in" on their manage page and show you the door phone code to scan.</p>}
      {state.s === 'bad' && <p role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">This door phone link no longer works. Ask the organiser for a new one.</p>}
      {state.s === 'offline' && <p role="alert" className="text-sm text-red-700">{OFFLINE}</p>}
    </main>
  );
}

type Result = { kind: 'loading' } | { kind: 'ok'; name: string; party: number } | { kind: 'already'; name: string; at: string } | { kind: 'missing' }
  | { kind: 'pass'; name: string; title: string } | { kind: 'denied' } | { kind: 'error'; text: string };

export function PassPage({ code }: { code: string }) {
  const [r, setR] = React.useState<Result>({ kind: 'loading' });
  const started = React.useRef(''); // a check-in must never be sent twice by a re-render
  React.useEffect(() => {
    if (started.current === code) return;
    started.current = code;
    const stored = readStored();
    const run = stored
      ? post('/api/checkin', { code, ...stored }).then(async (res) => {
        const b = await res.json().catch(() => ({}));
        if (res.status === 401) return setR({ kind: 'denied' });
        if (res.status === 404) return setR({ kind: 'missing' });
        if (res.status === 429) return setR({ kind: 'error', text: b.error });
        if (!res.ok) return setR({ kind: 'error', text: 'Something went wrong. Please scan again.' });
        setR(b.status === 'checked_in' ? { kind: 'ok', name: b.name, party: b.party } : { kind: 'already', name: b.name, at: b.at });
      })
      : fetch(`/api/checkin/pass/${encodeURIComponent(code)}`).then(async (res) => {
        const b = await res.json().catch(() => ({}));
        setR(res.ok ? { kind: 'pass', name: b.name, title: b.title } : { kind: 'missing' });
      });
    run.catch(() => setR({ kind: 'error', text: OFFLINE }));
  }, [code]);

  const next = <a href="/checkin" onClick={(e) => { e.preventDefault(); go('/checkin'); }} className="mt-8 inline-flex min-h-12 items-center rounded-full border-2 border-current px-8 py-3 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">Scan next</a>;
  const screen = (cls: string, title: string, sub?: string, extra?: React.ReactNode) => (
    <main className={`flex min-h-screen flex-col items-center justify-center px-6 text-center ${cls}`}>
      <div role="status" aria-live="polite">
        <h1 className="text-4xl font-extrabold font-display leading-tight break-words">{title}</h1>
        {sub && <p className="mt-3 text-2xl font-semibold">{sub}</p>}
      </div>
      {extra}
    </main>
  );
  switch (r.kind) {
    case 'loading': return screen('bg-white text-slate-900', 'Checking…');
    case 'ok': return screen('bg-emerald-700 text-white', `Welcome, ${r.name}`, `Party of ${r.party}`, <>{next}<p className="mt-4 text-sm">Scan the next guest's pass with the camera.</p></>);
    case 'already': return screen('bg-amber-300 text-slate-900', `${r.name} is already checked in`, `Already checked in at ${manila(r.at)}`, <>{next}<p className="mt-4 text-sm">Scan the next guest's pass with the camera.</p></>);
    case 'missing': return screen('bg-red-700 text-white', 'Not found', 'This pass is not on the guest list.', next);
    case 'denied': return screen('bg-red-700 text-white', 'This phone is not set up', 'Ask the organiser for a new door phone link.');
    case 'error': return screen('bg-red-700 text-white', 'Something went wrong', r.text, next);
    case 'pass': return screen('bg-white text-slate-900', `${r.name}'s entry pass`, `This is ${r.name}'s entry pass for ${r.title}. Please show it at the entrance.`);
  }
}
