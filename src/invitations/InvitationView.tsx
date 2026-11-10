// Renders an invitation in its chosen layout. The countdown, map links and photos live in ./parts and are placed by each layout.
import type { ReactNode } from 'react';
import { LAYOUTS, type LayoutKey } from './layouts';
import type { Scheme } from './parts';
import './invitations.css';

type Props = { layoutKey: string; scheme: Scheme; details: any; photos: string[]; rsvpSlot?: ReactNode };

export default function InvitationView({ layoutKey, ...rest }: Props) {
  // Birthday layouts are registered later; until then show a placeholder instead of feeding birthday details to a wedding layout.
  if (!Object.hasOwn(LAYOUTS, layoutKey)) return <p className="p-10 text-center text-sm text-slate-500">Preview available soon</p>;
  const Layout = LAYOUTS[layoutKey as LayoutKey];
  return <Layout {...rest} />;
}
