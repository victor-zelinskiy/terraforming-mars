import {Tag} from '../../../common/cards/Tag';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {inplaceShuffle} from '../../utils/shuffle';
import {AutomaResolver} from '../AutomaResolver';

/**
 * SETUP-TIME operations on MarsBot's own decks, shared by the corporation
 * setup boxes that print them. Two corporations print each of these word for
 * word, so each has ONE implementation — the same law that gave B06/B15/B25
 * `AutomaNearBonusPush` and C14/C19/C23 `MarsBotCubeTrackPush`.
 */

/**
 * «Destroy the card X from the bonus deck» — C05 Inventrix (Lobbyists) and
 * C21 Pharmacy Union (Meteor Shower).
 *
 * The card has to be cleared from THREE places, and the third is the subtle
 * one: this engine builds generation 1's action deck at game creation, BEFORE
 * the corporation exists, so the doomed card may already hold that deck's one
 * bonus slot. At the table the setup box runs first and the slot would have
 * gone to the next bonus card — so hand it over, and the deck keeps its
 * printed size instead of losing a card.
 *
 * Returns true when the card was actually somewhere in this game (only one
 * printing of a card is ever in play), so the caller can log honestly.
 */
/**
 * «Lobbyists» is ONE printed card with a Venus variant, and the deck carries
 * whichever the game's modules chose (`AutomaSetup`). Two setup boxes print
 * «destroy Lobbyists» (C05 Inventrix, C27 Morning Star Inc.), so the pair is
 * shared DATA — destroying both ids is exact, because only one is ever in play.
 */
export const LOBBYISTS_VARIANTS = [BonusCardId.B06_LOBBYISTS, BonusCardId.B15_LOBBYISTS_VENUS] as const;

export function destroyBonusCard(game: IGame, id: BonusCardId): boolean {
  const automa = game.automa;
  if (automa === undefined) {
    return false;
  }
  const inDeck = automa.bonusDeck.findIndex((entry) => entry.kind === 'bonus' && entry.id === id);
  if (inDeck !== -1) {
    automa.bonusDeck.splice(inDeck, 1);
  }
  const inDiscard = automa.bonusDiscard.indexOf(id);
  if (inDiscard !== -1) {
    automa.bonusDiscard.splice(inDiscard, 1);
  }
  const inAction = automa.actionDeck.findIndex((entry) => entry.kind === 'bonus' && entry.id === id);
  if (inAction !== -1) {
    const replacement = automa.bonusDeck.shift();
    if (replacement === undefined) {
      automa.actionDeck.splice(inAction, 1);
    } else {
      automa.actionDeck[inAction] = replacement;
    }
  }
  if (inDeck === -1 && inDiscard === -1 && inAction === -1) {
    return false; // This printing is not part of this game.
  }
  automa.destroyedBonusCards.push(id);
  return true;
}

/** What a seeding setup box does with the cards its reveal turned over. */
export type SeedShuffleMode =
  /**
   * Every revealed card joins the bonus deck (C07 PhoboLog: «shuffle THESE
   * cards» — the card names no other destination for the rest, and a physical
   * reveal has to put every turned card somewhere).
   */
  | 'all-revealed'
  /**
   * Only the MATCHING card joins the bonus deck; the rest are discarded (C21
   * Pharmacy Union: «reveal … until you've revealed a card with a science
   * tag, and shuffle IT into the bonus deck» — singular).
   */
  | 'matching-only';

export type BonusDeckSeedResult = {
  /** Everything the reveal turned over, in order. */
  revealed: ReadonlyArray<IProjectCard>;
  /** What actually went into the bonus deck. */
  seeded: ReadonlyArray<IProjectCard>;
};

/**
 * «Reveal cards from the project deck until you've revealed N cards with a
 * TAG, and shuffle <them|it> into the bonus deck.»
 *
 * The REVEAL is identical for both cards that print it; only the disposal
 * differs, which is exactly what `mode` names. Tags are read the way MarsBot
 * reads every tag — `AutomaResolver.printedTags` — so an event card's implicit
 * event tag and a wild tag behave here as they do everywhere else.
 *
 * The caller logs: WHICH cards left the project deck is public information the
 * human is entitled to, and each card words it its own way.
 */
export function seedBonusDeckFromProjectDeck(
  game: IGame,
  seed: {tag: Tag, count: number},
  mode: SeedShuffleMode,
): BonusDeckSeedResult {
  const automa = game.automa;
  if (automa === undefined) {
    return {revealed: [], seeded: []};
  }
  const revealed: Array<IProjectCard> = [];
  const matching: Array<IProjectCard> = [];
  while (matching.length < seed.count) {
    const card = game.projectDeck.draw(game);
    if (card === undefined) {
      break; // Draw + discard piles exhausted — impossible in a real game.
    }
    revealed.push(card);
    if (AutomaResolver.printedTags(card).includes(seed.tag)) {
      matching.push(card);
    }
  }
  const seeded = mode === 'all-revealed' ? revealed : matching;
  if (seeded.length === 0) {
    return {revealed, seeded};
  }
  for (const card of seeded) {
    automa.bonusDeck.push({kind: 'project', name: card.name});
  }
  // The cards that are NOT seeded were revealed and have to go somewhere: the
  // project discard, like any revealed-and-unused card in this engine.
  if (mode === 'matching-only') {
    for (const card of revealed) {
      if (!matching.includes(card)) {
        game.projectDeck.discard(card);
      }
    }
  }
  inplaceShuffle(automa.bonusDeck, game.rng);
  return {revealed, seeded};
}
