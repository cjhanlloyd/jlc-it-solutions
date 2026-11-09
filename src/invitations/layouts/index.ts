import type { ComponentType, ReactNode } from 'react';
import type { InvitationDetails, LAYOUT_KEYS } from '../../../shared/invitation-fields';
import type { Scheme } from '../parts';
import Classic from './Classic';
import Garden from './Garden';
import Modern from './Modern';

export type LayoutProps = { details: InvitationDetails; scheme: Scheme; photos: string[]; rsvpSlot?: ReactNode };
export type LayoutKey = (typeof LAYOUT_KEYS)[number];

export const LAYOUTS: Record<LayoutKey, ComponentType<LayoutProps>> = { classic: Classic, garden: Garden, modern: Modern };
