-- Phase 4a: design packages, order package snapshot, FAQ categories, testimonials, banner, site content. Additive.
ALTER TABLE products_designs ADD COLUMN packages TEXT NOT NULL DEFAULT '[]';
UPDATE products_designs SET packages = json_array(json_object(
  'key', 'standard', 'name', 'Standard', 'priceCentavos', price_centavos,
  'inclusions', json_array('RSVP with guest count', 'Map and directions', 'Countdown', 'Photo gallery', 'Private manage link', 'Online until 60 days after the event'),
  'kind', 'template')) WHERE packages = '[]';

ALTER TABLE orders ADD COLUMN package_key TEXT;
ALTER TABLE orders ADD COLUMN package_name TEXT;
UPDATE orders SET package_key = 'standard', package_name = 'Standard' WHERE package_key IS NULL;

ALTER TABLE faqs ADD COLUMN category TEXT NOT NULL DEFAULT 'it';
ALTER TABLE faqs ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
INSERT OR IGNORE INTO faqs (id, question, answer, category, sort_order) VALUES
 ('inv-1', 'How do I pay?', 'By GCash. After you place your order you get our GCash details. Send the payment and upload a screenshot of your receipt; our team verifies it.', 'invitations', 1),
 ('inv-2', 'When do I get my invitation?', 'As soon as our team has verified your payment, your invitation is delivered as a private link you can share with your guests.', 'invitations', 2),
 ('inv-3', 'How do my guests RSVP?', 'Right on the invitation page. They say whether they are coming and how many are in their party, and you see every reply.', 'invitations', 3),
 ('inv-4', 'Can I change details after ordering?', 'Yes. Your private manage link lets you edit your invitation details, and your guests see the changes right away.', 'invitations', 4),
 ('inv-5', 'How long does my invitation stay online?', 'Until 60 days after your event.', 'invitations', 5),
 ('inv-6', 'Can I get a refund?', 'Refunds follow our Refund Policy. [Read the Refund Policy](/refund-policy)', 'invitations', 6),
 ('inv-7', 'I have another question.', 'We are happy to help. [Contact us](/contact)', 'invitations', 7);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  occasion TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL,
  photo_key TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_banner (
  id TEXT PRIMARY KEY DEFAULT 'default',
  message TEXT NOT NULL DEFAULT '',
  link TEXT,
  active INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  updated_at TEXT
);
INSERT OR IGNORE INTO site_banner (id) VALUES ('default');

CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
