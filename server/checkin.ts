/// <reference types="@cloudflare/workers-types" />
// QR check-in (Premium): entry codes, the door key, door-phone check-in and the organiser's monitor.
import { randomToken, sha256 } from './crypto';
import { occasionOf } from '../shared/occasions';
import { tierOf } from '../shared/tiers';

interface Env { DB: D1Database }

const json = (data: unknown, status = 200) => Response.json(data, { status });
const parse = (s: string, fallback: unknown) => { try { return JSON.parse(s); } catch { return fallback; } };
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
// 16 chars from 64 symbols: masking a byte with 63 has no modulo bias
export const newCheckinCode = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => CODE_CHARS[b & 63]).join('');

export const checkinOn = (inv: any) => tierOf(inv) === 'premium' && parse(inv.extras, {})?.checkin?.enabled === true;

// People a guest brings: their attending reply (adults + kids), else the seats held for them.
const PARTY = 'COALESCE((SELECT r.party_size + COALESCE(r.kids_count, 0) FROM rsvps r WHERE r.guest_id = g.id AND r.invitation_id = g.invitation_id AND r.attending = 1), g.seats)';

// The guest's entry pass, only for an attending guest of a Premium invitation with check-in on. g: { id, name, attending, party_size, kids_count }.
export async function guestPass(db: D1Database, inv: any, g: any, origin: string) {
  if (!g || !g.attending || !checkinOn(inv)) return undefined;
  await db.prepare('UPDATE invitation_guests SET checkin_code = ? WHERE id = ? AND checkin_code IS NULL').bind(newCheckinCode(), g.id).run().catch(() => {});
  const row = await db.prepare('SELECT checkin_code FROM invitation_guests WHERE id = ?').bind(g.id).first<any>();
  return row?.checkin_code ? { url: `${origin}/c/${row.checkin_code}`, name: g.name, partySize: g.party_size + (g.kids_count ?? 0) } : undefined;
}

// ---- Organiser routes (the caller resolved the managed invitation): GET checkin, POST checkin/key, checkin/key/revoke, checkin/mark ----
export async function manageCheckin(sub: string, request: Request, env: Env, inv: any): Promise<Response> {
  if (tierOf(inv) !== 'premium') return json({ error: 'QR check-in is a Premium feature.' }, 403);
  if (sub === 'key') {
    const key = randomToken();
    await env.DB.prepare('UPDATE invitations SET checkin_key_hash = ? WHERE id = ?').bind(await sha256(key), inv.id).run();
    return json({ key, invitationId: inv.id }); // the only time the key is shown
  }
  if (sub === 'key/revoke') {
    await env.DB.prepare('UPDATE invitations SET checkin_key_hash = NULL WHERE id = ?').bind(inv.id).run();
    return json({ ok: true });
  }
  if (sub === 'mark') {
    const body: any = await request.json().catch(() => ({}));
    if (!Number.isInteger(body.guestId)) return json({ error: 'Guest not found.' }, 404);
    const mine = await env.DB.prepare('SELECT 1 AS x FROM invitation_guests WHERE id = ? AND invitation_id = ?').bind(body.guestId, inv.id).first();
    if (!mine) return json({ error: 'Guest not found.' }, 404);
    if (body.undo === true) await env.DB.prepare('UPDATE invitation_guests SET checked_in_at = NULL, checked_in_count = 0 WHERE id = ? AND invitation_id = ?').bind(body.guestId, inv.id).run();
    else await env.DB.prepare(`UPDATE invitation_guests AS g SET checked_in_at = ?, checked_in_count = ${PARTY} WHERE g.id = ? AND g.invitation_id = ? AND g.checked_in_at IS NULL`).bind(new Date().toISOString(), body.guestId, inv.id).run();
    return json({ ok: true });
  }
  // GET: the list and totals the monitor polls
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.name, g.seats, g.checked_in_at, g.checked_in_count, r.attending, r.party_size, r.kids_count
     FROM invitation_guests g LEFT JOIN rsvps r ON r.guest_id = g.id AND r.invitation_id = g.invitation_id
     WHERE g.invitation_id = ? ORDER BY lower(g.name), g.id`,
  ).bind(inv.id).all<any>();
  const guests = (results || []).map((g) => ({
    id: g.id, name: g.name, seats: g.seats, rsvp: g.attending == null ? null : g.attending ? 'attending' : 'declined',
    party: g.attending ? g.party_size + (g.kids_count ?? 0) : g.seats, checkedInAt: g.checked_in_at, checkedInCount: g.checked_in_count,
  }));
  const attending = guests.filter((g) => g.rsvp === 'attending');
  return json({
    enabled: checkinOn(inv), hasKey: !!inv.checkin_key_hash, guests,
    totals: {
      attendingGuests: attending.length, checkedInGuests: guests.filter((g) => g.checkedInAt).length,
      expectedPeople: attending.reduce((n, g) => n + g.party, 0), checkedInPeople: guests.reduce((n, g) => n + g.checkedInCount, 0),
    },
  });
}

// ---- Door routes: /api/checkin/verify, /api/checkin, /api/checkin/pass/<code> ----
// The door key proves the phone: sha256(key) must equal the invitation's stored hash. Anything else is 401.
async function doorInvitation(env: Env, body: any): Promise<any | null> {
  if (!Number.isInteger(body.invitationId) || typeof body.key !== 'string' || !body.key || body.key.length > 100) return null;
  const inv = await env.DB.prepare("SELECT i.*, d.product_type FROM invitations i JOIN products_designs d ON d.id = i.design_id WHERE i.id = ? AND i.status = 'live' AND i.checkin_key_hash = ?").bind(body.invitationId, await sha256(body.key)).first<any>();
  return inv && checkinOn(inv) ? inv : null;
}
const titleOf = (inv: any) => occasionOf(inv.product_type)?.title(parse(inv.details, {})) ?? '';

export async function doorRoute(route: string, request: Request, env: Env): Promise<Response> {
  const pass = route.match(/^GET \/api\/checkin\/pass\/([^/]+)$/)?.[1];
  if (pass) {
    let code: string;
    try { code = decodeURIComponent(pass); } catch { return json({ error: 'Not found.' }, 404); }
    // Only the name and event title: nothing about the reply or the guest link
    const row = await env.DB.prepare("SELECT g.name, i.details, d.product_type FROM invitation_guests g JOIN invitations i ON i.id = g.invitation_id JOIN products_designs d ON d.id = i.design_id WHERE g.checkin_code = ? AND i.status = 'live' AND i.tier = 'premium'").bind(code).first<any>();
    return row ? json({ name: row.name, title: titleOf(row) }) : json({ error: 'Not found.' }, 404);
  }
  const body: any = await request.json().catch(() => ({}));
  if (route === 'POST /api/checkin/verify') {
    const inv = await doorInvitation(env, body);
    return inv ? json({ title: titleOf(inv) }) : json({ error: 'This phone is not set up for check-in.' }, 401);
  }
  if (route === 'POST /api/checkin') {
    const inv = await doorInvitation(env, body);
    if (!inv) return json({ error: 'This phone is not set up for check-in.' }, 401);
    if (typeof body.code !== 'string' || body.code.length > 40) return json({ status: 'not_found' }, 404);
    // Atomic: only the first scan wins, so two phones scanning together cannot both succeed
    const up = await env.DB.prepare(`UPDATE invitation_guests AS g SET checked_in_at = ?, checked_in_count = ${PARTY} WHERE g.checkin_code = ? AND g.invitation_id = ? AND g.checked_in_at IS NULL`).bind(new Date().toISOString(), body.code, inv.id).run();
    const g = await env.DB.prepare('SELECT name, checked_in_at, checked_in_count FROM invitation_guests WHERE checkin_code = ? AND invitation_id = ?').bind(body.code, inv.id).first<any>();
    if (!g) return json({ status: 'not_found' }, 404);
    return up.meta.changes ? json({ status: 'checked_in', name: g.name, party: g.checked_in_count }) : json({ status: 'already', name: g.name, at: g.checked_in_at });
  }
  return json({ error: 'Not found.' }, 404);
}
