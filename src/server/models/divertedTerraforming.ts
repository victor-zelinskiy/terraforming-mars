/*
 * THE ONE EXIT PASS OF A REPLACING LAW (Turmoil Redux — RX35 Diverted Research:
 * «each step of oxygen or temperature and each greenery or ocean tile you would
 * gain becomes 1 data»): the forecast twin of `ResolutionPassive.
 * divertTerraforming`, run ONCE at the exit of every preview door (the card
 * play, the blue action, the standard project, the two conversions' option
 * metadata, a colony's build bonus) — never inside a card.
 *
 * What it does to a preview, branch by branch:
 *  1. every PRINTED unit the law takes is STRUCK on its own chip
 *     (`ActionEffect.diverted` — the icon stays, the reader draws the data it
 *     becomes beside it): a scale chip reads its PRINTED steps (decision Р3 —
 *     the ceiling cuts nothing), an ocean / greenery chip its tiles;
 *  2. a tile the preview promised as a PLACEMENT STEP is a unit too: the step
 *     goes (no cell is asked) and a struck tile chip stands for it — unless
 *     the branch already printed the tile as a chip (Water Hauling's «[океан]
 *     · [РТ]»), which then carries the mark alone;
 *  3. a rating RESTATED beside a struck unit (`implied`) goes with it — the
 *     engine pays none; the door's implied-rating pass runs AFTER this one
 *     and states no rating for a struck chip (`impliedRatingOf`);
 *  4. the «WHERE» is pre-collected: ONE card pick for the branch's whole data
 *     (decision Р4), built from the SAME picker the live landing presents
 *     (`divertedDataPicker` — the same candidates, the same marker, the law
 *     as its asker, so the exit pass of addresses stamps it for the batch);
 *     no holder → no step, and every mark reads `lost` instead.
 *
 * The forecast engine reads the marks: a struck chip makes NO grant
 * (`grantOfEffect` — no rating for the Greens, no bonus step, no reactor), a
 * removed step places NO tile (no Mars First steel, no adjacency), and the
 * law's own fact reads the sum off `ctx.diverted` (`resolutionFacts`). The
 * futility reader judges a struck unit by the holders, never the ceiling.
 *
 * READ-ONLY: the picker is built only to be asked for its candidates (as
 * `Executor.canExecute` asks it); nothing is queued, nothing is written.
 */
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {ActionEffect, ActionPreview, ActionPreviewBranch, ActionPreviewStep, DivertedTerraformingMark} from '../../common/models/ActionPreviewModel';
import {ActionFutilityVerdict} from '../../common/models/ActionFutilityModel';
import {CardResource} from '../../common/CardResource';
import {BASE_OCEAN_TILES, TileType} from '../../common/TileType';
import {ResolutionId} from '../../common/parliament/ParliamentTypes';
import * as divertedGate from '../parliament/divertedTerraformingGate';
import {DIVERTED_NO_HOLDER_REASON, divertedDataPicker, divertedSource} from '../parliament/resolutions/DivertedTerraforming';
import {ResolutionDefinition, TerraformingUnit} from '../parliament/resolutions/IResolution';
import {cardResourceIcon, globalGain, globalParameterStepSize, oceanGain, targetVictoryPoints} from '../cards/actionPreviews';
import {TRSource} from '../../common/cards/TRSource';

/** The law that replaces `player`'s terraforming right now — the dispatcher's own gate, read once per door. */
export function divertingLaw(player: IPlayer): ResolutionDefinition | undefined {
  if (!divertedGate.divertsTerraforming(player)) {
    return undefined;
  }
  return player.game.parliament?.enactedDefinition();
}

/** The data every struck chip of `effects` becomes, summed (0 when nothing is struck). */
export function divertedDataOf(effects: ReadonlyArray<ActionEffect>): number {
  return effects.reduce((sum, e) => sum + (e.diverted?.data ?? 0), 0);
}

/** Does a card of the seat's take the diverted data (the played card counted, since it is in the tableau by the landing)? */
export function divertedDataHolder(player: IPlayer, law: ResolutionId, cardBeingPlayed?: ICard): boolean {
  return divertedDataPicker(player, law, 1, cardBeingPlayed).getCards().length > 0;
}

/** What a preview branch reads after the pass: the struck chips, the steps without the tiles plus the «where», the sum. */
export type DivertedPreview = {
  effects: Array<ActionEffect>;
  steps: Array<ActionPreviewStep>;
  data: number;
};

export type TileKind = 'greenery' | 'ocean';

const TILE_ICON: Readonly<Record<TileKind, string>> = {greenery: 'greenery', ocean: 'oceans'};

/** The tile KIND a placement step seats (a greenery, an ocean) — undefined for a city, a colony, a special tile. Shared with the rating veto's pass. */
export function tileKindOfStep(step: ActionPreviewStep): TileKind | undefined {
  if (step.kind !== 'boardPlacement' || step.placementType === 'colony') {
    return undefined;
  }
  if (step.tileType === TileType.GREENERY || (step.tileType === undefined && step.placementType === 'greenery')) {
    return 'greenery';
  }
  if ((step.tileType !== undefined && BASE_OCEAN_TILES.has(step.tileType)) || (step.tileType === undefined && step.placementType === 'ocean')) {
    return 'ocean';
  }
  return undefined;
}

/** The PRINTED units a gain chip stands for under the law — 0 for a chip the law does not touch. */
function unitsOfChip(effect: ActionEffect): number {
  if (effect.direction !== 'gain' || effect.implied === true || effect.diverted !== undefined || effect.amount <= 0) {
    return 0;
  }
  switch (effect.icon) {
  case 'oxygen':
  case 'temperature':
    return Math.max(1, Math.round(effect.amount / globalParameterStepSize(effect.icon)));
  case 'oceans':
  case 'greenery':
    return effect.amount;
  default:
    return 0;
  }
}

/**
 * THE PASS over one branch's chips and steps (the core every door calls):
 * strike, take the tile steps, drop the restated ratings, pre-collect the
 * «where». `effects` and `steps` come back as new arrays; nothing of the
 * input is mutated.
 */
export function divertEffects(
  player: IPlayer,
  effects: ReadonlyArray<ActionEffect>,
  steps: ReadonlyArray<ActionPreviewStep>,
  opts: {cardBeingPlayed?: ICard} = {},
): DivertedPreview {
  const law = divertingLaw(player);
  if (law === undefined) {
    return {effects: [...effects], steps: [...steps], data: 0};
  }
  const holder = divertedDataHolder(player, law.id, opts.cardBeingPlayed);
  const mark = (data: number): DivertedTerraformingMark => ({resolution: law.id, data, ...(holder ? {} : {lost: true as const})});

  // 2. The tile steps are units; the branch keeps everything else in its order.
  const tilesOfSteps: Record<TileKind, number> = {greenery: 0, ocean: 0};
  const keptSteps: Array<ActionPreviewStep> = [];
  for (const step of steps) {
    const kind = tileKindOfStep(step);
    if (kind === undefined) {
      keptSteps.push(step);
      continue;
    }
    tilesOfSteps[kind] += step.kind === 'boardPlacement' ? (step.count ?? 1) : 1;
  }

  // 1 + 3. The chips: struck where the law takes them, a restated rating after a struck chip gone.
  const tilesOfChips: Record<TileKind, number> = {greenery: 0, ocean: 0};
  const struck: Array<ActionEffect> = [];
  let lastStruck = false;
  for (const effect of effects) {
    if (effect.implied === true && effect.icon === 'tr' && lastStruck) {
      continue;
    }
    const units = unitsOfChip(effect);
    if (units === 0) {
      struck.push(effect);
      lastStruck = false;
      continue;
    }
    if (effect.icon === 'oceans') {
      tilesOfChips.ocean += units;
    } else if (effect.icon === 'greenery') {
      tilesOfChips.greenery += units;
    }
    struck.push({...effect, diverted: mark(units)});
    lastStruck = true;
  }
  // …and a struck tile chip for every tile the steps promised beyond what the chips already printed.
  for (const kind of ['ocean', 'greenery'] as const) {
    const remainder = tilesOfSteps[kind] - tilesOfChips[kind];
    if (remainder <= 0) {
      continue;
    }
    const chip: ActionEffect = kind === 'ocean' ?
      {...oceanGain(player, remainder), diverted: mark(remainder)} :
      {direction: 'gain', icon: TILE_ICON.greenery, amount: remainder, diverted: mark(remainder)};
    struck.push(chip);
  }

  const data = divertedDataOf(struck);
  // 4. The «where» — one pick for the branch's whole data, after the branch's own steps (the landing is last).
  if (data > 0 && holder) {
    const picker = divertedDataPicker(player, law.id, data, opts.cardBeingPlayed);
    const model = picker.previewSelectCard();
    if (model !== undefined) {
      keptSteps.push({
        kind: 'input',
        input: model,
        amount: data,
        cardResource: cardResourceIcon(CardResource.DATA),
        vpBox: targetVictoryPoints(player, picker.getCards(), data),
        // THE ADDRESS is the law's, stated here: the step's input model carries no `choiceContext` (the markers are
        // serialized centrally on a LIVE prompt), so the exit pass of addresses would stamp the previewed card as the
        // asker — and the batch's answer would park forever in front of the law's own prompt.
        for: {role: 'card', source: divertedSource(law.id)},
      });
    }
  }
  return {effects: struck, steps: keptSteps, data};
}

/** The pass over a whole preview — every branch (a pre-step is a cost, never a unit). `card` is the card being PLAYED, when it is one. */
export function withDivertedTerraforming(player: IPlayer, preview: ActionPreview, cardBeingPlayed?: ICard): ActionPreview {
  if (divertingLaw(player) === undefined) {
    return preview;
  }
  return {
    ...preview,
    branches: preview.branches.map((branch): ActionPreviewBranch => {
      const passed = divertEffects(player, branch.effects, branch.steps, {cardBeingPlayed});
      return {...branch, effects: passed.effects, steps: passed.steps};
    }),
  };
}

/**
 * THE «NO EFFECT» VERDICT OF A STRUCK UNIT: under the law a step at its ceiling
 * is a yield (it becomes data) — unless no card of the seat's can take the
 * data, which is the one way the replaced unit comes to nothing.
 */
export function divertedFutility(player: IPlayer): ActionFutilityVerdict | undefined {
  const law = divertingLaw(player);
  if (law === undefined) {
    return undefined;
  }
  return divertedDataHolder(player, law.id) ? undefined : {kind: 'no-target', reason: DIVERTED_NO_HOLDER_REASON};
}

/** Does a standard project's `tr` declaration name a unit the law replaces (a raise of oxygen / temperature, an ocean)? Venus is nobody's. */
export function trSourceNamesDivertedUnit(tr: TRSource | undefined): boolean {
  if (tr === undefined) {
    return false;
  }
  return (tr.oxygen ?? 0) > 0 || (tr.temperature ?? 0) > 0 || (tr.oceans ?? 0) > 0;
}

/** The struck chip of ONE unit a door declares without a chip of its own (a standard project's tile — Greenery's). */
export function divertedUnitChip(player: IPlayer, unit: TerraformingUnit): ActionEffect | undefined {
  const law = divertingLaw(player);
  if (law === undefined) {
    return undefined;
  }
  const holder = divertedDataHolder(player, law.id);
  const data = unit.kind === 'parameter' ? unit.steps : unit.count;
  const mark: DivertedTerraformingMark = {resolution: law.id, data, ...(holder ? {} : {lost: true as const})};
  if (unit.kind === 'tile') {
    return unit.tile === 'ocean' ? {...oceanGain(player, unit.count), diverted: mark} :
      {direction: 'gain', icon: TILE_ICON.greenery, amount: unit.count, diverted: mark};
  }
  return {...globalGain(player, unit.parameter, unit.steps), diverted: mark};
}
