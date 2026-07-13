/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env } = context;
  try {
    const branding: any = await env.DB.prepare("SELECT * FROM branding WHERE id = 'default'").first();
    if (branding && branding.logoType === 'image' && branding.logoImageBase64) {
      const matches = branding.logoImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const binaryStr = atob(matches[2]);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return new Response(bytes, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }
  } catch (err) {
    console.error("Failed to serve dynamic favicon.svg from D1:", err);
  }

  // Fallback to fetching the static favicon from the assets
  const url = new URL(context.request.url);
  url.pathname = '/favicon.svg';
  const res = await context.env.ASSETS.fetch(url);
  return res;
};
