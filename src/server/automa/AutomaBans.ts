import {CardName} from '../../common/cards/CardName';
import {GameOptions} from '../game/GameOptions';

/**
 * Per-card bans for the OFFICIAL solo Automa mode (1 human vs MarsBot).
 *
 * Official FAQ (rulebook p.11): "You may not use Mons Insurance against
 * MarsBot." Deliberately PREDICATE-based, never a static global ban: the
 * future multiplayer-with-bot house-rule mode keeps these cards available and
 * gives their bot interactions explicit policies instead
 * (docs/AUTOMA_PROMO_MULTIPLAYER_FRAME.md §4).
 *
 * Deck-level filter (GameCards), NOT a gameOptions.bannedCards entry — a
 * non-empty bannedCards list reads as a "custom list" to the automa
 * compatibility rules, which would break validateOptions on a rematch of an
 * automa game.
 *
 * This module stays SHALLOW (CardName + the GameOptions type only) so
 * GameCards can import it without touching the AutomaSetup → Player
 * module-initialization chain.
 */
const OFFICIAL_SOLO_AUTOMA_BANS: ReadonlyArray<CardName> = [
  CardName.MONS_INSURANCE,
];

export function isCardBannedForAutoma(cardName: CardName, gameOptions: GameOptions): boolean {
  if (gameOptions.automa === undefined) {
    return false;
  }
  // Every automa game today IS the official solo mode. When the
  // multiplayer-with-bot house-rule mode lands, it carries its own mode marker
  // and skips these official-solo bans.
  return OFFICIAL_SOLO_AUTOMA_BANS.includes(cardName);
}
