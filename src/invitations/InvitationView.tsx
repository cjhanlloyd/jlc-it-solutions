// Renders an invitation in its chosen layout. The countdown, map links and photos live in ./parts and are placed by each layout.
import type { ReactNode } from 'react';
import type { InvitationDetails } from '../../shared/occasions/wedding';
import { LAYOUTS, type LayoutKey } from './layouts';
import type { Scheme } from './parts';
import './invitations.css';

type Props = { layoutKey: string; scheme: Scheme; details: InvitationDetails; photos: string[]; rsvpSlot?: ReactNode };

export default function InvitationView({ layoutKey, ...rest }: Props) {
  const Layout = LAYOUTS[layoutKey as LayoutKey] ?? LAYOUTS.classic;
  return <Layout {...rest} />;
}
