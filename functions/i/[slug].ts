/// <reference types="@cloudflare/workers-types" />
// Guest page: serves invitation.html with link-preview tags (<title>, og:*) for this invitation.
import { escapeHtml } from '../../server/email';
import { decodeSegment, findGuestInvitation } from '../../server/guest-invitation';

interface Env { DB: D1Database; ASSETS: Fetcher }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const slug = decodeSegment(url.pathname.match(/^\/i\/([^/]+)\/?$/)?.[1] ?? '');
  const inv = slug ? await findGuestInvitation(env.DB, slug) : null;
  const d = inv ? JSON.parse(inv.details) : {};
  const names = `${d.partner1} & ${d.partner2}`;

  let title = 'Invitation not available', description = 'This invitation is not available.', image = '';
  if (inv?.status === 'live') {
    title = `${names} — Wedding invitation`;
    description = `You're invited to the wedding of ${names}.`;
    const first = JSON.parse(inv.photos || '[]')[0];
    if (first) image = `${url.origin}/photos/${first}`;
  } else if (inv) {
    title = `${names} — celebration has passed`;
    description = `The wedding of ${names} has already been celebrated.`;
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
  return new Response(html, { status: inv ? 200 : 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
