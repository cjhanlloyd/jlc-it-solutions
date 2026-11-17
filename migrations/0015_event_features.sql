-- Event features: attire, gallery layouts, guest photos, wish list, QR check-in and the photo booth. Additive.
ALTER TABLE invitations ADD COLUMN extras TEXT NOT NULL DEFAULT '{}';
ALTER TABLE invitations ADD COLUMN checkin_key_hash TEXT;

ALTER TABLE invitation_guests ADD COLUMN checkin_code TEXT;
ALTER TABLE invitation_guests ADD COLUMN checked_in_at TEXT;
ALTER TABLE invitation_guests ADD COLUMN checked_in_count INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_invitation_guests_checkin_code ON invitation_guests (checkin_code);

CREATE TABLE gift_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  link TEXT,
  price_centavos INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  reserved_name TEXT,
  reserved_guest_id INTEGER,
  reserved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_gift_items_invitation ON gift_items (invitation_id);

CREATE TABLE invitation_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('attire', 'guest')),
  r2_key TEXT NOT NULL UNIQUE,
  caption TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  guest_id INTEGER,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  moderated_at TEXT
);
CREATE INDEX idx_invitation_media_inv ON invitation_media (invitation_id, kind, status);
