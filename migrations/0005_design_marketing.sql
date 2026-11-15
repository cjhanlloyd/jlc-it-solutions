-- Phase 3: marketing copy and homepage flag for designs. Additive.
ALTER TABLE products_designs ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE products_designs ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
