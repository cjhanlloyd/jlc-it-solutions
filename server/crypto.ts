export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Session tokens are 'jlc.<base64 payload>.<base64 HMAC-SHA256 of payload>', keyed by JWT_SECRET.
export function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function signAdminToken(email: string, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + (60 * 60 * 24); // 24 Hours
  const payloadB64 = btoa(JSON.stringify({ email, exp }));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(payloadB64));
  return `jlc.${payloadB64}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

export async function verifyAdminToken(request: Request, db: D1Database, secret?: string): Promise<any | null> {
  const authHeader = request.headers.get('Authorization');
  if (!secret || !authHeader || !authHeader.startsWith('Bearer ')) return null;
  const [prefix, payloadB64, sigB64, ...rest] = authHeader.substring(7).split('.');
  if (prefix !== 'jlc' || !payloadB64 || !sigB64 || rest.length) return null;

  try {
    const sig = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    // crypto.subtle.verify compares in constant time
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), sig, new TextEncoder().encode(payloadB64));
    if (valid) {
      const payload = JSON.parse(atob(payloadB64));
      if (payload && payload.email && payload.exp > Date.now() / 1000) {
        const admin = await db.prepare("SELECT email, fullName, role FROM admins WHERE email = ? AND status = 'Active' AND verified = 1").bind(payload.email).first();
        return admin || null;
      }
    }
  } catch (e) {
    return null;
  }
  return null;
}

// 32 random bytes, base64url (43 chars). Used for manage tokens; store only sha256(token).
export function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
