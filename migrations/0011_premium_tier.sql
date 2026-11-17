-- Standard / Premium tiers: each invitation records its tier, and Premium invitations can pick a music track.
ALTER TABLE invitations ADD COLUMN tier TEXT NOT NULL DEFAULT 'standard';

CREATE TABLE music_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  credit TEXT NOT NULL DEFAULT '',
  r2_key TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
