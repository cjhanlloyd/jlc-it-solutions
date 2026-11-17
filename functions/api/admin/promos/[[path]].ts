/// <reference types="@cloudflare/workers-types" />
// Admin promo codes: list with redemption stats, create, update, toggle, delete. Requires promos.manage.
import { verifyAdminToken } from '../../../../server/crypto';
import { can } from '../../../../server/permissions';
import { PAID_STATUSES } from '../../../../shared/order-status';
import { validatePromoInput } from '../../../../shared/promo';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}
type Admin = { email: string; role: string };

const json = (data: unknown, status = 200) => Response.json(data, { status });
const isId = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;
const NOT_FOUND = () => json({ error: 'Promo code not found.' }, 404);
const TAKEN = () => json({ error: 'That promo code already exists.' }, 409);
const PAID = PAID_STATUSES.map((s) => `'${s}'`).join(', ');

// uses: orders that are not cancelled; redeemed, discount and revenue: paid orders only
const STATS = `SELECT p.*,
  (SELECT COUNT(*) FROM orders o WHERE o.promo_code = p.code AND o.status != 'cancelled') AS uses,
  (SELECT COUNT(*) FROM orders o WHERE o.promo_code = p.code AND o.status IN (${PAID})) AS redeemed,
  (SELECT COALESCE(SUM(o.discount_centavos), 0) FROM orders o WHERE o.promo_code = p.code AND o.status IN (${PAID})) AS discountGiven,
  (SELECT COALESCE(SUM(o.amount_centavos), 0) FROM orders o WHERE o.promo_code = p.code AND o.status IN (${PAID})) AS revenue
  FROM promo_codes p`;
const summary = (p: any) => ({
  id: p.id, code: p.code, description: p.description, discountType: p.discount_type, discountValue: p.discount_value,
  minPurchaseCentavos: p.min_purchase_centavos, startsAt: p.starts_at, expiresAt: p.expires_at, maxUses: p.max_uses, active: !!p.active, createdAt: p.created_at,
  uses: p.uses, redeemed: p.redeemed, discountGivenCentavos: p.discountGiven, revenueCentavos: p.revenue,
});

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const path = new URL(request.url).pathname.replace(/\/+$/, '').replace(/^\/api\/admin\/promos/, '');
  try {
    const me: Admin | null = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'promos.manage')) return json({ error: 'Your role cannot do this.' }, 403);
    const route = `${request.method} ${path}`;
    if (route === 'GET ') {
      const { results } = await env.DB.prepare(`${STATS} ORDER BY p.id DESC`).all<any>();
      return json({ promos: (results || []).map(summary) });
    }
    if (route === 'POST ') return await action(env, me, (await request.json().catch(() => null)) ?? {});
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('admin promos API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

async function action(env: Env, me: Admin, b: any): Promise<Response> {
  // The change is already committed, so a failed audit row is logged, not surfaced
  const audit = async (what: string) => {
    try { await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'promo', ?)").bind(new Date().toISOString(), `${me.email} ${what}`).run(); } catch (e) { console.error('audit log failed:', e); }
  };
  const uses = async (id: number) => (await env.DB.prepare("SELECT code, (SELECT COUNT(*) FROM orders o WHERE o.promo_code = promo_codes.code AND o.status != 'cancelled') AS uses FROM promo_codes WHERE id = ?").bind(id).first<any>());

  if (b.action === 'create' || b.action === 'update') {
    const v = validatePromoInput(b);
    if (v.ok === false) return json({ error: v.error }, 400);
    const p = v.value;
    const vals = [p.code, p.description, p.discountType, p.discountValue, p.minPurchaseCentavos, p.startsAt, p.expiresAt, p.maxUses];
    try {
      if (b.action === 'create') {
        const r = await env.DB.prepare('INSERT INTO promo_codes (code, description, discount_type, discount_value, min_purchase_centavos, starts_at, expires_at, max_uses, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(...vals, b.active === false ? 0 : 1).run();
        await audit(`created promo code ${p.code}`);
        return json({ ok: true, id: r.meta.last_row_id });
      }
      if (!isId(b.id)) return json({ error: 'A promo code id is required.' }, 400);
      const cur = await uses(b.id);
      if (!cur) return NOT_FOUND();
      if (cur.uses > 0 && cur.code !== p.code) return json({ error: 'This code has been used, so its code cannot change.' }, 409);
      await env.DB.prepare('UPDATE promo_codes SET code = ?, description = ?, discount_type = ?, discount_value = ?, min_purchase_centavos = ?, starts_at = ?, expires_at = ?, max_uses = ? WHERE id = ?')
        .bind(...vals, b.id).run();
      await audit(`updated promo code ${p.code}`);
      return json({ ok: true });
    } catch (e) {
      if (/UNIQUE/i.test(String(e))) return TAKEN();
      throw e;
    }
  }
  if (b.action === 'toggle') {
    if (!isId(b.id) || typeof b.active !== 'boolean') return json({ error: 'A promo code id and an active flag are required.' }, 400);
    const r = await env.DB.prepare('UPDATE promo_codes SET active = ? WHERE id = ? RETURNING code').bind(b.active ? 1 : 0, b.id).first<any>();
    if (!r) return NOT_FOUND();
    await audit(`${b.active ? 'activated' : 'deactivated'} promo code ${r.code}`);
    return json({ ok: true });
  }
  if (b.action === 'delete') {
    if (!isId(b.id)) return json({ error: 'A promo code id is required.' }, 400);
    const cur = await uses(b.id);
    if (!cur) return NOT_FOUND();
    if (cur.uses > 0) return json({ error: 'This code has been used; deactivate it instead.' }, 409);
    await env.DB.prepare('DELETE FROM promo_codes WHERE id = ?').bind(b.id).run();
    await audit(`deleted promo code ${cur.code}`);
    return json({ ok: true });
  }
  return json({ error: 'Unknown action.' }, 400);
}
