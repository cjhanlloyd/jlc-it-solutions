/// <reference types="@cloudflare/workers-types" />
// Admin music library: list, upload an MP3, edit, reorder, delete. Requires designs.manage.
import { verifyAdminToken } from '../../../../server/crypto';
import { deleteMedia, mediaUrl, putAudio } from '../../../../server/media';
import { can } from '../../../../server/permissions';

interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  JWT_SECRET?: string;
}
type Admin = { email: string; role: string };

const json = (data: unknown, status = 200) => Response.json(data, { status });
const isId = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;
const NOT_FOUND = () => json({ error: 'Track not found.' }, 404);
const text = (v: unknown, min: number, max: number) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const path = new URL(request.url).pathname.replace(/\/+$/, '').replace(/^\/api\/admin\/music/, '');
  try {
    const me: Admin | null = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'designs.manage')) return json({ error: 'Your role cannot do this.' }, 403);
    const route = `${request.method} ${path}`;
    if (route === 'GET ') {
      const { results } = await env.DB.prepare('SELECT id, title, credit, r2_key, active, sort_order, created_at FROM music_tracks ORDER BY sort_order, id').all<any>();
      return json({ tracks: (results || []).map((t) => ({ id: t.id, title: t.title, credit: t.credit, url: mediaUrl(t.r2_key), active: !!t.active, sortOrder: t.sort_order, createdAt: t.created_at })) });
    }
    if (route === 'POST ') return await action(env, me, (await request.json().catch(() => null)) ?? {});
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('admin music API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

async function action(env: Env, me: Admin, b: any): Promise<Response> {
  // The change is already committed, so a failed audit row is logged, not surfaced
  const audit = async (what: string) => {
    try { await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'music', ?)").bind(new Date().toISOString(), `${me.email} ${what}`).run(); } catch (e) { console.error('audit log failed:', e); }
  };

  if (b.action === 'create') {
    if (!text(b.title, 1, 80)) return json({ error: 'Title must be 1 to 80 characters.' }, 400);
    if (b.credit !== undefined && b.credit !== '' && !text(b.credit, 0, 120)) return json({ error: 'Credit must be 120 characters or fewer.' }, 400);
    const put = await putAudio(env.PHOTOS, b.file);
    if ('error' in put) return json({ error: put.error }, 400);
    try {
      const r = await env.DB.prepare('INSERT INTO music_tracks (title, credit, r2_key, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM music_tracks))')
        .bind(b.title.trim(), String(b.credit ?? '').trim(), put.key).run();
      await audit(`added music track ${b.title.trim()}`);
      return json({ ok: true, id: r.meta.last_row_id });
    } catch (e) {
      await deleteMedia(env.PHOTOS, put.key);
      throw e;
    }
  }
  if (b.action === 'update') {
    if (!isId(b.id) || !text(b.title, 1, 80) || !(b.credit === undefined || text(b.credit, 0, 120)) || typeof b.active !== 'boolean') return json({ error: 'A track id, a title (1 to 80 characters), a credit and an active flag are required.' }, 400);
    const r = await env.DB.prepare('UPDATE music_tracks SET title = ?, credit = ?, active = ? WHERE id = ?').bind(b.title.trim(), String(b.credit ?? '').trim(), b.active ? 1 : 0, b.id).run();
    if (!r.meta.changes) return NOT_FOUND();
    await audit(`updated music track ${b.id} (${b.title.trim()}, ${b.active ? 'active' : 'hidden'})`);
    return json({ ok: true });
  }
  if (b.action === 'reorder') {
    if (!Array.isArray(b.ids) || !b.ids.length || !b.ids.every(isId) || new Set(b.ids).size !== b.ids.length) return json({ error: 'ids must be a list of distinct track ids.' }, 400);
    await env.DB.batch((b.ids as number[]).map((id, i) => env.DB.prepare('UPDATE music_tracks SET sort_order = ? WHERE id = ?').bind(i + 1, id)));
    await audit(`reordered music tracks ${b.ids.join(',')}`);
    return json({ ok: true });
  }
  if (b.action === 'delete') {
    if (!isId(b.id)) return json({ error: 'A track id is required.' }, 400);
    const r = await env.DB.prepare('DELETE FROM music_tracks WHERE id = ? RETURNING r2_key, title').bind(b.id).first<any>();
    if (!r) return NOT_FOUND();
    try { await deleteMedia(env.PHOTOS, r.r2_key); } catch (e) { console.error('music media cleanup failed:', e); }
    await audit(`deleted music track ${r.title}`);
    return json({ ok: true });
  }
  return json({ error: 'Unknown action.' }, 400);
}
