/*
 * Pure reward-view builder for the Гидросеть action-zone: turns the target
 * stage + the viewer's current state into "сейчас → станет" delta lines (with
 * the exact computed amount, e.g. plants = current + plant-tag count), or a raw
 * chip + follow-up hint for rewards resolved by a later premium flow.
 *
 * No Vue / DOM / i18n — unit-tested by hydroReward.spec.ts.
 */
import {Resource} from '@/common/Resource';
import {HydroStage, HydroRewardChip} from './hydroStages';

export type HydroPlayerSnapshot = {
  steel: number;
  plants: number;
  titanium: number;
  energy: number;
  heat: number;
  megacredits: number;
  prod: {megacredits: number; steel: number; titanium: number; plants: number; energy: number; heat: number};
  plantTags: number;
  jovianTags: number;
};

/** One "before → after" delta line with the icon to render. */
export type HydroDeltaLine = {
  resource?: Resource; // a standard resource / production icon
  production?: boolean;
  special?: 'jovian-tag' | 'animals'; // a tag / card-resource icon
  /** English i18n key naming what changes, e.g. 'M€ production' / 'Steel'. */
  labelKey?: string;
  before: number;
  after: number;
  delta: number;
  /** Optional context, e.g. the plant-tag count behind a computed amount. */
  noteKey?: string;
  noteValue?: number;
  /** Optional trailing label (e.g. the animal target card name). */
  cardName?: string;
};

export type HydroRewardView = {
  /** Computed delta lines (icon + before→after). */
  lines: ReadonlyArray<HydroDeltaLine>;
  /** Raw chips when there is no concrete delta (a choice not yet made, or a
   *  flow-resolved reward like draw / reuse). */
  rawChips: ReadonlyArray<HydroRewardChip>;
  vp?: number;
  /** Secondary follow-up hint (i18n key) — shown muted, never pushes confirm. */
  followUpKey?: string;
  /** A reward choice (pos 1/2) must be picked before any delta can be shown. */
  needsChoiceFirst: boolean;
};

const FOLLOWUP: Record<string, string> = {
  draw: 'After confirming, a card selection opens',
  reuse: 'After confirming, the chosen action is performed',
  animals: 'After confirming, the chosen card receives the animals',
};

export function buildRewardView(opts: {
  stage: HydroStage | undefined;
  snapshot: HydroPlayerSnapshot;
  rewardChoice: number | undefined;
  /** Current animals on the pre-selected pos-9 target card (undefined = not picked). */
  animalTargetCurrent?: number;
  animalTargetCardName?: string;
}): HydroRewardView {
  const empty: HydroRewardView = {lines: [], rawChips: [], needsChoiceFirst: false};
  const stage = opts.stage;
  if (stage === undefined) {
    return empty;
  }
  const s = opts.snapshot;
  const line = (l: HydroDeltaLine): HydroRewardView => ({lines: [l], rawChips: [], needsChoiceFirst: false});

  switch (stage.position) {
  case 1: // 2 steel OR 2 plants
    if (opts.rewardChoice === undefined) {
      return {lines: [], rawChips: [], needsChoiceFirst: true};
    }
    return opts.rewardChoice === 0 ?
      line({resource: Resource.STEEL, labelKey: 'Steel', before: s.steel, after: s.steel + 2, delta: 2}) :
      line({resource: Resource.PLANTS, labelKey: 'Plants', before: s.plants, after: s.plants + 2, delta: 2});
  case 2: // +1 energy OR +1 heat production
    if (opts.rewardChoice === undefined) {
      return {lines: [], rawChips: [], needsChoiceFirst: true};
    }
    return opts.rewardChoice === 0 ?
      line({resource: Resource.ENERGY, production: true, labelKey: 'Energy production', before: s.prod.energy, after: s.prod.energy + 1, delta: 1}) :
      line({resource: Resource.HEAT, production: true, labelKey: 'Heat production', before: s.prod.heat, after: s.prod.heat + 1, delta: 1});
  case 3: // +2 M€ production
    return line({resource: Resource.MEGACREDITS, production: true, labelKey: 'M€ production', before: s.prod.megacredits, after: s.prod.megacredits + 2, delta: 2});
  case 4: // +1 titanium production
    return line({resource: Resource.TITANIUM, production: true, labelKey: 'Titanium production', before: s.prod.titanium, after: s.prod.titanium + 1, delta: 1});
  case 5: // look at 4, keep 2
    return {lines: [], rawChips: [{special: 'draw-4-keep-2'}], followUpKey: FOLLOWUP.draw, needsChoiceFirst: false};
  case 6: // +1 plant per plant tag — the KEY computed amount
    return {
      lines: [{resource: Resource.PLANTS, labelKey: 'Plants', before: s.plants, after: s.plants + s.plantTags, delta: s.plantTags, noteKey: 'Plant tags', noteValue: s.plantTags}],
      rawChips: [], needsChoiceFirst: false,
    };
  case 7: // reuse a used blue card action
    return {lines: [], rawChips: [{special: 'reuse-blue-action'}], followUpKey: FOLLOWUP.reuse, needsChoiceFirst: false};
  case 8: // +1 Jovian tag
    return line({special: 'jovian-tag', labelKey: 'Jovian tags', before: s.jovianTags, after: s.jovianTags + 1, delta: 1});
  case 9: // add 2 animals to a card
    if (opts.animalTargetCurrent !== undefined) {
      return line({special: 'animals', labelKey: 'Animals on card', before: opts.animalTargetCurrent, after: opts.animalTargetCurrent + 2, delta: 2, cardName: opts.animalTargetCardName});
    }
    return {lines: [], rawChips: [{special: 'add-2-animals'}], followUpKey: FOLLOWUP.animals, needsChoiceFirst: false};
  case 10:
    return {lines: [], rawChips: [], vp: 2, needsChoiceFirst: false};
  case 11:
    return {lines: [], rawChips: [], vp: 5, needsChoiceFirst: false};
  default:
    return empty;
  }
}
