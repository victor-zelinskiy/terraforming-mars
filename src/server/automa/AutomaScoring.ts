import {getAutomaMaxGeneration} from '../../common/automa/AutomaTypes';
import {AutomaVictoryPoints} from '../../common/game/VictoryPointsBreakdown';
import {IGame} from '../IGame';
import {newProjectCard} from '../createCard';
import {IProjectCard} from '../cards/IProjectCard';
import {marsBotOf} from './AutomaSetup';

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
export class AutomaScoring {
  /**
   * The M€ → VP conversion rate by final generation (final scoring reference
   * card): base ≤12 → 8 M€/VP, then 7/6/5/4/3/2/1 for 13–19. The Prelude side
   * shifts the same ladder two generations earlier (≤10 → 8 … 17 → 1).
   * Generation 20 (18 with Prelude) never reaches scoring — entering it is an
   * instant MarsBot win.
   */
  public static mcPerVp(generation: number, preludeExtension: boolean): number {
    const normalized = generation + (preludeExtension ? 2 : 0);
    if (normalized <= 12) {
      return 8;
    }
    return Math.max(1, 8 - (normalized - 12));
  }

  /** "Non-negative VP icon": the card prints a VP icon and it is not negative. */
  public static hasNonNegativeVpIcon(card: IProjectCard): boolean {
    const vp = card.victoryPoints;
    if (vp === undefined) {
      return false;
    }
    if (typeof vp === 'number') {
      return vp >= 0;
    }
    if (vp === 'special') {
      // Every in-scope 'special' scorer prints a non-negative icon.
      return true;
    }
    // Countable ("1 per 2 microbes", "-1 per city"…): the sign of `each`.
    return (vp.each ?? 1) >= 0;
  }

  public static automaVictoryPoints(game: IGame): AutomaVictoryPoints {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const bot = marsBotOf(game);

    const mcPerVp = AutomaScoring.mcPerVp(game.generation, game.gameOptions.preludeExtension);
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

    return {mcToVp, mcPerVp, neuralInstance, cardVp};
  }

  /** True when entering `generation` instantly ends the game with a MarsBot win. */
  public static isInstantLossGeneration(generation: number, preludeExtension: boolean): boolean {
    return generation >= getAutomaMaxGeneration(preludeExtension);
  }
}
