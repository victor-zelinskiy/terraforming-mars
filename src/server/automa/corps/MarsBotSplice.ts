import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import {newCorporationCard} from '../../createCard';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {destroyBonusCard, seedBonusDeckFromProjectDeck} from './MarsBotBonusDeckOps';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C24_SPLICE);
/** The printed seeding: reveal until ONE card carries a microbe tag. */
const SEED = INFO.bonusDeckSeed ?? {tag: Tag.MICROBE, count: 1};
/** The card the setup box destroys. */
const DOOMED = BonusCardId.B03_RESEARCH_AND_DEVELOPMENT;
/** What the setup box hands the bot. */
const SETUP_MC = 8;
/** What one microbe tag of the bot's OWN pays it. */
const OWN_TAG_MC = 4;

/**
 * MarsBot Splice — official card C24:
 *
 *   STARTING TAG    plant
 *   DRAFT PRIORITY  Microbe
 *   SETUP           MarsBot gains 8 MC.
 *                   Destroy Research and Development from the bonus deck.
 *                   Reveal cards from the project deck until you reveal a card
 *                   with a microbe tag, and shuffle it into the bonus deck.
 *   EFFECT          When you play a microbe tag, MarsBot gains 2 MC, and you
 *                   may either gain 2 MC or add a microbe resource to the
 *                   played card.
 *                   When MarsBot resolves a microbe tag, it gains 4 MC.
 *
 * THE SETUP BOX IS C21 PHARMACY UNION'S, WITH DIFFERENT DATA — both shared
 * primitives (`MarsBotBonusDeckOps`), a different doomed card and a different
 * seeded tag. Only the plain 8 M€ is new, and that is an ordinary gain.
 *
 * THE FIRST EFFECT CLAUSE IS THE HUMAN SPLICE'S OWN LINE, AND IT RUNS IT.
 * «When you play a microbe tag, MarsBot gains 2 MC, and you may either gain 2
 * MC or add a microbe resource to the played card» is the human card's
 * `onCardPlayedByAnyPlayer` with the BOT as the Splice owner and the human as
 * the card player — so this file calls exactly that (the C18 law: a rule both
 * entities print has ONE implementation, the engine's). Everything then comes
 * for free and cannot drift: the per-tag amount, the «only when the card can
 * host a microbe» condition on the choice, the prompt's own `choiceContext`
 * naming Splice, and the gains' attribution.
 *
 * GRANULARITY IS THE ENGINE'S, AND IT IS PER TAG HERE — deliberately unlike
 * C21, whose identical English phrase («when you play a microbe tag») its own
 * human card reads as a BOOLEAN. `Splice.onCardPlayedByAnyPlayer` multiplies
 * by `cardTagCount`, so a card with two microbe tags pays 4 M€, not 2. Two
 * human cards, one phrase, two readings: each bot card follows ITS OWN twin.
 *
 * THE SECOND CLAUSE IS TAG-GRANULAR BY ITS OWN WORDS — «MarsBot resolves a
 * microbe TAG», not «a card with a microbe tag» — so it rides `onTagResolved`,
 * the per-tag hook, exactly as C08 Saturn Systems' own «resolves a Jovian tag»
 * does. Its printed starting tag is a PLANT, so the corporation does not open
 * the game by paying itself.
 *
 * A MICROBE ADVANCEMENT IS ALSO A MICROBE (RB-B FAQ). The Venus board's cell 9
 * advances the Bio track BY a microbe without resolving a tag, and the FAQ
 * already makes the sanctioned HUMAN reactors — Pharmacy Union and Splice —
 * treat it «as if a card with a microbe was played». A bot Splice that ignored
 * it would be deafer to the event than the very same card in a human's
 * tableau, so `onMicrobeAdvancement` pays the same 4 M€. That cell is the
 * hook's ONLY dispatch site: a starting tag is a real `resolveTag` and arrives
 * through `onTagResolved`, so no microbe is ever paid for twice.
 */
export const MarsBotSplice: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    bot.stock.add(Resource.MEGACREDITS, SETUP_MC, {log: false});
    game.log('${0} gained ${1} M€ from its corporation ${2}',
      (b) => b.player(bot).number(SETUP_MC).string('Splice'));

    if (destroyBonusCard(game, DOOMED)) {
      game.log('${0} destroyed Research and Development from its bonus deck', (b) => b.player(bot));
    }
    const {revealed, seeded} = seedBonusDeckFromProjectDeck(game, SEED, SEED.shuffle ?? 'matching-only');
    if (seeded.length > 0) {
      bumpCorpStat(game, 'spliceSeeded', seeded.length);
      // Named out loud: the card left the project deck for the bot's bonus
      // deck — public information the human is entitled to.
      game.log('${0} shuffled ${1} into its bonus deck after revealing ${2} card(s)',
        (b) => b.player(bot).cards(seeded).number(revealed.length));
    }
  },

  onHumanCardPlayed(game: IGame, player: IPlayer, card: ICard): void {
    const tags = player.tags.cardTagCount(card, Tag.MICROBE);
    if (tags === 0) {
      return;
    }
    const splice = newCorporationCard(CardName.SPLICE);
    if (splice?.onCardPlayedByAnyPlayer === undefined) {
      return; // The human card is not in this build — nothing to ride.
    }
    const bot = marsBotOf(game);
    bumpCorpStat(game, 'spliceHumanTags', tags);
    bumpCorpStat(game, 'spliceHumanMc', tags * 2);
    // The HUMAN card's own line, attributed exactly the way
    // `AutomaHumanTagReactions` attributes the mirror direction: the effect
    // belongs to the Splice card, held by the bot. It DEFERS both halves (the
    // bot's gain and the opponent's choice), which is why nothing is logged
    // here — a second line would duplicate what those gains already say.
    game.events.withEffect(bot, splice, 'card-played-by-any',
      () => splice.onCardPlayedByAnyPlayer?.(bot, card, player));
  },

  onTagResolved(game: IGame, tag: Tag): void {
    if (tag !== Tag.MICROBE) {
      return;
    }
    payForOwnMicrobe(game, 'a microbe tag');
  },

  onMicrobeAdvancement(game: IGame): void {
    payForOwnMicrobe(game, 'a microbe advancement');
  },
};

/** «When MarsBot resolves a microbe tag, it gains 4 MC.» */
function payForOwnMicrobe(game: IGame, _what: string): void {
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    bot.stock.add(Resource.MEGACREDITS, OWN_TAG_MC, {log: false});
    game.log('${0} gained ${1} M€ from its corporation ${2} for a microbe',
      (b) => b.player(bot).number(OWN_TAG_MC).string('Splice'));
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, 'spliceOwnTags');
  bumpCorpStat(game, 'spliceOwnMc', OWN_TAG_MC);
}
