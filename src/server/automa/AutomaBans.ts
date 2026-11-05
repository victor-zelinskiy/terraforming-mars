import {CardName} from '../../common/cards/CardName';
import {GameOptions} from '../game/GameOptions';

/**
 * Per-card bans for the OFFICIAL solo Automa mode (1 human vs MarsBot).
 *
 * Official FAQ (rulebook p.11): "You may not use Mons Insurance against
 * MarsBot." Prelude 2 with the Automa: Recession leaves the deck (the official
 * rule — the owner, 2026-11-06, for the SOLO game against the bot only; a table
 * of two humans and the bot keeps it, and a GUARANTEED pick — the test mode's
 * `customPreludes` — still reaches the table: those cards are added after this
 * filter). Deliberately PREDICATE-based, never a static global ban: the
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
  CardName.RECESSION,
];

export function isCardBannedForAutoma(cardName: CardName, gameOptions: GameOptions): boolean {
  if (gameOptions.automa === undefined) {
    return false;
  }
  // The multiplayer house-rule mode keeps these cards AVAILABLE — their bot
  // interactions ride the generic adapters + the insurance hooks instead
  // (docs/AUTOMA_PROMO_MULTIPLAYER_FRAME.md §12 Q10). An absent mode (older
  // saves) reads as official solo.
  if (gameOptions.automa.mode === 'multiplayer') {
    return false;
  }
  return OFFICIAL_SOLO_AUTOMA_BANS.includes(cardName);
}
