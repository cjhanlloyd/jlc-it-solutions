/// <reference types="@cloudflare/workers-types" />
import { randomToken, sha256 } from '../../../server/crypto';
import { EMAIL_RE } from '../../../server/email';
import { decodeSegment, findGuestInvitation, todayUtc } from '../../../server/guest-invitation';
import { emailAndRotateToken } from '../../../server/invitation-links';
import { notify } from '../../../server/order-emails';
import { newReference } from '../../../server/orders';
import { activeProvider, loadPaymentSettings } from '../../../server/payments';
import { turnstileError } from '../../../server/turnstile';
import { LIMITS, makeSlug, validateRsvp } from '../../../shared/invitation-fields';
import { occasionOf } from '../../../shared/occasions';

interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  TURNSTILE_SECRET_KEY?: string;
  PAYMONGO_SECRET_KEY?: string; // only when payment_settings.provider is 'paymongo'
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const parse = (s: string, fallback: unknown) => { try { return JSON.parse(s); } catch { return fallback; } };
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const NOT_FOUND = () => json({ error: 'Invitation not found.' }, 404);
const pastDate = (o: { dateNoun: string }) => `The ${o.dateNoun} date cannot be in the past.`;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;
  try {
    if (route === 'GET /api/invitations/designs') {
      const { results } = await env.DB.prepare(
        'SELECT slug, name, product_type, layout_key, price_centavos, color_schemes, preview_images, sample_details FROM products_designs WHERE active = 1 ORDER BY sort_order, id',
      ).all<any>();
      return json({ designs: (results || []).filter((d) => occasionOf(d.product_type)).map((d) => ({
        slug: d.slug, name: d.name, productType: d.product_type, layoutKey: d.layout_key, priceCentavos: d.price_centavos,
        colorSchemes: parse(d.color_schemes, []), previewImages: parse(d.preview_images, []), sampleDetails: parse(d.sample_details, {}),
      })) });
    }

    if (route === 'POST /api/invitations/checkout') return await checkout(context, url.origin);
    if (route === 'POST /api/invitations/resend') return await resend(context, url.origin);

    const rsvpSlug = route.match(/^POST \/api\/invitations\/i\/([^/]+)\/rsvp$/)?.[1];
    if (rsvpSlug) {
      const slug = decodeSegment(rsvpSlug);
      return slug === null ? NOT_FOUND() : await rsvp(request, env, slug);
    }

    const guestSlug = route.match(/^GET \/api\/invitations\/i\/([^/]+)$/)?.[1];
    if (guestSlug) return await guest(env, decodeSegment(guestSlug));

    if (route === 'GET /api/invitations/manage' || route === 'POST /api/invitations/manage' || route === 'GET /api/invitations/manage/rsvps.csv') {
      const token = request.headers.get('X-Manage-Token');
      const inv = token && await env.DB.prepare(
        "SELECT i.*, d.slug AS design_slug, d.name AS design_name, d.layout_key, d.product_type FROM invitations i JOIN products_designs d ON d.id = i.design_id WHERE i.manage_token_hash = ? AND i.status = 'live'",
      ).bind(await sha256(token)).first<any>();
      if (!inv) return NOT_FOUND();
      if (request.method === 'POST') return await manageEdit(request, env, inv);
      const { results } = await env.DB.prepare(
        'SELECT guest_name, attending, party_size, kids_count, message, created_at FROM rsvps WHERE invitation_id = ? ORDER BY created_at, id',
      ).bind(inv.id).all<any>();
      const rsvps = (results || []).map((r) => ({ guestName: r.guest_name, attending: !!r.attending, partySize: r.party_size, kidsCount: r.kids_count ?? 0, message: r.message ?? '', submitted: r.created_at }));
      const occasion = occasionOf(inv.product_type);
      if (url.pathname.endsWith('.csv')) return csv(rsvps, inv.slug, !!occasion?.askKids);
      return json({
        slug: inv.slug, status: inv.status, productType: inv.product_type, askKids: !!occasion?.askKids,
        title: occasion?.title(parse(inv.details, {})) ?? '', design: { slug: inv.design_slug, name: inv.design_name, layoutKey: inv.layout_key },
        colorScheme: parse(inv.color_scheme, {}), details: parse(inv.details, {}), photos: parse(inv.photos, []), rsvps,
      });
    }

    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('invitations API error:', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

const photoError = (p: unknown): string | null =>
  typeof p !== 'string' || !PHOTO_RE.test(p) ? 'Photos must be JPEG, PNG or WebP images.'
    : p.length > LIMITS.photoChars ? 'A photo is too large.' : null;

// Stores a checked data URL in R2 as inv/<invitationId>/<n>.<ext> and returns the key.
async function putPhoto(env: Env, invitationId: number, n: number, p: string): Promise<string> {
  const [, type] = p.match(PHOTO_RE)!;
  const key = `inv/${invitationId}/${n}.${type === 'jpeg' ? 'jpg' : type}`;
  const bin = atob(p.slice(p.indexOf(',') + 1));
  await env.PHOTOS.put(key, Uint8Array.from(bin, (c) => c.charCodeAt(0)), { httpMetadata: { contentType: `image/${type}` } });
  return key;
}

async function checkout(context: EventContext<Env, any, any>, origin: string): Promise<Response> {
  const { request, env } = context;
  const settings = await loadPaymentSettings(env.DB);
  const provider = activeProvider(settings);
  if (provider.ready(settings)) return json({ error: 'Online ordering is paused while we update payment details. Please contact us.' }, 503);

  const body: any = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > LIMITS.customerName) return json({ error: `Please enter your name (up to ${LIMITS.customerName} characters).` }, 400);
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if ((body.phone != null && typeof body.phone !== 'string') || phone.length > LIMITS.phone) return json({ error: `The phone number is too long (max ${LIMITS.phone}).` }, 400);

  const spam = await turnstileError(request, env.TURNSTILE_SECRET_KEY, body.turnstileToken);
  if (spam) return spam;

  if (body.termsAccepted !== true) return json({ error: 'Please accept the terms to continue.' }, 400);

  const design = await env.DB.prepare('SELECT * FROM products_designs WHERE slug = ? AND active = 1').bind(String(body.designSlug ?? '')).first<any>();
  if (!design) return json({ error: 'That design is not available.' }, 400);

  const scheme = (parse(design.color_schemes, []) as any[]).find((s) => s && s.name === body.colorScheme);
  if (!scheme) return json({ error: 'Please choose one of the design\'s color schemes.' }, 400);

  const occasion = occasionOf(design.product_type);
  if (!occasion) return json({ error: 'That design is not available.' }, 400);

  const v = occasion.validateDetails(body.details);
  if (v.ok === false) return json({ error: v.error }, 400);
  const details = v.details;
  // Not in validateDetails: admin sample dates would go stale
  if (details.eventDate < todayUtc()) return json({ error: pastDate(occasion) }, 400);

  const photos: unknown = body.photos ?? [];
  if (!Array.isArray(photos)) return json({ error: 'Photos must be a list.' }, 400);
  if (photos.length > LIMITS.photos) return json({ error: `Too many photos (max ${LIMITS.photos}).` }, 400);
  for (const p of photos) {
    const err = photoError(p);
    if (err) return json({ error: err }, 400);
  }

  const trackingToken = randomToken();
  const reference = newReference();
  const now = new Date();
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join('');
  const slug = makeSlug(occasion.slugBase(details), suffix);
  // One transaction for customer, invitation, order and its first event. Rows before photos, so the R2 keys
  // can use the real invitation id. The manage token is random and unused: delivery emails a fresh one.
  // shortcut: a reference collision (1 in ~887M per pair) fails the unique index → 500; retry if orders grow huge.
  const [, inv, ord] = await env.DB.batch([
    env.DB.prepare('INSERT INTO customers (email, name, phone) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = COALESCE(excluded.phone, phone)')
      .bind(email, name, phone || null),
    env.DB.prepare("INSERT INTO invitations (design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash) VALUES (?, ?, ?, ?, '[]', 'pending', ?, ?)")
      .bind(design.id, slug, JSON.stringify(scheme), JSON.stringify(details), details.eventDate, await sha256(randomToken())),
    env.DB.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos, status, terms_accepted_at, reference, customer_id, provider, payment_deadline, tracking_token_hash, updated_at) VALUES (last_insert_rowid(), ?, ?, 'pending_payment', ?, ?, (SELECT id FROM customers WHERE email = ?), ?, ?, ?, ?)")
      .bind(email, design.price_centavos, now.toISOString(), reference, email, provider.key,
        new Date(now.getTime() + settings.deadlineHours * 3_600_000).toISOString(), await sha256(trackingToken), now.toISOString()),
    env.DB.prepare("INSERT INTO order_events (order_id, at, actor, kind, from_status, to_status, note, visible) VALUES (last_insert_rowid(), ?, 'customer', 'status', NULL, 'pending_payment', 'Order placed', 1)")
      .bind(now.toISOString()),
  ]);
  const invitationId = inv.meta.last_row_id;
  const orderId = ord.meta.last_row_id;

  const keys: string[] = [];
  let start;
  try {
    for (const [n, p] of (photos as string[]).entries()) keys.push(await putPhoto(env, invitationId, n, p));
    await env.DB.prepare('UPDATE invitations SET photos = ? WHERE id = ?').bind(JSON.stringify(keys), invitationId).run();
    start = await provider.start({ id: orderId, reference, amountCentavos: design.price_centavos, email, itemName: `${occasion.label} invitation: ${design.name}` }, { env, origin });
    if (start.kind === 'redirect') await env.DB.prepare('UPDATE orders SET paymongo_checkout_id = ? WHERE id = ?').bind(start.providerRef, orderId).run();
  } catch (e) {
    console.error('checkout failed:', e instanceof Error ? e.message : e);
    if (keys.length) await env.PHOTOS.delete(keys);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM order_events WHERE order_id = ?').bind(orderId),
      env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(orderId),
      env.DB.prepare('DELETE FROM invitations WHERE id = ?').bind(invitationId),
    ]);
    return json({ error: 'We could not place your order. Please try again in a moment.' }, 502);
  }
  context.waitUntil(notify(env.DB, request, orderId, 'placed', { trackingToken }));
  return json({ reference, trackingToken, ...(start.kind === 'redirect' ? { checkoutUrl: start.url } : {}) });
}

// Body: { details, photos }. photos is the full desired list; each entry is either one of this
// invitation's current R2 keys (kept) or a new image data URL (uploaded). Removed keys are deleted.
async function manageEdit(request: Request, env: Env, inv: any): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  if (['design', 'designSlug', 'colorScheme'].some((k) => k in body)) return json({ error: 'The design and color scheme cannot be changed after payment.' }, 400);

  const occasion = occasionOf(inv.product_type);
  if (!occasion) return NOT_FOUND();
  const v = occasion.validateDetails(body.details);
  if (v.ok === false) return json({ error: v.error }, 400);
  const old = parse(inv.details, {});
  if (occasion.lockedFieldsChanged(old, v.details)) return json({ error: occasion.lockedMessage }, 400);
  // An unchanged past date (the wedding already happened) must not block other edits
  if (v.details.eventDate !== old.eventDate && v.details.eventDate < todayUtc()) return json({ error: pastDate(occasion) }, 400);

  const current: string[] = parse(inv.photos, []);
  const photos: unknown = body.photos ?? [];
  if (!Array.isArray(photos)) return json({ error: 'Photos must be a list.' }, 400);
  if (photos.length > LIMITS.photos) return json({ error: `Too many photos (max ${LIMITS.photos}).` }, 400);
  for (const p of photos) {
    if (current.includes(p as string)) continue;
    if (typeof p === 'string' && !p.startsWith('data:')) return json({ error: 'Unknown photo.' }, 400);
    const err = photoError(p);
    if (err) return json({ error: err }, 400);
  }

  const added: string[] = [];
  const keys: string[] = [];
  try {
    // New photos get a time-based index so a deleted key is never reused (the photo route caches for a day)
    const base = Date.now() * 10;
    for (const [n, p] of (photos as string[]).entries()) {
      if (current.includes(p)) { keys.push(p); continue; }
      const key = await putPhoto(env, inv.id, base + n, p);
      added.push(key);
      keys.push(key);
    }
    await env.DB.prepare('UPDATE invitations SET details = ?, event_date = ?, photos = ? WHERE id = ?')
      .bind(JSON.stringify(v.details), v.details.eventDate, JSON.stringify(keys), inv.id).run();
  } catch (e) {
    if (added.length) await env.PHOTOS.delete(added);
    throw e;
  }
  const removed = current.filter((k) => !keys.includes(k));
  if (removed.length) await env.PHOTOS.delete(removed);
  return json({ ok: true, details: v.details, photos: keys });
}

// Quotes every cell; a leading = + - @ gets a ' so spreadsheets do not run it as a formula.
function csv(rsvps: { guestName: string; attending: boolean; partySize: number; kidsCount: number; message: string; submitted: string }[], slug: string, kids: boolean): Response {
  const cell = (v: unknown) => {
    const s = String(v ?? '');
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const lines = [kids ? 'Name,Attending,Adults,Kids,Message,Submitted' : 'Name,Attending,Party size,Message,Submitted',
    ...rsvps.map((r) => [r.guestName, r.attending ? 'Yes' : 'No', r.partySize, ...(kids ? [r.kidsCount] : []), r.message, r.submitted].map(cell).join(','))];
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="rsvps-${slug}.csv"` },
  });
}

// Expired invitations show only the title: no details, photos or RSVP state.
async function guest(env: Env, slug: string | null): Promise<Response> {
  const inv = slug === null ? null : await findGuestInvitation(env.DB, slug);
  if (!inv) return NOT_FOUND();
  const occasion = occasionOf(inv.product_type);
  if (!occasion) return NOT_FOUND();
  const details = parse(inv.details, {});
  if (inv.status === 'expired') return json({ state: 'expired', title: occasion.title(details) });
  return json({
    state: 'live', productType: inv.product_type, askKids: occasion.askKids, layoutKey: inv.layout_key, colorScheme: parse(inv.color_scheme, {}), details,
    photos: (parse(inv.photos, []) as string[]).map((k) => `/photos/${k}`),
    // Same rule as the RSVP route below: open through the deadline day (UTC)
    rsvpOpen: !details.rsvpDeadline || todayUtc() <= details.rsvpDeadline,
  });
}

async function rsvp(request: Request, env: Env, slug: string): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const spam = await turnstileError(request, env.TURNSTILE_SECRET_KEY, body.turnstileToken);
  if (spam) return spam;

  const inv = await env.DB.prepare("SELECT i.id, i.details, d.product_type FROM invitations i JOIN products_designs d ON d.id = i.design_id WHERE i.slug = ? AND i.status = 'live'").bind(slug).first<any>();
  const occasion = occasionOf(inv?.product_type);
  if (!inv || !occasion) return NOT_FOUND();
  const deadline = parse(inv.details, {}).rsvpDeadline;
  if (deadline && todayUtc() > deadline) return json({ error: 'RSVPs are closed.' }, 400);

  const v = validateRsvp({ guestName: body.guestName, attending: body.attending, partySize: body.partySize, kidsCount: body.kidsCount, message: body.message }, { askKids: occasion.askKids });
  if (v.ok === false) return json({ error: v.error }, 400);
  const r = v.rsvp;
  // One statement, so the 300 cap holds even with concurrent submissions
  const ins = await env.DB.prepare(
    'INSERT INTO rsvps (invitation_id, guest_name, attending, party_size, kids_count, message) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM rsvps WHERE invitation_id = ?) < 300',
  ).bind(inv.id, r.guestName, r.attending ? 1 : 0, r.partySize, r.kidsCount, r.message, inv.id).run();
  if (!ins.meta.changes) return json({ error: 'This invitation is no longer accepting RSVPs.' }, 400);
  return json({ ok: true });
}

// Always { ok: true } after Turnstile, so the response never reveals whether the email has orders.
async function resend(context: EventContext<Env, any, any>, origin: string): Promise<Response> {
  const { request, env } = context;
  const body: any = await request.json().catch(() => ({}));
  const spam = await turnstileError(request, env.TURNSTILE_SECRET_KEY, body.turnstileToken);
  if (spam) return spam;
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: true });

  // Same pattern as the admin login lockout: 3 requests per email per hour, counted in audit_logs
  const message = `Invitation links resend requested for ${email}`;
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM audit_logs WHERE log_type = 'invitation_resend' AND message = ? AND timestamp > ?",
  ).bind(message, new Date(Date.now() - 60 * 60 * 1000).toISOString()).first<any>();
  if ((recent?.count || 0) >= 3) return json({ ok: true });
  await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'invitation_resend', ?)").bind(new Date().toISOString(), message).run();

  // In the background, so the response time does not reveal whether anything was sent either
  context.waitUntil((async () => {
    try {
      const { results } = await env.DB.prepare(
        "SELECT i.id, i.slug FROM orders o JOIN invitations i ON i.id = o.product_id WHERE o.customer_email = ? AND o.status = 'delivered' AND i.status = 'live'",
      ).bind(email).all<any>();
      if (!results?.length) return;
      const smtp: any = await env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
      // sendSmtpEmail silently skips when disabled; rotating then would lock the couple out
      if (!smtp?.enabled) return;
      for (const inv of results) {
        await emailAndRotateToken(env.DB, smtp, request, inv.id, (token) => ({
          to: email,
          subject: 'Your invitation links',
          // "Key: value" lines: the HTML builder keeps every URL there (plain paragraphs keep only the first)
          body: [
            'Here are the links to your invitation. Share the guest link with your guests. Use the manage link to edit your invitation and see RSVPs, and keep it private. Any earlier manage link no longer works.',
            '',
            `Guest link: ${origin}/i/${inv.slug}`,
            `Manage link: ${origin}/manage#${token}`,
          ].join('\n'),
        }));
      }
    } catch (e) {
      console.error('Resend links failed:', e instanceof Error ? e.message : e);
    }
  })());
  return json({ ok: true });
}
