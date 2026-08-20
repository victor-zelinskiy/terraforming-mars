import {Resource} from '../../../common/Resource';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {AutomaScoring} from '../AutomaScoring';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C17_VITOR);
/** The card Vitor takes out of the rotation and hands back every generation. */
const OVERACHIEVEMENT = BonusCardId.B04_OVERACHIEVEMENT;
/** The reward of the printed effect (card C17). */
const REWARD_MC = 3;

/**
 * MarsBot Vitor — official card C17:
 *
 *   SETUP                Set aside Overachievement from the bonus deck.
 *   EFFECT               When resolving a card with a non-negative VP icon,
 *                        MarsBot gains 3 MC.
 *   BEFORE ACTION PHASE  Add Overachievement to MarsBot's action deck, unless
 *                        it has been destroyed.
 *
 * No starting tag, no draft priority. The corporation turns ONE base bonus
 * card into a standing fixture: B04 leaves the random rotation and comes back
 * every generation until it finally lands a milestone (or, from generation 6,
 * funds an award) — at which point B04's own rule destroys it and it is gone
 * for good. Every failed attempt still pays the bot 5 M€, so the free shot is
 * never wasted.
 *
 * «A CARD WITH A NON-NEGATIVE VP ICON» is a rule this engine already owns:
 * `AutomaScoring.hasNonNegativeVpIcon` — the very predicate Hard/Brutal uses
 * to score the bot's played pile. Reused rather than re-implemented, so the
 * two can never drift (a countable «-1 per city» scorer must read as negative
 * on both sides). This effect happens to match the HUMAN Vitor's printed
 * effect word for word; that is what the bot card prints, not a rule leaking
 * through the identity link — the human's 45 M€ start and its free award
 * never appear here.
 *
 * LIFECYCLE. B04 rides `recurringBonusCards`, the B23/B25/B28 mechanism, with
 * two differences that are this card's whole point:
 *  - the SETUP box first pulls B04 out of `bonusDeck` / `bonusDiscard` / the
 *    generation-1 `actionDeck` slot (the C05 Inventrix cleanup: a slot it
 *    already occupies is handed to the next bonus card, so the deck keeps its
 *    printed size) — otherwise B04 would exist twice, once in the rotation and
 *    once as the fixture;
 *  - B04 is the FIRST recurring card that can be destroyed, so
 *    `routeBonusCard` now drops a destroyed id out of the recurring pool. The
 *    hook below re-checks `destroyedBonusCards` anyway, because «unless it has
 *    been destroyed» is what the card prints and the box must read as the card
 *    reads.
 */
export const MarsBotVitor: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const inDeck = automa.bonusDeck.findIndex((entry) => entry.kind === 'bonus' && entry.id === OVERACHIEVEMENT);
    if (inDeck !== -1) {
      automa.bonusDeck.splice(inDeck, 1);
    }
    const inDiscard = automa.bonusDiscard.indexOf(OVERACHIEVEMENT);
    if (inDiscard !== -1) {
      automa.bonusDiscard.splice(inDiscard, 1);
    }
    // This engine builds generation 1's action deck at game creation — BEFORE
    // the corporation exists — so B04 may already hold that deck's one bonus
    // slot. At the table the setup box runs first and the slot would have gone
    // to the next bonus card: hand it over, so the deck keeps its printed size
    // (the Before-Action-Phase box then adds B04 back on top, as an extra).
    const inAction = automa.actionDeck.findIndex((entry) => entry.kind === 'bonus' && entry.id === OVERACHIEVEMENT);
    if (inAction !== -1) {
      const replacement = automa.bonusDeck.shift();
      if (replacement === undefined) {
        automa.actionDeck.splice(inAction, 1);
      } else {
        automa.actionDeck[inAction] = replacement;
      }
    }
    game.log('${0} set Overachievement aside — its corporation ${1} hands it back every generation',
      (b) => b.player(marsBotOf(game)).string('Vitor'));
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (automa.destroyedBonusCards.includes(OVERACHIEVEMENT)) {
      return; // «unless it has been destroyed» — it left the game for good.
    }
    bumpCorpStat(game, 'vitorOverachievementGenerations');
    if (!automa.recurringBonusCards.includes(OVERACHIEVEMENT)) {
      automa.recurringBonusCards.push(OVERACHIEVEMENT);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === OVERACHIEVEMENT);
    if (!present) {
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'bonus', id: OVERACHIEVEMENT});
      // Journal-only (no scope): the deck join is public bookkeeping, not an
      // event worth a notification — the card announces itself when flipped.
      game.log('${0} shuffled Overachievement into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  onProjectCardResolving(game: IGame, card: IProjectCard): void {
    if (!AutomaScoring.hasNonNegativeVpIcon(card)) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bot.stock.add(Resource.MEGACREDITS, REWARD_MC, {log: false});
      game.log('${0} gained ${1} M€ from its corporation ${2} for resolving a card that scores',
        (b) => b.player(bot).number(REWARD_MC).string('Vitor'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'vitorTriggers');
    bumpCorpStat(game, 'vitorMc', REWARD_MC);
  },
};
