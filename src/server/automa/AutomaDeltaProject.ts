import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {DELTA_STAGE_NAMES} from '../../common/delta/deltaStages';
import {IGame} from '../IGame';
import {
  DELTA_TRACK_TAGS,
  DeltaProjectExpansion,
  MAX_TRACK_POSITION,
  VP2_POSITION,
  VP5_POSITION,
} from '../delta/DeltaProjectExpansion';
import {marsBotOf} from './AutomaUtil';

/** Hard cap from the Solo Delta Project reference card: at most 4 rows per resolution. */
export const MAX_BOT_DELTA_ROWS = 4;

/**
 * MarsBot on the Delta Project ("Гидросеть") track — the Solo Delta Project
 * reference card, mapped onto this fork's Delta model:
 *
 * - A "Delta Project row" is one position of the Delta track (1–9 carry an
 *   associated tag; 10/11 are the 2 VP / 5 VP finish slots). The bot is a real
 *   Player with `deltaProjectData`, so its marker, the VP-slot occupancy rules
 *   and the endgame 2/5 VP all ride the exact human pathways.
 * - The "Power Track" is the bot's OWN Energy track on the MarsBot board
 *   (resolved via `getTrackIndexForTag(Tag.POWER)` — never a hardcoded index).
 *   "# of increments in the Power Track" = its position minus the increments
 *   already consumed (`automa.deltaPowerConsumed`). Consuming power bumps the
 *   counter and deliberately does NOT regress the official track (regression is
 *   the human-attack mechanic). M€ is never used as power.
 * - An "Associated Tag track" is the MarsBot board track the row's tag maps to
 *   — the SAME mapping the resolver uses for revealed-card tags. "Progressed"
 *   means position ≥ 1.
 * - "Initial Step" (must first increase Power Track and Associated Tag by ≥1)
 *   is the eligibility precondition: ≥1 available power increment AND the tag
 *   tracks of every row on the path progressed — which is exactly the human's
 *   full-path tag rule (`canReachPosition`), so regressing the bot's tracks
 *   below 1 stalls its Delta progress (honest counterplay).
 * - "Increased Steps": once per generation (mirrors the human's
 *   once-per-generation action; the card gives no cadence — this is the fixed
 *   deterministic interpretation) the bot advances the MAXIMUM legal number of
 *   consecutive rows, capped by available power and the hard cap of 4, and
 *   consumes 1 power increment per row. Rows are linear, so "1-4 rows" can
 *   never revisit a row; there is no choice to make → fully deterministic.
 * - "Reward": the bot NEVER resolves a row reward (no resources, production,
 *   cards, or the Jovian tag) and records no reward stops — it scores only the
 *   final 2/5 VP via the shared `DeltaProjectExpansion.calculateVictoryPoints`.
 *
 * An ineligible generation is a silent skip — NOT a Failed Action (the Delta
 * resolution is a reference-card subsystem, not an action-deck card).
 */
export class AutomaDeltaProject {
  private constructor() {}

  /**
   * Unconsumed increments on the bot's Power (Energy) track. A human attack
   * that regresses the track below the consumed count honestly floors at 0.
   */
  public static availablePower(game: IGame): number {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const trackIndex = automa.board.getTrackIndexForTag(Tag.POWER);
    if (trackIndex === undefined) {
      return 0;
    }
    return Math.max(0, automa.board.tracks[trackIndex].position - automa.deltaPowerConsumed);
  }

  /**
   * The bot twin of the human's full-path tag rule (`canReachPosition`): every
   * row 1..min(target, 9) must have its associated-tag track progressed ≥ 1.
   * Wild coverage is unnecessary — the bot's Wild tags already advanced a real
   * track at reveal time. Rows 10/11 carry no tag, so only power + VP-slot
   * occupancy gate them.
   */
  private static botCanReachPosition(game: IGame, targetPos: number): boolean {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    for (let pos = 1; pos <= Math.min(targetPos, 9); pos++) {
      const tag = DELTA_TRACK_TAGS[pos];
      if (tag === undefined) {
        continue;
      }
      const trackIndex = automa.board.getTrackIndexForTag(tag);
      if (trackIndex === undefined || automa.board.tracks[trackIndex].position < 1) {
        return false;
      }
    }
    return true;
  }

  /**
   * The legal `steps` values for this resolution — the bot twin of
   * `DeltaProjectExpansion.getValidAdvanceSteps`, with available power in place
   * of energy stock, track progress in place of tags, and the reference card's
   * hard cap of {@link MAX_BOT_DELTA_ROWS} rows. The VP-slot occupancy rules are
   * byte-identical to the human's (cannot LAND on an occupied 10/11; jumping
   * over an occupied 10 onto a free 11 is legal).
   */
  public static getValidAdvanceSteps(game: IGame): ReadonlyArray<number> {
    const bot = marsBotOf(game);
    const progress = bot.deltaProjectData;
    if (progress === undefined) {
      return [];
    }
    const currentPos = progress.position;
    if (currentPos >= MAX_TRACK_POSITION) {
      return [];
    }

    const maxByPower = Math.min(
      AutomaDeltaProject.availablePower(game),
      MAX_BOT_DELTA_ROWS,
      MAX_TRACK_POSITION - currentPos,
    );

    const result: number[] = [];
    for (let steps = 1; steps <= maxByPower; steps++) {
      const newPos = currentPos + steps;
      if (!AutomaDeltaProject.botCanReachPosition(game, newPos)) {
        continue;
      }
      if (newPos === VP2_POSITION && DeltaProjectExpansion.hasOtherPlayerAtPosition(game, VP2_POSITION, bot)) {
        continue;
      }
      if (newPos === VP5_POSITION && DeltaProjectExpansion.hasOtherPlayerAtPosition(game, VP5_POSITION, bot)) {
        continue;
      }
      result.push(steps);
    }
    return result;
  }

  /**
   * Runs the once-per-generation Solo Delta Project resolution. Called at the
   * start of the bot's FIRST turn of each generation (before the reveal — the
   * `deltaResolvedGeneration` guard mirrors `hardClaimCheckedGeneration`), so
   * it happens even on an empty-deck pass turn. Deterministic: always the
   * MAXIMUM legal step count. Ineligible ⇒ silent no-op (never a Failed Action).
   */
  public static resolve(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    if (game.gameOptions.deltaProjectExpansion !== true) {
      return;
    }
    if (automa.deltaResolvedGeneration >= game.generation) {
      return;
    }
    automa.deltaResolvedGeneration = game.generation;

    const bot = marsBotOf(game);
    const progress = bot.deltaProjectData;
    if (progress === undefined) {
      return;
    }
    const valid = AutomaDeltaProject.getValidAdvanceSteps(game);
    if (valid.length === 0) {
      return;
    }
    const steps = Math.max(...valid);
    const newPos = progress.position + steps;
    const jumpedOverVp2 =
      newPos === VP5_POSITION &&
      DeltaProjectExpansion.hasOtherPlayerAtPosition(game, VP2_POSITION, bot);
    const stageName = DELTA_STAGE_NAMES[newPos] ?? '';

    // The same scope kind as the human advance (category 'delta-project' —
    // analytics / endgame facts unchanged). Opened INSIDE the automa-turn
    // scope, it JOINS the turn's single journal group (EventRecorder's
    // automa-turn coalescing): the advance reads as a detail of the bot's
    // turn — one entry, one «Осмотреть ход». The turn theater picks the log
    // lines up automatically (the resolution runs inside the turn recording).
    game.events.beginAction(bot, {kind: 'card', card: CardName.DELTA_PROJECT, owner: bot.color}, {category: 'delta-project'});
    try {
      automa.deltaPowerConsumed += steps;
      progress.position = newPos;
      // NO stop is recorded: a DeltaStop means "stopped AND received the
      // reward", and the bot never receives rewards — its traversed rows must
      // honestly read as "passed" in the history panel.

      game.log('${0} consumed ${1} Power increment(s) for the Delta Project', (b) =>
        b.player(bot).number(steps));
      game.log('${0} advanced ${1} row(s) on the Delta Project, reaching ${2}', (b) =>
        b.player(bot).number(steps).string(stageName));

      if (newPos === VP2_POSITION) {
        game.log('${0} claimed the ${1} position on the Delta Project (2 VP at game end)', (b) =>
          b.player(bot).string(stageName));
      } else if (newPos === VP5_POSITION) {
        if (jumpedOverVp2) {
          game.log('${0} leapt past the occupied 2 VP position to reach ${1} on the Delta Project (5 VP at game end)', (b) =>
            b.player(bot).string(stageName));
        } else {
          game.log('${0} claimed the ${1} position on the Delta Project (5 VP at game end)', (b) =>
            b.player(bot).string(stageName));
        }
      } else {
        // Landing on a reward row (1-9): the reward is skipped per the
        // reference card — say so explicitly, never silently.
        game.log('${0} does not receive the Delta Project reward (MarsBot gains only the final VP)', (b) =>
          b.player(bot));
      }
    } finally {
      game.events.endScope();
    }
  }
}
