-- Customer accounts (emailed sign-in code), per-guest invitation links and an optional gift QR image.
ALTER TABLE invitations ADD COLUMN gift_qr TEXT;

CREATE TABLE customer_login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE customer_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE rsvps ADD COLUMN guest_id INTEGER;

CREATE TABLE invitation_guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_invitation_guests_invitation ON invitation_guests (invitation_id);
