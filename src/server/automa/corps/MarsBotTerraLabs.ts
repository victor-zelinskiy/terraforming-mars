import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C38_TERRALABS);
/** The card's printed name, for the journal templates. */
const NAME = 'TerraLabs';
/** What the setup box costs. */
const TR_LOSS = 8;
/** Cards per generation, and the generation the printed rate doubles at. */
const CARDS_EARLY = 1;
const CARDS_LATE = 2;
const LATE_GENERATION = 9;

/**
 * MarsBot TerraLabs — official card C38:
 *
 *   STARTING TAG        science
 *   SETUP               MarsBot loses 8 TR.
 *   BEFORE ACTION PHASE If generation 1–8: draw and shuffle 1 project card
 *                       into MarsBot's action deck.
 *                       If generation 9+: draw and shuffle 2 project cards
 *                       into MarsBot's action deck.
 *
 * THE HUMAN CARD'S TRADE, IN THE BOT'S CURRENCY. TerraLabs Research buys its
 * cards for 1 M€ instead of 3 and pays for that in TR; the bot has no hand and
 * no prices, so the same bargain is struck in the only currency it spends —
 * its ACTION DECK. It starts 8 TR down and then draws harder than any other
 * corporation for the whole game, twice as hard once the endgame is in sight.
 *
 * A THICKER DECK IS MORE TURNS, NOT BETTER ONES. Every extra project card is
 * one more flip, and a flip is one track advance per printed tag — so the
 * corporation buys TEMPO, and the 8 TR is exactly what tempo costs. Nothing
 * here selects a card: the draw is off the top of the project deck and the
 * insertion is at a seeded-random index, which is what «shuffle into» means
 * (the same idiom C02/C16/C12 use, and for the same reason — the bot must not
 * be handed a card it could not have shuffled to).
 *
 * ⚠️ THE BOX HAS ALREADY RUN ONCE BY THE FIRST ACTION PHASE. RB-B resolves
 * Before-Action-Phase boxes after setup too, and the shared gate does it at
 * the research → action transition, so generation 1 gets its card like every
 * other generation — and a spec must read these counters as DELTAS (C32's
 * law).
 *
 * THE CARD IS NEVER NAMED IN THE JOURNAL. It goes into the deck face down and
 * announces itself when the bot flips it; naming it here would hand the
 * player information the table does not have (C16's law for the same idiom).
 */
export const MarsBotTerraLabs: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      // The player's own TR path: its event, its log line, its recorded delta.
      bot.decreaseTerraformRating(TR_LOSS, {log: true});
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'terralabsTrLost', TR_LOSS);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const late = game.generation >= LATE_GENERATION;
    const wanted = late ? CARDS_LATE : CARDS_EARLY;
    const bot = marsBotOf(game);
    let added = 0;
    for (let i = 0; i < wanted; i++) {
      const card = game.projectDeck.draw(game);
      if (card === undefined) {
        break; // Deck and discard both empty — nothing left to shuffle in.
      }
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'project', name: card.name});
      added++;
    }
    if (added === 0) {
      return;
    }
    bumpCorpStat(game, 'terralabsCards', added);
    if (late) {
      bumpCorpStat(game, 'terralabsLateCards', added);
    }
    // Journal-only bookkeeping — the COUNT, never the card: it was shuffled in
    // face down and speaks for itself when the bot flips it.
    game.log('${0} shuffled ${1} project card(s) into its action deck (corporation ${2})',
      (b) => b.player(bot).number(added).string(NAME));
  },
};
