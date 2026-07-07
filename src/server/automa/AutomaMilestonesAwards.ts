import {MAX_AWARDS, MAX_MILESTONES} from '../../common/constants';
import {IAward} from '../awards/IAward';
import {AwardScorer} from '../awards/AwardScorer';
import {IMilestone} from '../milestones/IMilestone';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {failedAction} from './AutomaFailedAction';
import {AutomaMAEvaluation} from './AutomaMAEvaluation';
import {marsBotOf} from './AutomaSetup';

function humanOf(game: IGame): IPlayer {
  const human = game.players.find((p) => !p.isMarsBot);
  if (human === undefined) {
    throw new Error('This game has no human player');
  }
  return human;
}

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
   * The Claim Milestone track action (rulebook p.8): claim an unclaimed
   * milestone the bot meets, free of charge. Tiebreakers: (1) one the human
   * also meets; (2) the one the human is closest to meeting; (3) leftmost
   * (Hoverlord last). 3 claimed / none met → Failed Action.
   */
  public static claimMilestoneAction(game: IGame): void {
    if (game.claimedMilestones.length >= MAX_MILESTONES) {
      failedAction(game, 'milestones-claimed');
      return;
    }
    const unclaimed = game.milestones.filter((m) => !game.milestoneClaimed(m));
    let eligible = unclaimed.filter((m) => AutomaMAEvaluation.botMilestoneMet(m, game));
    if (eligible.length === 0) {
      failedAction(game, 'no-milestone-criteria');
      return;
    }
    const human = humanOf(game);
    if (eligible.length > 1) {
      const humanAlsoMeets = eligible.filter((m) => m.canClaim(human));
      if (humanAlsoMeets.length > 0) {
        eligible = humanAlsoMeets;
      }
    }
    if (eligible.length > 1) {
      // "Whichever you're closest to meeting": progress = score / threshold,
      // capped at 1 (several already-met milestones are equally "close" — the
      // leftmost rule below settles them).
      const progress = (m: IMilestone): number => {
        const threshold = m.getThreshold !== undefined ?
          m.getThreshold(game) :
          ((m as unknown as {threshold?: number}).threshold ?? 1);
        return Math.min(1, m.getScore(human) / Math.max(1, threshold));
      };
      const max = Math.max(...eligible.map(progress));
      eligible = eligible.filter((m) => progress(m) === max);
    }
    const ordered = AutomaMilestonesAwards.leftmostOrder(game.milestones, 'Hoverlord')
      .filter((m) => eligible.includes(m));
    AutomaMilestonesAwards.claim(game, ordered[0]);
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
   * The Fund Award track action (rulebook p.8): fund the award the bot is the
   * MOST ahead of the human in (strictly ahead — a tie is not ahead), leftmost
   * on ties (Venuphile last), free of charge. 3 funded / not ahead anywhere →
   * Failed Action. Leftover-resource awards (Thermalist, Miner) already compare
   * against the human's resources PLUS production — their getScore does exactly
   * that until final production.
   */
  public static fundAwardAction(game: IGame): void {
    if (game.fundedAwards.length >= MAX_AWARDS) {
      failedAction(game, 'awards-funded');
      return;
    }
    const bot = marsBotOf(game);
    const human = humanOf(game);
    const unfunded = game.awards.filter((a) => !game.hasBeenFunded(a));
    const margin = new Map<IAward, number>();
    for (const award of unfunded) {
      const scorer = new AwardScorer(game, award);
      margin.set(award, scorer.get(bot) - scorer.get(human));
    }
    const ahead = unfunded.filter((a) => (margin.get(a) ?? 0) > 0);
    if (ahead.length === 0) {
      failedAction(game, 'not-ahead-any-award');
      return;
    }
    const best = Math.max(...ahead.map((a) => margin.get(a) ?? 0));
    const tied = ahead.filter((a) => margin.get(a) === best);
    const ordered = AutomaMilestonesAwards.leftmostOrder(game.awards, 'Venuphile')
      .filter((a) => tied.includes(a));
    game.fundAward(bot, ordered[0]);
  }
}
