import { iconNames } from 'lucide-react/dynamic.mjs';

// Stored names are PascalCase ("XCircle", "Grid3x3"); lucide's dynamic names are kebab-case with irregular
// digit/case splits. Match on the name with hyphens removed, lowercased (iconNames includes the old aliases).
const squash = (s: string): string => s.replace(/-/g, '').toLowerCase();
const byKey = new Map<string, string>(iconNames.map((n) => [squash(n), n]));

/** Lucide dynamic icon name for a stored name, or '' when unknown. */
export const toKebab = (name?: string | null): string => (name && byKey.get(squash(name))) || '';

export const isKnownIcon = (name?: string | null): boolean => !!toKebab(name);
