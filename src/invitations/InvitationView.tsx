// Renders an invitation in its chosen layout. The countdown, map links and photos live in ./parts and are placed by each layout.
import type { ReactNode } from 'react';
import type { InvitationStyle } from '../../shared/invitation-style';
import { LAYOUTS, type LayoutKey } from './layouts';
import { useStyleFonts, type Scheme } from './parts';
import { effectiveScheme } from './style-render';
import './invitations.css';

// style.cover.photo must already be an index into photos (see resolveCoverIndex for stored keys).
type Props = { layoutKey: string; scheme: Scheme; details: any; photos: string[]; style?: InvitationStyle | null; rsvpSlot?: ReactNode };

export default function InvitationView({ layoutKey, scheme, style, ...rest }: Props) {
  const s = style ?? {};
  useStyleFonts(s);
  // Unknown keys get a placeholder instead of feeding details to a layout of another occasion.
  if (!Object.prototype.hasOwnProperty.call(LAYOUTS, layoutKey)) return <p className="p-10 text-center text-sm text-slate-500">Preview available soon</p>;
  const Layout = LAYOUTS[layoutKey as LayoutKey];
  return <Layout scheme={effectiveScheme(scheme, s)} style={s} {...rest} />;
}
