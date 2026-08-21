import {Resource} from '../../../common/Resource';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {newProjectCard} from '../../createCard';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotDraftResolver} from './MarsBotDraftResolver';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C32_POLYPHEMOS);
/** The printed opening gift. */
const SETUP_MC = 25;

/**
 * MarsBot Polyphemos — official card C32:
 *
 *   STARTING TAGS       space, space, space, event, event, event
 *   SETUP               MarsBot gains 25 MC.
 *   BEFORE ACTION PHASE MarsBot discards one of the cards with the fewest tags
 *                       from its action deck.
 *
 * THE BIGGEST OPENING IN THE SET, AND THEN A CARD THAT SHARPENS ITSELF. Six
 * printed starting tags (C08 Saturn Systems' four was the previous record) put
 * the space and event tracks on #3 before the first turn, each landing fires,
 * and 25 M€ comes with it. From then on the corporation does nothing but keep
 * the WORST card out of every generation's deck.
 *
 * WHY THAT IS A REAL EFFECT: a MarsBot turn flips one action card and advances
 * a track per printed tag, so a card's tag count IS its value — and a card
 * with NO tags is the official Failed Action (rulebook p.6). Shedding the
 * fewest-tagged card every generation raises the floor of every remaining
 * turn.
 *
 * «CARDS WITH THE FEWEST TAGS» MEANS PROJECT CARDS. The action deck also
 * holds BONUS cards, and a bonus card is not a card with few tags — it has no
 * tag row at all, and it is the bot's special move for the generation, not a
 * candidate for the bin. The measure is the printed tag row
 * (`MarsBotDraftResolver.printedTagCount` — the very count C45 Spire's «most
 * tags» priority uses), and only a card that HAS one can be compared. Pinned
 * by a test: a deck whose bonus card is its only «tagless» entry sheds a
 * project card instead.
 *
 * TIES GO TO THE SEEDED RNG, like every other fork the bot faces — it is never
 * shown a prompt (RB-B), and «one of the cards» is the card's own admission
 * that several may qualify.
 *
 * THE FIRST GENERATION IS NOT EXEMPT. RB-B resolves Before-Action-Phase boxes
 * «also after setup, before the first generation's Action Phase», and the
 * shared gate already runs them there — so the opening deck is thinned too,
 * with no special case here.
 */
export const MarsBotPolyphemos: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    bot.stock.add(Resource.MEGACREDITS, SETUP_MC, {log: false});
    game.log('${0} received ${1} M€ from its corporation ${2}',
      (b) => b.player(bot).number(SETUP_MC).string('Polyphemos'));
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    // Only the entries that HAVE a printed tag row can be compared at all.
    const candidates: Array<{index: number, card: IProjectCard, tags: number}> = [];
    for (let i = 0; i < automa.actionDeck.length; i++) {
      const entry = automa.actionDeck[i];
      if (entry.kind !== 'project') {
        continue;
      }
      const card = newProjectCard(entry.name);
      if (card === undefined) {
        continue; // Not in this build — nothing to weigh.
      }
      candidates.push({index: i, card, tags: MarsBotDraftResolver.printedTagCount(card)});
    }
    if (candidates.length === 0) {
      return; // A deck of nothing but bonus cards has nothing to shed.
    }
    const fewest = Math.min(...candidates.map((c) => c.tags));
    const tied = candidates.filter((c) => c.tags === fewest);
    const chosen = tied[game.rng.nextInt(tied.length)];

    automa.actionDeck.splice(chosen.index, 1);
    game.projectDeck.discard(chosen.card);
    bumpCorpStat(game, 'polyphemosDiscards');
    if (fewest === 0) {
      bumpCorpStat(game, 'polyphemosTaglessShed');
    }
    // Journal-only, and it NAMES the card: the action deck is face down, but
    // what leaves it goes to the OPEN discard pile, so this leaks nothing the
    // human could not already read there.
    game.log('${0} discarded ${1} from its action deck — the fewest tags (corporation ${2})',
      (b) => b.player(marsBotOf(game)).card(chosen.card).string('Polyphemos'));
  },
};
