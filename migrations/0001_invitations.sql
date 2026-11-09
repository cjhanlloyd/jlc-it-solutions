-- Safe to run on the live DB: no DROP, no seed rows.
CREATE TABLE IF NOT EXISTS products_designs (
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

CREATE TABLE IF NOT EXISTS invitations (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_slug ON invitations(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_manage_token_hash ON invitations(manage_token_hash);

CREATE TABLE IF NOT EXISTS orders (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paymongo_checkout_id ON orders(paymongo_checkout_id);

CREATE TABLE IF NOT EXISTS payment_events (
  paymongo_event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  order_id INTEGER,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload TEXT
);

CREATE TABLE IF NOT EXISTS rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  attending INTEGER NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rsvps_invitation_id ON rsvps(invitation_id);
