-- Phase 4b: custom-package orders (designer notes, proofs). Additive.
ALTER TABLE orders ADD COLUMN package_kind TEXT NOT NULL DEFAULT 'template';
ALTER TABLE orders ADD COLUMN designer_notes TEXT;

CREATE TABLE IF NOT EXISTS order_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  round INTEGER NOT NULL,
  kind TEXT NOT NULL,
  file_key TEXT,
  content_type TEXT,
  url TEXT,
  message TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_proofs_order ON order_proofs(order_id);
