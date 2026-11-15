/// <reference types="@cloudflare/workers-types" />
// Admin designs: list, detail, create/update with packages and image upload, toggle, reorder. Requires designs.manage.
import { verifyAdminToken } from '../../../../server/crypto';
import { MEDIA_PATH_RE, validateDesign } from '../../../../server/designs';
import { deleteMedia, mediaUrl, putMedia } from '../../../../server/media';
import { can } from '../../../../server/permissions';

interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  JWT_SECRET?: string;
}
type Admin = { email: string; role: string };

const json = (data: unknown, status = 200) => Response.json(data, { status });
const parse = (s: string | null, fallback: unknown) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
const isId = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;
const NOT_FOUND = () => json({ error: 'Design not found.' }, 404);
const SLUG_TAKEN = () => json({ error: 'That slug is already used by another design.' }, 409);
// '/media/design/x.png' → 'media/design/x.png'
const keyOf = (path: string) => 'media/' + path.slice('/media/'.length);

const SELECT = 'SELECT d.*, (SELECT COUNT(*) FROM orders o JOIN invitations i ON i.id = o.product_id WHERE i.design_id = d.id) AS orderCount FROM products_designs d';
const summary = (d: any) => ({
  id: d.id, slug: d.slug, name: d.name, productType: d.product_type, layoutKey: d.layout_key, active: !!d.active, featured: !!d.featured,
  sortOrder: d.sort_order, fromPriceCentavos: d.price_centavos, previewImages: parse(d.preview_images, []), packages: parse(d.packages, []), orderCount: d.orderCount,
});

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/+$/, '').replace(/^\/api\/admin\/designs/, '');
  try {
    const me: Admin | null = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'designs.manage')) return json({ error: 'Your role cannot do this.' }, 403);
    const route = `${request.method} ${path}`;
    if (route === 'GET ') {
      const { results } = await env.DB.prepare(`${SELECT} ORDER BY d.sort_order, d.id`).all<any>();
      return json({ designs: (results || []).map(summary) });
    }
    const id = route.match(/^GET \/(\d+)$/)?.[1];
    if (id) {
      const d = await env.DB.prepare(`${SELECT} WHERE d.id = ?`).bind(Number(id)).first<any>();
      if (!d) return NOT_FOUND();
      return json({ design: { ...summary(d), description: d.description ?? '', colorSchemes: parse(d.color_schemes, []), sampleDetails: parse(d.sample_details, {}) } });
    }
    if (route === 'POST ') return await action(env, me, (await request.json().catch(() => null)) ?? {});
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('admin designs API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

async function action(env: Env, me: Admin, b: any): Promise<Response> {
  // The change is already committed, so a failed audit row is logged, not surfaced
  const audit = async (what: string) => {
    try { await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'design', ?)").bind(new Date().toISOString(), `${me.email} ${what}`).run(); } catch (e) { console.error('audit log failed:', e); }
  };

  if (b.action === 'toggle') {
    if (!isId(b.id) || (b.field !== 'active' && b.field !== 'featured') || typeof b.value !== 'boolean') return json({ error: 'A design id, a field (active or featured) and a true/false value are required.' }, 400);
    // b.field is one of two fixed column names, checked above
    const r = await env.DB.prepare(`UPDATE products_designs SET ${b.field} = ? WHERE id = ? RETURNING slug`).bind(b.value ? 1 : 0, b.id).first<any>();
    if (!r) return NOT_FOUND();
    await audit(`set ${b.field} ${b.value} on design ${r.slug}`);
    return json({ ok: true });
  }
  if (b.action === 'reorder') {
    if (!Array.isArray(b.ids) || !b.ids.length || !b.ids.every(isId) || new Set(b.ids).size !== b.ids.length) return json({ error: 'ids must be a list of distinct design ids.' }, 400);
    await env.DB.batch((b.ids as number[]).map((id, i) => env.DB.prepare('UPDATE products_designs SET sort_order = ? WHERE id = ?').bind(i + 1, id)));
    await audit(`reordered designs ${b.ids.join(',')}`);
    return json({ ok: true });
  }
  if (b.action !== 'create' && b.action !== 'update') return json({ error: 'Unknown action.' }, 400);
  if (b.action === 'update' && !isId(b.id)) return json({ error: 'A design id is required.' }, 400);
  const v = validateDesign(b);
  if (v.ok === false) return json({ error: v.error }, 400);
  const d = v.d;

  let oldImages: string[] = [];
  if (b.action === 'update') {
    const stored = await env.DB.prepare(`${SELECT} WHERE d.id = ?`).bind(b.id).first<any>();
    if (!stored) return NOT_FOUND();
    // Live invitations read layout_key and product_type from their design, so both are fixed for life
    if (stored.layout_key !== d.layout_key || stored.product_type !== d.product_type) return json({ error: "A design's layout and type can't be changed; add a new design instead." }, 409);
    if (stored.slug !== d.slug && stored.orderCount > 0) return json({ error: "This design already has orders, so its web address can't change." }, 409);
    oldImages = parse(stored.preview_images, []);
  }
  // A /media/ path may only be one this design already has (never on create), so no design can claim and later delete another's image
  if ((d.images as string[]).some((u) => MEDIA_PATH_RE.test(u) && !oldImages.includes(u))) return json({ error: "That image doesn't belong to this design." }, 400);
  const taken = await env.DB.prepare('SELECT id FROM products_designs WHERE slug = ? AND id != ?').bind(d.slug, b.action === 'update' ? b.id : 0).first();
  if (taken) return SLUG_TAKEN();

  // Upload new images; on any failure remove what this request already stored
  const uploaded: string[] = [];
  const dropUploaded = () => Promise.all(uploaded.map((k) => deleteMedia(env.PHOTOS, k)));
  const images: string[] = [];
  try {
    for (const img of d.images as string[]) {
      if (!img.startsWith('data:')) { images.push(img); continue; }
      const r = await putMedia(env.PHOTOS, 'design', img);
      if ('error' in r) { await dropUploaded(); return json({ error: r.error }, 400); }
      uploaded.push(r.key);
      images.push(mediaUrl(r.key));
    }
  } catch (e) {
    await dropUploaded(); // R2 put threw: remove what this request already stored
    throw e;
  }

  let newId = b.id;
  try {
    const fields = [d.slug, d.name, d.price_centavos, d.color_schemes, JSON.stringify(images), d.sample_details, d.active, d.description, d.featured, d.packages];
    if (b.action === 'create') {
      const r = await env.DB.prepare(
        'INSERT INTO products_designs (slug, name, price_centavos, color_schemes, preview_images, sample_details, active, description, featured, packages, layout_key, product_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM products_designs))',
      ).bind(...fields, d.layout_key, d.product_type).run();
      newId = r.meta.last_row_id;
    } else {
      const r = await env.DB.prepare(
        'UPDATE products_designs SET slug = ?, name = ?, price_centavos = ?, color_schemes = ?, preview_images = ?, sample_details = ?, active = ?, description = ?, featured = ?, packages = ? WHERE id = ?',
      ).bind(...fields, b.id).run();
      if (!r.meta.changes) { await dropUploaded(); return NOT_FOUND(); }
    }
  } catch (e) {
    await dropUploaded();
    if (/UNIQUE/i.test(String(e))) return SLUG_TAKEN(); // lost a race with another admin
    throw e;
  }

  // Saved: now remove uploaded images the admin took out of the list
  const removed = oldImages.filter((u) => MEDIA_PATH_RE.test(u) && !images.includes(u));
  try { await Promise.all(removed.map((u) => deleteMedia(env.PHOTOS, keyOf(u)))); } catch (e) { console.error('design media cleanup failed:', e); }
  await audit(`${b.action === 'create' ? 'created' : 'updated'} design ${d.slug}`);
  return json({ ok: true, id: newId });
}
