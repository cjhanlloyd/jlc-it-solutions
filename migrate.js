import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.json');

if (!fs.existsSync(DB_PATH)) {
  console.error("No db.json found at path:", DB_PATH);
  process.exit(1);
}

const raw = fs.readFileSync(DB_PATH, 'utf-8');
const data = JSON.parse(raw);

function escape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'string') {
    return `'${val.replace(/'/g, "''")}'`;
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }
  return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
}

let sql = '';

// 1. Branding (single row)
if (data.branding) {
  const b = data.branding;
  sql += `INSERT INTO branding (id, companyName, logoType, logoIcon, logoImageBase64, themeColor, tagline) VALUES ('default', ${escape(b.companyName)}, 'icon', ${escape(b.logoIcon)}, NULL, ${escape(b.themeColor)}, ${escape(b.tagline)});\n`;
}

// 2. Content (single row)
if (data.content) {
  const c = data.content;
  sql += `INSERT INTO content (id, heroTitle, heroSubtitle, aboutText, aboutMission, aboutVision, whyChooseUsText, whyChooseUsPoints, contactAddress, contactPhone, contactEmail, contactWorkingHours, contactMapEmbedUrl, bannerImageUrl, facebookUrl, whatsappUrl, viberUrl) VALUES ('default', ${escape(c.heroTitle)}, ${escape(c.heroSubtitle)}, ${escape(c.aboutText)}, ${escape(c.aboutMission)}, ${escape(c.aboutVision)}, ${escape(c.whyChooseUsText)}, ${escape(c.whyChooseUsPoints)}, ${escape(c.contactAddress)}, ${escape(c.contactPhone)}, ${escape(c.contactEmail)}, ${escape(c.contactWorkingHours)}, ${escape(c.contactMapEmbedUrl)}, ${escape(c.bannerImageUrl)}, ${escape(c.facebookUrl || '')}, ${escape(c.whatsappUrl || '')}, ${escape(c.viberUrl || '')});\n`;
}

// 3. Services
if (data.services && Array.isArray(data.services)) {
  data.services.forEach(s => {
    sql += `INSERT INTO services (id, title, description, iconName, features) VALUES (${escape(s.id)}, ${escape(s.title)}, ${escape(s.description)}, ${escape(s.iconName)}, ${escape(s.features)});\n`;
  });
}

// 4. Inquiries
if (data.inquiries && Array.isArray(data.inquiries)) {
  data.inquiries.forEach(i => {
    sql += `INSERT INTO inquiries (id, fullName, companyName, email, phone, serviceRequired, projectDescription, preferredContactMethod, status, createdAt, adminNotes, budget, fileAttachment) VALUES (${escape(i.id)}, ${escape(i.fullName)}, ${escape(i.companyName)}, ${escape(i.email)}, ${escape(i.phone)}, ${escape(i.serviceRequired)}, ${escape(i.projectDescription)}, ${escape(i.preferredContactMethod)}, ${escape(i.status)}, ${escape(i.createdAt)}, ${escape(i.adminNotes)}, ${escape(i.budget)}, ${escape(i.fileAttachment)});\n`;
  });
}

// 5. Admins
if (data.admins && Array.isArray(data.admins)) {
  data.admins.forEach(a => {
    const verified = a.verified ? 1 : 0;
    sql += `INSERT INTO admins (email, fullName, role, status, verified, passwordHash, createdAt, verificationToken, verificationTokenExpires, resetToken, resetTokenExpires) VALUES (${escape(a.email)}, ${escape(a.fullName)}, ${escape(a.role)}, ${escape(a.status)}, ${verified}, ${escape(a.passwordHash)}, ${escape(a.createdAt)}, ${escape(a.verificationToken)}, ${escape(a.verificationTokenExpires)}, ${escape(a.resetToken)}, ${escape(a.resetTokenExpires)});\n`;
  });
}

// 6. FAQs
if (data.faqs && Array.isArray(data.faqs)) {
  data.faqs.forEach(f => {
    sql += `INSERT INTO faqs (id, question, answer) VALUES (${escape(f.id)}, ${escape(f.question)}, ${escape(f.answer)});\n`;
  });
}

// 7. Sent Emails
if (data.sentEmails && Array.isArray(data.sentEmails)) {
  data.sentEmails.forEach(e => {
    sql += `INSERT INTO sent_emails (id, inquiryId, to_address, subject, body, sentAt, email_type) VALUES (${escape(e.id)}, ${escape(e.inquiryId)}, ${escape(e.to)}, ${escape(e.subject)}, ${escape(e.body)}, ${escape(e.sentAt)}, ${escape(e.type)});\n`;
  });
}

// 8. Audit Logs
if (data.auditLogs && Array.isArray(data.auditLogs)) {
  data.auditLogs.forEach(l => {
    sql += `INSERT INTO audit_logs (timestamp, log_type, message) VALUES (${escape(l.timestamp)}, ${escape(l.type)}, ${escape(l.message)});\n`;
  });
}

// 9. Project Gallery
if (data.projectGallery && Array.isArray(data.projectGallery)) {
  data.projectGallery.forEach(p => {
    sql += `INSERT INTO project_gallery (id, title, category, imageBase64, description) VALUES (${escape(p.id)}, ${escape(p.title)}, ${escape(p.category)}, NULL, ${escape(p.description)});\n`;
  });
}

// 10. Process Steps
if (data.processSteps && Array.isArray(data.processSteps)) {
  data.processSteps.forEach(p => {
    sql += `INSERT INTO process_steps (id, stepNumber, title, description, iconName) VALUES (${escape(p.id)}, ${escape(p.stepNumber)}, ${escape(p.title)}, ${escape(p.description)}, ${escape(p.iconName)});\n`;
  });
}

// 11. Roadmap Steps
if (data.roadmapSteps && Array.isArray(data.roadmapSteps)) {
  data.roadmapSteps.forEach(r => {
    sql += `INSERT INTO roadmap_steps (id, timeline, title, description, status) VALUES (${escape(r.id)}, ${escape(r.timeline)}, ${escape(r.title)}, ${escape(r.description)}, ${escape(r.status)});\n`;
  });
}

// 12. Email Template
if (data.emailTemplate) {
  const e = data.emailTemplate;
  sql += `INSERT INTO email_template (id, subject, body) VALUES ('default', ${escape(e.subject)}, ${escape(e.body)});\n`;
}

// 13. SMTP Settings
if (data.smtpSettings) {
  const s = data.smtpSettings;
  const enabled = s.enabled ? 1 : 0;
  sql += `INSERT INTO smtp_settings (id, host, port, username, password, senderName, senderEmail, signature, enabled) VALUES ('default', ${escape(s.host)}, ${escape(s.port)}, ${escape(s.username)}, ${escape(s.password)}, ${escape(s.senderName)}, ${escape(s.senderEmail)}, ${escape(s.signature)}, ${enabled});\n`;
}

console.log(sql);
