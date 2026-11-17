import type { InvitationStyle } from './invitation-style';
// Standard / Premium tier rules. Dependency-free: used by the Cloudflare server and the React client.
export type Tier = 'standard' | 'premium';

export const tierOf = (p?: { tier?: unknown } | null): Tier => (p?.tier === 'premium' ? 'premium' : 'standard');
export const photoLimit = (t: Tier): number => (t === 'premium' ? 12 : 6);
export const retentionDays = (t: Tier): number => (t === 'premium' ? 183 : 60);
// Standard designs take neither extra (the server rejects them), so drop them, e.g. after switching from a Premium design.
export const forTier = (s: InvitationStyle, t: Tier): InvitationStyle => {
  if (t === 'premium') return s;
  const { intro: _i, music: _m, ...rest } = s;
  return rest;
};
