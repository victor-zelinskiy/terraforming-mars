/*
 * PREMIUM CARD THEME — CardType → visual theme, and the ONE scope gate.
 *
 * The premium card face (this fork's from-scratch card renderer) covers
 * PROJECT cards (automated / active / event), PRELUDES, CORPORATIONS
 * (identity zone = the existing wordmark logo system instead of art) and
 * STANDARD PROJECTS / STANDARD ACTIONS (one class, one neutral theme —
 * joined in desktop-removal wave 2; they ship procedural faces by design,
 * no SP/SA art exists). Only CEOs stay on the legacy renderer until their
 * own premium pass.
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
export type PremiumTheme = 'emerald' | 'azure' | 'crimson' | 'prelude' | 'corporation' | 'standard';

const THEME_BY_TYPE: Partial<Record<CardType, PremiumTheme>> = {
  [CardType.AUTOMATED]: 'emerald',
  [CardType.ACTIVE]: 'azure',
  [CardType.EVENT]: 'crimson',
  [CardType.PRELUDE]: 'prelude',
  [CardType.CORPORATION]: 'corporation',
  // Standard projects and standard actions are ONE class everywhere in the
  // engine (both or neither) and share the neutral engineered theme.
  [CardType.STANDARD_PROJECT]: 'standard',
  [CardType.STANDARD_ACTION]: 'standard',
};

export function premiumThemeFor(type: CardType): PremiumTheme | undefined {
  return THEME_BY_TYPE[type];
}

/** True when this card TYPE is rendered by the premium face. */
export function isPremiumFaceType(type: CardType): boolean {
  return THEME_BY_TYPE[type] !== undefined;
}
