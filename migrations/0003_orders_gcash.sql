-- Phase 2: manual GCash ordering. Additive; no rows deleted. Run once: wrangler d1 execute jlc_database --remote --file=migrations/0003_orders_gcash.sql
ALTER TABLE orders ADD COLUMN reference TEXT;
ALTER TABLE orders ADD COLUMN customer_id INTEGER;
ALTER TABLE orders ADD COLUMN provider TEXT NOT NULL DEFAULT 'manual_gcash';
ALTER TABLE orders ADD COLUMN payment_deadline TEXT;
ALTER TABLE orders ADD COLUMN tracking_token_hash TEXT;
ALTER TABLE orders ADD COLUMN assigned_to TEXT;
ALTER TABLE orders ADD COLUMN delivered_at TEXT;
ALTER TABLE orders ADD COLUMN updated_at TEXT;

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  amount_centavos INTEGER NOT NULL,
  status TEXT NOT NULL, -- submitted | confirmed | rejected
  customer_reference TEXT,
  receipt_key TEXT,
  submitted_at TEXT NOT NULL,
  verified_by TEXT,
  verified_at TEXT,
  admin_reference TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  kind TEXT NOT NULL, -- status | note | assign | payment
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  visible INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

CREATE TABLE IF NOT EXISTS payment_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  provider TEXT NOT NULL DEFAULT 'manual_gcash',
  gcash_account_name TEXT,
  gcash_number TEXT,
  instructions TEXT,
  qr_key TEXT,
  deadline_hours INTEGER NOT NULL DEFAULT 48,
  updated_at TEXT
);
INSERT OR IGNORE INTO payment_settings (id) VALUES ('default');

-- Data mapping, in order. Legacy rows keep provider 'paymongo'; their hex references need not match the new-order format.
UPDATE orders SET status = 'delivered', delivered_at = paid_at WHERE status = 'paid';
UPDATE orders SET status = 'cancelled' WHERE status IN ('pending', 'expired', 'failed');
UPDATE orders SET provider = 'paymongo', reference = 'JLC-' || upper(substr(hex(randomblob(4)), 1, 6)), updated_at = COALESCE(paid_at, created_at);
INSERT OR IGNORE INTO customers (email) SELECT DISTINCT lower(customer_email) FROM orders;
UPDATE orders SET customer_id = (SELECT id FROM customers WHERE email = lower(orders.customer_email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_token_hash);
