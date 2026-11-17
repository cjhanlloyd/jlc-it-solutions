-- Sample photos per design: shown in the shop previews only, replaced by the customer's own photos when they customise.
ALTER TABLE products_designs ADD COLUMN sample_photos TEXT NOT NULL DEFAULT '[]';
