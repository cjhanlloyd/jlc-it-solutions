// Design package rules. Dependency-free: used by the Cloudflare server and the React client.
export type Package = {
  key: string;
  name: string;
  priceCentavos: number;
  inclusions: string[];
  kind: 'template' | 'custom';
};

const KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const bad = (error: string) => ({ ok: false as const, error });

export function validatePackages(input: unknown): { ok: true; packages: Package[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length < 1 || input.length > 4) return bad('Each design needs 1 to 4 packages.');
  const packages: Package[] = [];
  for (const raw of input) {
    const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const key = typeof p.key === 'string' ? p.key : '';
    if (!KEY_RE.test(key) || key.length > 30) return bad('Package key must be lowercase letters, numbers and dashes (30 characters max).');
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || name.length > 40) return bad('Package name is required (40 characters max).');
    const price = p.priceCentavos;
    if (typeof price !== 'number' || !Number.isInteger(price) || price < 1000 || price > 10000000) {
      return bad('Package price must be between ₱10 and ₱100,000.');
    }
    if (p.kind !== 'template' && p.kind !== 'custom') return bad('Package kind must be template or custom.');
    const incl = Array.isArray(p.inclusions) ? p.inclusions : [];
    if (!incl.every((s) => typeof s === 'string')) return bad('Package inclusions must be text.');
    const inclusions = (incl as string[]).map((s) => s.trim()).filter(Boolean);
    if (inclusions.length > 10 || inclusions.some((s) => s.length > 80)) {
      return bad('A package can have up to 10 inclusions of 80 characters each.');
    }
    packages.push({ key, name, priceCentavos: price, inclusions, kind: p.kind });
  }
  if (new Set(packages.map((p) => p.key)).size !== packages.length) return bad('Package keys must be unique.');
  if (!packages.some((p) => p.kind === 'template')) return bad('Each design needs at least one package that can be ordered online.');
  return { ok: true, packages };
}

/** Lowest template price (what "From ₱x" shows). Assumes validated input. */
export function fromPrice(packages: Package[]): number {
  return Math.min(...packages.filter((p) => p.kind === 'template').map((p) => p.priceCentavos));
}

/** Exact key (any kind), else the first template package, else null. */
export function pickPackage(packages: Package[], key?: string): Package | null {
  return (key !== undefined && packages.find((p) => p.key === key)) || packages.find((p) => p.kind === 'template') || null;
}

/** Like pickPackage but never returns a custom package: exact template key, else the first template. */
export function resolvePackage(packages: Package[], key?: string): Package | null {
  return packages.find((p) => p.key === key && p.kind === 'template') || packages.find((p) => p.kind === 'template') || null;
}

/** For the order flow: exact key of any kind (custom included), else the first template, else null. */
export function resolveOrderPackage(packages: Package[], key?: string): Package | null {
  return packages.find((p) => p.key === key) || packages.find((p) => p.kind === 'template') || null;
}
