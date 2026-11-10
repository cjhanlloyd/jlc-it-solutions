/// <reference types="@cloudflare/workers-types" />
// Guest page: serves invitation.html with link-preview tags (<title>, og:*) for this invitation.
import { escapeHtml } from '../../server/email';
import { decodeSegment, findGuestInvitation } from '../../server/guest-invitation';
import { occasionOf } from '../../shared/occasions';
import { SECURITY_HEADERS } from '../../server/security-headers';

interface Env { DB: D1Database; ASSETS: Fetcher }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const slug = decodeSegment(url.pathname.match(/^\/i\/([^/]+)\/?$/)?.[1] ?? '');
  const inv = slug ? await findGuestInvitation(env.DB, slug) : null;
  const occasion = inv ? occasionOf(inv.product_type) : null;
  const name = occasion ? occasion.title(JSON.parse(inv.details)) : '';

  let title = 'Invitation not available', description = 'This invitation is not available.', image = '';
  if (occasion && inv?.status === 'live') {
    // UTC so the date cannot shift a day; e.g. "June 12, 2027"
    const when = new Date(`${inv.event_date}T00:00:00Z`);
    title = `${name} — ${isNaN(when.getTime()) ? 'Invitation' : when.toLocaleDateString('en-US', { timeZone: 'UTC', dateStyle: 'long' })}`;
    description = inv.product_type === 'wedding_invitation' ? `You're invited to the wedding of ${name}.` : `You're invited to ${name}.`;
    const first = JSON.parse(inv.photos || '[]')[0];
    if (first) image = `${url.origin}/photos/${first}`;
  } else if (occasion) {
    title = `${name} — celebration has passed`;
    description = 'This celebration has already passed.';
  }

  const tags = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    ...(image ? [`<meta property="og:image" content="${escapeHtml(image)}">`] : []),
  ].join('\n    ');
  // Pages answers /invitation.html with a 308 to /invitation, so ask for the final path
  const asset = await env.ASSETS.fetch(new URL('/invitation', request.url));
  if (!asset.ok) return new Response('Bad gateway', { status: 502 });
  const shell = await asset.text();
  // Function replacers, so a "$&" in a name is not read as a replacement pattern
  const html = shell
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace('<!--og-tags-->', () => tags);
  return new Response(html, { status: inv ? 200 : 404, headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
};
