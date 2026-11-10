// Renders an invitation in its chosen layout. The countdown, map links and photos live in ./parts and are placed by each layout.
import type { ReactNode } from 'react';
import { LAYOUTS, type LayoutKey } from './layouts';
import type { Scheme } from './parts';
import './invitations.css';

type Props = { layoutKey: string; scheme: Scheme; details: any; photos: string[]; rsvpSlot?: ReactNode };

export default function InvitationView({ layoutKey, ...rest }: Props) {
  // Unknown keys get a placeholder instead of feeding details to a layout of another occasion.
  if (!Object.prototype.hasOwnProperty.call(LAYOUTS, layoutKey)) return <p className="p-10 text-center text-sm text-slate-500">Preview available soon</p>;
  const Layout = LAYOUTS[layoutKey as LayoutKey];
  return <Layout {...rest} />;
}
