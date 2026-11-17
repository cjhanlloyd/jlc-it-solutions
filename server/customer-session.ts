import { sha256 } from './crypto';

export async function customerFromToken(db: D1Database, token: string | null): Promise<{ email: string } | null> {
  if (!token) return null;
  const row = await db.prepare('SELECT email FROM customer_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256(token), new Date().toISOString()).first<{ email: string }>();
  return row ? { email: row.email } : null;
}

// The invitation a manage request may reach: by manage token, or by a customer session plus X-Invitation-Id.
// The session way needs a delivered order with the session's email and a live invitation. null → caller answers 404.
export async function findManagedInvitation(db: D1Database, request: Request): Promise<any | null> {
  const cols = 'i.*, d.slug AS design_slug, d.name AS design_name, d.layout_key, d.product_type, d.color_schemes AS design_color_schemes';
  const from = 'FROM invitations i JOIN products_designs d ON d.id = i.design_id';
  const token = request.headers.get('X-Manage-Token');
  if (token) {
    const inv = await db.prepare(`SELECT ${cols} ${from} WHERE i.manage_token_hash = ? AND i.status = 'live'`).bind(await sha256(token)).first<any>();
    if (inv) return inv;
  }
  const idText = request.headers.get('X-Invitation-Id') ?? '';
  const session = await customerFromToken(db, request.headers.get('X-Customer-Token'));
  if (!session || !/^[1-9]\d{0,14}$/.test(idText)) return null;
  return db.prepare(
    `SELECT ${cols} ${from} WHERE i.id = ? AND i.status = 'live'
     AND EXISTS (SELECT 1 FROM orders o WHERE o.product_id = i.id AND lower(o.customer_email) = ? AND o.status = 'delivered')`,
  ).bind(Number(idText), session.email).first<any>();
}
