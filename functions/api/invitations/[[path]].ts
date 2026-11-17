/// <reference types="@cloudflare/workers-types" />
import { randomToken, sha256 } from '../../../server/crypto';
import { findManagedInvitation } from '../../../server/customer-session';
import { EMAIL_RE } from '../../../server/email';
import { decodeSegment, findGuestInvitation, todayUtc } from '../../../server/guest-invitation';
import { emailAndRotateToken } from '../../../server/invitation-links';
import { notify } from '../../../server/order-emails';
import { newReference } from '../../../server/orders';
import { activeProvider, loadPaymentSettings } from '../../../server/payments';
import { turnstileError } from '../../../server/turnstile';
import { LIMITS, makeSlug, validateRsvp } from '../../../shared/invitation-fields';
import { coverIndexToKey, deriveScheme, remapCover, validateStyle, type InvitationStyle } from '../../../shared/invitation-style';
import { mediaUrl } from '../../../server/media';
import { occasionOf } from '../../../shared/occasions';
import { fromPrice, pickPackage, validatePackages, type Package } from '../../../shared/packages';
import { photoLimit, tierOf, type Tier } from '../../../shared/tiers';

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
// A bad stored row must never block or misprice checkout: fall back to one Standard package at price_centavos.
function packagesOf(d: { id: number; packages: string; price_centavos: number }): Package[] {
  const v = validatePackages(parse(d.packages, null));
  if (v.ok === false) {
    console.error(`Design ${d.id} has invalid packages (${v.error}); using Standard.`);
    return [{ key: 'standard', name: 'Standard', priceCentavos: d.price_centavos, inclusions: [], kind: 'template' }];
  }
  return v.packages;
}
// Ids the customer may pick as music (Premium only; validateStyle checks the tier).
async function activeTrackIds(db: D1Database): Promise<number[]> {
  const { results } = await db.prepare('SELECT id FROM music_tracks WHERE active = 1').all<any>();
  return (results || []).map((r) => r.id);
}
// 'Custom' is the customer's own colours (style.colors); any other name must be one of the design's schemes.
function schemeFor(designSchemes: string, name: unknown, style: InvitationStyle): { scheme: object } | { error: string } {
  if (name === 'Custom') return style.colors ? { scheme: { name: 'Custom', ...deriveScheme(style.colors.primary, style.colors.accent) } } : { error: 'Please choose your custom colours.' };
  if (style.colors) return { error: 'Custom colours need the Custom color scheme.' };
  const scheme = (parse(designSchemes, []) as any[]).find((s) => s && s.name === name);
  return scheme ? { scheme } : { error: 'Please choose one of the design\'s color schemes.' };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;
  try {
    if (route === 'GET /api/invitations/music') {
      const { results } = await env.DB.prepare('SELECT id, title, credit, r2_key FROM music_tracks WHERE active = 1 ORDER BY sort_order, id').all<any>();
      return json({ tracks: (results || []).map((t) => ({ id: t.id, title: t.title, credit: t.credit, url: mediaUrl(t.r2_key) })) });
    }
    if (route === 'GET /api/invitations/designs') {
      const { results } = await env.DB.prepare(
        'SELECT id, slug, name, product_type, layout_key, price_centavos, packages, color_schemes, preview_images, sample_photos, sample_details, description, featured FROM products_designs WHERE active = 1 ORDER BY sort_order, id',
      ).all<any>();
      return json({ designs: (results || []).filter((d) => occasionOf(d.product_type)).map((d) => {
        const packages = packagesOf(d);
        return {
          slug: d.slug, name: d.name, productType: d.product_type, layoutKey: d.layout_key,
          packages, fromPriceCentavos: fromPrice(packages), priceCentavos: fromPrice(packages), // priceCentavos: older clients
          colorSchemes: parse(d.color_schemes, []), previewImages: parse(d.preview_images, []), samplePhotos: parse(d.sample_photos, []), sampleDetails: parse(d.sample_details, {}),
          description: d.description, featured: !!d.featured,
        };
      }) });
    }

    if (route === 'POST /api/invitations/checkout') return await checkout(context, url.origin);
    if (route === 'POST /api/invitations/resend') return await resend(context, url.origin);

    const rsvpSlug = route.match(/^POST \/api\/invitations\/i\/([^/]+)\/rsvp$/)?.[1];
    if (rsvpSlug) {
      const slug = decodeSegment(rsvpSlug);
      return slug === null ? NOT_FOUND() : await rsvp(request, env, slug);
    }

    const guestSlug = route.match(/^GET \/api\/invitations\/i\/([^/]+)$/)?.[1];
    if (guestSlug) return await guest(env, decodeSegment(guestSlug), url.searchParams.get('g'));

    if (route === 'GET /api/invitations/manage' || route === 'POST /api/invitations/manage' || route === 'GET /api/invitations/manage/rsvps.csv'
      || route === 'GET /api/invitations/manage/guests' || route === 'POST /api/invitations/manage/guests') {
      const inv = await findManagedInvitation(env.DB, request);
      if (!inv) return NOT_FOUND();
      if (url.pathname.replace(/\/+$/, '').endsWith('/guests')) return request.method === 'POST' ? await manageGuests(request, env, inv) : await listGuests(env, inv);
      if (request.method === 'POST') return await manageEdit(request, env, inv);
      const { results } = await env.DB.prepare(
        'SELECT guest_name, attending, party_size, kids_count, message, created_at, guest_id FROM rsvps WHERE invitation_id = ? ORDER BY created_at, id',
      ).bind(inv.id).all<any>();
      const rsvps = (results || []).map((r) => ({ guestName: r.guest_name, attending: !!r.attending, partySize: r.party_size, kidsCount: r.kids_count ?? 0, message: r.message ?? '', submitted: r.created_at, guestId: r.guest_id ?? null }));
      const occasion = occasionOf(inv.product_type);
      if (url.pathname.endsWith('.csv')) return csv(rsvps, inv.slug, !!occasion?.askKids);
      return json({
        slug: inv.slug, status: inv.status, productType: inv.product_type, askKids: !!occasion?.askKids,
        title: occasion?.title(parse(inv.details, {})) ?? '', design: { slug: inv.design_slug, name: inv.design_name, layoutKey: inv.layout_key, colorSchemes: parse(inv.design_color_schemes, []) },
        // style.cover.photo is one of the photos keys
        colorScheme: parse(inv.color_scheme, {}), style: parse(inv.style, {}), details: parse(inv.details, {}), photos: parse(inv.photos, []), giftQr: inv.gift_qr ?? null, tier: tierOf(inv), rsvps,
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

const giftQrError = (p: unknown): string | null =>
  typeof p !== 'string' || !PHOTO_RE.test(p) ? 'Gift QR code must be a JPEG, PNG or WebP image.'
    : p.length > LIMITS.photoChars ? 'The gift QR code is too large.' : null;

// Stores a checked data URL in R2 as inv/<invitationId>/<n>.<ext> and returns the key.
async function putPhoto(env: Env, invitationId: number, n: number | string, p: string): Promise<string> {
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

  // Only the key comes from the body; the amount always comes from the stored package.
  const key = typeof body.packageKey === 'string' && body.packageKey.length <= 30 ? body.packageKey : undefined;
  const pkg = pickPackage(packagesOf(design), key)!; // packagesOf always has a template
  const custom = pkg.kind === 'custom';
  const notes = custom && typeof body.designerNotes === 'string' ? body.designerNotes.trim() : '';
  if (custom && (!notes || notes.length > 1500)) return json({ error: "Please tell the designer what you'd like (up to 1,500 characters)." }, 400);

  const tier: Tier = tierOf(pkg); // from the stored package only, never the body
  const occasion = occasionOf(design.product_type);
  if (!occasion) return json({ error: 'That design is not available.' }, 400);

  const v = occasion.validateDetails(body.details);
  if (v.ok === false) return json({ error: v.error }, 400);
  const details = v.details;
  // Not in validateDetails: admin sample dates would go stale
  if (details.eventDate < todayUtc()) return json({ error: pastDate(occasion) }, 400);

  const photos: unknown = body.photos ?? [];
  if (!Array.isArray(photos)) return json({ error: 'Photos must be a list.' }, 400);
  if (photos.length > photoLimit(tier)) return json({ error: `Too many photos (max ${photoLimit(tier)}).` }, 400);
  for (const p of photos) {
    const err = photoError(p);
    if (err) return json({ error: err }, 400);
  }
  const giftQr: unknown = body.giftQr ?? undefined;
  if (giftQr !== undefined) {
    const err = giftQrError(giftQr);
    if (err) return json({ error: err }, 400);
  }
  // cover.photo is an index into photos here; it becomes the photo's R2 key once stored
  const sv = validateStyle(body.style, { photoCount: photos.length, tier, trackIds: await activeTrackIds(env.DB) });
  if ('error' in sv) return json({ error: sv.error }, 400);
  const sch = schemeFor(design.color_schemes, body.colorScheme, sv.style);
  if ('error' in sch) return json({ error: sch.error }, 400);
  const { scheme } = sch;

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
    env.DB.prepare("INSERT INTO invitations (design_id, slug, color_scheme, details, photos, status, event_date, manage_token_hash, tier) VALUES (?, ?, ?, ?, '[]', 'pending', ?, ?, ?)")
      .bind(design.id, slug, JSON.stringify(scheme), JSON.stringify(details), details.eventDate, await sha256(randomToken()), tier),
    env.DB.prepare("INSERT INTO orders (product_id, customer_email, amount_centavos, status, terms_accepted_at, reference, customer_id, provider, payment_deadline, tracking_token_hash, updated_at, package_key, package_name, package_kind, designer_notes) VALUES (last_insert_rowid(), ?, ?, 'pending_payment', ?, ?, (SELECT id FROM customers WHERE email = ?), ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(email, pkg.priceCentavos, now.toISOString(), reference, email, provider.key,
        new Date(now.getTime() + settings.deadlineHours * 3_600_000).toISOString(), await sha256(trackingToken), now.toISOString(), pkg.key, pkg.name,
        custom ? 'custom' : 'template', custom ? notes : null),
    env.DB.prepare("INSERT INTO order_events (order_id, at, actor, kind, from_status, to_status, note, visible) VALUES (last_insert_rowid(), ?, 'customer', 'status', NULL, 'pending_payment', 'Order placed', 1)")
      .bind(now.toISOString()),
  ]);
  const invitationId = inv.meta.last_row_id;
  const orderId = ord.meta.last_row_id;

  const keys: string[] = [];
  let giftKey: string | null = null;
  let start;
  try {
    for (const [n, p] of (photos as string[]).entries()) keys.push(await putPhoto(env, invitationId, n, p));
    if (giftQr !== undefined) giftKey = await putPhoto(env, invitationId, 'gift', giftQr as string);
    await env.DB.prepare('UPDATE invitations SET photos = ?, style = ?, gift_qr = ? WHERE id = ?')
      .bind(JSON.stringify(keys), JSON.stringify(coverIndexToKey(sv.style, keys)), giftKey, invitationId).run();
    start = await provider.start({ id: orderId, reference, amountCentavos: pkg.priceCentavos, email, itemName: `${occasion.label} invitation: ${design.name}` }, { env, origin });
    if (start.kind === 'redirect') await env.DB.prepare('UPDATE orders SET paymongo_checkout_id = ? WHERE id = ?').bind(start.providerRef, orderId).run();
  } catch (e) {
    console.error('checkout failed:', e instanceof Error ? e.message : e);
    const doomed = giftKey ? [...keys, giftKey] : keys;
    if (doomed.length) await env.PHOTOS.delete(doomed);
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

// Body: { details, photos, style?, colorScheme? }. photos is the full desired list; each entry is either one of this
// invitation's current R2 keys (kept) or a new image data URL (uploaded). Removed keys are deleted.
// style.cover.photo is an index into the new photos list or a kept key; without a style the stored cover follows its photo.
// colorScheme may switch between the design's schemes and 'Custom' (with style.colors); the design stays fixed.
async function manageEdit(request: Request, env: Env, inv: any): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  if (['design', 'designSlug'].some((k) => k in body)) return json({ error: 'The design cannot be changed after payment.' }, 400);

  const occasion = occasionOf(inv.product_type);
  if (!occasion) return NOT_FOUND();
  const v = occasion.validateDetails(body.details);
  if (v.ok === false) return json({ error: v.error }, 400);
  const old = parse(inv.details, {});
  if (occasion.lockedFieldsChanged(old, v.details)) return json({ error: occasion.lockedMessage }, 400);
  // An unchanged past date (the wedding already happened) must not block other edits
  if (v.details.eventDate !== old.eventDate && v.details.eventDate < todayUtc()) return json({ error: pastDate(occasion) }, 400);

  const tier = tierOf(inv);
  const current: string[] = parse(inv.photos, []);
  const photos: unknown = body.photos ?? [];
  if (!Array.isArray(photos)) return json({ error: 'Photos must be a list.' }, 400);
  if (photos.length > photoLimit(tier)) return json({ error: `Too many photos (max ${photoLimit(tier)}).` }, 400);
  for (const p of photos) {
    if (current.includes(p as string)) continue;
    if (typeof p === 'string' && !p.startsWith('data:')) return json({ error: 'Unknown photo.' }, 400);
    const err = photoError(p);
    if (err) return json({ error: err }, 400);
  }

  // giftQr: absent keeps the stored QR, null removes it, a data URL replaces it
  const giftQr: unknown = inv.gift_qr && body.giftQr === inv.gift_qr ? undefined : body.giftQr; // the stored key means keep
  if (giftQr !== undefined && giftQr !== null) {
    const err = giftQrError(giftQr);
    if (err) return json({ error: err }, 400);
  }

  const stored: InvitationStyle = parse(inv.style, {});
  let style = stored;
  if (body.style !== undefined) {
    const sv = validateStyle(body.style, { photoCount: photos.length, photoKeys: current.filter((k) => photos.includes(k)), tier,
      // The unchanged stored track stays valid after it is deactivated or deleted (guests just get no music)
      trackIds: [...await activeTrackIds(env.DB), ...(stored.music === undefined ? [] : [stored.music])] });
    if ('error' in sv) return json({ error: sv.error }, 400);
    style = sv.style;
  }
  let scheme: string = inv.color_scheme; // untouched unless the scheme name or custom colours change
  const name = 'colorScheme' in body ? body.colorScheme : parse(inv.color_scheme, {}).name;
  if ('colorScheme' in body || name === 'Custom' || style.colors) {
    const sch = schemeFor(inv.design_color_schemes, name, style);
    if ('error' in sch) return json({ error: sch.error }, 400);
    scheme = JSON.stringify(sch.scheme);
  }

  const added: string[] = [];
  const keys: string[] = [];
  let giftKey: string | null = inv.gift_qr ?? null;
  try {
    // New photos get a time-based index so a deleted key is never reused (the photo route caches for a day)
    const base = Date.now() * 10;
    for (const [n, p] of (photos as string[]).entries()) {
      if (current.includes(p)) { keys.push(p); continue; }
      const key = await putPhoto(env, inv.id, base + n, p);
      added.push(key);
      keys.push(key);
    }
    if (giftQr === null) giftKey = null;
    else if (giftQr !== undefined) {
      giftKey = await putPhoto(env, inv.id, 'gift', giftQr as string);
      if (giftKey !== inv.gift_qr) added.push(giftKey);
    }
    style = body.style !== undefined ? coverIndexToKey(style, keys) : remapCover(stored, current, keys);
    await env.DB.prepare('UPDATE invitations SET details = ?, event_date = ?, photos = ?, style = ?, color_scheme = ?, gift_qr = ? WHERE id = ?')
      .bind(JSON.stringify(v.details), v.details.eventDate, JSON.stringify(keys), JSON.stringify(style), scheme, giftKey, inv.id).run();
  } catch (e) {
    if (added.length) await env.PHOTOS.delete(added);
    throw e;
  }
  const removed = current.filter((k) => !keys.includes(k));
  if (inv.gift_qr && inv.gift_qr !== giftKey) removed.push(inv.gift_qr);
  if (removed.length) await env.PHOTOS.delete(removed);
  return json({ ok: true, details: v.details, photos: keys, giftQr: giftKey, style });
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

const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
// 12 chars from 64 symbols: 256 % 64 === 0, so masking a byte has no modulo bias
const guestToken = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => TOKEN_CHARS[b & 63]).join('');

// Guests ordered by name (case-insensitive), then id. rsvp is null until the guest replies.
async function listGuests(env: Env, inv: any): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.name, g.seats, g.token, g.created_at, r.attending, r.party_size, r.kids_count, r.created_at AS submitted
     FROM invitation_guests g LEFT JOIN rsvps r ON r.guest_id = g.id AND r.invitation_id = g.invitation_id
     WHERE g.invitation_id = ? ORDER BY lower(g.name), g.id`,
  ).bind(inv.id).all<any>();
  return json({ guests: (results || []).map((g) => ({
    id: g.id, name: g.name, seats: g.seats, token: g.token, createdAt: g.created_at,
    rsvp: g.submitted == null ? null : { attending: !!g.attending, partySize: g.party_size, kidsCount: g.kids_count ?? 0, submitted: g.submitted },
  })) });
}

// Body: { action: 'add', name, seats } | { action: 'update', id, name?, seats? } | { action: 'delete', id }
async function manageGuests(request: Request, env: Env, inv: any): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  if (body.name !== undefined && (!name || name.length > 80)) return json({ error: 'Please enter the guest name (up to 80 characters).' }, 400);
  if (body.seats !== undefined && (!Number.isInteger(body.seats) || body.seats < 1 || body.seats > LIMITS.partySizeMax)) return json({ error: `Seats must be 1 to ${LIMITS.partySizeMax}.` }, 400);

  if (body.action === 'add') {
    if (name === undefined || body.seats === undefined) return json({ error: 'Please enter a name and the number of seats.' }, 400);
    for (let attempt = 0; ; attempt++) {
      const token = guestToken();
      try {
        // One statement, so the 300 cap holds under concurrent adds
        const ins = await env.DB.prepare(
          'INSERT INTO invitation_guests (invitation_id, token, name, seats) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM invitation_guests WHERE invitation_id = ?) < 300',
        ).bind(inv.id, token, name, body.seats, inv.id).run();
        if (!ins.meta.changes) return json({ error: 'You can add up to 300 guests.' }, 400);
        return json({ ok: true, id: ins.meta.last_row_id, token });
      } catch (e) {
        if (attempt > 0 || !/UNIQUE/i.test(String(e))) throw e; // a token clash is astronomically rare: retry once
      }
    }
  }
  const id = body.id;
  if (!Number.isInteger(id)) return json({ error: 'Guest not found.' }, 404);
  if (body.action === 'update') {
    if (name === undefined && body.seats === undefined) return json({ error: 'Nothing to change.' }, 400);
    const up = await env.DB.prepare('UPDATE invitation_guests SET name = COALESCE(?, name), seats = COALESCE(?, seats) WHERE id = ? AND invitation_id = ?')
      .bind(name ?? null, body.seats ?? null, id, inv.id).run();
    return up.meta.changes ? json({ ok: true }) : json({ error: 'Guest not found.' }, 404);
  }
  if (body.action === 'delete') {
    // Their reply stays in the list as a general reply
    const [, del] = await env.DB.batch([
      env.DB.prepare('UPDATE rsvps SET guest_id = NULL WHERE guest_id = ? AND invitation_id = ?').bind(id, inv.id),
      env.DB.prepare('DELETE FROM invitation_guests WHERE id = ? AND invitation_id = ?').bind(id, inv.id),
    ]);
    return del.meta.changes ? json({ ok: true }) : json({ error: 'Guest not found.' }, 404);
  }
  return json({ error: 'Unknown action.' }, 400);
}

// Expired invitations show only the title: no details, photos or RSVP state.
// A ?g= token of one of this invitation's guests adds guest: { name, seats, rsvp }; any other token is ignored.
async function guest(env: Env, slug: string | null, token: string | null): Promise<Response> {
  const inv = slug === null ? null : await findGuestInvitation(env.DB, slug);
  if (!inv) return NOT_FOUND();
  const occasion = occasionOf(inv.product_type);
  if (!occasion) return NOT_FOUND();
  const details = parse(inv.details, {});
  if (inv.status === 'expired') return json({ state: 'expired', title: occasion.title(details) });
  const keys: string[] = parse(inv.photos, []);
  // Guests get the cover as an index into photos (the keys stay server-side); a missing key drops the cover
  const { cover, ...style }: InvitationStyle = parse(inv.style, {});
  const coverIndex = cover ? keys.indexOf(cover.photo as string) : -1;
  const premium = tierOf(inv) === 'premium';
  // A deactivated or deleted track just means no music; the page still opens
  const track = premium && style.music !== undefined
    ? await env.DB.prepare('SELECT r2_key, title, credit FROM music_tracks WHERE id = ? AND active = 1').bind(style.music).first<any>() : null;
  const g = token ? await env.DB.prepare(
    'SELECT g.name, g.seats, r.attending, r.party_size FROM invitation_guests g LEFT JOIN rsvps r ON r.guest_id = g.id AND r.invitation_id = g.invitation_id WHERE g.token = ? AND g.invitation_id = ?',
  ).bind(token, inv.id).first<any>() : null;
  return json({
    ...(g ? { guest: { name: g.name, seats: g.seats, rsvp: g.attending == null ? null : { attending: !!g.attending, partySize: g.party_size } } } : {}),
    state: 'live', tier: tierOf(inv), intro: premium && style.intro !== false,
    music: track ? { url: mediaUrl(track.r2_key), title: track.title, credit: track.credit } : null, productType: inv.product_type, askKids: occasion.askKids, layoutKey: inv.layout_key, colorScheme: parse(inv.color_scheme, {}), details,
    photos: keys.map((k) => `/photos/${k}`),
    giftQr: inv.gift_qr ? `/photos/${inv.gift_qr}` : null,
    style: coverIndex < 0 ? style : { ...style, cover: { ...cover, photo: coverIndex } },
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

  // An unknown guestToken is a general RSVP (no error), like an unknown ?g= on the page
  const g = typeof body.guestToken === 'string' && body.guestToken
    ? await env.DB.prepare('SELECT id, name, seats FROM invitation_guests WHERE token = ? AND invitation_id = ?').bind(body.guestToken, inv.id).first<any>() : null;
  const v = validateRsvp({ guestName: g ? g.name : body.guestName, attending: body.attending, partySize: body.partySize, kidsCount: body.kidsCount, message: body.message }, { askKids: occasion.askKids });
  if (v.ok === false) return json({ error: v.error }, 400);
  const r = v.rsvp;
  if (g && r.partySize + r.kidsCount > g.seats) return json({ error: `You can reply for up to ${g.seats} guests in total.` }, 400);
  // One statement, so the 300 cap holds even with concurrent submissions. A guest's earlier reply is deleted in the
  // same batch (one reply per guest); it is gone before the count, so a replacement is never blocked by the cap.
  const [, ins] = await env.DB.batch([
    env.DB.prepare('DELETE FROM rsvps WHERE guest_id = ? AND invitation_id = ?').bind(g?.id ?? null, inv.id),
    env.DB.prepare(
      'INSERT INTO rsvps (invitation_id, guest_name, attending, party_size, kids_count, message, guest_id) SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM rsvps WHERE invitation_id = ?) < 300',
    ).bind(inv.id, r.guestName, r.attending ? 1 : 0, r.partySize, r.kidsCount, r.message, g?.id ?? null, inv.id),
  ]);
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
