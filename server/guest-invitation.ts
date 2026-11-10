/// <reference types="@cloudflare/workers-types" />
// Public (guest-facing) invitation lookup, shared by the guest API, the guest page and the photo route.

export const todayUtc = (now = new Date()) => now.toISOString().slice(0, 10);

// Expired once event_date + 60 days is before today (UTC). An unparsable date never expires.
export const isPastExpiry = (eventDate: string, now = new Date()) =>
  Date.parse(`${eventDate}T00:00:00Z`) + 60 * 86_400_000 < Date.parse(`${todayUtc(now)}T00:00:00Z`);

// Malformed %-escapes in a URL segment → null (callers answer 404, not 500).
export const decodeSegment = (s: string): string | null => { try { return decodeURIComponent(s); } catch { return null; } };

// The row (with layout_key and product_type) when the invitation is live or expired, else null.
// A live row past expiry is marked 'expired' here, lazily.
export async function findGuestInvitation(db: D1Database, slug: string): Promise<any | null> {
  const inv = await db.prepare(
    'SELECT i.*, d.layout_key, d.product_type FROM invitations i JOIN products_designs d ON d.id = i.design_id WHERE i.slug = ?',
  ).bind(slug).first<any>();
  if (inv?.status === 'live' && isPastExpiry(inv.event_date)) {
    await db.prepare("UPDATE invitations SET status = 'expired' WHERE id = ? AND status = 'live'").bind(inv.id).run();
    inv.status = 'expired';
  }
  return inv?.status === 'live' || inv?.status === 'expired' ? inv : null;
}
