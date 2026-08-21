import {Tag} from '../../../common/cards/Tag';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {inplaceShuffle} from '../../utils/shuffle';
import {AutomaResolver} from '../AutomaResolver';
import {resolveProjectCardForBot} from '../AutomaCardDraw';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotDraftResolver} from './MarsBotDraftResolver';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C46_TYCHO_MAGNETICS);
/** The corporation's own bonus card. */
const OWN_CARD = BonusCardId.B30_INTERFACE_HYPERLINK;
/** The track whose space number sizes the draw, named by TAG (never an index). */
const SIZING_TRACK = Tag.POWER;
/** «(minimum 2)» — and, separately, how many of the drawn cards are kept. */
const MINIMUM_DRAW = 2;
const KEPT = 2;

/**
 * MarsBot Tycho Magnetics — official card C46:
 *
 *   STARTING TAGS   none
 *   DRAFT PRIORITY  Power > science
 *   SETUP           Place Interface Hyperlink on the bottom of the bonus deck.
 *
 * plus its corporation-specific bonus card B30 Interface Hyperlink.
 *
 * A CORPORATION THAT IS ENTIRELY ONE DELAYED EVENT. It has no effect box, no
 * round start and no starting tag — its whole game is a single card sitting at
 * the BOTTOM of the bonus deck, plus a draft priority that spends the wait
 * stacking the power track. When the deck finally reaches it, the size of that
 * pile is what the corporation cashes in.
 *
 * «THE BOTTOM» IS A REAL, DIFFERENT DISPOSITION. Every other corp-owned card
 * is either shuffled into the rotation (C12/B31, C22/B27, C27/B26) or made
 * recurring (C02/B23, C15/B28); this one is placed, not shuffled — bonus
 * draws `shift()` from the front, so `push()` IS the bottom, and the card
 * comes up LAST. That is the deliberate design: the longer it waits, the
 * further up the power track the bot is when it lands.
 */
export const MarsBotTychoMagnetics: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    // The BOTTOM, deliberately unshuffled — see the header.
    automa.bonusDeck.push({kind: 'bonus', id: OWN_CARD});
    game.log('${0} placed Interface Hyperlink at the bottom of its bonus deck (corporation ${1})',
      (b) => b.player(marsBotOf(game)).string('Tycho Magnetics'));
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== OWN_CARD) {
      throw new Error(`MarsBot Tycho Magnetics does not own bonus card ${id}`);
    }
    return interfaceHyperlink(game);
  },
};

/**
 * B30 Interface Hyperlink:
 *
 *   "Draw project cards from the project deck equal to MarsBot's space number
 *    on the power track (minimum 2). Select 2 cards from the drawn cards using
 *    the following priorities: 1. Science tag. 2. Most expensive. 3. Most
 *    tags. 4. Random. Resolve the 2 selected cards, and discard the rest, then
 *    destroy this card."
 *
 * THE PRIORITY LIST IS ONE LEXICOGRAPHIC CHAIN, exactly the shape a corporation's
 * DRAFT PRIORITY is — so it runs on the same machinery
 * (`MarsBotDraftResolver.pickByScore`), with «Random» being that resolver's own
 * seeded tie-break rather than a fourth score. Science is COUNTED, not tested
 * as a boolean, because that is how RB-B reads a printed tag priority («a card
 * having the first tag twice is an even better one»); with no card carrying
 * two science tags the two readings coincide, which is why the printed list
 * can write it as one word.
 *
 * PICKED TWICE, NOT SORTED. «Select 2» is the best card, then the best of what
 * is left — the same act performed twice, which is also what keeps the random
 * tie-break honest when three cards score alike.
 *
 * THE DRAW IS THE POWER TRACK'S SPACE NUMBER, and the track is addressed by
 * TAG: on Tharsis that row carries POWER and JOVIAN together, so it is the row
 * the corporation's own draft priority has been feeding all game. `minimum 2`
 * is a floor on the DRAW, and it is also exactly the number kept — a bot still
 * on space 0 or 1 draws two and plays both, discarding nothing.
 *
 * RESOLVED, NOT MERELY REVEALED: each kept card goes through
 * `resolveProjectCardForBot`, so its tags advance tracks, the corporation
 * effect and the sanctioned human reactors fire, and it lands in the played
 * pile — the same treatment any flipped card gets.
 */
function interfaceHyperlink(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const bot = marsBotOf(game);
  bumpCorpStat(game, 'hyperlinkPlayed');

  const trackIndex = automa.board.getTrackIndexForTag(SIZING_TRACK);
  const space = trackIndex === undefined ? 0 : automa.board.tracks[trackIndex].position;
  const count = Math.max(MINIMUM_DRAW, space);

  const drawn: Array<IProjectCard> = [];
  for (let i = 0; i < count; i++) {
    const card = game.projectDeck.draw(game);
    if (card === undefined) {
      break; // Deck AND discard exhausted — resolve what we have.
    }
    drawn.push(card);
  }
  if (drawn.length === 0) {
    return 'destroy';
  }
  bumpCorpStat(game, 'hyperlinkDrawn', drawn.length);
  game.log('${0} drew ${1} card(s) with Interface Hyperlink — its power track stands at ${2}',
    (b) => b.player(bot).number(drawn.length).number(space));

  const resolver = new MarsBotDraftResolver(automa.board, (items) => inplaceShuffle(items, game.rng));
  const pool = [...drawn];
  const selected: Array<IProjectCard> = [];
  while (selected.length < KEPT && pool.length > 0) {
    const {card} = resolver.pickByScore(pool, hyperlinkScore);
    pool.splice(pool.indexOf(card), 1);
    selected.push(card);
  }

  // «Discard the rest» — BEFORE resolving, so a card the selection rejected can
  // never be drawn again by something the resolution itself triggers.
  for (const card of pool) {
    game.projectDeck.discard(card);
  }
  for (const card of selected) {
    bumpCorpStat(game, 'hyperlinkResolved');
    resolveProjectCardForBot(game, card);
  }
  return 'destroy';
}

/**
 * The printed priority chain as one lexicographic score:
 * science tags → cost → printed tag count. «Random» is the resolver's
 * seeded tie-break, not an entry here.
 */
function hyperlinkScore(card: IProjectCard): ReadonlyArray<number> {
  const printed = AutomaResolver.printedTags(card);
  return [
    printed.filter((tag) => tag === Tag.SCIENCE).length,
    card.cost,
    printed.length,
  ];
}
