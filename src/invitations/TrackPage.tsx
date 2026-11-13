// /track: find an order by reference + order email. The view token goes in sessionStorage for the order page.
import React from 'react';
import { Button, Card, TextField } from '../ui';
import { Alert, go, useTurnstile } from './kit';

export const orderKey = (reference: string) => 'jlc_order_' + reference;

// onFound: the order page passes this to show the order in place; otherwise navigate to it.
export function LookupForm({ reference: initial = '', onFound }: { reference?: string; onFound?: (token: string) => void }) {
  const [reference, setReference] = React.useState(initial);
  const [email, setEmail] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const turnstile = useTurnstile();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!turnstile.token) return setError('Please wait for the anti-spam check to finish, then try again.');
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: reference.trim().toUpperCase(), email, turnstileToken: turnstile.token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.viewToken) {
        try { sessionStorage.setItem(orderKey(data.reference), data.viewToken); } catch { /* private mode */ }
        if (onFound && data.reference === initial) onFound(data.viewToken); else go('/order/' + data.reference);
        return;
      }
      setError(res.status === 404 ? 'We could not find an order with that reference and email.' : data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
    }
    turnstile.reset();
    setSending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Order reference" placeholder="JLC-XXXXXX" required autoCapitalize="characters" value={reference} onChange={(e) => setReference(e.target.value)} />
      <TextField label="Email used for the order" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <div ref={turnstile.ref} className="min-h-[65px]" />
      {turnstile.error && <p className="text-xs text-red-700">{turnstile.error}</p>}
      {error && <Alert>{error}</Alert>}
      <Button type="submit" loading={sending} className="w-full">Find my order</Button>
    </form>
  );
}

export default function TrackPage() {
  return (
    <div className="bg-slate-50 py-12 px-4 select-text">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-extrabold text-slate-900 font-display">Track your order</h1>
        <p className="text-sm text-slate-600">Enter the reference from your order email and the email address you ordered with.</p>
        <Card><LookupForm /></Card>
      </div>
    </div>
  );
}
