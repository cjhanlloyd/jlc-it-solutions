/// <reference types="@cloudflare/workers-types" />
import { connect } from 'cloudflare:sockets';
import bcrypt from 'bcryptjs';

interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  JWT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// SMTP Transmission Client using cloudflare:sockets
function getThemeColorHex(themeColor?: string): string {
  switch (themeColor) {
    case 'emerald': return '#059669';
    case 'slate': return '#475569';
    case 'indigo': return '#4f46e5';
    case 'violet': return '#7c3aed';
    case 'deepblue':
    default:
      return '#2563eb';
  }
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parseTextToHtml(text: string, themeColorHex: string): { html: string; actionUrl: string } {
  const paragraphs = text.split(/\n\s*\n/);
  let htmlResult = '';
  let actionUrl = '';

  for (const para of paragraphs) {
    const rawPara = para.trim();
    if (!rawPara) continue;
    // Body text includes visitor input (name, project description): escape before it becomes HTML
    const trimmedPara = escapeHtml(rawPara);

    // Detect if this paragraph is just a URL
    const urlRegex = /^(https?:\/\/[^\s]+)$/;
    if (urlRegex.test(trimmedPara)) {
      actionUrl = trimmedPara;
      continue;
    }

    // Detect if this paragraph contains a URL alongside other text
    const inlineUrlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = trimmedPara.match(inlineUrlRegex);
    if (urlMatch && !actionUrl) {
      actionUrl = urlMatch[1];
    }

    // Detect key-value lines
    const lines = trimmedPara.split('\n');
    const isKeyValueBlock = lines.length > 1 && lines.every(line => {
      const trimmedLine = line.trim();
      return !trimmedLine || trimmedLine.includes(':');
    });

    if (isKeyValueBlock) {
      let tableRows = '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        const colonIdx = trimmedLine.indexOf(':');
        if (colonIdx > 0) {
          const key = trimmedLine.substring(0, colonIdx).trim();
          const val = trimmedLine.substring(colonIdx + 1).trim();
          
          tableRows += `
            <tr>
              <td style="padding: 6px 12px 6px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #475569; width: 140px; vertical-align: top;">${key}</td>
              <td style="padding: 6px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1e293b; vertical-align: top;">${val}</td>
            </tr>
          `;
        }
      }

      htmlResult += `
        <div style="margin: 20px 0; background-color: #f8fafc; border-left: 4px solid ${themeColorHex}; border-radius: 4px; padding: 12px 16px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            ${tableRows}
          </table>
        </div>
      `;
      continue;
    }

    // Check if it's a quoted description/quote block
    if (rawPara.startsWith('"') && rawPara.endsWith('"')) {
      htmlResult += `
        <div style="border-left: 4px solid #cbd5e1; padding: 4px 0 4px 16px; margin: 18px 0; font-style: italic; color: #475569; font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6;">
          ${trimmedPara}
        </div>
      `;
      continue;
    }

    // Default paragraph
    // Replace inline URL if it exists, so we don't display long raw links in the paragraph body
    let displayPara = trimmedPara;
    if (urlMatch) {
      displayPara = displayPara.replace(urlMatch[1], '').replace(/:\s*$/, '').trim();
    }
    
    if (displayPara) {
      const formattedText = displayPara.replace(/\n/g, '<br/>');
      htmlResult += `<p style="margin-top: 0; margin-bottom: 16px; font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">${formattedText}</p>`;
    }
  }

  return { html: htmlResult, actionUrl };
}

function buildHtmlEmail(branding: any, content: any, subject: string, plainTextBody: string, request?: Request): { html: string; actionUrl: string } {
  const themeColorHex = getThemeColorHex(branding.themeColor);
  const websiteUrl = request 
    ? (new URL(request.url).origin || 'http://localhost:3000')
    : 'http://localhost:3000';

  const { html: parsedContentHtml, actionUrl } = parseTextToHtml(plainTextBody, themeColorHex);

  // Setup Logo Header
  let headerLogoHtml = '';

  if (branding.logoType === 'image' && branding.logoImageBase64) {
    headerLogoHtml = `
      <a href="${websiteUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
        <img src="cid:logoimage" alt="${branding.companyName}" style="display: block; max-height: 48px; width: auto; border: 0; outline: none;" />
      </a>
    `;
  }

  if (!headerLogoHtml) {
    const parts = branding.companyName.split(' ');
    const firstWord = parts[0] || '';
    const remainingWords = parts.slice(1).join(' ') || '';
    headerLogoHtml = `
      <a href="${websiteUrl}" target="_blank" style="text-decoration: none; display: inline-block; margin-bottom: 8px;">
        <span style="font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif; font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1.2;">
          ${firstWord} <span style="color: ${themeColorHex};">${remainingWords}</span>
        </span>
      </a>
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 600; margin-top: 4px;">
        ${branding.tagline || ''}
      </div>
    `;
  }

  // CTA Button Text
  let buttonText = 'Click Here';
  const subLower = subject.toLowerCase();
  if (subLower.includes('reset')) {
    buttonText = 'Reset Password';
  } else if (subLower.includes('invitation') || subLower.includes('invite')) {
    buttonText = 'Verify & Set Password';
  } else if (subLower.includes('inquiry') || subLower.includes('contact')) {
    buttonText = 'View Website';
  }

  const ctaButtonHtml = actionUrl ? `
    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="${actionUrl}" target="_blank" style="background-color: ${themeColorHex}; color: #ffffff; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); text-transform: uppercase; letter-spacing: 0.5px;">
        ${buttonText}
      </a>
    </div>
  ` : '';

  // Social Links
  const socialLinks: string[] = [];
  if (content.facebookUrl) {
    socialLinks.push(`<a href="${content.facebookUrl}" target="_blank" style="color: ${themeColorHex}; text-decoration: none; margin: 0 8px; font-weight: 600; font-family: 'Inter', sans-serif; font-size: 13px;">Facebook</a>`);
  }
  if (content.whatsappUrl) {
    socialLinks.push(`<a href="${content.whatsappUrl}" target="_blank" style="color: ${themeColorHex}; text-decoration: none; margin: 0 8px; font-weight: 600; font-family: 'Inter', sans-serif; font-size: 13px;">WhatsApp</a>`);
  }
  if (content.viberUrl) {
    socialLinks.push(`<a href="${content.viberUrl}" target="_blank" style="color: ${themeColorHex}; text-decoration: none; margin: 0 8px; font-weight: 600; font-family: 'Inter', sans-serif; font-size: 13px;">Viber</a>`);
  }
  const socialHtml = socialLinks.length > 0 
    ? `<div style="margin: 16px 0;">${socialLinks.join(' <span style="color: #cbd5e1;">|</span> ')}</div>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(oneLine(subject))}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 20px 0;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; border-top: 4px solid ${themeColorHex}; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025); margin: 0 auto; overflow: hidden;">
          
          <!-- Header Area -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; background-color: #ffffff;">
              ${headerLogoHtml}
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="border-bottom: 1px solid #e2e8f0; height: 1px; line-height: 1px;">&nbsp;</div>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              ${parsedContentHtml}
              
              <!-- Call to Action Button -->
              ${ctaButtonHtml}
            </td>
          </tr>
          
          <!-- Footer Area -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 32px; text-align: center;">
              <span style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 13px; color: #475569; font-weight: 700; display: block; margin-bottom: 4px;">
                ${branding.companyName}
              </span>
              <span style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 11px; color: #64748b; font-style: italic; display: block; margin-bottom: 16px;">
                ${branding.tagline || ''}
              </span>
              
              ${socialHtml}
              
              <div style="border-bottom: 1px solid #e2e8f0; margin: 16px 0; height: 1px; line-height: 1px;">&nbsp;</div>
              
              <span style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 12px; color: #64748b; line-height: 1.5; display: block;">
                ${content.contactAddress || ''}
              </span>
              <span style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 12px; color: #64748b; line-height: 1.5; display: block; margin-top: 4px;">
                Email: <a href="mailto:${content.contactEmail}" style="color: ${themeColorHex}; text-decoration: none; font-weight: 500;">${content.contactEmail}</a>
                ${content.contactPhone ? ` | Phone: <a href="tel:${content.contactPhone}" style="color: ${themeColorHex}; text-decoration: none; font-weight: 500;">${content.contactPhone}</a>` : ''}
              </span>
              <span style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 11px; color: #94a3b8; display: block; margin-top: 24px;">
                &copy; ${new Date().getFullYear()} ${branding.companyName}. All rights reserved.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return { html, actionUrl };
}

// No whitespace (so no CR/LF) and no angle brackets: safe to place inside SMTP commands and headers
const EMAIL_RE = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const oneLine = (s: string) => String(s ?? '').replace(/[\r\n]+/g, ' ');

// SMTP Transmission Client using cloudflare:sockets
async function sendSmtpEmail(db: D1Database, smtp: any, mail: { to: string; subject: string; body: string }, request?: Request): Promise<void> {
  if (!smtp || !smtp.enabled) {
    console.log("SMTP is disabled. Skipping email transmission.");
    return;
  }
  if (!EMAIL_RE.test(mail.to) || !EMAIL_RE.test(smtp.senderEmail || '')) {
    throw new Error(`Invalid email address (to: ${oneLine(mail.to)}, from: ${oneLine(smtp.senderEmail)})`);
  }

  // Retrieve branding and content configuration from D1
  const branding = await db.prepare("SELECT * FROM branding WHERE id = 'default'").first<any>();
  const content = await db.prepare("SELECT * FROM content WHERE id = 'default'").first<any>();

  let fullBody = mail.body;
  if (smtp.signature) {
    if (!mail.body.includes(smtp.signature)) {
      fullBody += `\n\n${smtp.signature}`;
    }
  }

  const { html: htmlBody } = buildHtmlEmail(branding, content, mail.subject, fullBody, request);

  // Connect via Cloudflare TCP Sockets (use secure SSL for port 465)
  const socket = connect({
    hostname: smtp.host,
    port: smtp.port
  }, {
    allowHalfOpen: false,
    secureTransport: (smtp.port === 465 ? 'on' : 'off') as "on" | "off"
  });

  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let buffer = '';

  async function readLine(): Promise<string> {
    while (true) {
      const idx = buffer.indexOf('\r\n');
      if (idx !== -1) {
        const line = buffer.substring(0, idx);
        buffer = buffer.substring(idx + 2);
        return line;
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("Connection closed by SMTP server.");
      buffer += decoder.decode(value);
    }
  }

  async function writeLine(cmd: string) {
    await writer.write(encoder.encode(cmd + '\r\n'));
  }

  async function readResponse(): Promise<{ code: number; message: string }> {
    let line = await readLine();
    let code = parseInt(line.substring(0, 3));
    let msg = line.substring(4);
    while (line.charAt(3) === '-') {
      line = await readLine();
      msg += '\n' + line.substring(4);
    }
    return { code, message: msg };
  }

  try {
    let res = await readResponse();
    if (res.code !== 220) throw new Error("Invalid SMTP greeting: " + res.message);

    await writeLine("EHLO localhost");
    res = await readResponse();
    if (res.code !== 250) throw new Error("EHLO failed: " + res.message);

    // Authentication if username and password are provided
    if (smtp.username && smtp.password) {
      await writeLine("AUTH LOGIN");
      res = await readResponse();
      if (res.code !== 334) throw new Error("AUTH LOGIN rejected: " + res.message);

      await writeLine(btoa(smtp.username));
      res = await readResponse();
      if (res.code !== 334) throw new Error("SMTP Username rejected: " + res.message);

      await writeLine(btoa(smtp.password));
      res = await readResponse();
      if (res.code !== 235) throw new Error("SMTP Authentication failed: " + res.message);
    }

    await writeLine(`MAIL FROM:<${smtp.senderEmail}>`);
    res = await readResponse();
    if (res.code !== 250) throw new Error("MAIL FROM failed: " + res.message);

    await writeLine(`RCPT TO:<${mail.to}>`);
    res = await readResponse();
    if (res.code !== 250) throw new Error("RCPT TO failed: " + res.message);

    await writeLine("DATA");
    res = await readResponse();
    if (res.code !== 354) throw new Error("DATA command failed: " + res.message);

    const boundary = `----boundary_${Math.random().toString(36).substring(2)}`;
    const msgId = `<${Math.random().toString(36).substring(2)}@${smtp.host || 'cloudflare-pages'}>`;
    const date = new Date().toUTCString();

    let rawMail = `Message-ID: ${msgId}\r\n`;
    rawMail += `Date: ${date}\r\n`;
    rawMail += `From: "${oneLine(smtp.senderName).replace(/"/g, "'")}" <${smtp.senderEmail}>\r\n`;
    rawMail += `To: <${mail.to}>\r\n`;
    rawMail += `Subject: ${oneLine(mail.subject)}\r\n`;
    rawMail += `MIME-Version: 1.0\r\n`;
    rawMail += `Content-Type: multipart/related; boundary="${boundary}"\r\n`;
    rawMail += `\r\n`;

    // HTML Part
    rawMail += `--${boundary}\r\n`;
    rawMail += `Content-Type: text/html; charset=UTF-8\r\n`;
    rawMail += `Content-Transfer-Encoding: 8bit\r\n`;
    rawMail += `\r\n`;
    rawMail += htmlBody.replace(/\r\n|\r|\n/g, '\r\n') + `\r\n`;
    rawMail += `\r\n`;

    // Image attachment Part (if logo exists)
    if (branding && branding.logoType === 'image' && branding.logoImageBase64) {
      const match = branding.logoImageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const base64Data = match[2];
        rawMail += `--${boundary}\r\n`;
        rawMail += `Content-Type: ${contentType}\r\n`;
        rawMail += `Content-Transfer-Encoding: base64\r\n`;
        rawMail += `Content-ID: <logoimage>\r\n`;
        rawMail += `Content-Disposition: inline; filename="logo.png"\r\n`;
        rawMail += `\r\n`;
        const lines = base64Data.match(/.{1,76}/g) || [];
        rawMail += lines.join('\r\n') + `\r\n`;
        rawMail += `\r\n`;
      }
    }

    rawMail += `--${boundary}--\r\n`;
    // Dot-stuffing (RFC 5321 4.5.2): a line starting with "." must not end the DATA block early
    rawMail = rawMail.replace(/\r\n\./g, '\r\n..');
    rawMail += `.\r\n`;

    await writer.write(encoder.encode(rawMail));
    res = await readResponse();
    if (res.code !== 250) throw new Error("Message send rejected: " + res.message);

    await writeLine("QUIT");
    await readResponse();
  } finally {
    reader.releaseLock();
    writer.releaseLock();
    await socket.close();
  }
}

// Session tokens are 'jlc.<base64 payload>.<base64 HMAC-SHA256 of payload>', keyed by JWT_SECRET.
function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

async function signAdminToken(email: string, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + (60 * 60 * 24); // 24 Hours
  const payloadB64 = btoa(JSON.stringify({ email, exp }));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(payloadB64));
  return `jlc.${payloadB64}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

async function verifyAdminToken(request: Request, db: D1Database, secret?: string): Promise<any | null> {
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

// Helper to escape values safely
function parseJsonSafe(val: any, fallback: any = []) {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

const MAX_ATTACHMENT_BASE64 = 1_400_000;

// fileAttachment is stored as JSON text; the admin panel expects an object
async function listInquiries(db: D1Database): Promise<any[]> {
  const { results } = await db.prepare("SELECT * FROM inquiries ORDER BY createdAt DESC").all<any>();
  return (results || []).map(i => ({ ...i, fileAttachment: parseJsonSafe(i.fileAttachment, null) }));
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  try {
    // ----------------------------------------------------
    // GET /api/public-data
    // ----------------------------------------------------
    if (method === 'GET' && path === '/api/public-data') {
      const [
        branding,
        content,
        servicesResult,
        faqsResult,
        projectGalleryResult,
        processStepsResult,
        roadmapStepsResult
      ] = await Promise.all([
        env.DB.prepare("SELECT * FROM branding WHERE id = 'default'").first(),
        env.DB.prepare("SELECT * FROM content WHERE id = 'default'").first(),
        env.DB.prepare("SELECT * FROM services ORDER BY position ASC").all(),
        env.DB.prepare("SELECT * FROM faqs").all(),
        env.DB.prepare("SELECT * FROM project_gallery").all(),
        env.DB.prepare("SELECT * FROM process_steps ORDER BY stepNumber ASC").all(),
        env.DB.prepare("SELECT * FROM roadmap_steps").all()
      ]) as [any, any, any, any, any, any, any];

      const parsedServices = (servicesResult.results || []).map((s: any) => ({
        ...s,
        features: parseJsonSafe(s.features, [])
      }));

      const parsedContent = content ? {
        ...content,
        whyChooseUsPoints: parseJsonSafe((content as any).whyChooseUsPoints, []),
        aboutCommitments: parseJsonSafe((content as any).aboutCommitments, []),
        whyChooseUsPromises: parseJsonSafe((content as any).whyChooseUsPromises, []),
        pricingCards: parseJsonSafe((content as any).pricingCards, [])
      } : null;

      const publicBody = JSON.stringify({
        branding: branding || { companyName: "JLC Solutions", logoType: "icon", logoIcon: "Activity", themeColor: "deepblue", tagline: "Your Tech Companion" },
        content: parsedContent || { heroTitle: "Enterprise IT Services & Custom Software", heroSubtitle: "Trusted technology partner", whyChooseUsText: "We align standard TIA/EIA specifications.", whyChooseUsPoints: [] },
        services: parsedServices,
        faqs: faqsResult.results || [],
        projectGallery: projectGalleryResult.results || [],
        processSteps: processStepsResult.results || [],
        roadmapSteps: roadmapStepsResult.results || []
      });

      // Body carries base64 images (often MBs). With an ETag, repeat visits get a tiny 304 instead,
      // and no-cache keeps admin edits visible immediately.
      const etag = `"${await sha256(publicBody)}"`;
      headers.set('ETag', etag);
      headers.set('Cache-Control', 'no-cache');
      if (request.headers.get('If-None-Match') === etag) {
        return new Response(null, { headers, status: 304 });
      }
      return new Response(publicBody, { headers });
    }

    // ----------------------------------------------------
    // POST /api/inquiry (Intake submission)
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/inquiry') {
      const body: any = await request.json();
      const id = 'inq-' + Math.random().toString(36).substr(2, 9);
      const createdAt = new Date().toISOString();
      const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
      const clientEmail = (body.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(clientEmail)) {
        return new Response(JSON.stringify({ error: "Please enter a valid email address." }), { headers, status: 400 });
      }
      body.email = clientEmail;

      // 1. Cloudflare Turnstile bot check (tokens are single-use and expire after 5 minutes)
      if (!env.TURNSTILE_SECRET_KEY) {
        return new Response(JSON.stringify({ error: "Server misconfigured: TURNSTILE_SECRET_KEY is not set." }), { headers, status: 500 });
      }
      if (typeof body.turnstileToken !== 'string' || !body.turnstileToken) {
        return new Response(JSON.stringify({ error: "Please complete the anti-spam check." }), { headers, status: 400 });
      }
      const verification: any = await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: body.turnstileToken, remoteip: clientIp }),
      })).json();
      if (!verification.success) {
        await env.DB.prepare(
          "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)"
        ).bind(
          createdAt, `Blocked inquiry from IP ${clientIp}: Turnstile check failed (${(verification['error-codes'] || []).join(', ')})`
        ).run();
        return new Response(JSON.stringify({ error: "The anti-spam check failed. Please try again." }), { headers, status: 400 });
      }

      // 2. Duplicate submission detection (same email and project description in last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const duplicateCheck = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM inquiries WHERE LOWER(email) = ? AND projectDescription = ? AND createdAt > ?"
      ).bind(clientEmail, body.projectDescription, fiveMinutesAgo).first();

      if (duplicateCheck && (duplicateCheck as any).count > 0) {
        await env.DB.prepare(
          "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)"
        ).bind(
          createdAt, `Blocked duplicate inquiry submission from email: ${clientEmail} (IP: ${clientIp})`
        ).run();
        return new Response(JSON.stringify({ error: "A duplicate inquiry has already been submitted recently." }), { headers, status: 429 });
      }

      // 3. Server-side Rate Limiting (max 3 submissions per 10 minutes from the same email or IP)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const rateLimitCheck = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM inquiries WHERE (LOWER(email) = ? OR ipAddress = ?) AND createdAt > ?"
      ).bind(clientEmail, clientIp, tenMinutesAgo).first();

      if (rateLimitCheck && (rateLimitCheck as any).count >= 3) {
        await env.DB.prepare(
          "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)"
        ).bind(
          createdAt, `Blocked rate-limited inquiry attempt from email: ${clientEmail} (IP: ${clientIp})`
        ).run();
        return new Response(JSON.stringify({ error: "Too many submissions. Please wait 10 minutes before submitting another inquiry." }), { headers, status: 429 });
      }

      // D1 caps a row at 2,000,000 bytes, so a 1 MB file (~1.37 MB as base64) is the most we can store
      let fileAttachment: string | null = null;
      const file = body.fileAttachment;
      if (file) {
        if (typeof file.name !== 'string' || typeof file.base64 !== 'string' || !/^data:[\w.+-]+\/[\w.+-]+;base64,/.test(file.base64)) {
          return new Response(JSON.stringify({ error: "The attached file could not be read. Please try attaching it again." }), { headers, status: 400 });
        }
        if (file.base64.length > MAX_ATTACHMENT_BASE64) {
          return new Response(JSON.stringify({ error: "The attached file is too large. The maximum size is 1 MB." }), { headers, status: 413 });
        }
        fileAttachment = JSON.stringify({ name: file.name.slice(0, 200), type: String(file.type || '').slice(0, 100), base64: file.base64 });
      }

      await env.DB.prepare(
        "INSERT INTO inquiries (id, fullName, companyName, email, phone, serviceRequired, projectDescription, preferredContactMethod, budget, createdAt, status, ipAddress, fileAttachment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?)"
      ).bind(
        id, 
        body.fullName || '', 
        body.companyName || '', 
        body.email || '', 
        body.phone || '', 
        body.serviceRequired || '', 
        body.projectDescription || '', 
        body.preferredContactMethod || 'Email', 
        body.budget || '', 
        createdAt,
        clientIp,
        fileAttachment
      ).run();

      // Trigger automatic inquiry acknowledgment email and admin notification if enabled
      const [smtp, template, content] = await Promise.all([
        env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first(),
        env.DB.prepare("SELECT * FROM email_template WHERE id = 'default'").first(),
        env.DB.prepare("SELECT contactEmail, contactPhone FROM content WHERE id = 'default'").first()
      ]) as [any, any, any];
      
      if (smtp && smtp.enabled) {
        const sendEmailsPromise = (async () => {
          // Send client acknowledgment
          if (template) {
            let bodyText = template.body
              .replace(/\{\{name\}\}/g, body.fullName || '')
              .replace(/\{\{service\}\}/g, body.serviceRequired || '')
              .replace(/\{\{projectDescription\}\}/g, body.projectDescription || '')
              .replace(/\{\{preferredContact\}\}/g, body.preferredContactMethod || 'Email')
              .replace(/\{\{companyEmail\}\}/g, (content && content.contactEmail) || (smtp && smtp.senderEmail) || '')
              .replace(/\{\{companyPhone\}\}/g, (content && content.contactPhone) || '');

            try {
              await sendSmtpEmail(env.DB, smtp, {
                to: body.email || '',
                subject: template.subject || 'Thank you for contacting us',
                body: bodyText
              }, request);

              // Log acknowledgment email
              await env.DB.prepare(
                "INSERT INTO sent_emails (id, inquiryId, to_address, subject, body, sentAt, email_type) VALUES (?, ?, ?, ?, ?, ?, 'Acknowledgment')"
              ).bind(
                'eml-' + Math.random().toString(36).substr(2, 9), id, body.email || '', template.subject || '', bodyText, new Date().toISOString()
              ).run();
            } catch (e: any) {
              console.error("Acknowledgment email sending failed: ", e.message);
              await env.DB.prepare(
                "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'system_error', ?)"
              ).bind(new Date().toISOString(), `Acknowledgment email to ${body.email || ''} failed: ${e.message}`).run();
            }
          }

          // Send administrator notification
          const adminEmailBody = `Dear Administrator,\n\nA new client inquiry has been submitted on your website:\n\n` +
            `Client Details:\n` +
            `- Name: ${body.fullName || ''}\n` +
            `- Company: ${body.companyName || 'Not specified'}\n` +
            `- Email: ${body.email || ''}\n` +
            `- Phone: ${body.phone || ''}\n\n` +
            `Project Details:\n` +
            `- Service Required: ${body.serviceRequired || ''}\n` +
            `- Budget Range: ${body.budget || 'Not specified'}\n` +
            `- Preferred Contact: ${body.preferredContactMethod || 'Email'}\n\n` +
            `Project Description:\n${body.projectDescription || ''}\n\n` +
            `--- \nThis email was dispatched automatically from the JLC IT Solutions Cloud Portal.`;

          try {
            await sendSmtpEmail(env.DB, smtp, {
              to: smtp.senderEmail,
              subject: `New Inquiry Alert: ${body.fullName} - ${body.serviceRequired}`,
              body: adminEmailBody
            }, request);

            // Log admin notification
            await env.DB.prepare(
              "INSERT INTO sent_emails (id, inquiryId, to_address, subject, body, sentAt, email_type) VALUES (?, ?, ?, ?, ?, ?, 'Admin Notification')"
            ).bind(
              'eml-' + Math.random().toString(36).substr(2, 9), id, smtp.senderEmail, `New Inquiry Alert: ${body.fullName}`, adminEmailBody, new Date().toISOString()
            ).run();
          } catch (e: any) {
            console.error("Admin notification email failed: ", e.message);
            await env.DB.prepare(
              "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'system_error', ?)"
            ).bind(new Date().toISOString(), `Admin notification email failed: ${e.message}`).run();
          }
        })();

        context.waitUntil(sendEmailsPromise);
      }

      await env.DB.prepare(
        "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'inquiry', ?)"
      ).bind(
        createdAt, `New client intake submitted by ${body.fullName} for ${body.serviceRequired}`
      ).run();

      return new Response(JSON.stringify({ success: true, id }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/login
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/login') {
      if (!env.JWT_SECRET) {
        return new Response(JSON.stringify({ error: "Server misconfigured: JWT_SECRET is not set." }), { headers, status: 500 });
      }
      const body: any = await request.json();
      const email = String(body.email || '').trim().toLowerCase();
      const admin: any = await env.DB.prepare("SELECT * FROM admins WHERE email = ?").bind(email).first();

      if (!admin) {
        return new Response(JSON.stringify({ error: "Invalid username or password credentials." }), { headers, status: 401 });
      }

      if (admin.status !== 'Active' || admin.verified !== 1) {
        return new Response(JSON.stringify({ error: "Account status is unverified or pending invite activation." }), { headers, status: 403 });
      }

      // Brute-force guard: at most 5 failed attempts per account in 10 minutes, counted from audit_logs
      const failureMessage = `Failed login for ${admin.email}`;
      const recentFailures: any = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM audit_logs WHERE log_type = 'auth_failure' AND message = ? AND timestamp > ?"
      ).bind(failureMessage, new Date(Date.now() - 10 * 60 * 1000).toISOString()).first();
      if ((recentFailures?.count || 0) >= 5) {
        return new Response(JSON.stringify({ error: "Too many failed login attempts. Please wait 10 minutes and try again." }), { headers, status: 429 });
      }

      const isMatched = typeof body.password === 'string' && !!admin.passwordHash && bcrypt.compareSync(body.password, admin.passwordHash);
      if (!isMatched) {
        await env.DB.prepare(
          "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'auth_failure', ?)"
        ).bind(new Date().toISOString(), failureMessage).run();
        return new Response(JSON.stringify({ error: "Invalid username or password credentials." }), { headers, status: 401 });
      }

      const token = await signAdminToken(admin.email, env.JWT_SECRET!);

      await env.DB.prepare(
        "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, ?, ?)"
      ).bind(
        new Date().toISOString(), 'auth_success', `Administrator ${admin.fullName} logged into dashboard`
      ).run();

      return new Response(JSON.stringify({
        token,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role
      }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/verify-invite (Token activation)
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/verify-invite') {
      const body: any = await request.json();
      const admin: any = await env.DB.prepare("SELECT * FROM admins WHERE email = ?").bind(body.email).first();

      // Stored token is NULL once used, so a missing/null token must never match it
      if (typeof body.token !== 'string' || !body.token || typeof body.password !== 'string' || !body.password
        || !admin || admin.verificationToken !== body.token) {
        return new Response(JSON.stringify({ error: "Invalid verification token or email." }), { headers, status: 400 });
      }

      if (admin.verificationTokenExpires && new Date() > new Date(admin.verificationTokenExpires)) {
        return new Response(JSON.stringify({ error: "Verification token expired. Please request a new invitation." }), { headers, status: 400 });
      }

      const hashedPass = bcrypt.hashSync(body.password, 10);
      await env.DB.prepare(
        "UPDATE admins SET passwordHash = ?, status = 'Active', verified = 1, verificationToken = NULL, verificationTokenExpires = NULL WHERE email = ?"
      ).bind(hashedPass, admin.email).run();

      await env.DB.prepare(
        "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, ?, ?)"
      ).bind(
        new Date().toISOString(), 'security', `Account for ${admin.fullName} activated successfully via email verification.`
      ).run();

      return new Response(JSON.stringify({ success: true, message: "Account activated! You can now log in." }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/forgot-password
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/forgot-password') {
      const body: any = await request.json();
      const admin: any = await env.DB.prepare("SELECT * FROM admins WHERE email = ?").bind(body.email).first();

      if (admin) {
        const token = crypto.randomUUID();
        const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

        await env.DB.prepare(
          "UPDATE admins SET resetToken = ?, resetTokenExpires = ? WHERE email = ?"
        ).bind(token, expires, admin.email).run();

        const smtp: any = await env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
        if (smtp && smtp.enabled) {
          const origin = new URL(request.url).origin;
          const resetLink = `${origin}/?resetToken=${token}&email=${encodeURIComponent(admin.email)}`;
          const emailBody = `Dear ${admin.fullName},\n\nYou requested a password reset. Click the link below to update your password:\n${resetLink}\n\nThis recovery link is valid for 1 hour.`;
          
          const sendForgotEmailPromise = (async () => {
            try {
              await sendSmtpEmail(env.DB, smtp, {
                to: admin.email,
                subject: "Password Reset Request - JLC Solutions",
                body: emailBody
              }, request);
            } catch (e: any) {
              console.error("Forgot password email failed: ", e.message);
              await env.DB.prepare(
                "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'system_error', ?)"
              ).bind(new Date().toISOString(), `Failed to send password reset email to ${admin.email}: ${e.message}`).run();
            }
          })();
          context.waitUntil(sendForgotEmailPromise);
        }
      }

      return new Response(JSON.stringify({ success: true, message: "If the email exists, a password reset link has been dispatched." }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/reset-password
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/reset-password') {
      const body: any = await request.json();
      const admin: any = await env.DB.prepare("SELECT * FROM admins WHERE email = ?").bind(body.email).first();

      if (typeof body.token !== 'string' || !body.token || typeof body.password !== 'string' || !body.password
        || !admin || admin.resetToken !== body.token) {
        return new Response(JSON.stringify({ error: "Invalid reset token." }), { headers, status: 400 });
      }

      if (admin.resetTokenExpires && new Date() > new Date(admin.resetTokenExpires)) {
        return new Response(JSON.stringify({ error: "Reset link has expired." }), { headers, status: 400 });
      }

      const hashed = bcrypt.hashSync(body.password, 10);
      await env.DB.prepare(
        "UPDATE admins SET passwordHash = ?, resetToken = NULL, resetTokenExpires = NULL WHERE email = ?"
      ).bind(hashed, admin.email).run();

      return new Response(JSON.stringify({ success: true, message: "Password updated successfully!" }), { headers });
    }

    // ----------------------------------------------------
    // SECURE ENDPOINTS REQUIRE AUTHENTICATION
    // ----------------------------------------------------
    const adminUser = await verifyAdminToken(request, env.DB, env.JWT_SECRET);
    if (!adminUser) {
      return new Response(JSON.stringify({ error: "Unauthorized access: Invalid or expired bearer token." }), { headers, status: 401 });
    }

    // Role rules: only Super Admins manage accounts; Editors cannot touch branding, SMTP or the email template
    const forbidden = (path === '/api/admin/accounts' && adminUser.role !== 'Super Admin')
      || (adminUser.role === 'Editor' && ['/api/admin/settings/branding', '/api/admin/settings/smtp', '/api/admin/email-template'].includes(path));
    if (forbidden) {
      return new Response(JSON.stringify({ error: `Access Denied: your role (${adminUser.role}) is not permitted to perform this action.` }), { headers, status: 403 });
    }

    // ----------------------------------------------------
    // GET /api/admin/data (Full Database fetcher)
    // ----------------------------------------------------
    if (method === 'GET' && path === '/api/admin/data') {
      const [
        branding,
        content,
        servicesResult,
        inquiries,
        sentEmails,
        auditLogs,
        admins,
        faqs,
        projectGalleryResult,
        processStepsResult,
        roadmapStepsResult,
        emailTemplate,
        smtpSettings
      ] = await Promise.all([
        env.DB.prepare("SELECT * FROM branding WHERE id = 'default'").first(),
        env.DB.prepare("SELECT * FROM content WHERE id = 'default'").first(),
        env.DB.prepare("SELECT * FROM services ORDER BY position ASC").all(),
        listInquiries(env.DB),
        env.DB.prepare("SELECT * FROM sent_emails ORDER BY sentAt DESC").all(),
        env.DB.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 150").all(),
        env.DB.prepare("SELECT email, fullName, role, status, verified, createdAt FROM admins").all(),
        env.DB.prepare("SELECT * FROM faqs").all(),
        env.DB.prepare("SELECT * FROM project_gallery").all(),
        env.DB.prepare("SELECT * FROM process_steps ORDER BY stepNumber ASC").all(),
        env.DB.prepare("SELECT * FROM roadmap_steps").all(),
        env.DB.prepare("SELECT * FROM email_template WHERE id = 'default'").first(),
        env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first()
      ]) as [any, any, any, any, any, any, any, any, any, any, any, any, any];

      const parsedServices = (servicesResult.results || []).map((s: any) => ({
        ...s,
        features: parseJsonSafe(s.features, [])
      }));

      const parsedContent = content ? {
        ...content,
        whyChooseUsPoints: parseJsonSafe((content as any).whyChooseUsPoints, []),
        aboutCommitments: parseJsonSafe((content as any).aboutCommitments, []),
        whyChooseUsPromises: parseJsonSafe((content as any).whyChooseUsPromises, []),
        pricingCards: parseJsonSafe((content as any).pricingCards, [])
      } : null;

      return new Response(JSON.stringify({
        db: {
          branding: branding || { companyName: "JLC Solutions", logoType: "icon", logoIcon: "Activity", themeColor: "deepblue", tagline: "Your Tech Companion" },
          content: parsedContent || { heroTitle: "Enterprise IT Services", heroSubtitle: "Trusted technology partner", whyChooseUsText: "", whyChooseUsPoints: [] },
          services: parsedServices,
          inquiries,
          sentEmails: sentEmails.results || [],
          admins: admins.results || [],
          faqs: faqs.results || [],
          projectGallery: projectGalleryResult.results || [],
          processSteps: processStepsResult.results || [],
          roadmapSteps: roadmapStepsResult.results || [],
          emailTemplate: emailTemplate || { subject: "Thank You for contacting JLC Solutions!", body: "Hi {fullName}" },
          // Editors cannot edit SMTP, so they never receive its password
          smtpSettings: smtpSettings
            ? (adminUser.role === 'Editor' ? { ...smtpSettings, password: '' } : smtpSettings)
            : { host: "localhost", port: 587, enabled: 0 }
        },
        systemLogs: (auditLogs.results || []).map((l: any) => ({
          timestamp: l.timestamp,
          type: l.log_type,
          message: l.message
        }))
      }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/settings/branding
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/settings/branding') {
      const body: any = await request.json();
      await env.DB.prepare(
        "UPDATE branding SET companyName = ?, logoType = ?, logoIcon = ?, logoImageBase64 = ?, themeColor = ?, tagline = ? WHERE id = 'default'"
      ).bind(
        body.companyName,
        body.logoType,
        body.logoIcon,
        body.logoImageBase64 || null,
        body.themeColor,
        body.tagline
      ).run();

      const branding = await env.DB.prepare("SELECT * FROM branding WHERE id = 'default'").first();
      return new Response(JSON.stringify({ success: true, branding }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/settings/content
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/settings/content') {
      const body: any = await request.json();
      await env.DB.prepare(
        "UPDATE content SET heroTitle = ?, heroSubtitle = ?, heroBadge = ?, aboutHeader = ?, aboutSubheader = ?, aboutText = ?, aboutText2 = ?, aboutMission = ?, aboutVision = ?, aboutCommitments = ?, aboutImageBase64 = ?, whyChooseUsText = ?, whyChooseUsPoints = ?, whyChooseUsPromiseTitle = ?, whyChooseUsPromiseDesc = ?, whyChooseUsPromises = ?, whyChooseUsCtaTitle = ?, whyChooseUsCtaDesc = ?, servicesHeader = ?, servicesSubtitle = ?, portfolioHeader = ?, portfolioSubtitle = ?, processHeader = ?, processSubtitle = ?, faqHeader = ?, faqSubtitle = ?, contactHeader = ?, contactSubtitle = ?, contactAddress = ?, contactPhone = ?, contactEmail = ?, contactWorkingHours = ?, contactMapEmbedUrl = ?, bannerImageUrl = ?, facebookUrl = ?, whatsappUrl = ?, viberUrl = ?, pricingHeader = ?, pricingSubtitle = ?, pricingEnterpriseTitle = ?, pricingEnterpriseDesc = ?, pricingEnterpriseHighlights = ?, pricingCtaTitle = ?, pricingCtaDesc = ?, pricingCards = ? WHERE id = 'default'"
      ).bind(
        body.heroTitle,
        body.heroSubtitle,
        body.heroBadge || '',
        body.aboutHeader || '',
        body.aboutSubheader || '',
        body.aboutText || '',
        body.aboutText2 || '',
        body.aboutMission || '',
        body.aboutVision || '',
        JSON.stringify(body.aboutCommitments || []),
        body.aboutImageBase64 || '',
        body.whyChooseUsText || '',
        JSON.stringify(body.whyChooseUsPoints || []),
        body.whyChooseUsPromiseTitle || '',
        body.whyChooseUsPromiseDesc || '',
        JSON.stringify(body.whyChooseUsPromises || []),
        body.whyChooseUsCtaTitle || '',
        body.whyChooseUsCtaDesc || '',
        body.servicesHeader || '',
        body.servicesSubtitle || '',
        body.portfolioHeader || '',
        body.portfolioSubtitle || '',
        body.processHeader || '',
        body.processSubtitle || '',
        body.faqHeader || '',
        body.faqSubtitle || '',
        body.contactHeader || '',
        body.contactSubtitle || '',
        body.contactAddress || '',
        body.contactPhone || '',
        body.contactEmail || '',
        body.contactWorkingHours || '',
        body.contactMapEmbedUrl || '',
        body.bannerImageUrl || '',
        body.facebookUrl || '',
        body.whatsappUrl || '',
        body.viberUrl || '',
        body.pricingHeader || '',
        body.pricingSubtitle || '',
        body.pricingEnterpriseTitle || '',
        body.pricingEnterpriseDesc || '',
        body.pricingEnterpriseHighlights || '',
        body.pricingCtaTitle || '',
        body.pricingCtaDesc || '',
        JSON.stringify(body.pricingCards || [])
      ).run();

      const content = await env.DB.prepare("SELECT * FROM content WHERE id = 'default'").first();
      const parsedContent = content ? {
        ...content,
        whyChooseUsPoints: parseJsonSafe((content as any).whyChooseUsPoints, []),
        aboutCommitments: parseJsonSafe((content as any).aboutCommitments, []),
        whyChooseUsPromises: parseJsonSafe((content as any).whyChooseUsPromises, []),
        pricingCards: parseJsonSafe((content as any).pricingCards, [])
      } : null;

      return new Response(JSON.stringify({ success: true, content: parsedContent }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/services (CRUD + Reorder)
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/services') {
      const body: any = await request.json();
      const { action, service, order } = body;

      if (action === 'reorder' && order) {
        // Sequentially update positions in D1
        for (let i = 0; i < order.length; i++) {
          await env.DB.prepare("UPDATE services SET position = ? WHERE id = ?").bind(i + 1, order[i]).run();
        }
      } else if (action === 'add' && service) {
        const countResult: any = await env.DB.prepare("SELECT COUNT(*) as count FROM services").first();
        const nextPos = (countResult?.count || 0) + 1;
        await env.DB.prepare(
          "INSERT INTO services (id, title, description, iconName, features, position) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          service.id || 's-' + Math.random().toString(36).substr(2, 9),
          service.title,
          service.description,
          service.iconName,
          JSON.stringify(service.features || []),
          nextPos
        ).run();
      } else if ((action === 'update' || action === 'edit') && service) {
        await env.DB.prepare(
          "UPDATE services SET title = ?, description = ?, iconName = ?, features = ? WHERE id = ?"
        ).bind(
          service.title,
          service.description,
          service.iconName,
          JSON.stringify(service.features || []),
          service.id
        ).run();
      } else if (action === 'delete' && service) {
        await env.DB.prepare("DELETE FROM services WHERE id = ?").bind(service.id).run();
      }

      // Fetch refreshed services list
      const servicesResult = await env.DB.prepare("SELECT * FROM services ORDER BY position ASC").all();
      const parsedServices = (servicesResult.results || []).map((s: any) => ({
        ...s,
        features: parseJsonSafe(s.features, [])
      }));

      return new Response(JSON.stringify({ success: true, services: parsedServices }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/accounts (Admin invites CRUD)
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/accounts') {
      const body: any = await request.json();
      const { action, admin } = body;

      if (action === 'invite') {
        const cleanEmail = admin.email.toLowerCase().trim();
        const existing = await env.DB.prepare("SELECT email FROM admins WHERE email = ?").bind(cleanEmail).first();
        if (existing) {
          return new Response(JSON.stringify({ error: "An administrator with this email already exists." }), { headers, status: 400 });
        }

        const token = crypto.randomUUID();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await env.DB.prepare(
          "INSERT INTO admins (email, fullName, role, status, verified, verificationToken, verificationTokenExpires, createdAt) VALUES (?, ?, ?, 'Invited', 0, ?, ?, ?)"
        ).bind(cleanEmail, admin.fullName, admin.role, token, expires, new Date().toISOString()).run();

        const smtp: any = await env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
        if (smtp && smtp.enabled) {
          const origin = new URL(request.url).origin;
          const inviteLink = `${origin}/?inviteToken=${token}&email=${encodeURIComponent(cleanEmail)}`;
          const emailBody = `Dear ${admin.fullName},\n\nYou have been invited to join the Administration Panel of JLC Solutions as: ${admin.role}.\n\nClick the link below to verify your email and set your password:\n${inviteLink}\n\nThis invitation is valid for 24 hours.`;
          
          const sendInviteEmailPromise = (async () => {
            try {
              await sendSmtpEmail(env.DB, smtp, {
                to: cleanEmail,
                subject: "Invitation to Administration Panel - JLC Solutions",
                body: emailBody
              }, request);

              // Log email
              await env.DB.prepare(
                "INSERT INTO sent_emails (id, to_address, subject, body, sentAt, email_type) VALUES (?, ?, ?, ?, ?, 'invitation')"
              ).bind(
                'eml-' + Math.random().toString(36).substr(2, 9), cleanEmail, "Invitation to Administration Panel", emailBody, new Date().toISOString()
              ).run();
            } catch (e: any) {
              console.error("Invite email failed: ", e.message);
              await env.DB.prepare(
                "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'system_error', ?)"
              ).bind(new Date().toISOString(), `Failed to send invitation email to ${cleanEmail}: ${e.message}`).run();
            }
          })();
          context.waitUntil(sendInviteEmailPromise);
        }
      } else if (action === 'delete') {
        if (admin.email === adminUser.email) {
          return new Response(JSON.stringify({ error: "You cannot revoke your own account credentials." }), { headers, status: 400 });
        }
        await env.DB.prepare("DELETE FROM admins WHERE email = ?").bind(admin.email).run();
      } else if (action === 'toggle_status' || action === 'reset_password') {
        const cleanEmail = String(admin?.email || '').toLowerCase().trim();
        const target: any = await env.DB.prepare("SELECT email, fullName, status FROM admins WHERE email = ?").bind(cleanEmail).first();
        if (!target) {
          return new Response(JSON.stringify({ error: "Account not found." }), { headers, status: 404 });
        }
        if (action === 'toggle_status') {
          if (cleanEmail === adminUser.email.toLowerCase()) {
            return new Response(JSON.stringify({ error: "You cannot disable your own account." }), { headers, status: 400 });
          }
          // Disabled accounts fail verifyAdminToken (it requires status 'Active'), so their sessions end at once
          const newStatus = target.status === 'Active' ? 'Disabled' : 'Active';
          await env.DB.prepare("UPDATE admins SET status = ? WHERE email = ?").bind(newStatus, cleanEmail).run();
          await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)")
            .bind(new Date().toISOString(), `Account ${cleanEmail} set to ${newStatus} by ${adminUser.fullName}`).run();
        } else {
          if (typeof admin.password !== 'string' || !admin.password) {
            return new Response(JSON.stringify({ error: "A new password is required." }), { headers, status: 400 });
          }
          await env.DB.prepare("UPDATE admins SET passwordHash = ?, resetToken = NULL, resetTokenExpires = NULL WHERE email = ?")
            .bind(bcrypt.hashSync(admin.password, 10), cleanEmail).run();
          await env.DB.prepare("INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'security', ?)")
            .bind(new Date().toISOString(), `Password for ${cleanEmail} reset manually by ${adminUser.fullName}`).run();
        }
      } else {
        return new Response(JSON.stringify({ error: `Unknown account action: ${action}` }), { headers, status: 400 });
      }

      const admins = await env.DB.prepare("SELECT email, fullName, role, status, verified, createdAt FROM admins").all();
      return new Response(JSON.stringify({ success: true, admins: admins.results || [] }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/settings/smtp
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/settings/smtp') {
      const body: any = await request.json();
      await env.DB.prepare(
        "UPDATE smtp_settings SET host = ?, port = ?, username = ?, password = ?, senderName = ?, senderEmail = ?, signature = ?, enabled = ? WHERE id = 'default'"
      ).bind(
        body.host,
        body.port,
        body.username || '',
        body.password || '',
        body.senderName,
        body.senderEmail,
        body.signature || '',
        body.enabled ? 1 : 0
      ).run();

      const smtpSettings = await env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
      return new Response(JSON.stringify({ success: true, smtpSettings }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/email-template
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/email-template') {
      const body: any = await request.json();
      await env.DB.prepare(
        "UPDATE email_template SET subject = ?, body = ? WHERE id = 'default'"
      ).bind(
        body.subject,
        body.body
      ).run();

      const emailTemplate = await env.DB.prepare("SELECT * FROM email_template WHERE id = 'default'").first();
      return new Response(JSON.stringify({ success: true, emailTemplate }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/inquiries/update & delete & reply
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/inquiries/update') {
      const body: any = await request.json();
      await env.DB.prepare(
        "UPDATE inquiries SET status = ?, adminNotes = ? WHERE id = ?"
      ).bind(body.status, body.adminNotes || '', body.id).run();

      return new Response(JSON.stringify({ success: true, inquiries: await listInquiries(env.DB) }), { headers });
    }

    if (method === 'POST' && path === '/api/admin/inquiries/delete') {
      const body: any = await request.json();
      await env.DB.prepare("DELETE FROM inquiries WHERE id = ?").bind(body.id).run();

      return new Response(JSON.stringify({ success: true, inquiries: await listInquiries(env.DB) }), { headers });
    }

    if (method === 'POST' && path === '/api/admin/inquiries/reply') {
      const body: any = await request.json();
      const { inquiryId, to, subject } = body;
      const replyText = body.body || body.message || '';

      const smtp: any = await env.DB.prepare("SELECT * FROM smtp_settings WHERE id = 'default'").first();
      if (!smtp || !smtp.enabled) {
        return new Response(JSON.stringify({ error: "SMTP is disabled or not configured. Cannot send replies." }), { headers, status: 400 });
      }

      // Send before logging, so the panel never shows a reply as sent when it was not
      try {
        await sendSmtpEmail(env.DB, smtp, { to: to || '', subject: subject || '', body: replyText }, request);
      } catch (e: any) {
        console.error("Reply email failed: ", e.message);
        await env.DB.prepare(
          "INSERT INTO audit_logs (timestamp, log_type, message) VALUES (?, 'system_error', ?)"
        ).bind(new Date().toISOString(), `Inquiry reply to ${to || ''} failed: ${e.message}`).run();
        return new Response(JSON.stringify({ error: `Reply was not sent: ${e.message}` }), { headers, status: 502 });
      }

      // Auto update inquiry status to 'In Progress' if currently 'New'
      await env.DB.prepare("UPDATE inquiries SET status = 'In Progress' WHERE id = ? AND status = 'New'").bind(inquiryId || '').run();

      // Log sent email
      await env.DB.prepare(
        "INSERT INTO sent_emails (id, inquiryId, to_address, subject, body, sentAt, email_type) VALUES (?, ?, ?, ?, ?, ?, 'admin-reply')"
      ).bind(
        'eml-' + Math.random().toString(36).substr(2, 9), inquiryId || null, to || '', subject || '', replyText, new Date().toISOString()
      ).run();

      const [sentEmails, inquiries] = await Promise.all([
        env.DB.prepare("SELECT * FROM sent_emails ORDER BY sentAt DESC").all(),
        listInquiries(env.DB)
      ]) as [any, any[]];
      return new Response(JSON.stringify({ success: true, sentEmails: sentEmails.results || [], inquiries }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/faqs
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/faqs') {
      const body: any = await request.json();
      const { action, faq } = body;

      if (action === 'add') {
        await env.DB.prepare(
          "INSERT INTO faqs (id, question, answer) VALUES (?, ?, ?)"
        ).bind('faq-' + Math.random().toString(36).substr(2, 9), faq.question, faq.answer).run();
      } else if (action === 'update') {
        await env.DB.prepare(
          "UPDATE faqs SET question = ?, answer = ? WHERE id = ?"
        ).bind(faq.question, faq.answer, faq.id).run();
      } else if (action === 'delete') {
        await env.DB.prepare("DELETE FROM faqs WHERE id = ?").bind(faq.id).run();
      }

      const faqs = await env.DB.prepare("SELECT * FROM faqs").all();
      return new Response(JSON.stringify({ success: true, faqs: faqs.results || [] }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/gallery (Project Gallery CRUD)
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/gallery') {
      const body: any = await request.json();
      const { action } = body;
      const item = body.item || body.project;

      if (action === 'add') {
        await env.DB.prepare(
          "INSERT INTO project_gallery (id, title, category, imageBase64, description) VALUES (?, ?, ?, ?, ?)"
        ).bind('gal-' + Math.random().toString(36).substr(2, 9), item.title, item.category, item.imageBase64 || null, item.description || '').run();
      } else if (action === 'update') {
        await env.DB.prepare(
          "UPDATE project_gallery SET title = ?, category = ?, imageBase64 = ?, description = ? WHERE id = ?"
        ).bind(item.title, item.category, item.imageBase64 || null, item.description || '', item.id).run();
      } else if (action === 'delete') {
        await env.DB.prepare("DELETE FROM project_gallery WHERE id = ?").bind(item.id).run();
      }

      const gallery = await env.DB.prepare("SELECT * FROM project_gallery").all();
      return new Response(JSON.stringify({ success: true, projectGallery: gallery.results || [] }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/process (Collaboration Process CRUD)
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/process') {
      const body: any = await request.json();
      const { action, step } = body;

      if (action === 'add') {
        const stepNum = parseInt(step.stepNumber) || 1;
        await env.DB.prepare(
          "INSERT INTO process_steps (id, stepNumber, title, description, iconName) VALUES (?, ?, ?, ?, ?)"
        ).bind('pr-' + Math.random().toString(36).substr(2, 9), stepNum, step.title, step.description || '', step.iconName || 'Cpu').run();
      } else if (action === 'update') {
        const stepNum = parseInt(step.stepNumber) || 1;
        await env.DB.prepare(
          "UPDATE process_steps SET stepNumber = ?, title = ?, description = ?, iconName = ? WHERE id = ?"
        ).bind(stepNum, step.title, step.description || '', step.iconName || 'Cpu', step.id).run();
      } else if (action === 'delete') {
        await env.DB.prepare("DELETE FROM process_steps WHERE id = ?").bind(step.id).run();
      }

      const processStepsResult = await env.DB.prepare("SELECT * FROM process_steps ORDER BY stepNumber ASC").all();
      return new Response(JSON.stringify({ success: true, processSteps: processStepsResult.results || [] }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/roadmap (Growth Roadmap CRUD)
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/roadmap') {
      const body: any = await request.json();
      const { action, step } = body;

      if (action === 'add') {
        await env.DB.prepare(
          "INSERT INTO roadmap_steps (id, timeline, title, description, status) VALUES (?, ?, ?, ?, ?)"
        ).bind('rm-' + Math.random().toString(36).substr(2, 9), step.timeline, step.title, step.description || '', step.status || 'planned').run();
      } else if (action === 'update') {
        await env.DB.prepare(
          "UPDATE roadmap_steps SET timeline = ?, title = ?, description = ?, status = ? WHERE id = ?"
        ).bind(step.timeline, step.title, step.description || '', step.status || 'planned', step.id).run();
      } else if (action === 'delete') {
        await env.DB.prepare("DELETE FROM roadmap_steps WHERE id = ?").bind(step.id).run();
      }

      const roadmapStepsResult = await env.DB.prepare("SELECT * FROM roadmap_steps").all();
      return new Response(JSON.stringify({ success: true, roadmapSteps: roadmapStepsResult.results || [] }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/generate-tagline
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/generate-tagline') {
      const body: any = await request.json();
      let draft = `Dynamic Tech Solution\nYour Partner in Software\nReliable IT Architecture`;
      
      if (env.GEMINI_API_KEY) {
        try {
          const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
          const gResponse = await fetch(apiURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Generate 3 short catchy taglines of 2-5 words for: ${body.prompt}` }] }]
            })
          });
          const gData: any = await gResponse.json();
          const text = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) draft = text.trim();
        } catch (e) {
          console.error("Gemini API call failed: ", e);
        }
      }

      return new Response(JSON.stringify({ taglines: draft, generatedText: draft }), { headers });
    }

    // ----------------------------------------------------
    // POST /api/admin/generate-reply-draft
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/admin/generate-reply-draft') {
      const body: any = await request.json();
      const { inquiryId, instructions } = body;
      if (!inquiryId) {
        return new Response(JSON.stringify({ error: 'Inquiry ID is required.' }), { headers, status: 400 });
      }

      const inquiry: any = await env.DB.prepare("SELECT * FROM inquiries WHERE id = ?").bind(inquiryId).first();
      if (!inquiry) {
        return new Response(JSON.stringify({ error: 'Inquiry not found.' }), { headers, status: 404 });
      }

      const branding = await env.DB.prepare("SELECT companyName FROM branding WHERE id = 'default'").first<any>();
      const coName = branding ? branding.companyName : "JLC Solutions";

      // Intelligent Rule-Based Simulator for local development / missing API keys
      let draft = `Dear ${inquiry.fullName || 'Client'},\n\nThank you for your interest in our ${inquiry.serviceRequired || 'services'} at ${coName}! We reviewed your project description.`;

      const instrLower = (instructions || '').toLowerCase();
      if (instrLower.includes('decline') || instrLower.includes('busy') || instrLower.includes('cannot handle') || instrLower.includes('reject')) {
        draft = `Dear ${inquiry.fullName || 'Client'},\n\nThank you for your interest in ${coName}! We reviewed your project description regarding "${inquiry.serviceRequired || 'services'}".\n\nUnfortunately, our engineering team is currently at full capacity for the next few weeks and we are unable to take on new projects at this time. We apologize for the inconvenience and wish you the best of luck with your launch.\n\nBest regards,\n${coName} Technical Consulting Team`;
      } else {
        let actionItem = 'Are you available this Wednesday or Thursday afternoon for a brief Microsoft Teams or Zoom consultation?';
        
        if (instrLower.includes('zoom') || instrLower.includes('call') || instrLower.includes('schedule') || instrLower.includes('meet')) {
          const platform = instrLower.includes('zoom') ? 'Zoom' : instrLower.includes('teams') ? 'Microsoft Teams' : 'Google Meet';
          const duration = (instructions || '').match(/\b\d+\s*min\b/) ? (instructions || '').match(/\b\d+\s*min\b/)![0] : '15-minute';
          actionItem = `Are you available for a brief ${duration} ${platform} video consultation to review timelines and technical requirements?`;
        }

        let customInsight = '';
        if (instrLower.includes('react') || instrLower.includes('next.js') || instrLower.includes('frontend') || instrLower.includes('tailwind')) {
          customInsight = `\nFor custom React development, we highly recommend utilizing Next.js coupled with Tailwind CSS to ensure optimal performance and speed.\n`;
        } else if (instrLower.includes('database') || instrLower.includes('backend') || instrLower.includes('postgres') || instrLower.includes('storage')) {
          customInsight = `\nFor database solutions, we specialize in high-performance PostgreSQL architectures and serverless database integrations.\n`;
        }

        draft = `Dear ${inquiry.fullName || 'Client'},\n\nThank you for your interest in our ${inquiry.serviceRequired || 'services'} at ${coName}! We reviewed your project description regarding:\n"${(inquiry.projectDescription || '').substring(0, 100)}..."\n${customInsight}\nWe would love to schedule a quick consultation to discuss your objectives in detail.\n\n${actionItem}\n\nBest regards,\n${coName} Technical Consulting Team`;
      }

      if (env.GEMINI_API_KEY) {
        try {
          const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
          const prompt = `Write a professional email reply draft to a customer named ${inquiry.fullName || 'Client'} who is asking for ${inquiry.serviceRequired || 'our services'} with requirements: ${inquiry.projectDescription || ''}. Include tone context: ${instructions || 'friendly'}`;
          const gResponse = await fetch(apiURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });
          const gData: any = await gResponse.json();
          const text = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) draft = text.trim();
        } catch (e) {
          console.error("Gemini email generation failed: ", e);
        }
      }

      return new Response(JSON.stringify({ draft, draftText: draft }), { headers });
    }

    return new Response(JSON.stringify({ error: `Serverless router endpoint matched but action is unsupported: ${path}` }), { headers, status: 404 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Unknown worker internal error." }), { headers, status: 500 });
  }
};
