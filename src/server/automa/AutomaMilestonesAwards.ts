import {MAX_AWARDS, MAX_MILESTONES} from '../../common/constants';
import {IAward} from '../awards/IAward';
import {AwardScorer} from '../awards/AwardScorer';
import {IMilestone} from '../milestones/IMilestone';
import {IGame} from '../IGame';
import {failedAction} from './AutomaFailedAction';
import {AutomaMAEvaluation} from './AutomaMAEvaluation';
import {humansInTieOrder, marsBotOf} from './AutomaUtil';

/**
 * The Claim Milestone / Fund Award track actions (rulebook p.8). Evaluation
 * lives in AutomaMAEvaluation; this module owns the choices and the claims.
 */
export class AutomaMilestonesAwards {
  /** Leftmost order, with Hoverlord/Venuphile deliberately LAST (Adding Expansions pp.2–3). */
  private static leftmostOrder<T extends {name: string}>(items: ReadonlyArray<T>, lastName: string): Array<T> {
    return [...items.filter((i) => i.name !== lastName), ...items.filter((i) => i.name === lastName)];
  }

  /**
   * The milestone MarsBot would claim right now, or undefined (3 claimed / it
   * meets none). Tiebreakers (rulebook p.8): (1) one the human also meets;
   * (2) the one the human is closest to meeting; (3) leftmost (Hoverlord last).
   */
  public static selectMilestoneToClaim(game: IGame): IMilestone | undefined {
    if (game.claimedMilestones.length >= MAX_MILESTONES) {
      return undefined;
    }
    const unclaimed = game.milestones.filter((m) => !game.milestoneClaimed(m));
    let eligible = unclaimed.filter((m) => AutomaMAEvaluation.botMilestoneMet(m, game));
    if (eligible.length === 0) {
      return undefined;
    }
    // §12 Q12: "the human" generalizes to ANY / the BEST human.
    const humans = humansInTieOrder(game);
    if (eligible.length > 1) {
      const humanAlsoMeets = eligible.filter((m) => humans.some((h) => m.canClaim(h)));
      if (humanAlsoMeets.length > 0) {
        eligible = humanAlsoMeets;
      }
    }
    if (eligible.length > 1) {
      // "Whichever you're closest to meeting": progress = score / threshold,
      // capped at 1 (several already-met milestones are equally "close" — the
      // leftmost rule below settles them). Multiplayer: the CLOSEST human.
      const progress = (m: IMilestone): number => {
        const threshold = m.getThreshold !== undefined ?
          m.getThreshold(game) :
          ((m as unknown as {threshold?: number}).threshold ?? 1);
        return Math.max(...humans.map((h) => Math.min(1, m.getScore(h) / Math.max(1, threshold))));
      };
      const max = Math.max(...eligible.map(progress));
      eligible = eligible.filter((m) => progress(m) === max);
    }
    const ordered = AutomaMilestonesAwards.leftmostOrder(game.milestones, 'Hoverlord')
      .filter((m) => eligible.includes(m));
    return ordered[0];
  }

  /** Claim if possible; true on success. Used by Overachievement + the Hard first-turn rule. */
  public static tryClaimMilestone(game: IGame): boolean {
    const milestone = AutomaMilestonesAwards.selectMilestoneToClaim(game);
    if (milestone === undefined) {
      return false;
    }
    AutomaMilestonesAwards.claim(game, milestone);
    return true;
  }

  /**
   * The Claim Milestone track action (rulebook p.8): claim, free of charge;
   * 3 claimed / none met → Failed Action with the precise reason.
   */
  public static claimMilestoneAction(game: IGame): void {
    if (game.claimedMilestones.length >= MAX_MILESTONES) {
      failedAction(game, 'milestones-claimed');
      return;
    }
    if (!AutomaMilestonesAwards.tryClaimMilestone(game)) {
      failedAction(game, 'no-milestone-criteria');
    }
  }

  /** MarsBot claims free of charge; the journal roots it exactly like a human claim. */
  private static claim(game: IGame, milestone: IMilestone): void {
    const bot = marsBotOf(game);
    game.events.beginAction(bot, {kind: 'milestone', name: milestone.name}, {category: 'milestone'});
    try {
      game.log('${0} claimed ${1} milestone', (b) => b.player(bot).milestone(milestone));
      game.claimedMilestones.push({player: bot, milestone});
    } finally {
      game.events.endScope();
    }
  }

  /**
   * The award MarsBot would fund right now, or undefined (3 funded / not
   * strictly ahead of the human anywhere). "Most ahead", leftmost on ties
   * (Venuphile last). Leftover-resource awards (Thermalist, Miner) already
   * compare against the human's resources PLUS production — their getScore
   * does exactly that until final production.
   */
  public static selectAwardToFund(game: IGame): IAward | undefined {
    if (game.fundedAwards.length >= MAX_AWARDS) {
      return undefined;
    }
    const bot = marsBotOf(game);
    // §12 Q12: the bot's margin is measured against the BEST human per award.
    const humans = humansInTieOrder(game);
    const unfunded = game.awards.filter((a) => !game.hasBeenFunded(a));
    const margin = new Map<IAward, number>();
    for (const award of unfunded) {
      const scorer = new AwardScorer(game, award);
      margin.set(award, scorer.get(bot) - Math.max(...humans.map((h) => scorer.get(h))));
    }
    const ahead = unfunded.filter((a) => (margin.get(a) ?? 0) > 0);
    if (ahead.length === 0) {
      return undefined;
    }
    const best = Math.max(...ahead.map((a) => margin.get(a) ?? 0));
    const tied = ahead.filter((a) => margin.get(a) === best);
    const ordered = AutomaMilestonesAwards.leftmostOrder(game.awards, 'Venuphile')
      .filter((a) => tied.includes(a));
    return ordered[0];
  }

  /** Fund if possible; true on success. Used by Overachievement. */
  public static tryFundAward(game: IGame): boolean {
    const award = AutomaMilestonesAwards.selectAwardToFund(game);
    if (award === undefined) {
      return false;
    }
    game.fundAward(marsBotOf(game), award);
    return true;
  }

  /**
   * The Fund Award track action (rulebook p.8): fund free of charge; 3 funded /
   * not ahead anywhere → Failed Action with the precise reason.
   */
  public static fundAwardAction(game: IGame): void {
    if (game.fundedAwards.length >= MAX_AWARDS) {
      failedAction(game, 'awards-funded');
      return;
    }
    if (!AutomaMilestonesAwards.tryFundAward(game)) {
      failedAction(game, 'not-ahead-any-award');
    }
  }
}
