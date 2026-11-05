import {Tag} from '../../../common/cards/Tag';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {TITAN_TAGS} from '../../../common/cards/titanHoldingsTags';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {chooseVoteSlot} from '../../parliament/BotVoteChooser';
import {placeBotGrantDelegate} from '../AutomaPolitics';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {otherPlayersCardsWithAnyTag, pileTagCount} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF10_TITAN_HOLDINGS);

/** EFFECT — leverage per planet tag MarsBot resolves (the human card's «add 1 leverage»). */
export const LEVERAGE_PER_TAG = 1;
/** BEFORE ACTION PHASE — the leverage one lobbying move costs (a delegate, or the investment in its stead). */
export const LEVERAGE_PER_MOVE = 1;

/** Nested pushes in flight — the depth the shared runaway guard reads, kept in the MODULE (the C22 / CF1 law). */
let pushDepth = 0;

/**
 * MarsBot Titan Holdings — CF10, the FORK'S OWN bot card (the owner, 2026-11-05) for the Turmoil Redux corporation
 * TR84. «The Holding's Lobby» — the owner chose it over takeovers of the most advanced planet track and orbital real
 * estate paying rent: the closest reading of the printed card. Planet tags bring leverage; leverage buys delegates —
 * but only where a delegate can still change the vote; the leverage the Parliament cannot use is invested in a planet
 * track instead, so the card never sinks into the bot's cheap votes.
 *
 *   MODULE               Turmoil Redux — the Mars Parliament.
 *   STARTING TAGS        Earth, Jovian — planet tags, so they bring their own leverage («including these»).
 *   DRAFT PRIORITY       Earth, then Jovian — the planets the holding is built on.
 *   EFFECT               Each Mars, Earth, Venus, Jovian or Moon tag MarsBot resolves puts 1 leverage on the card (the
 *                        human card's own set — `common/cards/titanHoldingsTags.ts`, one list for both).
 *   BEFORE ACTION PHASE  For each leverage here, MarsBot spends it: a delegate from its reserve to the resolution it is
 *                        closest to winning — WHERE A DELEGATE CAN STILL CHANGE THE VOTE (a delegate left, a resolution
 *                        up for the vote, MarsBot not already the winning player); otherwise the leverage advances its
 *                        least advanced planet track (a track carrying a planet tag).
 *
 * THE BALANCE (measured 2026-11-05, 30 seeded 8-generation games, Turmoil Redux, the research draft played, the HUMAN
 * VOTING — 3 delegates a generation, the CF9 calibration: C38 wins 35 % of the votes, 4.7 Agenda steps). References
 * under the same driver: C38 99.3 / 112.1 · CF9 101.8 / 110.8 · CF1 — / 115.3 (base / Venus + Colonies + Prelude). At
 * the human card's price (2 leverage a delegate) the card is weak: 93.7 / 104.2 — ~13 leverage a game, nearly all of it
 * gone into cheap delegates (0.5 investments). A delegate AND a push for 2: 106.7 / 119.8 (too strong); for 3, the
 * least advanced planet track: 99.7 / 105.4. **A delegate OR the investment, 1 leverage a move, the least advanced
 * planet track: 104.6 / 112.2** (≈ 8 delegates and 5 investments a game — once the bot leads the vote, the rest is
 * invested); the most advanced planet track: 103.6 / 116.7.
 */
export const MarsBotTitanHoldings: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF10_TITAN_HOLDINGS).rates;
    return dividendResult([
      perUnitTerm('Cards with a planet tag the other players played', otherPlayersCardsWithAnyTag(game, TITAN_TAGS), r.each, r.per),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    // «Planetary portfolio» — the holding's own assets: the planet tags (the human card's set) in MarsBot's pile.
    return pileTagCount(game, TITAN_TAGS);
  },

  onTagResolved(game: IGame, tag: Tag): void {
    const automa = game.automa;
    if (automa === undefined || !TITAN_TAGS.includes(tag)) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources += LEVERAGE_PER_TAG;
      game.log('${0} put ${1} leverage on its corporation ${2}', (b) => b.player(bot).number(LEVERAGE_PER_TAG).string('Titan Holdings'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'titanLeverage', LEVERAGE_PER_TAG);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined || automa.corpResources < LEVERAGE_PER_MOVE) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    pushDepth++;
    try {
      while (automa.corpResources >= LEVERAGE_PER_MOVE) {
        automa.corpResources -= LEVERAGE_PER_MOVE;
        if (delegateCanMatter(game, bot)) {
          placeBotGrantDelegate(game, bot);
          game.log('${0} spent ${1} leverage on a delegate', (b) => b.player(bot).number(LEVERAGE_PER_MOVE));
          bumpCorpStat(game, 'titanDelegates');
        } else {
          game.log('${0} spent ${1} leverage on its planet track — no delegate would change the vote', (b) => b.player(bot).number(LEVERAGE_PER_MOVE));
          AutomaResolver.advanceTrack(game, planetTrackIndex(game), pushDepth);
          bumpCorpStat(game, 'titanInvestments');
        }
      }
    } finally {
      pushDepth--;
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },
};

/**
 * A delegate CAN STILL CHANGE THE VOTE — a fact read off the table now: a delegate left in the reserve, a resolution
 * up for the vote, and MarsBot not already the winning player (a delegate on a vote it already leads changes nothing).
 */
export function delegateCanMatter(game: IGame, bot: IPlayer): boolean {
  const parliament = game.parliament;
  if (parliament === undefined || parliament.reserve(bot) <= 0 || chooseVoteSlot(parliament, bot) === undefined) {
    return false;
  }
  return parliament.winner()?.player !== bot.id;
}

/** The planet track an investment pushes — the least advanced track that carries a planet tag and can still advance. */
export function planetTrackIndex(game: IGame): number {
  const board = game.automa?.board;
  if (board === undefined) {
    return 0;
  }
  let best: number | undefined;
  board.tracks.forEach((track, index) => {
    if (!track.canAdvance() || !track.definition.tags.some((tag) => TITAN_TAGS.includes(tag))) {
      return;
    }
    if (best === undefined || track.position < board.tracks[best].position) {
      best = index;
    }
  });
  return best ?? board.getLeastAdvancedTrackIndex();
}
