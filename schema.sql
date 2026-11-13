-- D1 SQL Database Schema for JLC IT Solutions

DROP TABLE IF EXISTS services;
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  iconName TEXT,
  features TEXT, -- JSON array of strings
  position INTEGER DEFAULT 0
);

DROP TABLE IF EXISTS inquiries;
CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  fullName TEXT NOT NULL,
  companyName TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  serviceRequired TEXT NOT NULL,
  projectDescription TEXT NOT NULL,
  preferredContactMethod TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  createdAt TEXT NOT NULL,
  adminNotes TEXT,
  budget TEXT,
  fileAttachment TEXT, -- JSON object representing attachment metadata and base64 string
  ipAddress TEXT
);

DROP TABLE IF EXISTS branding;
CREATE TABLE branding (
  id TEXT PRIMARY KEY DEFAULT 'default',
  companyName TEXT NOT NULL,
  logoType TEXT NOT NULL DEFAULT 'icon',
  logoIcon TEXT NOT NULL DEFAULT 'Activity',
  logoImageBase64 TEXT,
  themeColor TEXT NOT NULL DEFAULT 'deepblue',
  tagline TEXT
);

DROP TABLE IF EXISTS content;
CREATE TABLE content (
  id TEXT PRIMARY KEY DEFAULT 'default',
  heroTitle TEXT NOT NULL,
  heroSubtitle TEXT,
  heroBadge TEXT,
  aboutHeader TEXT,
  aboutSubheader TEXT,
  aboutText TEXT,
  aboutText2 TEXT,
  aboutMission TEXT,
  aboutVision TEXT,
  aboutCommitments TEXT, -- JSON array of AboutCommitmentPoint
  aboutImageBase64 TEXT,
  whyChooseUsText TEXT,
  whyChooseUsPoints TEXT, -- JSON array of WhyChooseUsPoint
  whyChooseUsPromiseTitle TEXT,
  whyChooseUsPromiseDesc TEXT,
  whyChooseUsPromises TEXT, -- JSON array of WhyChooseUsPromise
  whyChooseUsCtaTitle TEXT,
  whyChooseUsCtaDesc TEXT,
  servicesHeader TEXT,
  servicesSubtitle TEXT,
  portfolioHeader TEXT,
  portfolioSubtitle TEXT,
  processHeader TEXT,
  processSubtitle TEXT,
  faqHeader TEXT,
  faqSubtitle TEXT,
  contactHeader TEXT,
  contactSubtitle TEXT,
  contactAddress TEXT,
  contactPhone TEXT,
  contactEmail TEXT,
  contactWorkingHours TEXT,
  contactMapEmbedUrl TEXT,
  bannerImageUrl TEXT,
  facebookUrl TEXT,
  whatsappUrl TEXT,
  viberUrl TEXT,
  pricingHeader TEXT,
  pricingSubtitle TEXT,
  pricingEnterpriseTitle TEXT,
  pricingEnterpriseDesc TEXT,
  pricingEnterpriseHighlights TEXT,
  pricingCtaTitle TEXT,
  pricingCtaDesc TEXT,
  pricingCards TEXT -- JSON array of PricingCard
);

DROP TABLE IF EXISTS admins;
CREATE TABLE admins (
  email TEXT PRIMARY KEY,
  fullName TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Editor',
  status TEXT NOT NULL DEFAULT 'Invited',
  verified INTEGER NOT NULL DEFAULT 0, -- 0 for false, 1 for true
  passwordHash TEXT,
  createdAt TEXT NOT NULL,
  verificationToken TEXT,
  verificationTokenExpires TEXT,
  resetToken TEXT,
  resetTokenExpires TEXT
);

DROP TABLE IF EXISTS faqs;
CREATE TABLE faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL
);

DROP TABLE IF EXISTS sent_emails;
CREATE TABLE sent_emails (
  id TEXT PRIMARY KEY,
  inquiryId TEXT,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sentAt TEXT NOT NULL,
  email_type TEXT NOT NULL
);

DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  log_type TEXT NOT NULL,
  message TEXT NOT NULL
);

DROP TABLE IF EXISTS project_gallery;
CREATE TABLE project_gallery (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  imageBase64 TEXT,
  description TEXT
);

DROP TABLE IF EXISTS process_steps;
CREATE TABLE process_steps (
  id TEXT PRIMARY KEY,
  stepNumber INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  iconName TEXT
);

DROP TABLE IF EXISTS roadmap_steps;
CREATE TABLE roadmap_steps (
  id TEXT PRIMARY KEY,
  timeline TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL
);

DROP TABLE IF EXISTS email_template;
CREATE TABLE email_template (
  id TEXT PRIMARY KEY DEFAULT 'default',
  subject TEXT NOT NULL,
  body TEXT NOT NULL
);

DROP TABLE IF EXISTS smtp_settings;
CREATE TABLE smtp_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  host TEXT,
  port INTEGER,
  username TEXT,
  password TEXT,
  senderName TEXT,
  senderEmail TEXT,
  signature TEXT,
  enabled INTEGER DEFAULT 0
);

-- Wedding invitations (see migrations/0001_invitations.sql)
DROP TABLE IF EXISTS rsvps;
DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS products_designs;
CREATE TABLE products_designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_type TEXT NOT NULL DEFAULT 'wedding_invitation',
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  layout_key TEXT NOT NULL,
  price_centavos INTEGER NOT NULL,
  color_schemes TEXT NOT NULL DEFAULT '[]',
  preview_images TEXT NOT NULL DEFAULT '[]',
  sample_details TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  color_scheme TEXT NOT NULL,
  details TEXT NOT NULL,
  photos TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  event_date TEXT NOT NULL,
  manage_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_invitations_slug ON invitations(slug);
CREATE UNIQUE INDEX idx_invitations_manage_token_hash ON invitations(manage_token_hash);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_type TEXT NOT NULL DEFAULT 'wedding_invitation',
  product_id INTEGER NOT NULL,
  customer_email TEXT NOT NULL,
  amount_centavos INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  status TEXT NOT NULL DEFAULT 'pending',
  paymongo_checkout_id TEXT,
  paymongo_payment_id TEXT,
  terms_accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);
CREATE UNIQUE INDEX idx_orders_paymongo_checkout_id ON orders(paymongo_checkout_id);
CREATE TABLE payment_events (
  paymongo_event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  order_id INTEGER,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload TEXT
);
CREATE TABLE rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  attending INTEGER NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  kids_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_rsvps_invitation_id ON rsvps(invitation_id);

-- see migrations/0003_orders_gcash.sql (orders GCash columns, customers, payments, order_events, payment_settings)
