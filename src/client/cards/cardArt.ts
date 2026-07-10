/*
 * CARD ART — the ONE resolution point for per-card artwork.
 *
 * Card art is not shipped yet (cards render with their type-gradient frame
 * only; the extraction tooling lives in scripts/card-art). This module is
 * the SINGLE source both the full card renderer and the lightweight proxy
 * card (ConsoleCardFaceLite — the deal-cinematic flyer) will read, so the
 * flying proxy and the landed real card can never disagree about art:
 * same file, same crop, same fallback.
 *
 * Contract when art lands:
 *  - return the asset URL for cards that have art, undefined otherwise;
 *  - both renderers keep using the SAME fallback visual (the type-gradient
 *    body) when this returns undefined — never a blur-up/muddy placeholder.
 */

import {CardName} from '@/common/cards/CardName';

export function cardArtUrl(_name: CardName): string | undefined {
  return undefined;
}
