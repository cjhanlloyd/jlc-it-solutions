/// <reference types="@cloudflare/workers-types" />
// Public reviews: approved only, newest first. Never returns emails or ids.
import { averageRating } from '../../shared/reviews';

interface Env { DB: D1Database }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const n = Number(new URL(request.url).searchParams.get('limit'));
    const limit = Number.isInteger(n) && n >= 1 ? Math.min(n, 200) : 12;
    const [stats, rows] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(rating), 0) AS total FROM reviews WHERE status = 'approved'").first<any>(),
      env.DB.prepare("SELECT display_name, rating, body, COALESCE(moderated_at, updated_at) AS date FROM reviews WHERE status = 'approved' ORDER BY COALESCE(moderated_at, updated_at) DESC, id DESC LIMIT ?").bind(limit).all<any>(),
    ]);
    const count = stats?.count ?? 0;
    return Response.json(
      { average: averageRating(stats?.total ?? 0, count), count, reviews: (rows.results || []).map((r) => ({ displayName: r.display_name, rating: r.rating, body: r.body, date: r.date })) },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (e) {
    console.error('reviews API error:', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Something went wrong.' }, { status: 500 });
  }
};
