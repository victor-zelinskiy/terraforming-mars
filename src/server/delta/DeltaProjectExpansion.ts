import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {DeltaProjectPlayerModel} from '../../common/models/DeltaProjectPlayerModel';
import {DeltaTrackDestination, DeltaTrackPreviewModel, DeltaTraversalStep} from '../../common/models/DeltaTrackPreviewModel';
import {Priority} from '../deferredActions/Priority';
import {declaredActionCost, deltaAdvancePlanVerdict} from './deltaAdvancePlan';
import {Units} from '../../common/Units';
import {DELTA_STAGE_NAMES} from '../../common/delta/deltaStages';
import {systemChoice} from '../inputs/choiceContext';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {Resource} from '../../common/Resource';
import {SelectOption} from '../inputs/SelectOption';
import {SelectCard} from '../inputs/SelectCard';
import {OrOptions} from '../inputs/OrOptions';
import {VictoryPointsBreakdownBuilder} from '../game/VictoryPointsBreakdownBuilder';
import {DrawCards} from '../deferredActions/DrawCards';
import {namedCardSource} from '../inputs/choiceContext';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {CardResource} from '../../common/CardResource';
import {IActionCard, ICard, isIActionCard, isIHasCheckLoops} from '../cards/ICard';
import {DeltaWorks} from '../cards/delta/DeltaWorks';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {notEnoughEnergy, ruleReason} from '../cards/actionReasons';
import {DeltaStageAnswer} from '../../common/inputs/InputResponse';
import {clearBatchTail, parkBatchTail} from '../inputs/deferredInputBatch';

/**
 * The ordered tags for each track position (1-indexed).
 * Position 0 is the starting position (no tag).
 * Positions 10 and 11 are the 2VP and 5VP spots (no tag requirement).
 */
export const DELTA_TRACK_TAGS: ReadonlyArray<Tag | undefined> = [
  undefined,     // 0: start
  Tag.BUILDING,  // 1
  Tag.POWER,     // 2
  Tag.EARTH,     // 3
  Tag.SPACE,     // 4
  Tag.SCIENCE,   // 5
  Tag.PLANT,     // 6
  Tag.MICROBE,   // 7
  Tag.JOVIAN,    // 8
  Tag.ANIMAL,    // 9
  undefined,     // 10: 2VP
  undefined,     // 11: 5VP
] as const;

export const VP2_POSITION = 10;
export const VP5_POSITION = 11;

export const MAX_TRACK_POSITION = DELTA_TRACK_TAGS.length - 1; // 11 (positions 0–11)

/**
 * THE ONE ENTRY POINT FOR A BONUS ADVANCE.
 *
 * A card may grant a move on the SAME track the standard action moves on
 * (Dynamic Ocean Barrier, on every ocean the owner places). Such a move must be
 * the standard move in every respect that the player can observe — position,
 * destination validation, rewards, choices, the repeat-blue-action pick, the
 * journal scope, the event recorder — and differ ONLY in how it was started and
 * how it is paid for. So it is NOT a second pipeline: it is the same
 * {@link DeltaProjectExpansion.getValidAdvanceSteps} /
 * {@link DeltaProjectExpansion.advance} pair carrying this context.
 *
 * The once-per-generation limit is deliberately NOT a term here: it lives in
 * `Player.getActions`' own option callback (`deltaProjectData.usedThisGeneration`),
 * never inside `advance`, so a move that does not go through that option cannot
 * spend the standard action and cannot be blocked by it having been spent.
 */
export type AdvanceOptions = {
  /**
   * Hard ceiling on the step count, independent of energy (a bonus grants a
   * fixed number of steps — the card says how many, not the player's stock).
   */
  maxSteps?: number;
  /** Energy is not spent per step. */
  free?: boolean;
  /**
   * Cover EXACTLY ONE otherwise-uncoverable required tag for THIS move only.
   * Grants no tag, changes no tableau, never carries to a later move, and can
   * never cover a deficit of two.
   */
  tagWaiver?: boolean;
  /**
   * Energy charged ONCE for the whole move, instead of the standard per-step
   * price. It is the toll of whatever the granting card sells: the tag waiver
   * (Dynamic Ocean Barrier) or the move itself (Storm Surge Barrier, which
   * grants no waiver and always charges 1).
   */
  energyToll?: number;
};

/**
 * THE DP04 CONTEXT — Storm Surge Barrier's «spend 1 energy, advance 1 step».
 *
 * Declared beside its sibling shapes in `BonusDeltaAdvance` so the family is
 * readable in one place: `free` (no per-step price) + `energyToll: 1` (the move
 * costs exactly one energy, always) + NO `tagWaiver` (the card buys a step, not
 * a requirement — a missing path tag blocks it exactly as it blocks the
 * standard action). Nothing here mentions the once-per-generation limit,
 * because that limit is not a term of `advance` at all: it lives in
 * `Player.getActions`' own option callback, which this move never goes through.
 */
export const DP04_ADVANCE: AdvanceOptions = {maxSteps: 1, free: true, energyToll: 1};

export class DeltaProjectExpansion {
  private constructor() {}

  private static getProgress(player: IPlayer): DeltaProjectPlayerModel {
    if (player.deltaProjectData === undefined) {
      throw new Error('No Delta Project progress for player ' + player.color);
    }
    return player.deltaProjectData;
  }

  // Records which reward alternative the player took at a choice stage
  // (positions 1/2). POSITIONAL: only a stop at that very position takes the
  // record — a stage CROSSED under Delta Surge grants the same choice but is
  // not a stop (the marker never stood there), so its answer must not be
  // written onto the destination's history. Positions only ever increase, so
  // at most one stop per position exists. A REWARD-ONLY grant (Dutch
  // Mountains) never calls this at all (`resolveReward`'s `recordStop`):
  // re-claiming a stage the player once stopped on must never rewrite that
  // stop's historical choice.
  private static recordStopChoice(player: IPlayer, position: number, choice: number): void {
    const stop = player.deltaProjectData?.stops?.find((s) => s.position === position);
    if (stop !== undefined) {
      stop.choice = choice;
    }
  }

  /**
   * THE TRAVERSAL MODIFIER — the tableau card whose effect turns crossed
   * stages into paying ones (Delta Surge). Declared per card
   * (`ICard.grantsDeltaTraversalRewards`, co-located in the card file), read
   * ONLY here: the preview and the committed advance both ask this one
   * function, so the promise and the payout cannot diverge. Only the MOVING
   * player's tableau counts.
   */
  public static traversalRewardModifier(player: IPlayer): ICard | undefined {
    for (const card of player.tableau) {
      if (card.grantsDeltaTraversalRewards === true) {
        return card;
      }
    }
    return undefined;
  }

  /**
   * THE ORDERED REWARD PLAN of one advance `fromPosition → toPosition` — one
   * entry per crossed/landed stage, in path order.
   *
   * The DESTINATION always pays (the standard rule). A CROSSED stage pays only
   * under a live traversal modifier, and never the VP stages: their value is
   * POSITIONAL (scored from the final marker position, the slot exclusive), so
   * crossing one grants nothing — the printed «Does not apply to the 2 VP
   * step». The stage definitions themselves are untouched; this is a per-move
   * applicability verdict, never a rewrite of the track.
   */
  public static traversalSteps(player: IPlayer, fromPosition: number, toPosition: number): Array<DeltaTraversalStep> {
    const modifier = DeltaProjectExpansion.traversalRewardModifier(player) !== undefined;
    const steps: Array<DeltaTraversalStep> = [];
    for (let position = fromPosition + 1; position <= toPosition; position++) {
      if (position === toPosition) {
        steps.push({position, rewarded: true});
      } else if (!modifier) {
        steps.push({position, rewarded: false, skipped: 'standing-rule'});
      } else if (position === VP2_POSITION || position === VP5_POSITION) {
        steps.push({position, rewarded: false, skipped: 'vp-step'});
      } else {
        steps.push({position, rewarded: true});
      }
    }
    return steps;
  }

  // True if another player (not `excludePlayer`) occupies this track position.
  // Public: shared with the MarsBot resolution (AutomaDeltaProject) so the VP-slot
  // occupancy semantics can never diverge between the human and the bot.
  public static hasOtherPlayerAtPosition(game: IGame, position: number, excludePlayer: IPlayer): boolean {
    for (const p of game.players) {
      if (p === excludePlayer) {
        continue;
      }
      if (p.deltaProjectData?.position === position) {
        return true;
      }
    }
    return false;
  }

  // Whether the player has enough tags (using wilds to fill gaps) to reach targetPos.
  private static canReachPosition(player: IPlayer, targetPos: number, options?: AdvanceOptions): boolean {
    return DeltaProjectExpansion.missingTagCount(player, targetPos) <= (options?.tagWaiver === true ? 1 : 0);
  }

  /**
   * How many of the path's required tags the player CANNOT cover — raw tags
   * first, then wilds, exactly as the standard rule does. 0 ⇔ the standard
   * movement pipeline already allows the step; 1 ⇔ a single waiver would.
   *
   * The ONE place this arithmetic lives: a card that offers to cover a missing
   * tag asks here rather than re-counting tags of its own (which is how a
   * requirement modifier or a wild would silently stop being honoured).
   */
  public static missingTagCount(player: IPlayer, targetPos: number): number {
    let missing = 0;
    for (let pos = 1; pos <= Math.min(targetPos, 9); pos++) {
      const tag = DELTA_TRACK_TAGS[pos];
      if (tag !== undefined && player.tags.count(tag, 'raw') === 0) {
        missing++;
      }
    }
    return Math.max(0, missing - player.tags.count(Tag.WILD, 'raw'));
  }

  /**
   * WHICH path tags the player cannot cover on the way to `targetPos`, in
   * track order. The list behind {@link DeltaProjectExpansion.missingTagCount}
   * — exposed because a refusal has to NAME the missing tag, and re-deriving
   * that name anywhere else is how the two surfaces that state it would come
   * to state different things.
   */
  public static missingPathTags(player: IPlayer, targetPos: number): ReadonlyArray<Tag> {
    return DeltaProjectExpansion.pathTagAnalysis(player, targetPos).missingTags;
  }

  /**
   * Breaks down the tag requirement for reaching `targetPos`: the full path tags,
   * which lacked tags a wild covers, and which remain uncovered (⇒ illegal). The
   * wild→tag assignment is positional (arbitrary but stable) — only the counts /
   * uncovered set are rule-meaningful; the rest is presentation for the overlay.
   */
  private static pathTagAnalysis(player: IPlayer, targetPos: number): {
    requiredTags: Array<Tag>;
    wildCoveredTags: Array<Tag>;
    missingTags: Array<Tag>;
  } {
    const requiredTags: Array<Tag> = [];
    const lacking: Array<Tag> = [];
    for (let pos = 1; pos <= Math.min(targetPos, 9); pos++) {
      const tag = DELTA_TRACK_TAGS[pos];
      if (tag !== undefined) {
        requiredTags.push(tag);
        if (player.tags.count(tag, 'raw') === 0) {
          lacking.push(tag);
        }
      }
    }
    const wilds = player.tags.count(Tag.WILD, 'raw');
    const covered = Math.min(lacking.length, wilds);
    return {
      requiredTags,
      wildCoveredTags: lacking.slice(0, covered),
      missingTags: lacking.slice(covered),
    };
  }

  /**
   * The viewer's full planning preview (energy / current position / every
   * energy-reachable destination with legality + tag breakdown + VP occupancy).
   * Energy bounds the depth; tags bound legality, not depth. Drives the premium
   * "Гидросеть" overlay action-zone — see {@link DeltaTrackPreviewModel}.
   */
  public static getPreview(player: IPlayer): DeltaTrackPreviewModel {
    const progress = player.deltaProjectData;
    if (progress === undefined) {
      return {
        currentPosition: 0,
        availableEnergy: player.energy,
        availableSteelSubstitute: 0,
        usedThisGeneration: false,
        atEndOfTrack: false,
        maxLegalSteps: 0,
        maxEnergySteps: 0,
        maxPreviewSteps: 0,
        destinations: [],
        reuseActionCards: [],
        animalTargetCards: [],
      };
    }
    const game = player.game;
    const currentPos = progress.position;
    const energy = player.energy;
    // Delta Works: steel pays 1:1 for the STANDARD advance, so the budget the
    // preview grades affordability against is energy + the live substitute.
    const steelSubstitute = DeltaWorks.steelSubstituteAvailable(player);
    const budget = energy + steelSubstitute;
    // The preview covers the WHOLE remaining track (not just affordable steps) so
    // the player can click any distant stage to study it; the budget only gates
    // the stepper bound + the confirm.
    const maxPreviewSteps = Math.max(0, MAX_TRACK_POSITION - currentPos);

    // A live traversal modifier (Delta Surge) turns crossed stages into paying
    // ones — every destination then carries the SERVER's ordered reward plan.
    // Without one the historical payload stays byte-identical (no plan field).
    const traversalModifier = DeltaProjectExpansion.traversalRewardModifier(player);

    const destinations: Array<DeltaTrackDestination> = [];
    let maxLegalSteps = 0;
    for (let steps = 1; steps <= maxPreviewSteps; steps++) {
      const position = currentPos + steps;
      const tagInfo = DeltaProjectExpansion.pathTagAnalysis(player, position);
      const occupied =
        (position === VP2_POSITION || position === VP5_POSITION) &&
        DeltaProjectExpansion.hasOtherPlayerAtPosition(game, position, player);
      const jumpedOverVp2 =
        position === VP5_POSITION &&
        DeltaProjectExpansion.hasOtherPlayerAtPosition(game, VP2_POSITION, player);
      const legal = tagInfo.missingTags.length === 0 && !occupied;
      const affordable = steps <= budget;
      if (legal && affordable) {
        maxLegalSteps = steps;
      }
      destinations.push({
        steps,
        position,
        legal,
        affordable,
        energyDeficit: Math.max(0, steps - budget),
        occupied,
        jumpedOverVp2,
        requiredTags: tagInfo.requiredTags,
        wildCoveredTags: tagInfo.wildCoveredTags,
        missingTags: tagInfo.missingTags,
        ...(traversalModifier !== undefined ?
          {traversal: DeltaProjectExpansion.traversalSteps(player, currentPos, position)} : {}),
      });
    }

    // Eligible targets for the stages whose reward needs a card pick, so the
    // overlay can pre-collect the choice BEFORE confirm (pos 7 reuse-action,
    // pos 9 add-animals). Computed from current state via the same helpers the
    // reward resolution uses, so the lists are authoritative.
    const reuseActionCards = DeltaProjectExpansion.getUsedActionCards(player).map((c) => c.name);
    // …and each candidate's MANDATORY declarative stock cost — the ordered
    // resource plan's per-candidate price, extracted from the card's own
    // data-defined behavior. The client repeats arithmetic over THESE numbers
    // (its plan mirrors the server's `deltaAdvancePlanVerdict`); it never
    // computes a card cost itself.
    const reuseActionCosts: Partial<Record<CardName, Partial<Units>>> = {};
    for (const name of reuseActionCards) {
      const cost = declaredActionCost(player, name);
      if (Object.keys(cost).length > 0) {
        reuseActionCosts[name] = cost;
      }
    }
    const animalTargetCards = new AddResourcesToCard(player, CardResource.ANIMAL, {count: 2}).getCards().map((c) => c.name);

    return {
      currentPosition: currentPos,
      availableEnergy: energy,
      availableSteelSubstitute: steelSubstitute,
      ...(steelSubstitute > 0 ? {steelSubstituteCard: CardName.DELTA_WORKS} : {}),
      usedThisGeneration: progress.usedThisGeneration === true,
      atEndOfTrack: currentPos >= MAX_TRACK_POSITION,
      maxLegalSteps,
      maxEnergySteps: Math.max(0, Math.min(budget, MAX_TRACK_POSITION - currentPos)),
      maxPreviewSteps,
      destinations,
      reuseActionCards,
      ...(Object.keys(reuseActionCosts).length > 0 ? {reuseActionCosts} : {}),
      animalTargetCards,
      ...(traversalModifier !== undefined ? {traversalModifierCard: traversalModifier.name} : {}),
    };
  }

  /**
   * Returns the allowed values for `advance(player, steps)` from the current position: each array
   * element is one legal `steps` argument (energy spent equals steps; landing passes tag checks and VP occupancy).
   * For example `[1, 2, 3]` when several jump sizes work, or `[2]` when only a two-step jump ends on a legal space.
   * Returns an empty array when no advance is possible.
   */
  public static getValidAdvanceSteps(player: IPlayer, options?: AdvanceOptions): ReadonlyArray<number> {
    const game = player.game;
    const progress = DeltaProjectExpansion.getProgress(player);
    const currentPos = progress.position;

    if (currentPos >= MAX_TRACK_POSITION) {
      return [];
    }

    const result: number[] = [];
    // A bonus move is bounded by what the CARD grants, not by the stock: it
    // pays no per-step energy, so the player's energy must not shorten it.
    // The STANDARD advance's budget is energy plus Delta Works's 1:1 steel
    // substitute (the mix itself is validated at commit) — a bonus move's
    // toll stays energy-only, so the substitute never widens it.
    const budget = options?.free === true ?
      (options.maxSteps ?? MAX_TRACK_POSITION) :
      Math.min(player.energy + DeltaWorks.steelSubstituteAvailable(player), options?.maxSteps ?? MAX_TRACK_POSITION);
    const maxByEnergy = Math.min(budget, MAX_TRACK_POSITION - currentPos);

    for (let steps = 1; steps <= maxByEnergy; steps++) {
      const newPos = currentPos + steps;
      if (newPos > MAX_TRACK_POSITION) {
        break;
      }

      if (!DeltaProjectExpansion.canReachPosition(player, newPos, options)) {
        continue;
      }

      if (newPos === VP2_POSITION && DeltaProjectExpansion.hasOtherPlayerAtPosition(game, VP2_POSITION, player)) {
        continue;
      }
      if (newPos === VP5_POSITION && DeltaProjectExpansion.hasOtherPlayerAtPosition(game, VP5_POSITION, player)) {
        continue;
      }
      result.push(steps);
    }
    return result;
  }

  /**
   * WHY A CARD-GRANTED ONE-STEP MOVE IS REFUSED — the ONE answer, shared by
   * every card that grants one.
   *
   * Asked in the SAME order the movement pipeline itself checks, and phrased in
   * the keys the console Hydronetwork screen already uses for its own reasons
   * (`client/components/hydronetwork/hydroReasons.ts`), so a card's disabled
   * variant and the workspace it would open can never say different things.
   *
   * `undefined` ⇔ {@link DeltaProjectExpansion.getValidAdvanceSteps} admits a
   * one-step move under `options` — the two are asked of the same state, so the
   * button and its explanation cannot drift apart.
   *
   * DELIBERATELY NOT the STANDARD action's reason (`DeltaProject`): that one
   * answers a different question. A multi-step advance can be refused at one
   * step and legal at two (an opponent on the 2 VP slot with the 5 VP slot
   * free), so «why can't I move ONE step» is not «why can't I advance».
   */
  public static bonusAdvanceUnavailableReason(player: IPlayer, options?: AdvanceOptions): UnplayableReason | undefined {
    const progress = player.deltaProjectData;
    if (progress === undefined) {
      return ruleReason('Not in this game');
    }
    if (progress.position >= MAX_TRACK_POSITION) {
      return ruleReason('You have reached the end of the Hydronetwork track.');
    }
    // The price of the move: the whole-move toll when the card pays per move,
    // else the standard action's 1 energy per step.
    const owed = options?.free === true ? (options.energyToll ?? 0) : 1;
    if (player.energy < owed) {
      return notEnoughEnergy();
    }
    const next = progress.position + 1;
    if ((next === VP2_POSITION || next === VP5_POSITION) &&
        DeltaProjectExpansion.hasOtherPlayerAtPosition(player.game, next, player)) {
      return ruleReason('This VP position is occupied by another player');
    }
    if (DeltaProjectExpansion.getValidAdvanceSteps(player, options).includes(1)) {
      return undefined;
    }
    // Energy is available and the space is free, so what stops the advance is
    // the tag path — the track's own rule, not an economic shortfall. NAME the
    // tag: «не хватает обязательной метки» tells the player that something is
    // wrong and nothing about what to do about it. The `tag` field is what
    // carries it (structural — the client translates its own name for it),
    // and the `${0}` slot is filled from that same field, never from a param
    // the server would have had to word in its own language.
    const missing = DeltaProjectExpansion.missingPathTags(player, next);
    return {
      type: 'tag',
      message: missing.length > 0 ?
        'Required tag is missing: ${0}' :
        'Required tag is missing — you have none',
      tag: missing[0],
    };
  }

  /**
   * Highest legal step count. Not every integer 1..maxSteps is valid when VP
   * spaces are blocked (use {@link DeltaProjectExpansion.getValidAdvanceSteps} for the full list).
   * Returns 0 when no advance is possible.
   *
   * Constraints:
   * - Must have the required tag (raw, without wilds) for each step, OR use a wild tag.
   * - Each wild tag covers exactly one missing tag.
   * - Must have enough energy (1 per step).
   * - Cannot land on position VP spots if another player already occupies that position.
   * - Cannot move beyond position 11 (5VP).
   */
  public static maxSteps(player: IPlayer, options?: AdvanceOptions): number {
    const steps = DeltaProjectExpansion.getValidAdvanceSteps(player, options);
    return steps.length === 0 ? 0 : Math.max(...steps);
  }

  public static advance(player: IPlayer, steps: number, options?: AdvanceOptions, extras?: {
    /**
     * The player CONSCIOUSLY declined the landed stage's target-bearing reward
     * (pos 7 repeat / pos 9 animals) — carried by the `{deltaProject}` response
     * (`DeltaProjectInput.waiveReward`). The decline is logged BY NAME (no
     * silent loss) and the follow-up SelectCard is never deferred. Ignored for
     * every other landing: only the two target picks are waivable.
     */
    waiveTargetReward?: boolean,
    /**
     * PER-POSITION conscious declines of target-bearing rewards along a
     * traversal (Delta Surge — a path can hold BOTH pos 7 and pos 9, each
     * answered or declined on its own). Same contract as `waiveTargetReward`,
     * which stays the landing-only shorthand: the two compose (union).
     */
    waivedTargetPositions?: ReadonlyArray<number>,
    /**
     * THE DECLARED RESOURCE PLAN: pre-selected repeated actions (and the
     * choice answers whose guaranteed gains fund them), each at its stage.
     * Re-validated as an ORDERED projection BEFORE any mutation
     * (`deltaAdvancePlanVerdict`): a payment mix that starves a declared
     * action at its own point throws atomically — nothing is spent, the
     * marker never moves, the draft comes back editable.
     */
    plannedActions?: ReadonlyArray<{position: number, card: CardName}>,
    plannedChoices?: ReadonlyArray<{position: number, choice: number}>,
    /**
     * THE INVOCATION PLAN — the pre-answered stage asks, by position,
     * CONSUMED by {@link resolveReward} itself (the same closures / deferred
     * actions the prompts would run, so plan and prompt cannot diverge).
     * Validated at consume time against the LIVE candidate lists: a stale
     * entry degrades to that one stage's ordinary prompt, never to a dropped
     * plan. A composed repeat's own nested responses ride along and are
     * parked for the prompts the repeated action raises when it runs.
     */
    answers?: ReadonlyArray<DeltaStageAnswer>,
    /**
     * The STANDARD advance's chosen payment mix (Delta Works: 1 steel = 1
     * energy). Must total `steps`; steel > 0 requires the card in the tableau.
     * Absent = the energy-first default (energy, then steel for the deficit
     * only). Ignored for `free` bonus contexts — their toll is energy-only.
     */
    payment?: {energy: number, steel: number},
  }): void {
    // Re-validated against the SAME option set the offer was computed with —
    // the authoritative check happens HERE, at commit, never at prompt time.
    const valid = DeltaProjectExpansion.getValidAdvanceSteps(player, options);
    if (!valid.includes(steps)) {
      throw new Error(`Invalid Delta Project advance: ${String(steps)} step(s) (valid: ${valid.join(', ')})`);
    }
    // The toll is the waiver's price and is charged ONCE for the whole move.
    // Checked before anything mutates, so an unaffordable toll cannot leave a
    // half-applied move behind.
    const energyToll = options?.energyToll ?? 0;
    if (energyToll > player.energy) {
      throw new Error(`Not enough energy for the Delta Project toll: ${String(energyToll)}`);
    }
    // The actual {energy, steel} the move is paid with — fully validated HERE,
    // before any mutation, so a stale/impossible mix rejects atomically.
    const payment = DeltaProjectExpansion.resolveAdvancePayment(player, steps, options, extras?.payment);

    // THE ORDERED PROJECTED RESOURCE PLAN — the declared pre-selected actions
    // must be executable AT THEIR OWN POINTS of the sequence (after this very
    // payment and every earlier guaranteed gain, before later ones). Checked
    // BEFORE any mutation: a plan the payment starves refuses atomically,
    // with nothing spent and the marker unmoved — a promise the pre-select's
    // green tick made is either kept or refused out loud, never half-run.
    if (extras?.plannedActions !== undefined && extras.plannedActions.length > 0) {
      const choices: Record<number, number> = {};
      for (const c of extras.plannedChoices ?? []) {
        choices[c.position] = c.choice;
      }
      const fromPosition = DeltaProjectExpansion.getProgress(player).position;
      const verdict = deltaAdvancePlanVerdict(player, {
        fromPosition,
        toPosition: fromPosition + steps,
        payment,
        choices,
        actions: extras.plannedActions,
      });
      if (!verdict.feasible) {
        const c = verdict.conflicts[0];
        throw new Error(
          `The planned action ${c.card} cannot be executed at stage ${String(c.position)}: ` +
          (c.reason === 'resources' ? `not enough ${String(c.resource)} at that point` : 'no longer eligible'));
      }
    }

    const game = player.game;
    const progress = DeltaProjectExpansion.getProgress(player);
    const currentPos = progress.position;
    const newPos = currentPos + steps;
    const jumpedOverVp2 =
      newPos === VP5_POSITION &&
      DeltaProjectExpansion.hasOtherPlayerAtPosition(game, VP2_POSITION, player);
    const stageName = DELTA_STAGE_NAMES[newPos] ?? '';

    // Root the whole advance (energy spend + reward + any deferred follow-ups) in
    // a journal action scope so it becomes ONE grouped root event (correlationId +
    // category 'delta-project') — picked up by the premium journal AND surfaced by
    // the notification layer as a distinct "Гидросеть" card. The deferred rewards
    // (steel/plants, draw, reuse, animals) capture this scope at defer-time, so
    // their result logs stay in the same group.
    game.events.beginAction(player, {kind: 'card', card: CardName.DELTA_PROJECT, owner: player.color}, {category: 'delta-project'});
    try {
      // The STANDARD action's per-step price, in the player's chosen mix of
      // energy and Delta Works steel; a bonus move pays only its own toll
      // (0 for a plain bonus, 1 for a tag waiver — always energy).
      player.stock.deduct(Resource.ENERGY, payment.energy);
      if (payment.steel > 0) {
        // The substitution is Delta Works's effect — source the steel spend to
        // the card so the journal/event stream names the modifier.
        player.stock.deduct(Resource.STEEL, payment.steel, {log: false, from: {card: CardName.DELTA_WORKS}});
      }
      progress.position = newPos;
      // Record the landing for the per-stage history panel (a choice stage's
      // chosen reward is filled in by the deferred OrOptions callback below).
      if (progress.stops === undefined) {
        progress.stops = [];
      }
      progress.stops.push({position: newPos, generation: game.generation});

      // The log names the ACTUAL mix spent — never «N energy» over steel.
      if (payment.steel === 0) {
        game.log('${0} directed ${1} energy into the Hydronetwork, reaching ${2}', (b) =>
          b.player(player).number(steps).string(stageName));
      } else if (payment.energy === 0) {
        game.log('${0} directed ${1} steel into the Hydronetwork, reaching ${2}', (b) =>
          b.player(player).number(payment.steel).string(stageName));
      } else {
        game.log('${0} directed ${1} energy and ${2} steel into the Hydronetwork, reaching ${3}', (b) =>
          b.player(player).number(payment.energy).number(payment.steel).string(stageName));
      }

      if (newPos === VP2_POSITION) {
        game.log('${0} claimed the ${1} position on the Hydronetwork (2 VP at game end)', (b) =>
          b.player(player).string(stageName));
      } else if (newPos === VP5_POSITION) {
        if (jumpedOverVp2) {
          game.log('${0} leapt past the occupied 2 VP position to reach ${1} on the Hydronetwork (5 VP at game end)', (b) =>
            b.player(player).string(stageName));
        } else {
          game.log('${0} claimed the ${1} position on the Hydronetwork (5 VP at game end)', (b) =>
            b.player(player).string(stageName));
        }
      }

      // ONE committed advance = ONE semantic movement event for the mover's own
      // passive cards (Development Manager listens for `steps >= 2`). Fired
      // after the position is committed and BEFORE the landing reward resolves,
      // so a movement-triggered gain always precedes a reward-triggered one
      // (the pos-3 reward is itself a +2 M€-production change) — the journal
      // order mirrors the real resolution order. Mirrors the dispatch shape of
      // `Production.add` (tableau of the affected player only, wrapped in a
      // lazy effect scope so an inert hook records nothing).
      for (const card of player.tableau) {
        if (card.onDeltaTrackAdvance === undefined) {
          continue;
        }
        game.events.withEffect(player, card, 'delta-advance',
          () => card.onDeltaTrackAdvance?.(player, steps));
      }

      // THE ORDERED REWARD RESOLUTION — the one plan builder the preview also
      // reads. The waives compose: the legacy landing-only flag plus the
      // per-position set a traversal batch carries.
      const traversal = DeltaProjectExpansion.traversalSteps(player, currentPos, newPos);
      const rewarded = traversal.filter((s) => s.rewarded);
      const waived = new Set<number>(extras?.waivedTargetPositions ?? []);
      if (extras?.waiveTargetReward === true) {
        waived.add(newPos);
      }
      // The modifier's own journal voice — stated for the MOVE, not per branch:
      // the activation when crossed stages actually pay, and the printed 2 VP
      // exclusion whenever that stage is crossed under it (a 9 → 11 leap pays
      // nothing extra, but the omission still may not be silent).
      const modifier = DeltaProjectExpansion.traversalRewardModifier(player);
      if (modifier !== undefined && steps > 1) {
        if (rewarded.some((s) => s.position !== newPos)) {
          game.log('${0} grants the reward of every stage crossed on the Hydronetwork', (b) => b.card(modifier));
        }
        if (traversal.some((s) => s.skipped === 'vp-step')) {
          game.log('${0} crossed the 2 VP stage — its reward is claimed only by stopping there', (b) => b.player(player));
        }
      }
      const answersByPos = new Map<number, DeltaStageAnswer>();
      for (const a of extras?.answers ?? []) {
        answersByPos.set(a.position, a);
      }
      if (rewarded.length <= 1) {
        // The historical shape — only the destination pays. Resolved inline,
        // byte- and order-identical to every advance before Delta Surge.
        DeltaProjectExpansion.resolveReward(player, newPos, waived.has(newPos), answersByPos.get(newPos));
      } else {
        // DELTA SURGE: every crossed stage pays, IN PATH ORDER. Each stage
        // rides its own deferred step at BACK_OF_THE_LINE: anything a stage's
        // own resolution defers (a reward OrOptions, the stage-5 draw, the
        // repeated blue action and every input IT raises) queues at a nearer
        // priority and therefore fully resolves before the next stage's step
        // executes — strict path order without re-implementing a single
        // reward. The steps capture the live journal scope at defer time, so
        // the whole payout stays one grouped delta-project event.
        //
        // `repeatParkStanding` scopes the stage-boundary cleanup to what THIS
        // advance parked: a CONSUMED repeat whose prompt auto-resolved (a
        // single candidate) leaves its nested answer as a stray of the same
        // `card` shape, and the NEXT stage's own runtime ask must never be
        // able to swallow it. By the next step the previous chain has fully
        // resolved (its prompts queue nearer than BACK_OF_THE_LINE), so a
        // still-standing park of ours is moot by construction. A LEGACY
        // stream tail (parked by replayBatch behind the stage-5 hidden draw)
        // is deliberately untouched — it still owes its own prompts.
        let repeatParkStanding = false;
        for (const step of rewarded) {
          const position = step.position;
          player.defer(() => {
            if (repeatParkStanding) {
              clearBatchTail(player);
            }
            // A CROSSED STAGE THAT PAYS IS HISTORY TOO. The stop list was the
            // only record of «what happened at this stage», and it held nothing
            // but landings — so under the modifier the track marked every stage
            // it had just paid the player for as «Прошёл мимо — без награды».
            // Recorded on the same terms a landing is: the reward path was
            // TAKEN (a fizzle for want of a candidate names itself in the log
            // and reads the same way at a landing, so the two stay consistent);
            // a stage the player consciously WAIVED records nothing, because
            // there the «no reward» reading is the true one.
            if (position !== newPos && !waived.has(position)) {
              if (progress.stops === undefined) {
                progress.stops = [];
              }
              if (!progress.stops.some((s) => s.position === position)) {
                progress.stops.push({position, generation: game.generation, crossed: true});
              }
            }
            repeatParkStanding = DeltaProjectExpansion.resolveReward(
              player, position, waived.has(position), answersByPos.get(position));
            return undefined;
          }, Priority.BACK_OF_THE_LINE);
        }
      }
    } finally {
      game.events.endScope();
    }
  }

  /**
   * THE STAGES A REWARD-ONLY GRANT MAY CLAIM (Dutch Mountains): every stage
   * the player's marker has REACHED (their current stage and every stage
   * behind it), excluding — semantically, never by number literals or
   * localized names —
   *  - the START and both VP TERMINALS (`DELTA_TRACK_TAGS[p] === undefined`:
   *    a cell with no path tag has no stage reward — its value is positional),
   *  - the JOVIAN stage (its reward is a one-shot tag grant, printed as
   *    claimable only by standing there).
   * Track-configuration-driven: a future track re-shape moves this list with
   * it. The ORDER is path order (the selection surface walks it).
   */
  public static rewardClaimableStages(player: IPlayer): Array<number> {
    // No module data (mixed-deck edge) → nothing claimable, never a throw:
    // callers include availability hooks that run for every card.
    const position = player.deltaProjectData?.position ?? 0;
    const out: Array<number> = [];
    for (let p = 1; p <= Math.min(position, MAX_TRACK_POSITION); p++) {
      const tag = DELTA_TRACK_TAGS[p];
      if (tag === undefined || tag === Tag.JOVIAN) {
        continue;
      }
      out.push(p);
    }
    return out;
  }

  /**
   * THE REWARD-ONLY ENTRY POINT: grant ONE stage's ordinary reward to the
   * player WITHOUT any movement — the marker does not move, the position does
   * not change, no stop is recorded, no movement requirement or price is
   * re-checked, the generation's own advance is untouched, and no terminal
   * VP/ceremony can be reached (the claimable filter excludes those stages
   * semantically). The reward itself is THE resolver every arrival uses
   * (`resolveReward`) — same resources, same prompts, same declared-answer
   * consumption (`DeltaStageAnswer`, the invocation-plan contract), same
   * journal grammar — so a granted reward and a landed reward cannot diverge.
   *
   * `source` names the card whose effect opened the door (the log's causal
   * chain); eligibility is re-validated HERE, at commit, against the live
   * position — a crafted/stale position throws before anything mutates.
   */
  public static grantStageReward(player: IPlayer, position: number, opts: {
    source: CardName,
    answer?: DeltaStageAnswer,
  }): void {
    if (!DeltaProjectExpansion.rewardClaimableStages(player).includes(position)) {
      throw new Error(`Stage ${String(position)} is not claimable for a Hydronetwork reward grant`);
    }
    const stageName = DELTA_STAGE_NAMES[position] ?? '';
    player.game.log('${0} claimed the ${1} stage reward of the Hydronetwork via ${2}', (b) =>
      b.player(player).string(stageName).cardName(opts.source));
    DeltaProjectExpansion.resolveReward(player, position, false, opts.answer, false);
  }

  /**
   * The actual {energy, steel} mix ONE advance is paid with — validated in
   * full BEFORE any mutation. Steel substitutes energy 1:1 ONLY for the
   * STANDARD per-step price and ONLY while Delta Works is in the tableau; a
   * `free` bonus context (DP03's bonus step, DP04's card action) pays its
   * energy toll and nothing else, whatever mix was requested. Exact-total by
   * construction: an under- or over-payment is a thrown error, never a clamp.
   * With no requested mix (legacy wire shape / DP01) the default is
   * energy-first — steel covers ONLY the deficit, never silently more.
   */
  private static resolveAdvancePayment(
    player: IPlayer,
    steps: number,
    options: AdvanceOptions | undefined,
    requested: {energy: number, steel: number} | undefined,
  ): {energy: number, steel: number} {
    if (options?.free === true) {
      return {energy: options.energyToll ?? 0, steel: 0};
    }
    const substitute = DeltaWorks.steelSubstituteAvailable(player);
    if (requested !== undefined) {
      const {energy, steel} = requested;
      if (!Number.isInteger(energy) || !Number.isInteger(steel) || energy < 0 || steel < 0) {
        throw new Error('Invalid Hydronetwork payment: amounts must be non-negative integers');
      }
      if (energy + steel !== steps) {
        throw new Error(`Invalid Hydronetwork payment: ${String(energy)} energy + ${String(steel)} steel does not equal ${String(steps)} step(s)`);
      }
      if (steel > 0 && substitute === 0) {
        throw new Error('Steel cannot pay for Hydronetwork steps without Delta Works');
      }
      if (steel > substitute) {
        throw new Error('Not enough steel for the Hydronetwork advance');
      }
      if (energy > player.energy) {
        throw new Error('Not enough energy for the Hydronetwork advance');
      }
      return requested;
    }
    const steel = Math.min(Math.max(0, steps - player.energy), substitute);
    const energy = steps - steel;
    if (energy > player.energy) {
      throw new Error('Not enough energy for the Hydronetwork advance');
    }
    return {energy, steel};
  }

  /**
   * RUN A COPIED CARD ACTION inside the copied-action scope.
   *
   * ONE entry point for both doors (the declared pre-select and the runtime
   * pick), so the journal marker and — load-bearing — the scope that attributes
   * every prompt the copy raises cannot depend on which door was used.
   */
  private static runCopied(player: IPlayer, card: IActionCard & ICard) {
    const events = player.game.events;
    if (events === undefined) {
      // No recorder: the copy still runs. Attribution degrades, rules do not.
      return card.action(player);
    }
    // ⚠️ DEFER INSIDE THE SCOPE, never RETURN out of it.
    //
    // `withCopiedAction` closes its scope the moment `fn` returns, and the queue
    // sets the returned input as `waitingFor` AFTER that — so a copy that hands
    // its prompt back up produces a prompt raised outside its own scope, and the
    // attribution is lost for the very first thing the copy asks. Deferring
    // INSIDE captures the scope onto the deferred action (`DeferredActionsQueue`
    // snapshots it at push time), the queue restores it around the run, and
    // `setWaitingFor` therefore sees it — including for every prompt the copy
    // raises LATER, since the captured context rides `waitingForContext` across
    // each input boundary.
    // ⚠️ THE COPIER HERE IS NOT A CARD IN THE TABLEAU. The Hydronetwork is a
    // GLOBAL SUBSYSTEM action — the module's own card is never played — so
    // looking it up in `player.tableau` found nothing, the scope was skipped and
    // every prompt the copy raised went out unattributed. `withCopiedActionFrom`
    // takes the source directly, which is what this door actually has.
    events.withCopiedActionFrom(
      player,
      {kind: 'card', card: CardName.DELTA_PROJECT, owner: player.color},
      card,
      () => {
        player.defer(card.action(player));
      });
    return undefined;
  }

  /** @returns whether this stage PARKED a consumed repeat's nested responses —
   *  the traversal's stage-boundary cleanup drops what is still standing of
   *  them (an auto-resolved prompt's stray) before the next stage resolves.
   *  `recordStop` is false for a REWARD-ONLY grant (the marker never stood
   *  there — nothing may be written onto the stop history). */
  private static resolveReward(player: IPlayer, position: number, waiveTargetReward = false, answer?: DeltaStageAnswer, recordStop = true): boolean {
    let parkedRepeat = false;
    // Positions 10/11 (VP spots) have no additional reward beyond VP claiming.
    switch (DELTA_TRACK_TAGS[position]) {
    case Tag.BUILDING: { // Choose 2 steel or 2 plants
      // ONE effect per alternative, run by the prompt's own option AND by a
      // consumed pre-answer — the same closure, so plan and prompt cannot
      // diverge (never a second implementation of the reward).
      const gainBuilding = (choice: 0 | 1): void => {
        player.stock.add(choice === 0 ? Resource.STEEL : Resource.PLANTS, 2,
          {log: true, from: {card: CardName.DELTA_PROJECT}});
        if (recordStop) {
          DeltaProjectExpansion.recordStopChoice(player, position, choice);
        }
      };
      // THE DECLARED ANSWER consumes the ask server-side (validated: the
      // choice is structural, 0/1). Anything else falls to the prompt.
      if (answer?.rewardChoice === 0 || answer?.rewardChoice === 1) {
        gainBuilding(answer.rewardChoice);
        break;
      }
      // The premium overlay pre-collects this choice in the action-zone (it is
      // batch-submitted with the advance). markChoiceContext is a graceful
      // fallback: if the OrOptions ever surfaces as a standalone prompt (batch
      // divergence / undo), it renders as a premium contextual choice modal
      // sourced to the Delta Project, not a bare option list.
      player.defer(() => new OrOptions(
        new SelectOption('Gain 2 steel', 'Gain steel').andThen(() => {
          gainBuilding(0);
          return undefined;
        }),
        new SelectOption('Gain 2 plants', 'Gain plants').andThen(() => {
          gainBuilding(1);
          return undefined;
        }),
      ).markChoiceContext(systemChoice('system', 'Choose your Hydronetwork reward', 'effect-choice')));
      break;
    }

    case Tag.POWER: { // Choose +1 energy production or +1 heat production
      const gainPower = (choice: 0 | 1): void => {
        player.production.add(choice === 0 ? Resource.ENERGY : Resource.HEAT, 1,
          {log: true, from: {card: CardName.DELTA_PROJECT}});
        if (recordStop) {
          DeltaProjectExpansion.recordStopChoice(player, position, choice);
        }
      };
      if (answer?.rewardChoice === 0 || answer?.rewardChoice === 1) {
        gainPower(answer.rewardChoice);
        break;
      }
      player.defer(() => new OrOptions(
        new SelectOption('Increase energy production 1 step', 'Increase').andThen(() => {
          gainPower(0);
          return undefined;
        }),
        new SelectOption('Increase heat production 1 step', 'Increase').andThen(() => {
          gainPower(1);
          return undefined;
        }),
      ).markChoiceContext(systemChoice('system', 'Choose your Hydronetwork reward', 'effect-choice')));
      break;
    }

    case Tag.EARTH: // +2 MC production
      player.production.add(Resource.MEGACREDITS, 2, {log: true, from: {card: CardName.DELTA_PROJECT}});
      break;

    case Tag.SPACE: // +1 titanium production
      player.production.add(Resource.TITANIUM, 1, {log: true, from: {card: CardName.DELTA_PROJECT}});
      break;

    case Tag.SCIENCE: // Look at top 4 cards, take 2, discard rest
      player.game.defer(DrawCards.keepSome(player, 4, {
        keepMax: 2, promptSource: namedCardSource(CardName.DELTA_PROJECT),
      }));
      break;

    case Tag.PLANT: { // Gain 1 plant per plant tag
      const plantCount = player.tags.count(Tag.PLANT);
      player.stock.add(Resource.PLANTS, plantCount, {log: true, from: {card: CardName.DELTA_PROJECT}});
      break;
    }

    case Tag.MICROBE: { // Reuse a used blue card action
      const actionCards = DeltaProjectExpansion.getUsedActionCards(player);
      if (actionCards.length === 0) {
        // NO SILENT LOSS: the reward fizzling for want of a candidate is a
        // named omission, never a quiet nothing — the resolution continues.
        player.game.log('${0} had no usable action to repeat — the Hydronetwork reward is skipped', (b) => b.player(player));
        break;
      }
      {
        // A CONSCIOUS DECLINE forfeits the reward instead of postponing the
        // question — logged by name (no silent loss), and nothing is deferred,
        // so no follow-up prompt can rise after the move the player already
        // confirmed «without copying».
        if (waiveTargetReward) {
          player.game.log('${0} declined to reuse a card action from the Hydronetwork', (b) => b.player(player));
          break;
        }
        // THE DECLARED ANSWER consumes the pick server-side, against the SAME
        // eligibility filter the prompt would offer — a stale card degrades to
        // the ordinary prompt below (the runtime follow-up, served embedded).
        // The action then runs through the REAL pipeline (`card.action`), and
        // its composed nested responses are PARKED for the prompts it raises
        // — the same drain a direct activation's batch rides, so an ask the
        // plan could not know (hidden information, a runtime-only follow-up)
        // still surfaces as its own prompt.
        const planned = answer?.selectedCard !== undefined ?
          actionCards.find((c) => c.name === answer.selectedCard) :
          undefined;
        if (planned !== undefined) {
          player.game.log('${0} reused ${1} action via ${2}', (b) => b.player(player).card(planned).cardName(CardName.DELTA_PROJECT));
          if (answer?.repeatResponses !== undefined && answer.repeatResponses.length > 0) {
            parkBatchTail(player, answer.repeatResponses);
            parkedRepeat = true;
          }
          // THROUGH THE COPIED-ACTION SCOPE, like every other copier.
          //
          // «Проверка проекта», Viron and Robotic Workforce all run their copy
          // inside `withCopiedAction`; this one did not, and that was not only a
          // journal inconsistency. The scope is what the deferred queue captures
          // and restores, so it is what `Player.setWaitingFor` reads to stamp
          // `copiedActionSource` on EVERY prompt the copied action raises — the
          // one thing that lets the console tell «this prompt belongs to stage 7»
          // without any card marking itself. Without it a repeated action whose
          // follow-up is a PROMPT (a colony trade, a target pick) was invisible
          // to the stage gate and could open its screen mid-walk.
          player.defer(() => DeltaProjectExpansion.runCopied(player, planned));
          break;
        }
        // The console pre-collects this pick (batch-submitted with the
        // advance). markChoiceContext is the STRUCTURAL identity for the
        // fallback path (batch divergence / reconnect): the client must
        // never route this prompt by its translatable title.
        player.defer(() => new SelectCard<IActionCard & ICard>(
          'Use a blue card action that has already been used this generation',
          'Take action',
          actionCards,
        ).andThen(([card]) => {
          player.game.log('${0} reused ${1} action via ${2}', (b) => b.player(player).card(card).cardName(CardName.DELTA_PROJECT));
          // The RUNTIME pick reaches the same runner as the declared one — a
          // copy is a copy whichever door chose the card.
          return DeltaProjectExpansion.runCopied(player, card);
        }).markChoiceContext(systemChoice('system', 'Use a blue card action that has already been used this generation', 'effect-choice')));
      }
      break;
    }

    case Tag.JOVIAN: { // Gain one Jovian tag
      const progress = DeltaProjectExpansion.getProgress(player);
      if (!progress.jovianBonus) {
        progress.jovianBonus = true;
        player.tags.extraJovianTags++;
        player.triggerOnNonCardTagAdded(Tag.JOVIAN);
        for (const p of player.game.playersInGenerationOrder) {
          for (const card of p.tableau) {
            card.onNonCardTagAddedByAnyPlayer?.(p, Tag.JOVIAN);
          }
        }
        player.game.log('${0} gained a Jovian tag from the Hydronetwork', (b) => b.player(player));
      }
      break;
    }

    case Tag.ANIMAL: // Add 2 animals to any card
      // A CONSCIOUS DECLINE — same contract as the pos-7 waive: named in the
      // log only when there was actually something to decline (an empty pool
      // is the ordinary fizzle, already stated by the client), and nothing is
      // deferred, so no target prompt follows the confirmed move.
      if (waiveTargetReward) {
        if (new AddResourcesToCard(player, CardResource.ANIMAL, {count: 2}).getCards().length > 0) {
          player.game.log('${0} declined to add animals from the Hydronetwork', (b) => b.player(player));
        }
        break;
      }
      // THE DECLARED TARGET consumes the ask through the SAME deferred action
      // the prompt path runs, narrowed to the pre-answered card (the FIXED-
      // target `filter` exemption: the player already saw the target and its
      // «сейчас → станет» at pre-select). Validated against the LIVE
      // eligibility first — a stale target degrades to the ordinary prompt
      // with only the actual candidates.
      if (answer?.selectedCard !== undefined) {
        const target = answer.selectedCard;
        const eligible = new AddResourcesToCard(player, CardResource.ANIMAL, {count: 2})
          .getCards().some((c) => c.name === target);
        if (eligible) {
          player.game.defer(new AddResourcesToCard(player, CardResource.ANIMAL, {
            count: 2, filter: (c) => c.name === target,
            cause: namedCardSource(CardName.DELTA_PROJECT),
          }));
          break;
        }
      }
      // `cause` = the structural prompt identity (choiceContext) for the
      // fallback path — the console pre-collects the target, but a batch
      // divergence / reconnect must still route this premium, not bare.
      player.game.defer(new AddResourcesToCard(player, CardResource.ANIMAL, {
        count: 2, cause: namedCardSource(CardName.DELTA_PROJECT),
      }));
      break;
    }
    return parkedRepeat;
  }

  // Public: the projected-plan dry run (`deltaAdvancePlan.ts`) asks THIS very
  // filter under a stock overlay, so pre-select feasibility and the reward's
  // own candidate list can never use two different eligibility rules.
  public static getUsedActionCards(player: IPlayer): Array<IActionCard & ICard> {
    const result: Array<IActionCard & ICard> = [];
    for (const playedCard of player.tableau) {
      if (!isIActionCard(playedCard)) {
        continue;
      }
      if (isIHasCheckLoops(playedCard) && playedCard.getCheckLoops() >= 2) {
        continue;
      }
      if (player.actionsThisGeneration.has(playedCard.name) && playedCard.canAct(player)) {
        result.push(playedCard);
      }
    }
    return result;
  }

  public static calculateVictoryPoints(player: IPlayer, builder: VictoryPointsBreakdownBuilder): void {
    const progress = player.deltaProjectData;
    if (progress === undefined) {
      return;
    }

    // The player scores ONLY their current final position (never 2+5): leaving
    // slot 10 for slot 11 frees slot 10 for others. Routed to the dedicated
    // `deltaProject` category so the score report shows it under "Достижения и
    // награды" rather than the generic card-VP bucket.
    if (progress.position === VP5_POSITION) {
      builder.setVictoryPoints('deltaProject', 5, 'Hydronetwork (5 VP)');
    } else if (progress.position === VP2_POSITION) {
      builder.setVictoryPoints('deltaProject', 2, 'Hydronetwork (2 VP)');
    }
  }
}
