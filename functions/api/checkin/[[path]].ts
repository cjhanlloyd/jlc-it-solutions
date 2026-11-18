/// <reference types="@cloudflare/workers-types" />
// Door-phone check-in: the key in the body authorises, no session. See server/checkin.ts.
import { doorRoute } from '../../../server/checkin';

interface Env { DB: D1Database }

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    return await doorRoute(`${request.method} ${new URL(request.url).pathname.replace(/\/+$/, '')}`, request, env);
  } catch (e) {
    console.error('check-in API error:', e);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
};
