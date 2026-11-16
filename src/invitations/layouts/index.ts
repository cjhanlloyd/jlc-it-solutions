import type { ComponentType, ReactNode } from 'react';
import type { InvitationStyle } from '../../../shared/invitation-style';
import type { Scheme } from '../parts';
import Classic from './Classic';
import Confetti from './Confetti';
import Garden from './Garden';
import Blush from './Blush';
import Golden from './Golden';
import Modern from './Modern';
import Portrait from './Portrait';

export type LayoutProps<D = any> = { details: D; scheme: Scheme; photos: string[]; style: InvitationStyle; rsvpSlot?: ReactNode };
export type LayoutKey = 'classic' | 'garden' | 'modern' | 'confetti' | 'golden' | 'blush' | 'portrait';

export const LAYOUTS: Record<LayoutKey, ComponentType<LayoutProps>> = { classic: Classic, garden: Garden, modern: Modern, confetti: Confetti, golden: Golden, blush: Blush, portrait: Portrait };
