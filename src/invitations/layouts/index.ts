import type { ComponentType, ReactNode } from 'react';
import type { InvitationStyle } from '../../../shared/invitation-style';
import type { EventData } from '../event-view';
import type { Scheme } from '../parts';
import Classic from './Classic';
import Confetti from './Confetti';
import Garden from './Garden';
import Blush from './Blush';
import Golden from './Golden';
import Modern from './Modern';
import Portrait from './Portrait';
import Editorial from './Editorial';
import Minimal from './Minimal';
import Starlight from './Starlight';
import Pastel from './Pastel';

export type LayoutProps<D = any> = { details: D; scheme: Scheme; photos: string[]; style: InvitationStyle; rsvpSlot?: ReactNode; giftQr?: string; events?: EventData };
export type LayoutKey = 'classic' | 'garden' | 'modern' | 'confetti' | 'golden' | 'blush' | 'portrait' | 'editorial' | 'minimal' | 'starlight' | 'pastel';

export const LAYOUTS: Record<LayoutKey, ComponentType<LayoutProps>> = { classic: Classic, garden: Garden, modern: Modern, confetti: Confetti, golden: Golden, blush: Blush, portrait: Portrait,
  editorial: Editorial, minimal: Minimal, starlight: Starlight, pastel: Pastel };
