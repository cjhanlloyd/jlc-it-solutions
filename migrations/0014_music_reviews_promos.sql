-- Own music, reviews, promo codes and the new-order alert address.
ALTER TABLE invitations ADD COLUMN music_key TEXT;
ALTER TABLE invitations ADD COLUMN music_title TEXT;

ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN discount_centavos INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_orders_promo_code ON orders (promo_code);

ALTER TABLE smtp_settings ADD COLUMN order_alert_email TEXT;

CREATE TABLE promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL,
  min_purchase_centavos INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  expires_at TEXT,
  max_uses INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  moderated_at TEXT,
  moderated_by TEXT
);
CREATE INDEX idx_reviews_status_updated ON reviews (status, updated_at);
