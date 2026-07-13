/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { 
  WebsiteData, 
  DEFAULT_SERVICES, 
  DEFAULT_BRANDING, 
  DEFAULT_CONTENT, 
  DEFAULT_EMAIL_TEMPLATE, 
  DEFAULT_ADMINS,
  DEFAULT_SMTP_SETTINGS,
  DEFAULT_FAQS,
  DEFAULT_PROCESS_STEPS,
  DEFAULT_ROADMAP_STEPS,
  DEFAULT_PROJECT_GALLERY,
  ProjectGalleryItem,
  Inquiry,
  Service,
  SentEmail,
  AuditLog,
  AdminAccount
} from './src/types.js'; // Use .js for TS resolution at runtime when compiled

dotenv.config();

const app = express();
const PORT = 3000;

// Security Middlewares
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com; frame-src 'self' https://www.google.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'");
  next();
});

// Rate limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 5 minutes.' }
});

const SEED_ADMIN_HASH = bcrypt.hashSync('admin123', 10);
const SEED_EDITOR_HASH = bcrypt.hashSync('editor123', 10);

// Initialize Gemini API client if key is available
let ai: GoogleGenAI | null = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
  try {
    ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini AI client successfully initialized server-side.");
  } catch (error) {
    console.error("Failed to initialize Gemini AI client:", error);
  }
} else {
  console.log("No GEMINI_API_KEY found or it has default placeholder value. AI draft and generation features will run in high-quality simulated mode.");
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const DB_PATH = path.join(process.cwd(), 'db.json');

// Database Access Helpers
// Database Access Helpers
function readDb(): WebsiteData {
  if (!fs.existsSync(DB_PATH)) {
    const initialData: WebsiteData = {
      inquiries: [],
      services: DEFAULT_SERVICES,
      branding: DEFAULT_BRANDING,
      content: DEFAULT_CONTENT,
      emailTemplate: DEFAULT_EMAIL_TEMPLATE,
      admins: DEFAULT_ADMINS,
      sentEmails: [],
      smtpSettings: DEFAULT_SMTP_SETTINGS,
      faqs: DEFAULT_FAQS,
      processSteps: DEFAULT_PROCESS_STEPS,
      roadmapSteps: DEFAULT_ROADMAP_STEPS,
      auditLogs: [],
      projectGallery: DEFAULT_PROJECT_GALLERY
    };
    if (initialData.admins[0]) {
      initialData.admins[0].passwordHash = bcrypt.hashSync('admin123', 10);
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    
    // Database migration: upgrade to email-based dynamic accounts and purge testing accounts
    let needsMigration = false;
    let validatedAdmins: AdminAccount[] = [];
    
    if (parsed.admins && Array.isArray(parsed.admins)) {
      const hasOldKeys = parsed.admins.some((a: any) => a.username !== undefined || a.email === undefined);
      const hasPrimarySuperAdmin = parsed.admins.some((a: any) => a.email === 'cjhanlloyd@gmail.com');
      
      if (hasOldKeys || !hasPrimarySuperAdmin) {
        needsMigration = true;
      } else {
        validatedAdmins = parsed.admins;
      }
    } else {
      needsMigration = true;
    }
    
    if (needsMigration) {
      validatedAdmins = [
        {
          email: 'cjhanlloyd@gmail.com',
          fullName: 'John Lloyd Cahilig',
          role: 'Super Admin',
          status: 'Active',
          verified: true,
          passwordHash: bcrypt.hashSync('admin123', 10),
          createdAt: new Date().toISOString()
        }
      ];
    }
    
    const db: WebsiteData = {
      inquiries: parsed.inquiries || [],
      services: parsed.services || DEFAULT_SERVICES,
      branding: parsed.branding || DEFAULT_BRANDING,
      content: { ...DEFAULT_CONTENT, ...parsed.content },
      emailTemplate: parsed.emailTemplate || DEFAULT_EMAIL_TEMPLATE,
      admins: validatedAdmins,
      sentEmails: parsed.sentEmails || [],
      smtpSettings: parsed.smtpSettings || DEFAULT_SMTP_SETTINGS,
      faqs: parsed.faqs || DEFAULT_FAQS,
      processSteps: parsed.processSteps || DEFAULT_PROCESS_STEPS,
      roadmapSteps: parsed.roadmapSteps || DEFAULT_ROADMAP_STEPS,
      auditLogs: parsed.auditLogs || [],
      projectGallery: parsed.projectGallery || DEFAULT_PROJECT_GALLERY
    };
    
    if (needsMigration) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    }
    
    return db;
  } catch (err) {
    console.error("Error reading database file, returning defaults:", err);
    const fallbackDb: WebsiteData = {
      inquiries: [],
      services: DEFAULT_SERVICES,
      branding: DEFAULT_BRANDING,
      content: DEFAULT_CONTENT,
      emailTemplate: DEFAULT_EMAIL_TEMPLATE,
      admins: [
        {
          email: 'cjhanlloyd@gmail.com',
          fullName: 'John Lloyd Cahilig',
          role: 'Super Admin',
          status: 'Active',
          verified: true,
          passwordHash: bcrypt.hashSync('admin123', 10),
          createdAt: new Date().toISOString()
        }
      ],
      sentEmails: [],
      smtpSettings: DEFAULT_SMTP_SETTINGS,
      faqs: DEFAULT_FAQS,
      processSteps: DEFAULT_PROCESS_STEPS,
      roadmapSteps: DEFAULT_ROADMAP_STEPS,
      auditLogs: [],
      projectGallery: DEFAULT_PROJECT_GALLERY
    };
    return fallbackDb;
  }
}

function writeDb(data: WebsiteData) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error writing to database file:", err);
  }
}

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

function parseTextToHtml(text: string, themeColorHex: string): { html: string; actionUrl: string } {
  const paragraphs = text.split(/\n\s*\n/);
  let htmlResult = '';
  let actionUrl = '';

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

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
    if (trimmedPara.startsWith('"') && trimmedPara.endsWith('"')) {
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

function buildHtmlEmail(to: string, subject: string, plainTextBody: string, req?: express.Request): { html: string; attachments: any[] } {
  const db = readDb();
  const themeColorHex = getThemeColorHex(db.branding.themeColor);
  const websiteUrl = req 
    ? (req.headers.origin || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:3000'))
    : 'http://localhost:3000';

  const { html: parsedContentHtml, actionUrl } = parseTextToHtml(plainTextBody, themeColorHex);

  // Setup Logo Header
  let headerLogoHtml = '';
  const attachments: any[] = [];

  if (db.branding.logoType === 'image' && db.branding.logoImageBase64) {
    const match = db.branding.logoImageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const base64Data = match[2];
      attachments.push({
        filename: 'logo.png',
        content: Buffer.from(base64Data, 'base64'),
        cid: 'logoimage'
      });
      headerLogoHtml = `
        <a href="${websiteUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
          <img src="cid:logoimage" alt="${db.branding.companyName}" style="display: block; max-height: 48px; width: auto; border: 0; outline: none;" />
        </a>
      `;
    }
  }

  if (!headerLogoHtml) {
    const parts = db.branding.companyName.split(' ');
    const firstWord = parts[0] || '';
    const remainingWords = parts.slice(1).join(' ') || '';
    headerLogoHtml = `
      <a href="${websiteUrl}" target="_blank" style="text-decoration: none; display: inline-block; margin-bottom: 8px;">
        <span style="font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif; font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1.2;">
          ${firstWord} <span style="color: ${themeColorHex};">${remainingWords}</span>
        </span>
      </a>
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 600; margin-top: 4px;">
        ${db.branding.tagline}
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
  if (db.content.facebookUrl) {
    socialLinks.push(`<a href="${db.content.facebookUrl}" target="_blank" style="color: ${themeColorHex}; text-decoration: none; margin: 0 8px; font-weight: 600; font-family: 'Inter', sans-serif; font-size: 13px;">Facebook</a>`);
  }
  if (db.content.whatsappUrl) {
    socialLinks.push(`<a href="${db.content.whatsappUrl}" target="_blank" style="color: ${themeColorHex}; text-decoration: none; margin: 0 8px; font-weight: 600; font-family: 'Inter', sans-serif; font-size: 13px;">WhatsApp</a>`);
  }
  if (db.content.viberUrl) {
    socialLinks.push(`<a href="${db.content.viberUrl}" target="_blank" style="color: ${themeColorHex}; text-decoration: none; margin: 0 8px; font-weight: 600; font-family: 'Inter', sans-serif; font-size: 13px;">Viber</a>`);
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
  <title>${subject}</title>
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
                ${db.branding.companyName}
              </span>
              <span style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 11px; color: #64748b; font-style: italic; display: block; margin-bottom: 16px;">
                ${db.branding.tagline}
              </span>
              
              ${socialHtml}
              
              <div style="border-bottom: 1px solid #e2e8f0; margin: 16px 0; height: 1px; line-height: 1px;">&nbsp;</div>
              
              <span style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 12px; color: #64748b; line-height: 1.5; display: block;">
                ${db.content.contactAddress || ''}
              </span>
              <span style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 12px; color: #64748b; line-height: 1.5; display: block; margin-top: 4px;">
                Email: <a href="mailto:${db.content.contactEmail}" style="color: ${themeColorHex}; text-decoration: none; font-weight: 500;">${db.content.contactEmail}</a>
                ${db.content.contactPhone ? ` | Phone: <a href="tel:${db.content.contactPhone}" style="color: ${themeColorHex}; text-decoration: none; font-weight: 500;">${db.content.contactPhone}</a>` : ''}
              </span>
              <span style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 11px; color: #94a3b8; display: block; margin-top: 24px;">
                &copy; ${new Date().getFullYear()} ${db.branding.companyName}. All rights reserved.
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

  return { html, attachments };
}

async function sendSystemEmail(to: string, subject: string, body: string, req?: express.Request) {
  const db = readDb();
  
  // Combine body and signature for HTML parsing
  let fullBody = body;
  if (db.smtpSettings && db.smtpSettings.signature) {
    if (!body.includes(db.smtpSettings.signature)) {
      fullBody += `\n\n${db.smtpSettings.signature}`;
    }
  }

  const { html: htmlBody, attachments } = buildHtmlEmail(to, subject, fullBody, req);

  if (db.smtpSettings && db.smtpSettings.enabled) {
    try {
      const transporter = nodemailer.createTransport({
        host: db.smtpSettings.host,
        port: db.smtpSettings.port,
        secure: db.smtpSettings.port === 465,
        auth: {
          user: db.smtpSettings.username,
          pass: db.smtpSettings.password
        }
      });
      await transporter.sendMail({
        from: `"${db.smtpSettings.senderName}" <${db.smtpSettings.senderEmail}>`,
        to,
        subject,
        text: body + `\n\n${db.smtpSettings.signature || ''}`,
        html: htmlBody,
        attachments: attachments
      });
      logActivity('email', `SMTP email sent to ${to} (Subject: "${subject}")`);
      return true;
    } catch (err: any) {
      console.error(`SMTP delivery failed to ${to}:`, err);
      logActivity('email', `SMTP delivery failed to ${to}: ${err.message || 'Unknown error'}. Logged simulation instead.`);
    }
  }
  logActivity('email', `[SIMULATION] Email to: ${to} | Subject: ${subject}\nBody: ${body}`);
  return false;
}

// In-memory system activity logs cache
const systemLogs: { timestamp: string; type: string; message: string }[] = [
  { timestamp: new Date().toISOString(), type: 'system', message: 'System boot and server initialization completed.' },
  { timestamp: new Date().toISOString(), type: 'system', message: 'JSON database file loaded successfully.' }
];

function logActivity(type: string, message: string) {
  const timestamp = new Date().toISOString();
  systemLogs.unshift({ timestamp, type, message });
  if (systemLogs.length > 100) {
    systemLogs.pop();
  }
  try {
    // Write persistently to db.json auditLogs
    const db = readDb();
    db.auditLogs.unshift({ timestamp, type, message });
    if (db.auditLogs.length > 200) {
      db.auditLogs.pop();
    }
    writeDb(db);
  } catch (err) {
    console.error("Failed to persist audit log:", err);
  }
}

// Session management
interface Session {
  email: string;
  role: string;
  fullName: string;
  createdAt: number;
}

const ADMIN_SESSIONS: Record<string, Session> = {};

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. Authorization token missing.' });
  }
  const token = authHeader.split(' ')[1];
  const session = ADMIN_SESSIONS[token];
  if (!session) {
    return res.status(401).json({ error: 'Access denied. Invalid or expired token.' });
  }

  // Session timeout checking (30 minutes)
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  if (Date.now() - session.createdAt > SESSION_TIMEOUT_MS) {
    delete ADMIN_SESSIONS[token];
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  // Activity session refresh
  session.createdAt = Date.now();
  (req as any).adminSession = session;
  next();
}

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// GET /api/public-data
app.get('/api/public-data', (req, res) => {
  const db = readDb();
  res.json({
    services: db.services,
    branding: db.branding,
    content: db.content,
    faqs: db.faqs,
    processSteps: db.processSteps,
    roadmapSteps: db.roadmapSteps,
    projectGallery: db.projectGallery
  });
});

// POST /api/inquiry - client submits a project inquiry
app.post('/api/inquiry', apiLimiter, async (req, res) => {
  try {
    const { fullName, companyName, email, phone, serviceRequired, projectDescription, preferredContactMethod, budget, fileAttachment } = req.body;
    
    if (!fullName || !email || !phone || !serviceRequired || !projectDescription || !preferredContactMethod) {
      return res.status(400).json({ error: 'All fields except Company Name, Budget, and File are required.' });
    }

    const db = readDb();
    
    // Create new Inquiry record
    const inquiryId = `inq-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newInquiry: Inquiry = {
      id: inquiryId,
      fullName,
      companyName: companyName || '',
      email,
      phone,
      serviceRequired,
      projectDescription,
      preferredContactMethod,
      status: 'New',
      createdAt: new Date().toISOString(),
      adminNotes: '',
      budget: budget || '',
      fileAttachment: fileAttachment || undefined
    };

    db.inquiries.unshift(newInquiry);
    logActivity('inquiry', `New inquiry received from ${fullName} for service "${serviceRequired}".`);

    // Compose professional acknowledgment email using the customized template
    let emailSubject = db.emailTemplate.subject;
    let emailBody = db.emailTemplate.body;

    // Replace placeholders
    const replacements: Record<string, string> = {
      '{{name}}': fullName,
      '{{service}}': serviceRequired,
      '{{projectDescription}}': projectDescription,
      '{{preferredContact}}': preferredContactMethod,
      '{{companyName}}': db.branding.companyName,
      '{{companyEmail}}': db.content.contactEmail,
      '{{companyPhone}}': db.content.contactPhone
    };

    Object.keys(replacements).forEach(key => {
      emailSubject = emailSubject.replace(new RegExp(key, 'g'), replacements[key]);
      emailBody = emailBody.replace(new RegExp(key, 'g'), replacements[key]);
    });

    // Save sent email simulator log
    const emailId = `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sentEmail: SentEmail = {
      id: emailId,
      inquiryId,
      to: email,
      subject: emailSubject,
      body: emailBody,
      sentAt: new Date().toISOString(),
      type: 'Acknowledgment'
    };

    db.sentEmails.unshift(sentEmail);
    writeDb(db);

    // Dispatch auto-acknowledgment and company alert emails asynchronously in the background
    const alertBody = `A new customer inquiry has been received.\n\nName: ${fullName}\nCompany: ${companyName || 'N/A'}\nEmail: ${email}\nPhone: ${phone}\nService: ${serviceRequired}\nBudget: ${budget || 'N/A'}\nContact Method: ${preferredContactMethod}\n\nDescription:\n${projectDescription}`;
    Promise.all([
      sendSystemEmail(email, emailSubject, emailBody, req),
      sendSystemEmail(db.smtpSettings.senderEmail || db.content.contactEmail, `[JLC IT Inquiry] ${serviceRequired} - ${fullName}`, alertBody, req)
    ]).catch(err => {
      console.error("Failed to send parallel inquiry submission emails in background:", err);
    });

    res.status(201).json({ 
      success: true, 
      message: 'Inquiry submitted successfully!',
      inquiryId 
    });

  } catch (error: any) {
    console.error("Error submitting inquiry:", error);
    res.status(500).json({ error: 'Server error processing your request. Please try again.' });
  }
});

// ==========================================
// ADMIN API ENDPOINTS (SECURABLE)
// ==========================================

// POST /api/admin/login
app.post('/api/admin/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const db = readDb();
  const matchedAdmin = db.admins.find(a => a.email.toLowerCase().trim() === cleanEmail);

  if (matchedAdmin) {
    if (matchedAdmin.status === 'Disabled') {
      logActivity('security', `Blocked login attempt for disabled account: "${cleanEmail}".`);
      return res.status(403).json({ error: 'Your account has been disabled by the Super Administrator.' });
    }
    if (matchedAdmin.status === 'Invited' || !matchedAdmin.verified) {
      logActivity('security', `Blocked login attempt for unverified/invited account: "${cleanEmail}".`);
      return res.status(403).json({ error: 'Please verify your email address and activate your account using your invitation link.' });
    }

    const isMatched = matchedAdmin.passwordHash && bcrypt.compareSync(password, matchedAdmin.passwordHash);
      
    if (isMatched) {
      const token = `session-token-${cleanEmail}-${Date.now()}`;
      ADMIN_SESSIONS[token] = { email: matchedAdmin.email, role: matchedAdmin.role, fullName: matchedAdmin.fullName, createdAt: Date.now() };
      logActivity('security', `${matchedAdmin.fullName} (${matchedAdmin.role}) logged in successfully.`);
      return res.json({ token, role: matchedAdmin.role, fullName: matchedAdmin.fullName, email: matchedAdmin.email });
    }
  }

  logActivity('security', `Failed login attempt for email: "${cleanEmail}".`);
  res.status(401).json({ error: 'Invalid email address or password.' });
});

// POST /api/admin/verify-invite - verify invitation and set password
app.post('/api/admin/verify-invite', (req, res) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) {
    return res.status(400).json({ error: 'Email, verification token, and password are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const db = readDb();
  const matchedAdmin = db.admins.find(a => a.email.toLowerCase().trim() === cleanEmail);

  if (!matchedAdmin || matchedAdmin.verificationToken !== token) {
    return res.status(400).json({ error: 'Invalid verification token or email address.' });
  }

  if (matchedAdmin.verificationTokenExpires && new Date() > new Date(matchedAdmin.verificationTokenExpires)) {
    return res.status(400).json({ error: 'Verification token has expired. Please request a new invitation.' });
  }

  matchedAdmin.passwordHash = bcrypt.hashSync(password, 10);
  matchedAdmin.status = 'Active';
  matchedAdmin.verified = true;
  delete matchedAdmin.verificationToken;
  delete matchedAdmin.verificationTokenExpires;

  writeDb(db);
  logActivity('security', `Account for ${matchedAdmin.fullName} (${cleanEmail}) activated successfully via email verification.`);
  res.json({ success: true, message: 'Account activated successfully! You may now log in.' });
});

// POST /api/admin/forgot-password - request password reset
app.post('/api/admin/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const db = readDb();
  const matchedAdmin = db.admins.find(a => a.email.toLowerCase().trim() === cleanEmail);

  if (!matchedAdmin) {
    logActivity('security', `Password reset requested for unregistered email: "${cleanEmail}".`);
    return res.json({ success: true, message: 'If the email matches an active account, a recovery link will be sent shortly.' });
  }

  if (matchedAdmin.status === 'Disabled') {
    return res.status(403).json({ error: 'Your account is disabled. Please contact your Super Administrator.' });
  }

  const resetToken = `reset-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  matchedAdmin.resetToken = resetToken;
  matchedAdmin.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  writeDb(db);

  const origin = req.headers.origin || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:3000');
  const resetLink = `${origin}/?resetToken=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;
  const emailBody = `Dear ${matchedAdmin.fullName},\n\nWe received a request to reset your password for the ${db.branding.companyName} Administration Panel.\n\nPlease click the link below to set a new password:\n${resetLink}\n\nThis link is valid for 1 hour. If you did not request this, you can ignore this email.`;

  sendSystemEmail(cleanEmail, 'Reset Your Password - ' + db.branding.companyName, emailBody, req).catch(err => {
    console.error("Failed to send password reset email in background:", err);
  });

  res.json({ success: true, message: 'Recovery link dispatched successfully!' });
});

// POST /api/admin/reset-password - execute password reset
app.post('/api/admin/reset-password', (req, res) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) {
    return res.status(400).json({ error: 'Email, token, and password are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const db = readDb();
  const matchedAdmin = db.admins.find(a => a.email.toLowerCase().trim() === cleanEmail);

  if (!matchedAdmin || matchedAdmin.resetToken !== token) {
    return res.status(400).json({ error: 'Invalid reset token or email address.' });
  }

  if (matchedAdmin.resetTokenExpires && new Date() > new Date(matchedAdmin.resetTokenExpires)) {
    return res.status(400).json({ error: 'Reset link has expired. Please request a new recovery link.' });
  }

  matchedAdmin.passwordHash = bcrypt.hashSync(password, 10);
  delete matchedAdmin.resetToken;
  delete matchedAdmin.resetTokenExpires;

  writeDb(db);
  logActivity('security', `Password reset completed successfully for ${matchedAdmin.fullName} (${cleanEmail}).`);
  res.json({ success: true, message: 'Password updated successfully! You may now log in.' });
});

// GET /api/admin/data - retrieve entire data state (Auth required)
app.get('/api/admin/data', requireAuth, (req, res) => {
  const db = readDb();
  res.json({
    db,
    systemLogs
  });
});

// POST /api/admin/settings/branding - edit company info & theme (Auth required)
app.post('/api/admin/settings/branding', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  if (session.role === 'Editor') {
    return res.status(403).json({ error: 'Access Denied: Editors are not permitted to change company branding.' });
  }

  try {
    const db = readDb();
    db.branding = {
      ...db.branding,
      ...req.body
    };
    writeDb(db);
    logActivity('settings', `Branding and layout settings updated by ${session.fullName}.`);
    res.json({ success: true, branding: db.branding });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branding.' });
  }
});

// POST /api/admin/settings/content - edit website pages content (Auth required)
app.post('/api/admin/settings/content', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  try {
    const db = readDb();
    db.content = {
      ...db.content,
      ...req.body
    };
    writeDb(db);
    logActivity('settings', `Website page text content updated by ${session.fullName}.`);
    res.json({ success: true, content: db.content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update content.' });
  }
});

// POST /api/admin/services - CRUD services (Auth required)
app.post('/api/admin/services', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  try {
    const { action, service } = req.body; // action = 'add' | 'edit' | 'delete' | 'reorder'
    const db = readDb();

    if (action === 'add') {
      const newService: Service = {
        ...service,
        id: `s-${Date.now()}`
      };
      db.services.push(newService);
      logActivity('services', `Added new service: "${newService.title}" by ${session.fullName}.`);
    } else if (action === 'edit' || action === 'update') {
      db.services = db.services.map(s => s.id === service.id ? service : s);
      logActivity('services', `Updated service details for "${service.title}" by ${session.fullName}.`);
    } else if (action === 'delete') {
      const removed = db.services.find(s => s.id === service.id);
      db.services = db.services.filter(s => s.id !== service.id);
      logActivity('services', `Removed service "${removed ? removed.title : service.id}" by ${session.fullName}.`);
    } else if (action === 'reorder') {
      const { order } = req.body;
      if (order && Array.isArray(order)) {
        const serviceMap = new Map(db.services.map(s => [s.id, s]));
        const reordered: Service[] = [];
        order.forEach((id: string) => {
          const s = serviceMap.get(id);
          if (s) reordered.push(s);
        });
        db.services.forEach(s => {
          if (!order.includes(s.id)) reordered.push(s);
        });
        db.services = reordered;
        logActivity('services', `Services reordered by ${session.fullName}.`);
      }
    }

    writeDb(db);
    res.json({ success: true, services: db.services });
  } catch (error) {
    res.status(500).json({ error: 'Failed to manage services.' });
  }
});

// POST /api/admin/inquiries/update - update inquiry status/notes (Auth required)
app.post('/api/admin/inquiries/update', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  try {
    const { id, status, adminNotes } = req.body;
    const db = readDb();
    
    db.inquiries = db.inquiries.map(inq => {
      if (inq.id === id) {
        return {
          ...inq,
          status: status || inq.status,
          adminNotes: adminNotes !== undefined ? adminNotes : inq.adminNotes
        };
      }
      return inq;
    });

    writeDb(db);
    logActivity('inquiry', `Inquiry status/notes for ID: ${id} updated to "${status}" by ${session.fullName}.`);
    res.json({ success: true, inquiries: db.inquiries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update inquiry.' });
  }
});

// POST /api/admin/inquiries/delete - delete client inquiry permanently (Auth required)
app.post('/api/admin/inquiries/delete', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Inquiry ID is required.' });
    
    const db = readDb();
    const matched = db.inquiries.find(inq => inq.id === id);
    if (!matched) return res.status(404).json({ error: 'Inquiry not found.' });

    db.inquiries = db.inquiries.filter(inq => inq.id !== id);
    writeDb(db);
    logActivity('inquiry', `Inquiry from "${matched.fullName}" (${matched.email}) permanently deleted by ${session.fullName}.`);
    res.json({ success: true, inquiries: db.inquiries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete inquiry.' });
  }
});

// POST /api/admin/inquiries/reply - send simulated reply to client (Auth required)
app.post('/api/admin/inquiries/reply', requireAuth, async (req, res) => {
  const session = (req as any).adminSession;
  try {
    const { inquiryId, to, subject, body } = req.body;
    if (!inquiryId || !to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }

    const db = readDb();
    const newMail: SentEmail = {
      id: `mail-reply-${Date.now()}`,
      inquiryId,
      to,
      subject,
      body,
      sentAt: new Date().toISOString(),
      type: 'Manual Reply'
    };

    db.sentEmails.unshift(newMail);
    
    // Auto move inquiry status to 'In Progress' if it is currently 'New'
    db.inquiries = db.inquiries.map(inq => {
      if (inq.id === inquiryId && inq.status === 'New') {
        return { ...inq, status: 'In Progress' };
      }
      return inq;
    });

    writeDb(db);
    // Actually send the email in the background!
    sendSystemEmail(to, subject, body, req).catch(err => {
      console.error("Failed to send manual reply email in background:", err);
    });
    logActivity('email', `Manual reply sent to client ${to} by ${session.fullName}.`);
    res.json({ success: true, sentEmails: db.sentEmails, inquiries: db.inquiries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reply.' });
  }
});

// POST /api/admin/email-template - update auto-ack template (Auth required)
app.post('/api/admin/email-template', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  if (session.role === 'Editor') {
    return res.status(403).json({ error: 'Access Denied: Editors cannot modify email templates.' });
  }

  try {
    const { subject, body } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body cannot be empty.' });
    }

    const db = readDb();
    db.emailTemplate = { subject, body };
    writeDb(db);

    logActivity('settings', `Auto-acknowledgment email template updated by ${session.fullName}.`);
    res.json({ success: true, emailTemplate: db.emailTemplate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update email template.' });
  }
});

// POST /api/admin/accounts - edit other admin dynamic accounts (Auth required)
app.post('/api/admin/accounts', requireAuth, async (req, res) => {
  const session = (req as any).adminSession;
  if (session.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Access Denied: Only Super Admins can manage administrator accounts.' });
  }

  try {
    const { action, admin } = req.body; // action: 'invite' | 'delete' | 'toggle_status' | 'edit' | 'reset_password'
    const db = readDb();

    if (action === 'invite') {
      if (!admin.email || !admin.fullName || !admin.role) {
        return res.status(400).json({ error: 'Missing email, fullName, or role in invitation.' });
      }
      const cleanEmail = admin.email.toLowerCase().trim();
      if (db.admins.some(a => a.email.toLowerCase().trim() === cleanEmail)) {
        return res.status(400).json({ error: 'An administrator account with this email already exists.' });
      }

      const token = `invite-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const newAdmin: AdminAccount = {
        email: cleanEmail,
        fullName: admin.fullName,
        role: admin.role,
        status: 'Invited',
        verified: false,
        verificationToken: token,
        verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      };

      db.admins.push(newAdmin);
      logActivity('security', `Invitation sent to ${admin.fullName} (${cleanEmail}) as role: ${admin.role} by ${session.fullName}.`);

      const origin = req.headers.origin || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:3000');
      const inviteLink = `${origin}/?inviteToken=${token}&email=${encodeURIComponent(cleanEmail)}`;
      const emailBody = `Dear ${admin.fullName},\n\nYou have been invited by the Super Administrator to access the ${db.branding.companyName} Administration Panel as role: ${admin.role}.\n\nPlease click the link below to verify your email and set your password:\n${inviteLink}\n\nThis invitation link is valid for 24 hours.`;

      sendSystemEmail(cleanEmail, 'Invitation to Admin Panel - ' + db.branding.companyName, emailBody, req).catch(err => {
        console.error("Failed to send admin invitation email in background:", err);
      });

    } else if (action === 'delete') {
      const cleanEmail = admin.email.toLowerCase().trim();
      if (cleanEmail === session.email.toLowerCase().trim()) {
        return res.status(400).json({ error: 'You cannot revoke your own Super Admin account.' });
      }
      db.admins = db.admins.filter(a => a.email.toLowerCase().trim() !== cleanEmail);
      logActivity('security', `Administrator account "${cleanEmail}" revoked by ${session.fullName}.`);

    } else if (action === 'toggle_status') {
      const cleanEmail = admin.email.toLowerCase().trim();
      if (cleanEmail === session.email.toLowerCase().trim()) {
        return res.status(400).json({ error: 'You cannot disable your own Super Admin account.' });
      }
      const matched = db.admins.find(a => a.email.toLowerCase().trim() === cleanEmail);
      if (!matched) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      matched.status = matched.status === 'Active' ? 'Disabled' : 'Active';
      logActivity('security', `Administrator status for "${cleanEmail}" toggled to "${matched.status}" by ${session.fullName}.`);

    } else if (action === 'edit') {
      const cleanEmail = admin.email.toLowerCase().trim();
      const matched = db.admins.find(a => a.email.toLowerCase().trim() === cleanEmail);
      if (!matched) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      matched.fullName = admin.fullName || matched.fullName;
      matched.role = admin.role || matched.role;
      logActivity('security', `Administrator account details for "${cleanEmail}" updated by ${session.fullName}.`);

    } else if (action === 'reset_password') {
      const cleanEmail = admin.email.toLowerCase().trim();
      const matched = db.admins.find(a => a.email.toLowerCase().trim() === cleanEmail);
      if (!matched) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      matched.passwordHash = bcrypt.hashSync(admin.password, 10);
      logActivity('security', `Password reset manually for administrator "${cleanEmail}" by ${session.fullName}.`);
    }

    writeDb(db);
    res.json({ success: true, admins: db.admins });
  } catch (error) {
    console.error("Accounts management failed:", error);
    res.status(500).json({ error: 'Failed to manage administrator accounts.' });
  }
});

// POST /api/admin/settings/smtp - configure SMTP settings (Auth required)
app.post('/api/admin/settings/smtp', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  if (session.role === 'Editor') {
    return res.status(403).json({ error: 'Access Denied: Editors cannot modify email SMTP configuration.' });
  }

  try {
    const db = readDb();
    db.smtpSettings = {
      ...db.smtpSettings,
      ...req.body
    };
    writeDb(db);
    logActivity('settings', `SMTP settings updated by ${session.fullName}.`);
    res.json({ success: true, smtpSettings: db.smtpSettings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update SMTP settings.' });
  }
});



// POST /api/admin/faqs - CRUD FAQs (Auth required)
app.post('/api/admin/faqs', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  try {
    const { action, faq } = req.body; // action: 'add' | 'update' | 'delete'
    const db = readDb();
    if (action === 'add') {
      db.faqs.push({
        id: `faq-${Date.now()}`,
        question: faq.question,
        answer: faq.answer
      });
      logActivity('settings', `Added FAQ question by ${session.fullName}.`);
    } else if (action === 'update') {
      db.faqs = db.faqs.map(f => f.id === faq.id ? faq : f);
      logActivity('settings', `Updated FAQ question by ${session.fullName}.`);
    } else if (action === 'delete') {
      db.faqs = db.faqs.filter(f => f.id !== faq.id);
      logActivity('settings', `Deleted FAQ question by ${session.fullName}.`);
    }
    writeDb(db);
    res.json({ success: true, faqs: db.faqs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to manage FAQs.' });
  }
});

// POST /api/admin/process - CRUD Collaboration Process steps (Auth required)
app.post('/api/admin/process', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  try {
    const { action, step } = req.body; // action: 'add' | 'update' | 'delete'
    const db = readDb();
    if (action === 'add') {
      db.processSteps.push({
        id: `pr-${Date.now()}`,
        stepNumber: step.stepNumber || `${db.processSteps.length + 1}`.padStart(2, '0'),
        title: step.title,
        description: step.description,
        iconName: step.iconName || 'Cpu'
      });
      logActivity('settings', `Added collaboration process step "${step.title}" by ${session.fullName}.`);
    } else if (action === 'update') {
      db.processSteps = db.processSteps.map(p => p.id === step.id ? step : p);
      logActivity('settings', `Updated collaboration process step "${step.title}" by ${session.fullName}.`);
    } else if (action === 'delete') {
      db.processSteps = db.processSteps.filter(p => p.id !== step.id);
      logActivity('settings', `Deleted collaboration process step by ${session.fullName}.`);
    }
    writeDb(db);
    res.json({ success: true, processSteps: db.processSteps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to manage process steps.' });
  }
});

// POST /api/admin/gallery - CRUD Project Gallery (Auth required)
app.post('/api/admin/gallery', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  try {
    const { action, project } = req.body; // action: 'add' | 'update' | 'delete'
    const db = readDb();
    if (action === 'add') {
      db.projectGallery.push({
        id: `gal-${Date.now()}`,
        title: project.title,
        description: project.description,
        category: project.category || 'General',
        imageBase64: project.imageBase64
      });
      logActivity('settings', `Added project gallery item "${project.title}" by ${session.fullName}.`);
    } else if (action === 'update') {
      db.projectGallery = db.projectGallery.map(g => g.id === project.id ? project : g);
      logActivity('settings', `Updated project gallery item "${project.title}" by ${session.fullName}.`);
    } else if (action === 'delete') {
      db.projectGallery = db.projectGallery.filter(g => g.id !== project.id);
      logActivity('settings', `Deleted project gallery item by ${session.fullName}.`);
    }
    writeDb(db);
    res.json({ success: true, projectGallery: db.projectGallery });
  } catch (error) {
    res.status(500).json({ error: 'Failed to manage project gallery.' });
  }
});

// POST /api/admin/roadmap - CRUD Roadmap milestones (Auth required)
app.post('/api/admin/roadmap', requireAuth, (req, res) => {
  const session = (req as any).adminSession;
  try {
    const { action, step } = req.body; // action: 'add' | 'update' | 'delete'
    const db = readDb();
    if (action === 'add') {
      db.roadmapSteps.push({
        id: `rm-${Date.now()}`,
        timeline: step.timeline,
        title: step.title,
        description: step.description,
        status: step.status || 'planned'
      });
      logActivity('settings', `Added roadmap milestone "${step.title}" by ${session.fullName}.`);
    } else if (action === 'update') {
      db.roadmapSteps = db.roadmapSteps.map(r => r.id === step.id ? step : r);
      logActivity('settings', `Updated roadmap milestone "${step.title}" by ${session.fullName}.`);
    } else if (action === 'delete') {
      db.roadmapSteps = db.roadmapSteps.filter(r => r.id !== step.id);
      logActivity('settings', `Deleted roadmap milestone by ${session.fullName}.`);
    }
    writeDb(db);
    res.json({ success: true, roadmapSteps: db.roadmapSteps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to manage roadmap.' });
  }
});

// ==========================================
// GEMINI INTELLIGENCE API CALLS (SERVER-SIDE)
// ==========================================

// POST /api/admin/generate-tagline
app.post('/api/admin/generate-tagline', requireAuth, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'A prompt is required.' });
  }

  try {
    const db = readDb();
    if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Generate 3 professional and modern business slogans or tagline options for ${db.branding.companyName} (an IT & Custom Software Development startup) based on the user request: "${prompt}". Return as a clean text list. Do not use markdown blocks, just return a simple, clean bulleted list.`,
        config: {
          systemInstruction: 'You are a professional branding consultant specializing in technology agencies.',
          temperature: 0.7
        }
      });
      const generatedText = response.text || "Failed to generate text output.";
      res.json({ success: true, generatedText });
    } else {
      // High-quality simulated response when API key is not available
      const simulation = `Here are professional tagline options based on your prompt:
• "Architecting Digital Trust, Engineering Infinite Growth"
• "Innovative Systems. Uncompromising Reliability. Done Right."
• "Powering the Technical Core of Modern Business"`;
      res.json({ success: true, generatedText: simulation, simulated: true });
    }
  } catch (error: any) {
    console.error("Gemini tagline generation error:", error);
    res.status(500).json({ error: 'Failed to generate taglines using Gemini API.' });
  }
});

// POST /api/admin/generate-reply-draft
app.post('/api/admin/generate-reply-draft', requireAuth, async (req, res) => {
  const { inquiryId, instructions } = req.body;
  if (!inquiryId) {
    return res.status(400).json({ error: 'Inquiry ID is required.' });
  }

  try {
    const db = readDb();
    const inquiry = db.inquiries.find(inq => inq.id === inquiryId);
    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found.' });
    }

    if (ai) {
      const systemInstruction = `You are an expert IT solutions sales engineer drafting a professional email response. Be client-oriented, warm, professional, and highlight high quality of work, trust, and clear communication. Keep it clean and scannable.`;
      
      const prompt = `Compose a response email to ${inquiry.fullName || 'Client'} who submitted an inquiry for ${db.branding.companyName}.
Client Details:
- Name: ${inquiry.fullName || 'Client'}
- Company: ${inquiry.companyName || 'N/A'}
- Service Required: ${inquiry.serviceRequired || 'our services'}
- Project Description: ${inquiry.projectDescription || ''}

Additional instructions from the Admin: "${instructions || 'Briefly acknowledge, suggest a quick 15-minute introductory call, and thank them.'}"

Compose the email. It should start with Dear ${inquiry.fullName || 'Client'}, include a professional response offering technical insight, and end with a modern signature:
Best regards,
${db.branding.companyName} Technical Consulting Team`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      res.json({ success: true, draftText: response.text });
    } else {
      // Intelligent Rule-Based Simulator for local development / missing API keys
      let simulatedReply = `Dear ${inquiry.fullName || 'Client'},

Thank you for your interest in our ${inquiry.serviceRequired || 'services'} at ${db.branding.companyName}! We reviewed your project description.`;

      const instrLower = (instructions || '').toLowerCase();
      if (instrLower.includes('decline') || instrLower.includes('busy') || instrLower.includes('cannot handle') || instrLower.includes('reject')) {
        simulatedReply = `Dear ${inquiry.fullName || 'Client'},

Thank you for your interest in ${db.branding.companyName}! We reviewed your project description regarding "${inquiry.serviceRequired || 'services'}". 

Unfortunately, our engineering team is currently at full capacity for the next few weeks and we are unable to take on new projects at this time. We apologize for the inconvenience and wish you the best of luck with your launch.

Best regards,
${db.branding.companyName} Technical Consulting Team`;
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

        simulatedReply = `Dear ${inquiry.fullName || 'Client'},

Thank you for your interest in our ${inquiry.serviceRequired || 'services'} at ${db.branding.companyName}! We reviewed your project description regarding:
"${(inquiry.projectDescription || '').substring(0, 100)}..."
${customInsight}
We would love to schedule a quick consultation to discuss your objectives in detail. 

${actionItem}

Best regards,
${db.branding.companyName} Technical Consulting Team`;
      }

      res.json({ success: true, draftText: simulatedReply, simulated: true });
    }
  } catch (error: any) {
    console.error("Gemini reply draft error:", error);
    res.status(500).json({ error: 'Failed to generate reply draft.' });
  }
});


// ==========================================
// DYNAMIC FAVICON ENDPOINTS
// ==========================================
app.get('/favicon.ico', (req, res) => {
  const db = readDb();
  const branding = db.branding || DEFAULT_BRANDING;
  if (branding.logoType === 'image' && branding.logoImageBase64) {
    try {
      const matches = branding.logoImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(buffer);
      }
    } catch (err) {
      console.error("Failed to parse base64 logo for favicon.ico:", err);
    }
  }
  const fallbackPath = path.join(process.cwd(), 'public', 'favicon.svg');
  if (fs.existsSync(fallbackPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(fallbackPath);
  }
  res.status(404).end();
});

app.get('/favicon.svg', (req, res) => {
  const db = readDb();
  const branding = db.branding || DEFAULT_BRANDING;
  if (branding.logoType === 'image' && branding.logoImageBase64) {
    try {
      const matches = branding.logoImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(buffer);
      }
    } catch (err) {
      console.error("Failed to parse base64 logo for favicon.svg:", err);
    }
  }
  const fallbackPath = path.join(process.cwd(), 'public', 'favicon.svg');
  if (fs.existsSync(fallbackPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(fallbackPath);
  }
  res.status(404).end();
});

// ==========================================
// VITE DEV SERVER & STATIC ASSETS HANDLER
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const db = readDb();
    console.log(`[${db.branding.companyName} Backend] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
