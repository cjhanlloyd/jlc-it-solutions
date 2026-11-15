import { connect } from 'cloudflare:sockets';

// SMTP Transmission Client using cloudflare:sockets
export function getThemeColorHex(themeColor?: string): string {
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

export function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function parseTextToHtml(text: string, themeColorHex: string): { html: string; actionUrl: string } {
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

export function buildHtmlEmail(branding: any, content: any, subject: string, plainTextBody: string, request?: Request): { html: string; actionUrl: string } {
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
export const EMAIL_RE = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
export const oneLine = (s: string) => String(s ?? '').replace(/[\r\n]+/g, ' ');

// SMTP Transmission Client using cloudflare:sockets
export async function sendSmtpEmail(db: D1Database, smtp: any, mail: { to: string; subject: string; body: string }, request?: Request): Promise<void> {
  if (!smtp || !smtp.enabled) {
    console.log("SMTP is disabled. Skipping email transmission.");
    return;
  }
  if (!EMAIL_RE.test(mail.to) || !EMAIL_RE.test(smtp.senderEmail || '')) {
    throw new Error(`Invalid email address (to: ${oneLine(mail.to)}, from: ${oneLine(smtp.senderEmail)})`);
  }

  // Retrieve branding and content configuration from D1
  // Fall back to defaults so a missing settings row never blocks email
  const branding = (await db.prepare("SELECT * FROM branding WHERE id = 'default'").first<any>()) ?? { companyName: 'JLC Solutions', logoType: 'icon', themeColor: 'deepblue' };
  const content = (await db.prepare("SELECT * FROM content WHERE id = 'default'").first<any>()) ?? {};

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
