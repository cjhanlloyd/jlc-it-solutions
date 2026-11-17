import { tierOf } from '../../shared/tiers';
import type { Package } from '../../shared/packages';

// A design is Premium when any of its template packages is.
export const isPremium = (d: { packages: Package[] }) => d.packages.some((p) => p.kind === 'template' && tierOf(p) === 'premium');
