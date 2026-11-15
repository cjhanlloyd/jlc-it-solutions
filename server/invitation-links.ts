/// <reference types="@cloudflare/workers-types" />
import { randomToken, sha256 } from './crypto';
import { sendSmtpEmail } from './email';

// Emails a fresh manage token and stores its hash only after the send succeeds
// (a throw leaves the old link working). Callers must check smtp.enabled first:
// sendSmtpEmail silently skips when disabled, and rotating then would lock the couple out.
export async function emailAndRotateToken(
  db: D1Database, smtp: any, request: Request, invitationId: number,
  mail: (token: string) => { to: string; subject: string; body: string },
): Promise<void> {
  const token = randomToken();
  await sendSmtpEmail(db, smtp, mail(token), request);
  await db.prepare("UPDATE invitations SET manage_token_hash = ? WHERE id = ? AND status = 'live'").bind(await sha256(token), invitationId).run();
}
