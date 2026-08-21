import {Resource} from '../../../common/Resource';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {MarsBotBoard} from '../MarsBotBoard';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C39_UTOPIA_INVEST);
/** The card's printed name, for the journal templates. */
const NAME = 'Utopia Invest';

/**
 * MarsBot Utopia Invest — official card C39:
 *
 *   STARTING TAGS       building, space
 *   BEFORE ACTION PHASE Add Investors to MarsBot's action deck.
 *
 * plus its corporation-specific bonus card B32 Investors:
 *
 *   "If it is an even-numbered generation, advance MarsBot's least-advanced
 *    track (topmost, if tied), and regress its most-advanced (topmost if
 *    tied) track. Otherwise, MarsBot gains MC equal to its least-advanced
 *    track space number. At the beginning of every generation, shuffle this
 *    into MarsBot's action deck."
 *
 * A PORTFOLIO MANAGER, NOT AN ENGINE. The human Utopia Invest trades one
 * production step for four resources of that kind — it moves value from where
 * it sits to where it is wanted. B32 is that same instinct applied to the only
 * board the bot has: on even generations it takes a step off whatever the bot
 * is BEST at and gives it to whatever it is WORST at; on odd ones it simply
 * cashes the weak track's position out as M€. So the bot's mat is kept level
 * by design — a human who plans around the bot's strongest track finds it
 * pulled back every other generation.
 *
 * ⚠️ BOTH TARGETS ARE READ BEFORE ANYTHING MOVES. The printed clause names
 * them in ONE sentence — at the table you look at the mat once, then move both
 * cubes. Choosing the most-advanced track AFTER the push would let the push
 * itself create the leader it then cancels (a flat mat: track 0 advances to 1,
 * becomes the most advanced, and slides straight back), which is the reading
 * that makes the card do nothing exactly when it should be doing the most.
 * The flat-mat case still resolves onto ONE track (both clauses say «topmost
 * if tied»), and that is honest: the space's icon fires on the way up, and the
 * regression marker keeps it from firing twice if the track is pushed there
 * again. Pinned by tests.
 *
 * THE THREE SHARED READINGS IT INHERITS, none of them re-implemented here:
 * «least-advanced, topmost if tied» is `board.getLeastAdvancedTrackIndex` (the
 * same helper the WILD tag, C33 and B28 use), «most-advanced, topmost if tied»
 * its sibling `getMostAdvancedTrackIndex`, and the push is the ordinary
 * `AutomaResolver.advanceTrack` — so the space icon, cascades, cubes and the
 * Failed Action on a completed track all behave exactly as anywhere else.
 * The pull-back is `MarsBotTrack.regress`, the engine's own regression (the
 * Ares hazard consequence uses it): a track at the start cannot regress and
 * honestly does nothing.
 *
 * LIFECYCLE. B32 is RECURRING — the B23/B25/B28 mechanism
 * (`AutomaState.recurringBonusCards` + `AutomaResearch.finishActionDeck`):
 * never in the random bonus rotation, never discarded. Generation 1 is seeded
 * here because this engine builds that deck before the corporation exists, and
 * the presence check keeps the hook idempotent — there is exactly ONE B32.
 */
export const MarsBotUtopiaInvest: MarsBotCorp = {
  info: INFO,

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.B32_INVESTORS)) {
      automa.recurringBonusCards.push(BonusCardId.B32_INVESTORS);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.B32_INVESTORS);
    if (!present) {
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'bonus', id: BonusCardId.B32_INVESTORS});
      // Journal-only (no scope): the deck join is public bookkeeping, not an
      // event worth a notification — the card announces itself when flipped.
      game.log('${0} shuffled Investors into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.B32_INVESTORS) {
      throw new Error(`MarsBot Utopia Invest does not own bonus card ${id}`);
    }
    return investors(game);
  },
};

/** B32 Investors. Always ends in the recurring holding (never destroyed). */
function investors(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  bumpCorpStat(game, 'investorsPlayed');
  if (game.generation % 2 === 0) {
    rebalance(game, automa.board);
  } else {
    cashOut(game, automa.board);
  }
  return 'discard'; // In the recurring pool → routeBonusCard keeps it in holding.
}

/** «Advance the least-advanced track … and regress the most-advanced one.» */
function rebalance(game: IGame, board: MarsBotBoard): void {
  // ONE look at the mat, then both cubes move (see the file docstring).
  const weakest = board.getLeastAdvancedTrackIndex();
  const strongest = board.getMostAdvancedTrackIndex();
  AutomaTurnLog.setBonusBranch(game, {key: 'An even generation: the portfolio is rebalanced'});

  const before = board.tracks[weakest].position;
  AutomaResolver.advanceTrack(game, weakest);
  // The track's OWN position — a cascade may have moved others too, and only
  // this one answers «did the printed push land?».
  if (board.tracks[weakest].position > before) {
    bumpCorpStat(game, 'investorsPushes');
  }

  const bot = marsBotOf(game);
  const track = board.tracks[strongest];
  const from = track.position;
  track.regress();
  if (track.position < from) {
    bumpCorpStat(game, 'investorsRegressions');
    game.log('${0} pulled its ${1} track back from ${2} to ${3} (corporation ${4})',
      (b) => b.player(bot).string(track.definition.tags.join('/')).number(from).number(track.position).string(NAME));
  } else {
    // A track still at the start cannot regress: the printed pull honestly
    // finds nothing to take, which is an outcome, not a Failed Action.
    game.log('${0} had nothing to pull back — its tracks are all at the start (corporation ${1})',
      (b) => b.player(bot).string(NAME));
  }
}

/** «Otherwise, MarsBot gains MC equal to its least-advanced track space number.» */
function cashOut(game: IGame, board: MarsBotBoard): void {
  const bot = marsBotOf(game);
  const amount = board.tracks[board.getLeastAdvancedTrackIndex()].position;
  AutomaTurnLog.setBonusBranch(game, {key: 'An odd generation: the weakest track is cashed out'});
  if (amount <= 0) {
    // Space number 0 pays 0 — the card is honest about a mat that has not
    // moved yet, and this is not a Failed Action either.
    game.log('${0} cashed out nothing — its weakest track is still at the start (corporation ${1})',
      (b) => b.player(bot).string(NAME));
    return;
  }
  bot.stock.add(Resource.MEGACREDITS, amount, {log: false});
  bumpCorpStat(game, 'investorsMc', amount);
  game.log('${0} gained ${1} M€ from Investors — the space number of its weakest track',
    (b) => b.player(bot).number(amount));
}
