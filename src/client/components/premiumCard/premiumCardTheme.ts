/*
 * PREMIUM CARD THEME — CardType → visual theme, and the ONE scope gate.
 *
 * The premium card face (this fork's from-scratch card renderer) covers
 * PROJECT cards (automated / active / event) and PRELUDES. Corporations,
 * CEOs and standard projects stay on the legacy renderer until their own
 * premium pass (the corporation logo system is a separate project).
 *
 * EVERY routing point (CardFace facade, CardZoomModal face, the console
 * FaceLite proxy) must consult `isPremiumFaceCard` — never re-derive the
 * scope locally, so widening it later is a one-line change here.
 */

import {CardType} from '@/common/cards/CardType';

/**
 * Visual themes. The theme drives the WHOLE body system (corpus gradients,
 * inner rim, glow, mechanics panel tint) via `pcard--theme-<t>` CSS classes
 * in premium_card.less — gold frame / cost / VP elements stay shared.
 */
export type PremiumTheme = 'emerald' | 'azure' | 'crimson' | 'prelude';

const THEME_BY_TYPE: Partial<Record<CardType, PremiumTheme>> = {
  [CardType.AUTOMATED]: 'emerald',
  [CardType.ACTIVE]: 'azure',
  [CardType.EVENT]: 'crimson',
  [CardType.PRELUDE]: 'prelude',
};

export function premiumThemeFor(type: CardType): PremiumTheme | undefined {
  return THEME_BY_TYPE[type];
}

/** True when this card TYPE is rendered by the premium face. */
export function isPremiumFaceType(type: CardType): boolean {
  return THEME_BY_TYPE[type] !== undefined;
}
