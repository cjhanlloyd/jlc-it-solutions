import type { ComponentType, ReactNode } from 'react';
import type { Scheme } from '../parts';
import Classic from './Classic';
import Confetti from './Confetti';
import Garden from './Garden';
import Blush from './Blush';
import Golden from './Golden';
import Modern from './Modern';

export type LayoutProps<D = any> = { details: D; scheme: Scheme; photos: string[]; rsvpSlot?: ReactNode };
export type LayoutKey = 'classic' | 'garden' | 'modern' | 'confetti' | 'golden' | 'blush';

export const LAYOUTS: Record<LayoutKey, ComponentType<LayoutProps>> = { classic: Classic, garden: Garden, modern: Modern, confetti: Confetti, golden: Golden, blush: Blush };
