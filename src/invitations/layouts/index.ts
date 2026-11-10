import type { ComponentType, ReactNode } from 'react';
import type { InvitationDetails } from '../../../shared/occasions/wedding';
import type { Scheme } from '../parts';
import Classic from './Classic';
import Garden from './Garden';
import Modern from './Modern';

export type LayoutProps = { details: InvitationDetails; scheme: Scheme; photos: string[]; rsvpSlot?: ReactNode };
export type LayoutKey = 'classic' | 'garden' | 'modern';

export const LAYOUTS: Record<LayoutKey, ComponentType<LayoutProps>> = { classic: Classic, garden: Garden, modern: Modern };
