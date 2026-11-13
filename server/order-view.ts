// Short-lived order view tokens from the reference + email lookup: "<orderId>.<exp>.<hmac>", keyed by JWT_SECRET.
import { hmacKey } from './crypto';

const TTL_SECONDS = 2 * 60 * 60;
const b64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function signOrderView(orderId: number, secret: string, now: Date): Promise<string> {
  const payload = `${orderId}.${Math.floor(now.getTime() / 1000) + TTL_SECONDS}`;
  return `${payload}.${b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(payload)))}`;
}

export async function verifyOrderView(token: string, secret: string, now: Date): Promise<number | null> {
  const m = /^(\d{1,15})\.(\d{1,15})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m || Number(m[2]) <= now.getTime() / 1000) return null;
  const sig = Uint8Array.from(atob(m[3].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  // crypto.subtle.verify compares in constant time
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), sig, new TextEncoder().encode(`${m[1]}.${m[2]}`));
  return ok ? Number(m[1]) : null;
}
