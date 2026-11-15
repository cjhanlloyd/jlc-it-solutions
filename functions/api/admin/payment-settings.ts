/// <reference types="@cloudflare/workers-types" />
// GCash payment settings (Super Admin). The provider is not editable here: manual GCash is the only live path.
import { verifyAdminToken } from '../../../server/crypto';
import { decodeImage } from '../../../server/images';
import { loadPaymentSettings } from '../../../server/payments';
import { can } from '../../../server/permissions';

interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  JWT_SECRET?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const QR_MAX_BYTES = 2_000_000;
// [body field, max length]
const TEXT_FIELDS = [['gcashAccountName', 80], ['gcashNumber', 30], ['instructions', 1000]] as const;

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const me = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'settings.payment')) return json({ error: 'Your role cannot do this.' }, 403);
    const current = await loadPaymentSettings(env.DB);
    if (request.method === 'GET') return json({ ...current, qrUrl: current.qrKey ? '/api/orders/gcash-qr' : null });
    if (request.method !== 'POST') return json({ error: 'Not found.' }, 404);
    return await save(env, me.email, current, await request.json().catch(() => ({})));
  } catch (e) {
    console.error('payment settings API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

// Fields left out keep their current value.
async function save(env: Env, adminEmail: string, current: Awaited<ReturnType<typeof loadPaymentSettings>>, b: any): Promise<Response> {
  const next = { ...current };
  for (const [field, max] of TEXT_FIELDS) {
    if (b[field] === undefined) continue;
    if (typeof b[field] !== 'string' || b[field].trim().length > max) return json({ error: `${field} must be text of up to ${max} characters.` }, 400);
    next[field] = b[field].trim();
  }
  if (b.deadlineHours !== undefined) {
    if (!Number.isInteger(b.deadlineHours) || b.deadlineHours < 1 || b.deadlineHours > 168) return json({ error: 'The payment deadline must be 1 to 168 hours.' }, 400);
    next.deadlineHours = b.deadlineHours;
  }
  let newKey: string | null = null;
  if (b.qrImage !== undefined) {
    const img = decodeImage(b.qrImage, QR_MAX_BYTES);
    if (img === 'size') return json({ error: 'The QR image is too large (max 2 MB).' }, 400);
    if (img === 'type') return json({ error: 'The QR code must be a PNG, JPEG or WebP image.' }, 400);
    newKey = `settings/gcash-qr-${Date.now()}.${img.ext}`;
    await env.PHOTOS.put(newKey, img.bytes, { httpMetadata: { contentType: `image/${img.type}` } });
  }
  let saved = false;
  try {
    // Upsert: a database without the 'default' row (production lost its seed) must still save
    await env.DB.prepare(`INSERT INTO payment_settings (id, gcash_account_name, gcash_number, instructions, deadline_hours, qr_key, updated_at)
      VALUES ('default', ?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(id) DO UPDATE SET gcash_account_name = ?1, gcash_number = ?2, instructions = ?3, deadline_hours = ?4, qr_key = ?5, updated_at = ?6`)
      .bind(next.gcashAccountName, next.gcashNumber, next.instructions, next.deadlineHours, newKey ?? current.qrKey, new Date().toISOString()).run();
    saved = true;
  } finally {
    // Only one QR object is referenced at a time: drop the unused one
    const unused = saved ? current.qrKey : newKey;
    if (newKey && unused) await env.PHOTOS.delete(unused).catch((e) => console.error('QR delete failed:', e instanceof Error ? e.message : e));
  }
  await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)")
    .bind(new Date().toISOString(), `${adminEmail} updated the GCash payment settings`).run();
  return json({ ok: true });
}
