/*
 * PREMIUM CARD THEME — CardType → visual theme, and the ONE scope gate.
 *
 * The premium card face (this fork's from-scratch card renderer) covers
 * PROJECT cards (automated / active / event), PRELUDES, CORPORATIONS
 * (identity zone = the existing wordmark logo system instead of art) and,
 * since desktop-removal wave 4, CEOs (executive graphite theme + the prose
 * rule zone — the description IS the rule on that type).
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
export type PremiumTheme = 'emerald' | 'azure' | 'crimson' | 'prelude' | 'corporation' | 'ceo';

const THEME_BY_TYPE: Partial<Record<CardType, PremiumTheme>> = {
  [CardType.AUTOMATED]: 'emerald',
  [CardType.ACTIVE]: 'azure',
  [CardType.EVENT]: 'crimson',
  [CardType.PRELUDE]: 'prelude',
  [CardType.CORPORATION]: 'corporation',
  [CardType.CEO]: 'ceo',
};

export function premiumThemeFor(type: CardType): PremiumTheme | undefined {
  return THEME_BY_TYPE[type];
}

/** True when this card TYPE is rendered by the premium face. */
export function isPremiumFaceType(type: CardType): boolean {
  return THEME_BY_TYPE[type] !== undefined;
}
