-- Invitation style (font pair, custom colours, cover photo). Additive; '{}' keeps the layout defaults.
ALTER TABLE invitations ADD COLUMN style TEXT NOT NULL DEFAULT '{}';
