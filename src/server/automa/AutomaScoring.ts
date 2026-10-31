import {hasNonNegativeVictoryPointsIcon} from '../../common/cards/victoryPointsIcon';
import {getAutomaMaxGeneration} from '../../common/automa/AutomaTypes';
import {AutomaVictoryPoints} from '../../common/game/VictoryPointsBreakdown';
import {GOAL_TERM_LABELS} from '../../common/automa/MarsBotDividend';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {IGame} from '../IGame';
import {newProjectCard} from '../createCard';
import {IProjectCard} from '../cards/IProjectCard';
import {marsBotOf} from './AutomaUtil';

/**
 * MarsBot's scoring exceptions (rulebook p.10 + Adding Expansions p.1):
 * - No VP from played cards — EXCEPT Hard/Brutal: "+1 VP for any card in its
 *   played discard pile with a non-negative VP icon" (rulebook p.11).
 * - Neural Instance: +1 VP per adjacent space not occupied by the human
 *   (empty, or holding a MarsBot tile).
 * - Remaining M€ converts to VP by the generation the game ended in.
 * TR / milestones / awards / greenery / city VP ride the standard engine paths
 * (the bot is a real player; AwardScorer evaluates it via the reference card).
 */
/** Generations the M€ → VP ladder moves earlier per human seat beyond the first (the owner, 2026-10-31: «давай +2»). */
export const MC_LADDER_SHIFT_PER_EXTRA_HUMAN = 2;

export class AutomaScoring {
  /**
   * The M€ → VP conversion rate by final generation (final scoring reference
   * card): base ≤12 → 8 M€/VP, then 7/6/5/4/3/2/1 for 13–19. The Prelude side
   * shifts the same ladder two generations earlier (≤10 → 8 … 17 → 1).
   * Generation 20 (18 with Prelude) never reaches scoring — entering it is an
   * instant MarsBot win.
   *
   * A TABLE OF SEVERAL HUMANS (fork rule, the owner 2026-10-31): the reference
   * card is written for the solo game, and a table of more players terraforms
   * faster — the owner's 180 two-player games ended in the 9th generation (median)
   * against the 13th solo, so the bot met the 8 M€ rung in 156 of them. The
   * ladder shifts {@link MC_LADDER_SHIFT_PER_EXTRA_HUMAN} generations earlier per
   * human beyond the first (a solo game is the rulebook's); every game with the
   * bot, whatever the switches. Measured on those games: +2.5 VP a game for the
   * bot on average. The instant win is untouched (it reads the generation).
   */
  public static mcPerVp(generation: number, preludeExtension: boolean, humanCount: number = 1): number {
    const normalized = generation + (preludeExtension ? 2 : 0) + MC_LADDER_SHIFT_PER_EXTRA_HUMAN * Math.max(0, humanCount - 1);
    if (normalized <= 12) {
      return 8;
    }
    return Math.max(1, 8 - (normalized - 12));
  }

  /**
   * "Non-negative VP icon": the card prints a VP icon and it is not negative.
   * THE shared rule (`common/cards/victoryPointsIcon.ts`) — the same predicate
   * Turmoil Redux's Architecture Award counts with, so a bespoke penalty icon
   * (Vermin's «-1 per city») reads as negative on every side.
   */
  public static hasNonNegativeVpIcon(card: IProjectCard): boolean {
    return hasNonNegativeVictoryPointsIcon(card);
  }

  public static automaVictoryPoints(game: IGame): AutomaVictoryPoints {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const bot = marsBotOf(game);

    const humanCount = game.players.filter((p) => p !== bot).length;
    const mcPerVp = AutomaScoring.mcPerVp(game.generation, game.gameOptions.preludeExtension, humanCount);
    const mcToVp = Math.floor(bot.megaCredits / mcPerVp);

    // Neural Instance: +1 VP per adjacent space that is empty or holds a
    // MarsBot tile. Oceans can never be adjacent — the tile's placement rule
    // forbids reserved neighbors — so the strict empty/bot-tile reading is total.
    let neuralInstance = 0;
    if (automa.neuralInstanceSpaceId !== undefined) {
      const space = game.board.getSpaceOrThrow(automa.neuralInstanceSpaceId);
      neuralInstance = game.board.getAdjacentSpaces(space)
        .filter((adj) => adj.tile === undefined || adj.player?.id === bot.id)
        .length;
    }

    let cardVp = 0;
    if (automa.difficulty === 'hard' || automa.difficulty === 'brutal') {
      for (const name of automa.playedPile) {
        const card = newProjectCard(name);
        if (card !== undefined && AutomaScoring.hasNonNegativeVpIcon(card)) {
          cardVp++;
        }
      }
    }

    // The corporation's OWN endgame clause, if it prints one (C25 Viron).
    const corpVp = AutomaCorporations.endgameVictoryPoints(game);

    const result: AutomaVictoryPoints = {mcToVp, mcPerVp, neuralInstance, cardVp, corpVp};
    // Campaign dividends: one per HOLDING of the portfolio, live from the first
    // generation (the owner's D3 — the number grows in plain sight, it never
    // jumps at the end). Absent without holdings: an ordinary game and
    // mission 1 keep their exact breakdown.
    if (automa.holdings.length > 0) {
      const details = AutomaCorporations.dividends(game);
      result.dividendVp = details.reduce((sum, d) => sum + d.vp, 0);
      // The goals' share — the three tier terms of every holding (the score files them as FIXED card VP).
      const goalLabels: ReadonlyArray<string> = GOAL_TERM_LABELS;
      result.dividendGoalVp = details.reduce((sum, d) => sum + d.terms.filter((t) => goalLabels.includes(t.label)).reduce((s, t) => s + t.vp, 0), 0);
      result.detailsDividends = details;
    }
    return result;
  }

  /** True when entering `generation` instantly ends the game with a MarsBot win. */
  public static isInstantLossGeneration(generation: number, preludeExtension: boolean): boolean {
    return generation >= getAutomaMaxGeneration(preludeExtension);
  }
}
