import { DynamicIcon } from 'lucide-react/dynamic';
import type { LucideIcon } from 'lucide-react';
import { isKnownIcon, toKebab } from './icon-name';

/** Renders an icon chosen by admin-stored name; unknown or empty names show the fallback icon. */
export function StoredIcon({ name, fallback: Fallback, className }: { name?: string | null; fallback: LucideIcon; className?: string }) {
  if (!name || !isKnownIcon(name)) return <Fallback className={className} />;
  return <DynamicIcon name={toKebab(name) as never} className={className} fallback={() => <Fallback className={className} />} />;
}
