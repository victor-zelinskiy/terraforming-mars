import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import {IProjectCard} from '../../cards/IProjectCard';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {destroyBonusCard, seedBonusDeckFromProjectDeck} from './MarsBotBonusDeckOps';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C21_PHARMACY_UNION);
/** The printed seeding: reveal until ONE card carries a science tag. */
const SEED = INFO.bonusDeckSeed ?? {tag: Tag.SCIENCE, count: 1};
/** The card the setup box destroys. */
const DOOMED = BonusCardId.B01_METEOR_SHOWER;
/** What a human microbe tag costs the bot. */
const MICROBE_TOLL = 4;

/**
 * MarsBot Pharmacy Union — official card C21:
 *
 *   STARTING TAG    science
 *   DRAFT PRIORITY  Science
 *   SETUP           Destroy the card Meteor Shower from the bonus deck.
 *                   Reveal cards from the project deck until you've revealed a
 *                   card with a science tag, and shuffle it into the bonus
 *                   deck.
 *   EFFECT          When you play a microbe tag, MarsBot loses 4 MC, or as
 *                   much as it is able to lose.
 *                   When MarsBot resolves a card with a science tag, including
 *                   this, it raises its TR 1 step.
 *
 * The only corporation so far whose effect POINTS BOTH WAYS: one half taxes
 * the bot for what the HUMAN does, the other pays it for what it does itself.
 * That is why it destroys Meteor Shower — the bot gives up its own plant
 * attack and takes a standing vulnerability instead.
 *
 * BOTH SETUP OPERATIONS ARE SHARED PRIMITIVES (`MarsBotBonusDeckOps`): the
 * three-place destroy is C05 Inventrix's, and the reveal-until is C07
 * PhoboLog's. What differs is the DISPOSAL: C07 seeds every revealed card
 * («shuffle THESE cards»), this one seeds only the science card («shuffle IT»)
 * and discards the rest.
 *
 * «OR AS MUCH AS IT IS ABLE TO LOSE» IS A PARTIAL PAYMENT — the same third
 * wording as C20/B24's «or as much as possible», and deliberately not C15's
 * all-or-nothing «if able». The HUMAN Pharmacy Union prints the same rule and
 * this engine already implements it as `Math.min(megaCredits, 4)`; two
 * entities printing one rule must not disagree.
 *
 * GRANULARITY IS THE ENGINE'S OWN, for the same reason. «When you play a
 * microbe tag» fires ONCE PER CARD — that is how `PharmacyUnion.onCardPlayedByAnyPlayer`
 * reads the identical printed phrase (`card.tags.includes(Tag.MICROBE)`, a
 * boolean), and a card with two microbe tags therefore costs 4, not 8. «A card
 * with a science tag» is card-granular by its own words, so the TR rides
 * `onProjectCardResolving`, not the per-tag hook.
 *
 * «INCLUDING THIS» is the corporation's OWN science tag: RB-B Setup 4 resolves
 * a starting tag «as if shown on a card revealed during play», so the
 * corporation card is itself a card with a science tag — raised once, in the
 * setup box, where it cannot be confused with a project card's tags.
 */
export const MarsBotPharmacyUnion: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    if (destroyBonusCard(game, DOOMED)) {
      game.log('${0} destroyed Meteor Shower from its bonus deck', (b) => b.player(bot));
    }
    const {revealed, seeded} = seedBonusDeckFromProjectDeck(game, SEED, SEED.shuffle ?? 'matching-only');
    if (seeded.length > 0) {
      bumpCorpStat(game, 'pharmacySeeded', seeded.length);
      // Named out loud: the card left the project deck and now sits in the
      // bot's bonus deck — public information the human is entitled to.
      game.log('${0} shuffled ${1} into its bonus deck after revealing ${2} card(s)',
        (b) => b.player(bot).cards(seeded).number(revealed.length));
    }
    // «Including this»: the corporation card is itself a card with a science
    // tag, and its starting tag resolves at setup (RB-B Setup 4).
    raiseForScience(game, 'pharmacyOwnTag');
  },

  onHumanCardPlayed(game: IGame, _player: IPlayer, card: ICard): void {
    if (!card.tags.includes(Tag.MICROBE)) {
      return;
    }
    const bot = marsBotOf(game);
    // «or as much as it is able to lose» — PARTIAL, exactly as the human
    // Pharmacy Union's own implementation of the same sentence.
    const lost = Math.min(bot.megaCredits, MICROBE_TOLL);
    if (lost === 0) {
      // Still worth saying: a toll that could not be collected is not the
      // same event as no toll at all, and the human must not wonder.
      game.log('${0} owed ${1} M€ for a microbe tag but had nothing to lose',
        (b) => b.player(bot).number(MICROBE_TOLL));
      bumpCorpStat(game, 'pharmacyMicrobeTags');
      return;
    }
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bot.stock.deduct(Resource.MEGACREDITS, lost, {log: false});
      game.log('${0} lost ${1} M€ to a microbe tag — its corporation ${2}',
        (b) => b.player(bot).number(lost).string('Pharmacy Union'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'pharmacyMicrobeTags');
    bumpCorpStat(game, 'pharmacyMcLost', lost);
  },

  onProjectCardResolving(game: IGame, card: IProjectCard): void {
    // «A card WITH a science tag» — once per card, however many it prints.
    if (!AutomaResolver.printedTags(card).includes(Tag.SCIENCE)) {
      return;
    }
    raiseForScience(game, 'pharmacyScienceCards');
  },
};

/** The printed «raises its TR 1 step», counted by which half asked for it. */
function raiseForScience(game: IGame, countStat: string): void {
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    bot.increaseTerraformRating(1, {log: true});
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, countStat);
  bumpCorpStat(game, 'pharmacyTr');
}
