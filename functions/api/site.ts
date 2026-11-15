/// <reference types="@cloudflare/workers-types" />
// Public site content: homepage copy, invitation FAQs, published testimonials, the active banner.
import { mediaUrl } from '../../server/media';

interface Env { DB: D1Database }

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const [homeRow, faqs, tms, b] = await Promise.all([
      env.DB.prepare("SELECT value FROM site_content WHERE key = 'home'").first<any>(),
      env.DB.prepare("SELECT question, answer FROM faqs WHERE category = 'invitations' ORDER BY sort_order, id").all<any>(),
      env.DB.prepare('SELECT name, occasion, quote, photo_key FROM testimonials WHERE published = 1 ORDER BY sort_order, id').all<any>(),
      env.DB.prepare("SELECT * FROM site_banner WHERE id = 'default'").first<any>(),
    ]);
    let home = { eyebrow: '', headline: '', subheadline: '' };
    try { if (homeRow) home = { ...home, ...JSON.parse(homeRow.value) }; } catch { /* keep default */ }
    const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Asia/Manila
    const live = b && b.active && b.message && (!b.starts_at || b.starts_at <= today) && (!b.ends_at || b.ends_at >= today);
    return Response.json({
      home,
      faqs: (faqs.results || []).map((f) => ({ q: f.question, a: f.answer })),
      testimonials: (tms.results || []).map((t) => ({ name: t.name, occasion: t.occasion, quote: t.quote, photoUrl: t.photo_key ? mediaUrl(t.photo_key) : null })),
      banner: live ? { message: b.message, link: b.link || null } : null,
    }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (e) {
    console.error('site API error:', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Something went wrong.' }, { status: 500 });
  }
};
