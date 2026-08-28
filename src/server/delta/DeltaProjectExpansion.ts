import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {DeltaProjectPlayerModel} from '../../common/models/DeltaProjectPlayerModel';
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '../../common/models/DeltaTrackPreviewModel';
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
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {notEnoughEnergy, ruleReason} from '../cards/actionReasons';

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

  // Records which reward alternative the player took on the most recent landing
  // (a choice stage, positions 1/2). Runs from the deferred reward OrOptions, so
  // the latest stop is the current advance's stop.
  private static recordStopChoice(player: IPlayer, choice: number): void {
    const stops = player.deltaProjectData?.stops;
    if (stops !== undefined && stops.length > 0) {
      stops[stops.length - 1].choice = choice;
    }
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
    // The preview covers the WHOLE remaining track (not just affordable steps) so
    // the player can click any distant stage to study it; energy only gates the
    // stepper bound + the confirm.
    const maxPreviewSteps = Math.max(0, MAX_TRACK_POSITION - currentPos);

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
      const affordable = steps <= energy;
      if (legal && affordable) {
        maxLegalSteps = steps;
      }
      destinations.push({
        steps,
        position,
        legal,
        affordable,
        energyDeficit: Math.max(0, steps - energy),
        occupied,
        jumpedOverVp2,
        requiredTags: tagInfo.requiredTags,
        wildCoveredTags: tagInfo.wildCoveredTags,
        missingTags: tagInfo.missingTags,
      });
    }

    // Eligible targets for the stages whose reward needs a card pick, so the
    // overlay can pre-collect the choice BEFORE confirm (pos 7 reuse-action,
    // pos 9 add-animals). Computed from current state via the same helpers the
    // reward resolution uses, so the lists are authoritative.
    const reuseActionCards = DeltaProjectExpansion.getUsedActionCards(player).map((c) => c.name);
    const animalTargetCards = new AddResourcesToCard(player, CardResource.ANIMAL, {count: 2}).getCards().map((c) => c.name);

    return {
      currentPosition: currentPos,
      availableEnergy: energy,
      usedThisGeneration: progress.usedThisGeneration === true,
      atEndOfTrack: currentPos >= MAX_TRACK_POSITION,
      maxLegalSteps,
      maxEnergySteps: Math.max(0, Math.min(energy, MAX_TRACK_POSITION - currentPos)),
      maxPreviewSteps,
      destinations,
      reuseActionCards,
      animalTargetCards,
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
    const budget = options?.free === true ?
      (options.maxSteps ?? MAX_TRACK_POSITION) :
      Math.min(player.energy, options?.maxSteps ?? MAX_TRACK_POSITION);
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
      // Per-step energy is the STANDARD action's price; a bonus move pays only
      // its own toll (0 for a plain bonus, 1 for a tag waiver).
      player.stock.deduct(Resource.ENERGY, options?.free === true ? energyToll : steps);
      progress.position = newPos;
      // Record the landing for the per-stage history panel (a choice stage's
      // chosen reward is filled in by the deferred OrOptions callback below).
      if (progress.stops === undefined) {
        progress.stops = [];
      }
      progress.stops.push({position: newPos, generation: game.generation});

      game.log('${0} directed ${1} energy into the Hydronetwork, reaching ${2}', (b) =>
        b.player(player).number(steps).string(stageName));

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

      DeltaProjectExpansion.resolveReward(player, newPos, extras?.waiveTargetReward === true);
    } finally {
      game.events.endScope();
    }
  }

  private static resolveReward(player: IPlayer, position: number, waiveTargetReward = false): void {
    // Positions 10/11 (VP spots) have no additional reward beyond VP claiming.
    switch (DELTA_TRACK_TAGS[position]) {
    case Tag.BUILDING: // Choose 2 steel or 2 plants
      // The premium overlay pre-collects this choice in the action-zone (it is
      // batch-submitted with the advance). markChoiceContext is a graceful
      // fallback: if the OrOptions ever surfaces as a standalone prompt (batch
      // divergence / undo), it renders as a premium contextual choice modal
      // sourced to the Delta Project, not a bare option list.
      player.defer(() => new OrOptions(
        new SelectOption('Gain 2 steel', 'Gain steel').andThen(() => {
          player.stock.add(Resource.STEEL, 2, {log: true, from: {card: CardName.DELTA_PROJECT}});
          DeltaProjectExpansion.recordStopChoice(player, 0);
          return undefined;
        }),
        new SelectOption('Gain 2 plants', 'Gain plants').andThen(() => {
          player.stock.add(Resource.PLANTS, 2, {log: true, from: {card: CardName.DELTA_PROJECT}});
          DeltaProjectExpansion.recordStopChoice(player, 1);
          return undefined;
        }),
      ).markChoiceContext(systemChoice('system', 'Choose your Hydronetwork reward', 'effect-choice')));
      break;

    case Tag.POWER: // Choose +1 energy production or +1 heat production
      player.defer(() => new OrOptions(
        new SelectOption('Increase energy production 1 step', 'Increase').andThen(() => {
          player.production.add(Resource.ENERGY, 1, {log: true, from: {card: CardName.DELTA_PROJECT}});
          DeltaProjectExpansion.recordStopChoice(player, 0);
          return undefined;
        }),
        new SelectOption('Increase heat production 1 step', 'Increase').andThen(() => {
          player.production.add(Resource.HEAT, 1, {log: true, from: {card: CardName.DELTA_PROJECT}});
          DeltaProjectExpansion.recordStopChoice(player, 1);
          return undefined;
        }),
      ).markChoiceContext(systemChoice('system', 'Choose your Hydronetwork reward', 'effect-choice')));
      break;

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
      if (actionCards.length > 0) {
        // A CONSCIOUS DECLINE forfeits the reward instead of postponing the
        // question — logged by name (no silent loss), and nothing is deferred,
        // so no follow-up prompt can rise after the move the player already
        // confirmed «without copying».
        if (waiveTargetReward) {
          player.game.log('${0} declined to reuse a card action from the Hydronetwork', (b) => b.player(player));
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
          return card.action(player);
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
      // `cause` = the structural prompt identity (choiceContext) for the
      // fallback path — the console pre-collects the target, but a batch
      // divergence / reconnect must still route this premium, not bare.
      player.game.defer(new AddResourcesToCard(player, CardResource.ANIMAL, {
        count: 2, cause: namedCardSource(CardName.DELTA_PROJECT),
      }));
      break;
    }
  }

  private static getUsedActionCards(player: IPlayer): Array<IActionCard & ICard> {
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
