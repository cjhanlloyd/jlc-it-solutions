/// <reference types="@cloudflare/workers-types" />
import { randomToken, sha256 } from '../../../server/crypto';
import { customerFromToken } from '../../../server/customer-session';
import { EMAIL_RE, sendSmtpEmail } from '../../../server/email';
import { turnstileError } from '../../../server/turnstile';
import { STATUS_LABEL, type OrderStatus } from '../../../shared/order-status';
import { occasionOf } from '../../../shared/occasions';
import { tierOf } from '../../../shared/tiers';
import { validateReview } from '../../../shared/reviews';

interface Env {
  DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const parse = (s: string, fallback: unknown) => { try { return JSON.parse(s); } catch { return fallback; } };
const BAD_CODE = 'That code is not valid or has expired. Request a new one.';
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const SESSION_DAYS = 30;
const normEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();

// Six digits, uniform: values above the last whole multiple of 1,000,000 are redrawn (no modulo bias).
function sixDigits(): string {
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= 4_294_000_000);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const route = `${request.method} ${new URL(request.url).pathname.replace(/\/+$/, '')}`;
  try {
    if (route === 'POST /api/account/code') return await requestCode(context);
    if (route === 'POST /api/account/verify') return await verify(request, env);
    if (route === 'GET /api/account') return await account(request, env);
    if (route === 'POST /api/account/logout') {
      const token = request.headers.get('X-Customer-Token');
      if (token) await env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
      return json({ ok: true });
    }
    if (route === 'GET /api/account/review') return await getReview(request, env);
    if (route === 'POST /api/account/review') return await saveReview(request, env);
    if (route === 'POST /api/account/review/delete') return await deleteReview(request, env);
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('account API error:', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

// Always { ok: true } after Turnstile, so the response never reveals whether the email has orders.
async function requestCode(context: EventContext<Env, any, any>): Promise<Response> {
  const { request, env } = context;
  const body: any = await request.json().catch(() => ({}));
  const spam = await turnstileError(request, env.TURNSTILE_SECRET_KEY, body.turnstileToken);
  if (spam) return spam;
  const email = normEmail(body.email);
  if (!EMAIL_RE.test(email)) return json({ ok: true });

  // 3 requests per email per hour, counted in audit_logs (same as the invitation resend)
  const message = `Sign-in code requested for ${email}`;
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM audit_logs WHERE log_type = 'customer_login_code' AND message = ? AND timestamp > ?",
  ).bind(message, new Date(Date.now() - 60 * 60 * 1000).toISOString()).first<any>();
  if ((recent?.count || 0) >= 3) return json({ ok: true });
  await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'customer_login_code', ?)").bind(new Date().toISOString(), message).run();

  // Same work for every email, in the background, so timing reveals nothing. A new code replaces the old one.
  context.waitUntil((async () => {
    try {
      const code = sixDigits();
      await env.DB.prepare('INSERT OR REPLACE INTO customer_login_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)')
        .bind(email, await sha256(`${email}:${code}`), new Date(Date.now() + CODE_MINUTES * 60 * 1000).toISOString()).run();
      const smtp: any = await env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
      await sendSmtpEmail(env.DB, smtp, {
        to: email,
        subject: 'Your sign-in code',
        body: `${code}\n\nIt expires in ${CODE_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
      }, request);
    } catch (e) {
      console.error('Sign-in code failed:', e instanceof Error ? e.message : e);
    }
  })());
  return json({ ok: true });
}

// shortcut: no per-IP limit on verify; the 5-attempt cap per code (and 3 codes per email per hour) bounds guessing, upgrade if IP spraying across emails matters.
async function verify(request: Request, env: Env): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const email = normEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const bad = () => json({ error: BAD_CODE }, 400);
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return bad();
  // One atomic statement counts this attempt and decides whether it may be made, so parallel guesses cannot skip the cap
  const row = await env.DB.prepare(
    'UPDATE customer_login_codes SET attempts = attempts + 1 WHERE email = ? AND attempts < ? AND expires_at > ? RETURNING code_hash',
  ).bind(email, MAX_ATTEMPTS, new Date().toISOString()).first<any>();
  if (!row || row.code_hash !== await sha256(`${email}:${code}`)) return bad();
  // The delete is the single use: only the request that removes the row may sign in
  const del = await env.DB.prepare('DELETE FROM customer_login_codes WHERE email = ? AND code_hash = ? RETURNING email').bind(email, row.code_hash).first();
  if (!del) return bad();
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO customers (email) VALUES (?)').bind(email),
    env.DB.prepare('INSERT INTO customer_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)')
      .bind(await sha256(token), email, new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()),
  ]);
  return json({ token, email });
}

async function account(request: Request, env: Env): Promise<Response> {
  const session = await customerFromToken(env.DB, request.headers.get('X-Customer-Token'));
  if (!session) return json({ error: 'Please sign in.' }, 401);
  const { results } = await env.DB.prepare(
    `SELECT o.reference, o.status, o.created_at, o.amount_centavos, o.package_name,
            i.id AS inv_id, i.slug, i.status AS inv_status, i.tier, i.details, i.event_date, d.name AS design_name, d.product_type
     FROM orders o LEFT JOIN invitations i ON i.id = o.product_id LEFT JOIN products_designs d ON d.id = i.design_id
     WHERE lower(o.customer_email) = ? ORDER BY o.created_at DESC, o.id DESC`,
  ).bind(session.email).all<any>();
  const orders = (results || []).map((r) => {
    const details = parse(r.details ?? '{}', {}) as any;
    let title = '';
    try { title = occasionOf(r.product_type)?.title(details) ?? ''; } catch { /* purged details */ }
    const live = r.status === 'delivered' && r.inv_status === 'live';
    return {
      reference: r.reference, status: r.status, statusLabel: STATUS_LABEL[r.status as OrderStatus] ?? r.status, createdAt: r.created_at,
      amountCentavos: r.amount_centavos, packageName: r.package_name, tier: tierOf(r), designName: r.design_name, productType: r.product_type,
      title, eventDate: details.eventDate ?? r.event_date ?? null, invitationId: r.inv_id ?? null,
      ...(live ? { slug: r.slug, live: true } : {}),
    };
  });
  return json({ email: session.email, orders });
}

const reviewOut = (r: any) => (r ? { rating: r.rating, body: r.body, displayName: r.display_name, status: r.status, rejectReason: r.reject_reason, updatedAt: r.updated_at } : null);
const eligible = async (env: Env, email: string) =>
  !!(await env.DB.prepare("SELECT 1 AS ok FROM orders WHERE lower(customer_email) = ? AND status = 'delivered' LIMIT 1").bind(email).first());

async function getReview(request: Request, env: Env): Promise<Response> {
  const session = await customerFromToken(env.DB, request.headers.get('X-Customer-Token'));
  if (!session) return json({ error: 'Please sign in.' }, 401);
  const [ok, review, who] = await Promise.all([
    eligible(env, session.email),
    env.DB.prepare('SELECT * FROM reviews WHERE customer_email = ?').bind(session.email).first<any>(),
    env.DB.prepare('SELECT name FROM customers WHERE email = ?').bind(session.email).first<any>(),
  ]);
  return json({ eligible: ok, review: reviewOut(review), suggestedName: who?.name ?? '' });
}

async function saveReview(request: Request, env: Env): Promise<Response> {
  const session = await customerFromToken(env.DB, request.headers.get('X-Customer-Token'));
  if (!session) return json({ error: 'Please sign in.' }, 401);
  const body: any = await request.json().catch(() => ({}));
  const v = validateReview(body);
  if (v.ok === false) return json({ error: v.error }, 400);
  if (!(await eligible(env, session.email))) return json({ error: 'Reviews are open to customers with a delivered invitation.' }, 403);
  const spam = await turnstileError(request, env.TURNSTILE_SECRET_KEY, body.turnstileToken);
  if (spam) return spam;
  // 5 saves per email per hour, counted in audit_logs
  const message = `Review saved by ${session.email}`;
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE log_type = 'customer_review' AND message = ? AND timestamp > ?")
    .bind(message, new Date(Date.now() - 60 * 60 * 1000).toISOString()).first<any>();
  if ((recent?.count || 0) >= 5) return json({ error: 'You have saved your review several times already. Please try again in an hour.' }, 429);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'customer_review', ?)").bind(now, message).run();
  const row = await env.DB.prepare(
    `INSERT INTO reviews (customer_email, display_name, rating, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)
     ON CONFLICT(customer_email) DO UPDATE SET display_name = excluded.display_name, rating = excluded.rating, body = excluded.body,
       status = 'pending', reject_reason = NULL, updated_at = excluded.updated_at RETURNING *`,
  ).bind(session.email, v.value.displayName, v.value.rating, v.value.body, now, now).first<any>();
  return json({ review: reviewOut(row) });
}

async function deleteReview(request: Request, env: Env): Promise<Response> {
  const session = await customerFromToken(env.DB, request.headers.get('X-Customer-Token'));
  if (!session) return json({ error: 'Please sign in.' }, 401);
  await env.DB.prepare('DELETE FROM reviews WHERE customer_email = ?').bind(session.email).run();
  return json({ ok: true });
}
