// Returns an error response, or null when the Turnstile token is valid.
export async function turnstileError(request: Request, secret: string | undefined, token: unknown): Promise<Response | null> {
  if (!secret) return Response.json({ error: 'Server misconfigured: the anti-spam key is not set.' }, { status: 500 });
  if (typeof token !== 'string' || !token) return Response.json({ error: 'Please complete the anti-spam check.' }, { status: 400 });
  const verification: any = await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: request.headers.get('CF-Connecting-IP') || '127.0.0.1' }),
  })).json();
  return verification.success ? null : Response.json({ error: 'The anti-spam check failed. Please try again.' }, { status: 400 });
}
