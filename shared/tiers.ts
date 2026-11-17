// Standard / Premium tier rules. Dependency-free: used by the Cloudflare server and the React client.
export type Tier = 'standard' | 'premium';

export const tierOf = (p?: { tier?: unknown } | null): Tier => (p?.tier === 'premium' ? 'premium' : 'standard');
export const photoLimit = (t: Tier): number => (t === 'premium' ? 12 : 6);
export const retentionDays = (t: Tier): number => (t === 'premium' ? 183 : 60);
