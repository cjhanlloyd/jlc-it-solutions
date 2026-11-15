/// <reference types="@cloudflare/workers-types" />
// Admin site content: homepage copy, invitation FAQs, testimonials, banner, contact details, branding. Requires content.manage.
import { verifyAdminToken } from '../../../../server/crypto';
import { decodeImage } from '../../../../server/images';
import { deleteMedia, mediaUrl, putMedia } from '../../../../server/media';
import { INLINE_LINK_RE, isSafeLink } from '../../../../shared/links';
import { can } from '../../../../server/permissions';

interface Env { DB: D1Database; PHOTOS: R2Bucket; JWT_SECRET?: string }
type Admin = { email: string; role: string };

const json = (data: unknown, status = 200) => Response.json(data, { status });
const bad = (error: string) => json({ error }, 400);
const isId = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;
const str = (v: unknown, max: number, required = false) => (typeof v === 'string' && v.trim().length <= max && (!required || v.trim()) ? v.trim() : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Keys getThemeColorHex (server/email.ts) knows
const THEME_COLORS = ['emerald', 'slate', 'indigo', 'violet', 'deepblue'];
const HOME_DEFAULT = { eyebrow: '', headline: '', subheadline: '' };

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const me: Admin | null = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    if (!can(me.role, 'content.manage')) return json({ error: 'Your role cannot do this.' }, 403);
    if (request.method === 'GET') return json(await load(env));
    if (request.method === 'POST') return await write(env, me, (await request.json().catch(() => null)) ?? {});
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    console.error('admin content API error:', e instanceof Error ? e.message : e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

async function load(env: Env) {
  const q = (sql: string) => env.DB.prepare(sql).all<any>().then((r) => r.results || []);
  const [homeRow, faqs, tms, banner, c, b] = await Promise.all([
    env.DB.prepare("SELECT value FROM site_content WHERE key = 'home'").first<any>(),
    q("SELECT id, question, answer FROM faqs WHERE category = 'invitations' ORDER BY sort_order, id"),
    q('SELECT * FROM testimonials ORDER BY sort_order, id'),
    env.DB.prepare("SELECT * FROM site_banner WHERE id = 'default'").first<any>(),
    env.DB.prepare("SELECT * FROM content WHERE id = 'default'").first<any>(),
    env.DB.prepare("SELECT * FROM branding WHERE id = 'default'").first<any>(),
  ]);
  let home = HOME_DEFAULT;
  try { if (homeRow) home = { ...HOME_DEFAULT, ...JSON.parse(homeRow.value) }; } catch { /* keep default */ }
  return {
    home,
    faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    testimonials: tms.map((t) => ({ id: t.id, name: t.name, occasion: t.occasion, quote: t.quote, photoUrl: t.photo_key ? mediaUrl(t.photo_key) : null, published: !!t.published })),
    banner: { message: banner?.message ?? '', link: banner?.link ?? '', active: !!banner?.active, startsAt: banner?.starts_at ?? '', endsAt: banner?.ends_at ?? '' },
    contact: { email: c?.contactEmail ?? '', phone: c?.contactPhone ?? '', address: c?.contactAddress ?? '', hours: c?.contactWorkingHours ?? '', mapEmbedUrl: c?.contactMapEmbedUrl ?? '', facebookUrl: c?.facebookUrl ?? '', whatsappUrl: c?.whatsappUrl ?? '', viberUrl: c?.viberUrl ?? '' },
    branding: { companyName: b?.companyName ?? '', tagline: b?.tagline ?? '', logoType: b?.logoType ?? 'icon', logoIcon: b?.logoIcon ?? '', logoUrl: b?.logoImageBase64 ?? null, themeColor: b?.themeColor ?? 'deepblue' },
  };
}

async function write(env: Env, me: Admin, b: any): Promise<Response> {
  // The change is already committed, so a failed audit row is logged, not surfaced
  const done = async (what: string) => {
    try { await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'content', ?)").bind(new Date().toISOString(), `${me.email} ${what}`).run(); } catch (e) { console.error('audit log failed:', e); }
    return json({ ok: true });
  };
  const idsOk = (ids: unknown, check: (i: unknown) => boolean) => Array.isArray(ids) && ids.length > 0 && ids.every(check) && new Set(ids).size === ids.length;

  if (b.section === 'home') {
    const eyebrow = str(b.eyebrow, 40), headline = str(b.headline, 90), subheadline = str(b.subheadline, 240);
    if (eyebrow === null || headline === null || subheadline === null) return bad('Eyebrow up to 40, headline up to 90 and subheadline up to 240 characters.');
    await env.DB.prepare("INSERT INTO site_content (key, value) VALUES ('home', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify({ eyebrow, headline, subheadline })).run();
    return done('updated homepage copy');
  }

  if (b.section === 'banner') {
    const message = str(b.message, 140), link = str(b.link ?? '', 300);
    if (message === null) return bad('Banner message must be 140 characters or fewer.');
    if (link === null || (link && !isSafeLink(link))) return bad('The banner link must start with / or https://');
    const dates = [b.startsAt ?? '', b.endsAt ?? ''];
    if (!dates.every((d) => d === '' || (typeof d === 'string' && DATE_RE.test(d) && !isNaN(Date.parse(d))))) return bad('Dates must be YYYY-MM-DD or empty.');
    if (typeof b.active !== 'boolean') return bad('active must be true or false.');
    await env.DB.prepare("UPDATE site_banner SET message = ?, link = ?, active = ?, starts_at = ?, ends_at = ?, updated_at = ? WHERE id = 'default'")
      .bind(message, link, b.active ? 1 : 0, dates[0], dates[1], new Date().toISOString()).run();
    return done(`updated banner (${b.active ? 'on' : 'off'})`);
  }

  if (b.section === 'contact') {
    const f = { email: str(b.email, 120), phone: str(b.phone, 40), address: str(b.address, 200), hours: str(b.hours, 120), map: str(b.mapEmbedUrl ?? '', 1000), fb: str(b.facebookUrl ?? '', 300), wa: str(b.whatsappUrl ?? '', 300), vb: str(b.viberUrl ?? '', 300) };
    if (Object.values(f).some((v) => v === null)) return bad('One of the contact fields is missing or too long.');
    if (f.map && !f.map.startsWith('https://www.google.com/maps/embed')) return bad('The map embed URL must start with https://www.google.com/maps/embed');
    if ([f.fb, f.wa, f.vb].some((u) => u && !u.startsWith('https://'))) return bad('Social links must start with https://');
    const r = await env.DB.prepare("UPDATE content SET contactEmail = ?, contactPhone = ?, contactAddress = ?, contactWorkingHours = ?, contactMapEmbedUrl = ?, facebookUrl = ?, whatsappUrl = ?, viberUrl = ? WHERE id = 'default'")
      .bind(f.email, f.phone, f.address, f.hours, f.map, f.fb, f.wa, f.vb).run();
    if (!r.meta.changes) return json({ error: 'Site content has not been set up.' }, 409);
    return done('updated contact details');
  }

  if (b.section === 'branding') {
    const name = str(b.companyName, 60, true), tagline = str(b.tagline ?? '', 120), icon = str(b.logoIcon, 40, true);
    if (name === null || tagline === null || icon === null || (b.logoType !== 'icon' && b.logoType !== 'image')) return bad('Company name, tagline, logo type and icon are required (name up to 60, tagline up to 120).');
    if (b.themeColor !== undefined && !THEME_COLORS.includes(b.themeColor)) return bad('Choose one of the listed theme colours.');
    // The logo stays a data URL: the email builder and Navbar read branding.logoImageBase64 directly
    if (b.logo) {
      const img = decodeImage(b.logo, 500_000);
      if (img === 'type') return bad('Upload a JPEG, PNG or WebP logo');
      if (img === 'size') return bad('Logo must be 500 KB or smaller');
    }
    const r = await env.DB.prepare("UPDATE branding SET companyName = ?, tagline = ?, logoType = ?, logoIcon = ?, logoImageBase64 = COALESCE(?, logoImageBase64), themeColor = COALESCE(?, themeColor) WHERE id = 'default'")
      .bind(name, tagline, b.logoType, icon, b.logo || null, b.themeColor ?? null).run();
    if (!r.meta.changes) return json({ error: 'Branding has not been set up.' }, 409);
    return done('updated branding');
  }

  if (b.section === 'faq') {
    if (b.action === 'save') {
      const question = str(b.question, 160, true), answer = str(b.answer, 800, true);
      if (question === null || answer === null) return bad('A question (up to 160) and an answer (up to 800 characters) are required.');
      const links = [...answer.matchAll(INLINE_LINK_RE)];
      if (answer.split('](').length - 1 !== links.length || /]:|<http|javascript:/i.test(answer)) return bad('Answers can only use links written as [text](/page) or [text](https://…)');
      if (links.some((m) => !isSafeLink(m[2]))) return bad('Links in answers must start with / or https://');
      if (b.id === undefined) {
        await env.DB.prepare("INSERT INTO faqs (id, question, answer, category, sort_order) VALUES (?, ?, ?, 'invitations', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM faqs WHERE category = 'invitations'))")
          .bind('inv-' + crypto.randomUUID().slice(0, 8), question, answer).run();
      } else {
        const r = await env.DB.prepare("UPDATE faqs SET question = ?, answer = ? WHERE id = ? AND category = 'invitations'").bind(question, answer, String(b.id)).run();
        if (!r.meta.changes) return json({ error: 'FAQ not found.' }, 404);
      }
      return done('saved an invitation FAQ');
    }
    if (b.action === 'delete') {
      const r = await env.DB.prepare("DELETE FROM faqs WHERE id = ? AND category = 'invitations'").bind(String(b.id)).run();
      if (!r.meta.changes) return json({ error: 'FAQ not found.' }, 404);
      return done(`deleted FAQ ${b.id}`);
    }
    if (b.action === 'reorder') {
      if (!idsOk(b.ids, (i) => typeof i === 'string')) return bad('ids must be a list of distinct FAQ ids.');
      const have = ((await env.DB.prepare("SELECT id FROM faqs WHERE category = 'invitations'").all<any>()).results || []).map((r) => r.id);
      if (have.length !== b.ids.length || !have.every((id: string) => b.ids.includes(id))) return bad('ids must list every invitation FAQ exactly once.');
      await env.DB.batch((b.ids as string[]).map((id, i) => env.DB.prepare('UPDATE faqs SET sort_order = ? WHERE id = ?').bind(i + 1, id)));
      return done('reordered FAQs');
    }
    return bad('Unknown action.');
  }

  if (b.section === 'testimonial') {
    if (b.action === 'save') {
      const name = str(b.name, 60, true), occasion = str(b.occasion ?? '', 40), quote = str(b.quote, 300, true);
      if (name === null || occasion === null || quote === null || typeof b.published !== 'boolean') return bad('Name (up to 60), occasion (up to 40), quote (up to 300) and published are required.');
      let oldKey: string | null = null;
      if (b.id !== undefined) {
        const t = await env.DB.prepare('SELECT photo_key FROM testimonials WHERE id = ?').bind(b.id).first<any>();
        if (!t) return json({ error: 'Testimonial not found.' }, 404);
        oldKey = t.photo_key;
      }
      let newKey: string | null = null;
      if (b.photo) {
        const r = await putMedia(env.PHOTOS, 'testimonial', b.photo);
        if ('error' in r) return bad(r.error);
        newKey = r.key;
      }
      const photoKey = newKey ?? (b.removePhoto ? null : oldKey);
      try {
        if (b.id === undefined) {
          await env.DB.prepare('INSERT INTO testimonials (name, occasion, quote, photo_key, published, sort_order) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM testimonials))')
            .bind(name, occasion, quote, photoKey, b.published ? 1 : 0).run();
        } else {
          await env.DB.prepare('UPDATE testimonials SET name = ?, occasion = ?, quote = ?, photo_key = ?, published = ? WHERE id = ?').bind(name, occasion, quote, photoKey, b.published ? 1 : 0, b.id).run();
        }
      } catch (e) {
        if (newKey) await deleteMedia(env.PHOTOS, newKey);
        throw e;
      }
      if (oldKey && oldKey !== photoKey) { try { await deleteMedia(env.PHOTOS, oldKey); } catch (e) { console.error('testimonial media cleanup failed:', e); } }
      return done(`saved testimonial from ${name}`);
    }
    if (b.action === 'delete') {
      if (!isId(b.id)) return bad('A testimonial id is required.');
      const t = await env.DB.prepare('DELETE FROM testimonials WHERE id = ? RETURNING photo_key').bind(b.id).first<any>();
      if (!t) return json({ error: 'Testimonial not found.' }, 404);
      if (t.photo_key) { try { await deleteMedia(env.PHOTOS, t.photo_key); } catch (e) { console.error('testimonial media cleanup failed:', e); } }
      return done(`deleted testimonial ${b.id}`);
    }
    if (b.action === 'reorder') {
      if (!idsOk(b.ids, isId)) return bad('ids must be a list of distinct testimonial ids.');
      await env.DB.batch((b.ids as number[]).map((id, i) => env.DB.prepare('UPDATE testimonials SET sort_order = ? WHERE id = ?').bind(i + 1, id)));
      return done('reordered testimonials');
    }
    return bad('Unknown action.');
  }

  return bad('Unknown section.');
}
