import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {DeltaProjectPlayerModel} from '../../common/models/DeltaProjectPlayerModel';
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '../../common/models/DeltaTrackPreviewModel';
import {DELTA_STAGE_NAMES} from '../../common/delta/deltaStages';
import {namedCardEffect} from '../inputs/choiceContext';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {Resource} from '../../common/Resource';
import {SelectOption} from '../inputs/SelectOption';
import {SelectCard} from '../inputs/SelectCard';
import {OrOptions} from '../inputs/OrOptions';
import {VictoryPointsBreakdownBuilder} from '../game/VictoryPointsBreakdownBuilder';
import {DrawCards} from '../deferredActions/DrawCards';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {CardResource} from '../../common/CardResource';
import {IActionCard, ICard, isIActionCard, isIHasCheckLoops} from '../cards/ICard';

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
  private static hasOtherPlayerAtPosition(game: IGame, position: number, excludePlayer: IPlayer): boolean {
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
  private static canReachPosition(player: IPlayer, targetPos: number): boolean {
    let missing = 0;
    for (let pos = 1; pos <= Math.min(targetPos, 9); pos++) {
      const tag = DELTA_TRACK_TAGS[pos];
      if (tag !== undefined && player.tags.count(tag, 'raw') === 0) {
        missing++;
      }
    }
    return missing <= player.tags.count(Tag.WILD, 'raw');
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

    return {
      currentPosition: currentPos,
      availableEnergy: energy,
      usedThisGeneration: progress.usedThisGeneration === true,
      atEndOfTrack: currentPos >= MAX_TRACK_POSITION,
      maxLegalSteps,
      maxEnergySteps: Math.max(0, Math.min(energy, MAX_TRACK_POSITION - currentPos)),
      maxPreviewSteps,
      destinations,
    };
  }

  /**
   * Returns the allowed values for `advance(player, steps)` from the current position: each array
   * element is one legal `steps` argument (energy spent equals steps; landing passes tag checks and VP occupancy).
   * For example `[1, 2, 3]` when several jump sizes work, or `[2]` when only a two-step jump ends on a legal space.
   * Returns an empty array when no advance is possible.
   */
  public static getValidAdvanceSteps(player: IPlayer): ReadonlyArray<number> {
    const game = player.game;
    const progress = DeltaProjectExpansion.getProgress(player);
    const currentPos = progress.position;

    if (currentPos >= MAX_TRACK_POSITION) {
      return [];
    }

    const result: number[] = [];
    const maxByEnergy = Math.min(player.energy, MAX_TRACK_POSITION - currentPos);

    for (let steps = 1; steps <= maxByEnergy; steps++) {
      const newPos = currentPos + steps;
      if (newPos > MAX_TRACK_POSITION) {
        break;
      }

      if (!DeltaProjectExpansion.canReachPosition(player, newPos)) {
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
  public static maxSteps(player: IPlayer): number {
    const steps = DeltaProjectExpansion.getValidAdvanceSteps(player);
    return steps.length === 0 ? 0 : Math.max(...steps);
  }

  public static advance(player: IPlayer, steps: number): void {
    const valid = DeltaProjectExpansion.getValidAdvanceSteps(player);
    if (!valid.includes(steps)) {
      throw new Error(`Invalid Delta Project advance: ${String(steps)} step(s) (valid: ${valid.join(', ')})`);
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
      player.stock.deduct(Resource.ENERGY, steps);
      progress.position = newPos;
      // Record the landing for the per-stage history panel (a choice stage's
      // chosen reward is filled in by the deferred OrOptions callback below).
      if (progress.stops === undefined) {
        progress.stops = [];
      }
      progress.stops.push({position: newPos, generation: game.generation});

      game.log('${0} directed ${1} energy into the Delta Project, reaching ${2}', (b) =>
        b.player(player).number(steps).string(stageName));

      if (newPos === VP2_POSITION) {
        game.log('${0} claimed the ${1} position on the Delta Project (2 VP at game end)', (b) =>
          b.player(player).string(stageName));
      } else if (newPos === VP5_POSITION) {
        if (jumpedOverVp2) {
          game.log('${0} leapt past the occupied 2 VP position to reach ${1} on the Delta Project (5 VP at game end)', (b) =>
            b.player(player).string(stageName));
        } else {
          game.log('${0} claimed the ${1} position on the Delta Project (5 VP at game end)', (b) =>
            b.player(player).string(stageName));
        }
      }

      DeltaProjectExpansion.resolveReward(player, newPos);
    } finally {
      game.events.endScope();
    }
  }

  private static resolveReward(player: IPlayer, position: number): void {
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
      ).markChoiceContext(namedCardEffect(CardName.DELTA_PROJECT, false, 'Choose your Delta Project reward', 'effect-choice')));
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
      ).markChoiceContext(namedCardEffect(CardName.DELTA_PROJECT, false, 'Choose your Delta Project reward', 'effect-choice')));
      break;

    case Tag.EARTH: // +2 MC production
      player.production.add(Resource.MEGACREDITS, 2, {log: true, from: {card: CardName.DELTA_PROJECT}});
      break;

    case Tag.SPACE: // +1 titanium production
      player.production.add(Resource.TITANIUM, 1, {log: true, from: {card: CardName.DELTA_PROJECT}});
      break;

    case Tag.SCIENCE: // Look at top 4 cards, take 2, discard rest
      player.game.defer(DrawCards.keepSome(player, 4, {keepMax: 2}));
      break;

    case Tag.PLANT: { // Gain 1 plant per plant tag
      const plantCount = player.tags.count(Tag.PLANT);
      player.stock.add(Resource.PLANTS, plantCount, {log: true, from: {card: CardName.DELTA_PROJECT}});
      break;
    }

    case Tag.MICROBE: { // Reuse a used blue card action
      const actionCards = DeltaProjectExpansion.getUsedActionCards(player);
      if (actionCards.length > 0) {
        player.defer(() => new SelectCard<IActionCard & ICard>(
          'Use a blue card action that has already been used this generation',
          'Take action',
          actionCards,
        ).andThen(([card]) => {
          player.game.log('${0} reused ${1} action via ${2}', (b) => b.player(player).card(card).cardName(CardName.DELTA_PROJECT));
          return card.action(player);
        }));
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
        player.game.log('${0} gained a Jovian tag from the Delta Project', (b) => b.player(player));
      }
      break;
    }

    case Tag.ANIMAL: // Add 2 animals to any card
      player.game.defer(new AddResourcesToCard(player, CardResource.ANIMAL, {count: 2}));
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
      builder.setVictoryPoints('deltaProject', 5, 'Delta Project (5VP)');
    } else if (progress.position === VP2_POSITION) {
      builder.setVictoryPoints('deltaProject', 2, 'Delta Project (2VP)');
    }
  }
}
