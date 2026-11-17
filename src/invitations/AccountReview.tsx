// "Your review" card on the account dashboard: eligibility note, the form, and the status of the saved review.
import React from 'react';
import { Alert, useTurnstile } from './kit';
import { focusRing, primaryBtn, secondaryBtn } from './LinkBox';
import { NAME_MAX, REVIEW_MAX, REVIEW_MIN, validateReview } from '../../shared/reviews';
import { Stars } from '../site/Stars';

type Review = { rating: number; body: string; displayName: string; status: 'pending' | 'approved' | 'rejected'; rejectReason: string | null; updatedAt: string };
type State = { eligible: boolean; review: Review | null; suggestedName: string };

const fieldCls = `w-full rounded-xl border border-gold bg-white px-4 py-3 text-base text-ink focus:border-brand-700 ${focusRing}`;
const labelCls = 'mb-1.5 block text-sm font-semibold text-ink';
const OFFLINE = 'We could not reach the server. Please check your connection and try again.';

export default function AccountReview({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [state, setState] = React.useState<State | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [name, setName] = React.useState('');
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const turnstile = useTurnstile();
  const headers = { 'X-Customer-Token': token, 'Content-Type': 'application/json' };

  React.useEffect(() => {
    fetch('/api/account/review', { headers }).then(async (res) => {
      if (res.status === 401) return onSignOut();
      if (!res.ok) return; // the card simply stays hidden; the orders above still work
      const d: State = await res.json();
      setState(d);
      setName(d.review?.displayName ?? d.suggestedName);
    }).catch(() => { /* hidden */ });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;
  const review = state.review;
  const showForm = state.eligible && (!review || editing);

  function startEdit() {
    if (!review) return;
    setRating(review.rating); setName(review.displayName); setText(review.body); setError(''); setEditing(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateReview({ rating, body: text, displayName: name });
    if (v.ok === false) return setError(v.error);
    if (!turnstile.token) return setError('Please wait for the anti-spam check to finish, then try again.');
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/account/review', { method: 'POST', headers, body: JSON.stringify({ ...v.value, turnstileToken: turnstile.token }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) { setState({ ...state!, review: body.review }); setEditing(false); setBusy(false); return; }
      if (res.status === 401) return onSignOut();
      setError(body.error || 'Something went wrong. Please try again.');
    } catch { setError(OFFLINE); }
    turnstile.reset();
    setBusy(false);
  }

  async function remove() {
    if (!confirm('Delete your review? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/account/review/delete', { method: 'POST', headers, body: '{}' });
      if (res.ok) { setState({ ...state!, review: null }); setRating(0); setText(''); setEditing(false); }
      else setError('Something went wrong. Please try again.');
    } catch { setError(OFFLINE); }
    setBusy(false);
  }

  const status = !review ? '' : review.status === 'pending' ? 'Waiting for approval' : review.status === 'approved' ? 'Published' : `Not published${review.rejectReason ? `: ${review.rejectReason}` : ''}`;

  return (
    <section aria-labelledby="your-review" className="rounded-card border border-gold-light bg-white p-6 shadow-card sm:p-8">
      <h2 id="your-review" className="font-serif text-3xl font-semibold text-ink">Your review</h2>
      <div className="mt-4 h-px w-16 bg-gold" aria-hidden="true" />
      {!state.eligible && <p className="mt-4 text-sm text-ink/80">Once your invitation is delivered, you can leave a review.</p>}

      {review && !editing && (
        <div className="mt-5 space-y-3">
          <p className="flex flex-wrap items-center gap-3"><Stars rating={review.rating} /> <span role="status" className="rounded-full border border-gold-light bg-sand px-3 py-1 text-xs font-semibold text-ink">{status}</span></p>
          <p className="whitespace-pre-line break-words text-base leading-relaxed text-ink">{review.body}</p>
          <p className="text-sm text-ink/80">Shown as <span className="font-semibold text-ink">{review.displayName}</span></p>
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-wrap gap-3 pt-2">
            {state.eligible && <button type="button" onClick={startEdit} disabled={busy} className={secondaryBtn}>Edit</button>}
            <button type="button" onClick={remove} disabled={busy} className={secondaryBtn}>Delete</button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="mt-5 space-y-5">
          {review?.status === 'approved' && <Alert kind="info">Your review is published. If you change it, it will be checked again before it shows.</Alert>}
          <fieldset>
            <legend className={labelCls}>Your rating</legend>
            <div className="flex gap-1" role="radiogroup">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700">
                  <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
                  <span className="sr-only">{n} {n === 1 ? 'star' : 'stars'}</span>
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-9 w-9 stroke-gold ${n <= rating ? 'fill-gold' : 'fill-none'}`} strokeWidth="1.5">
                    <path strokeLinejoin="round" d="M10 1.8l2.4 5 5.4.7-4 3.8 1 5.4L10 14.1 5.2 16.7l1-5.4-4-3.8 5.4-.7z" />
                  </svg>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="rev-name" className={labelCls}>Display name</label>
            <input id="rev-name" className={fieldCls} maxLength={NAME_MAX} required value={name} onChange={(e) => setName(e.target.value)} aria-describedby="rev-name-hint" />
            <p id="rev-name-hint" className="mt-1.5 text-xs text-ink/80">Shown publicly with your review. A first name or nickname is fine.</p>
          </div>
          <div>
            <label htmlFor="rev-text" className={labelCls}>Your review</label>
            <textarea id="rev-text" className={fieldCls} rows={5} maxLength={REVIEW_MAX} required value={text} onChange={(e) => setText(e.target.value)} aria-describedby="rev-count" />
            <p id="rev-count" className="mt-1.5 text-xs text-ink/80">{text.length} / {REVIEW_MAX} characters (at least {REVIEW_MIN})</p>
          </div>
          <div ref={turnstile.ref} className="min-h-[65px]" />
          {turnstile.error && <p role="alert" className="text-xs text-red-700">{turnstile.error}</p>}
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : review ? 'Save changes' : 'Submit review'}</button>
            {review && <button type="button" onClick={() => { setEditing(false); setError(''); }} className={secondaryBtn}>Cancel</button>}
          </div>
          <p className="text-xs text-ink/80">Reviews are checked before they are shown. See our <a href="/privacy" className={`underline ${focusRing}`}>Privacy Notice</a>.</p>
        </form>
      )}
    </section>
  );
}
