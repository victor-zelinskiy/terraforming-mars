import {Tag} from '../../../common/cards/Tag';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
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
import {matTracks, otherPlayersCardsWithTag} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF9_DEIMOS_GROUP);

/** SETUP — the human card's first action: one delegate to a resolution. */
export const SETUP_DELEGATES = 1;
/** SETUP — the rumour that precedes the group (in place of the human card's +2 influence — the owner, 2026-11-05). */
export const SETUP_RUMOURS = 1;
/** EFFECT — rumours per vote MarsBot does not win. */
export const RUMOURS_PER_LOSS = 1;

/**
 * Nested pushes in flight (a space can open a cascade) — the depth the shared runaway guard reads, kept in the
 * MODULE (the C22 / CF1 law).
 */
let pushDepth = 0;

/**
 * MarsBot The Deimos Group — CF9, the FORK'S OWN bot card (the owner, 2026-11-05) for the Turmoil Redux corporation
 * TR83. «The Conspiracy Theory» — the owner chose it over a blackmail file that sends a human's delegate home and a
 * puppet master whose every won vote adds influence: the villain of every conspiracy theory feeds on its DEFEATS. The
 * human card's first-action delegate carries over; its +2 influence does NOT (the owner, 2026-11-05: «не нравится что у
 * бота сразу +2 влияния, лучше отбалансить другим инструментом») — a rumour on the card stands in its place; its
 * party-requirement waiver has nothing to say to MarsBot, which ignores every requirement anyway (RB-B).
 *
 *   MODULE               Turmoil Redux — the Mars Parliament.
 *   STARTING TAG         Mars (no track of its own on the mat — the flip home rule resolves it).
 *   DRAFT PRIORITY       Least-advanced track — the track the hidden project feeds.
 *   SETUP                MarsBot sends 1 delegate from its reserve to the resolution it is closest to winning, and
 *                        puts 1 rumour on this card — the reputation that precedes the group (spent by the
 *                        before-action-phase box, which the shared gate also runs right after setup).
 *   EFFECT               Each vote MarsBot does not win puts 1 rumour on this card — at the sitting itself
 *                        (`onVoteDecided`, guarded by the sitting's number); a neutral winner is a lost vote too.
 *   BEFORE ACTION PHASE  For each rumour here, MarsBot spends it: it sends a delegate from its reserve to the
 *                        resolution it is closest to winning (while the reserve and the voting area permit) and
 *                        advances its least advanced track — «the hidden project».
 *
 * A COMEBACK ENGINE IN POLITICS — a bot that leads the Parliament gains nothing from the effect (it wins, no rumours);
 * a bot shut out of it pushes back each generation, in the Parliament and on its mat. The delegates are free (D14) and
 * take the one placement rule every bot delegate takes; the push is the shared `advanceTrack`.
 *
 * THE BALANCE (measured 2026-11-05, 30 seeded 8-generation games with Turmoil Redux played, the research draft played,
 * and the HUMAN VOTING — 3 delegates a generation on the resolution the bot is strongest on, calibrated so that C38
 * wins 35 % of the votes and walks 4.7 Agenda steps, the owner's real games' median 4 — §20). Politics alone stays
 * weak: rumours → delegates only 90.0 (C38 99.3 under the same driver); +6 influence and two delegates a loss 97.3;
 * influence that grows with every rumour 95.9. **Each rumour → a delegate AND a push of the least advanced track:
 * 100.7, Venus + Colonies + Prelude 110.1** with the +2 influence (C38 112.1 · CF1 115.3); a push alone 100.8, two
 * pushes a loss 111.2.
 * Plates: none 96.1 · Earth 98.5 · least-advanced track 100.7 · event 102.3 · most expensive 102.7.
 * The +2 influence dropped (the owner's call): 98.0; a setup rumour in its place — 1: **101.8 / 110.8** (final), 2:
 * 103.9 / 113.5; two setup delegates + 1 rumour 101.8.
 */
export const MarsBotDeimosGroup: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF9_DEIMOS_GROUP).rates;
    return dividendResult([
      perUnitTerm('Cards with an Earth tag the other players played', otherPlayersCardsWithTag(game, Tag.EARTH), r.each, r.per),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    // «No weak spots» — the conspiracy covers every front: the space number of MarsBot's least advanced track.
    return Math.min(...matTracks(game).map((track) => track.position));
  },

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined || game.parliament === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bumpCorpStat(game, 'deimosSetupDelegates', sendDelegates(game, bot, SETUP_DELEGATES));
      automa.corpResources += SETUP_RUMOURS;
      game.log('${0} put ${1} rumour(s) on its corporation ${2}', (b) => b.player(bot).number(SETUP_RUMOURS).string('The Deimos Group'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },

  onVoteDecided(game: IGame, winner: string | undefined, seq: number | undefined): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    if (winner === bot.id) {
      return;
    }
    // One rumour per sitting — a sitting re-entered after a reload carries the same number.
    if (seq !== undefined) {
      if (automa.corpStats.deimosLastSitting === seq) {
        return;
      }
      automa.corpStats.deimosLastSitting = seq;
    }
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources += RUMOURS_PER_LOSS;
      game.log('${0} did not win the vote — a rumour goes onto its corporation ${1}', (b) => b.player(bot).string('The Deimos Group'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'deimosRumours', RUMOURS_PER_LOSS);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined || automa.corpResources <= 0) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    pushDepth++;
    try {
      while (automa.corpResources > 0) {
        automa.corpResources--;
        game.log('${0} spent a rumour from its corporation ${1}', (b) => b.player(bot).string('The Deimos Group'));
        bumpCorpStat(game, 'deimosDelegates', sendDelegates(game, bot, 1));
        AutomaResolver.advanceTrack(game, automa.board.getLeastAdvancedTrackIndex(), pushDepth);
        bumpCorpStat(game, 'deimosPushes');
      }
    } finally {
      pushDepth--;
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },
};

/** Send up to `count` free delegates from the bot's reserve by its own vote rule; returns how many went. */
function sendDelegates(game: IGame, bot: IPlayer, count: number): number {
  const parliament = game.parliament;
  if (parliament === undefined) {
    return 0;
  }
  let sent = 0;
  while (sent < count && parliament.reserve(bot) > 0 && chooseVoteSlot(parliament, bot) !== undefined) {
    placeBotGrantDelegate(game, bot);
    sent++;
  }
  if (sent < count) {
    game.log('${0} has no delegate it can send for its corporation ${1}', (b) => b.player(bot).string('The Deimos Group'));
  }
  return sent;
}
