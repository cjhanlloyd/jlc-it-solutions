/// <reference types="@cloudflare/workers-types" />
// Invite and password-reset emails for portal admins. Never throws: callers get { emailed, link }.
import { sendSmtpEmail } from './email';

// Admin names reach email bodies: no line breaks, no links, at most 80 characters
export const NAME_MAX = 80;
export const cleanName = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').replace(/https?:\/\/\S*/gi, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim() : '');

type Target = { email: string; fullName: string; role?: string };

async function deliver(db: D1Database, request: Request, to: string, subject: string, body: string, type: string | null): Promise<boolean> {
  const smtp: any = await db.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
  if (!smtp || !smtp.enabled) return false;
  try {
    await sendSmtpEmail(db, smtp, { to, subject, body }, request);
    if (type) {
      await db.prepare("INSERT INTO sent_emails (id, to_address, subject, body, sentAt, email_type) VALUES (?, ?, ?, ?, ?, ?)")
        .bind('eml-' + Math.random().toString(36).slice(2, 11), to, subject, body, new Date().toISOString(), type).run();
    }
    return true;
  } catch (e: any) {
    console.error('Admin account email failed:', e?.message);
    await db.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'system_error', ?)")
      .bind(new Date().toISOString(), `Failed to send "${subject}" to ${to}: ${e?.message}`).run().catch(() => {});
    return false;
  }
}

export async function sendInvite(db: D1Database, request: Request, a: Target, token: string): Promise<{ emailed: boolean; link: string }> {
  const link = `${new URL(request.url).origin}/admin#/invite?email=${encodeURIComponent(a.email)}&token=${token}`;
  const body = `Dear ${cleanName(a.fullName) || 'there'},\n\nYou have been invited to join the Administration Panel of JLC Solutions as: ${a.role}.\n\nClick the link below to verify your email and set your password:\n${link}\n\nThis invitation is valid for 24 hours.`;
  return { emailed: await deliver(db, request, a.email, 'Invitation to Administration Panel - JLC Solutions', body, 'invitation'), link };
}

export async function sendReset(db: D1Database, request: Request, a: Target, token: string): Promise<{ emailed: boolean; link: string }> {
  const link = `${new URL(request.url).origin}/admin#/reset?email=${encodeURIComponent(a.email)}&token=${token}`;
  const body = `Dear ${cleanName(a.fullName) || 'there'},\n\nYou requested a password reset. Click the link below to update your password:\n${link}\n\nThis recovery link is valid for 1 hour.`;
  return { emailed: await deliver(db, request, a.email, 'Password Reset Request - JLC Solutions', body, null), link };
}
