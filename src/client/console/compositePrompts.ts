/*
 * The three prompts the console used to hand back to the DESKTOP modal.
 *
 * `consoleTaskRouter`'s own red list named them for months: `composite` (the
 * Venus alt-track bonus and Stormcraft's spend-heat — both IN SCOPE, both with
 * a premium desktop modal and no console-native one) and `aresGlobal`. On a TV
 * they broke the shell's whole language: a mouse-shaped dialog, no pad contract,
 * no workspace band, no source.
 *
 * This module is the PURE half of their console surfaces: it turns each server
 * model into lanes / rows the shared engines already understand
 * (`budgetLanes.ts`), and back into the byte-identical response. No Vue, no DOM,
 * no i18n — English i18n KEYS out — so every rule here is unit-tested under the
 * fast server runner rather than through three mounted components.
 */

import {Units} from '@/common/Units';
import {
  AndOptionsModel,
  OrOptionsModel,
  PlayerInputModel,
  SelectAmountModel,
  ShiftAresGlobalParametersModel,
  VenusBonusPromptMeta,
} from '@/common/models/PlayerInputModel';
import {AresGlobalParametersResponse} from '@/common/inputs/AresGlobalParametersResponse';
import {CardName} from '@/common/cards/CardName';
import {HazardData} from '@/common/ares/AresData';
// The ONE icon-class resolver (standard resources / global parameters / card
// resources). Hardcoding a class here is how the floater lane and all four
// threshold rows first shipped with EMPTY icon frames.
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {BudgetLane, BudgetState, laneValue} from '@/client/console/budgetLanes';
import {amountResponse, andResponse, cardsResponse, orWrappedResponse, STANDARD_UNITS} from '@/client/console/taskResponses';

/* ── STANDARD-RESOURCE LANES (shared builders) ──────────────────────────── */

const LANE_LABELS: Record<string, string> = {
  megacredits: 'M€', steel: 'Steel', titanium: 'Titanium',
  plants: 'Plants', energy: 'Energy', heat: 'Heat',
};

/**
 * The six standard-resource lanes of a GAIN. Every lane is worth 1 of the
 * budget and is capped by the budget itself, NOT by the player's stock: this is
 * a gain, and a cap borrowed from what you already own would read as a limit
 * that isn't one — the `SelectResources` distribute surface shipped exactly
 * that bug (six lanes capped by the very stock they were about to increase, so
 * an empty pool read «0 / 0» and refused its share of the reward). The stock
 * still rides along as `available`, because "M€ 44 → 46" is the whole point of
 * choosing where the bonus goes.
 *
 * Two prompts speak these lanes: the Venus alt-track bonus (`AndOptions` of
 * `SelectAmount` on the wire) and the `SelectResources` distribute prompt
 * (Philares, the behavior DSL's `standardResource` — served by the task host).
 */
export function standardGainLanes(count: number, stock: Partial<Record<keyof Units, number>>): Array<BudgetLane> {
  return STANDARD_UNITS.map((unit) => ({
    key: unit,
    iconClass: iconClassFor(unit),
    label: LANE_LABELS[unit],
    weight: 1,
    max: count,
    available: stock[unit] ?? 0,
  }));
}

/**
 * The reducible lanes of a production LOSS (`SelectProductionToLose`, reaching
 * the task host only NESTED inside a choice wizard — the top-level prompt has
 * its own surface). Here the per-lane cap IS a rule: the server's own
 * `payProduction.units` say how far each production can fall.
 */
export function productionLossLanes(units: Units): Array<BudgetLane> {
  return STANDARD_UNITS
    .filter((u) => units[u] > 0)
    .map((u) => ({
      key: u,
      iconClass: iconClassFor(u),
      label: LANE_LABELS[u],
      weight: 1,
      max: units[u],
    }));
}

/* ── VENUS ALT-TRACK BONUS ──────────────────────────────────────────────── */

/** The Venus bonus places its budget over the same six gain lanes. */
export function venusBonusLanes(count: number, stock: Partial<Record<keyof Units, number>>): Array<BudgetLane> {
  return standardGainLanes(count, stock);
}

/**
 * The FINAL-step (30 %) bonus offers one WILD resource on top of the base: put
 * it on a card, or take one more standard resource. The server models that as a
 * single top-level `OrOptions` (branch 0 = card + base, branch 1 = base + 1), so
 * the surface must decide the branch BEFORE the distribution — and the base
 * count changes with it.
 */
export type VenusWildChoice = 'onCard' | 'asStandard';

/** How many standard resources the distribution places, given the wild choice. */
export function venusBaseCount(meta: VenusBonusPromptMeta, wild: VenusWildChoice | undefined): number {
  if (meta.kind === 'standard') {
    return meta.baseCount;
  }
  return wild === 'asStandard' ? meta.baseCount + 1 : meta.baseCount;
}

/** Cards eligible to host the wild resource. Empty ⇒ the branch is impossible
 *  and must be shown DISABLED with a reason, never silently dropped. */
export function venusWildTargets(meta: VenusBonusPromptMeta): ReadonlyArray<CardName> {
  return meta.wildCardTargets ?? [];
}

/**
 * The response.
 *
 * `standard` → the bare `GainResources` (an `and` of six amounts, in
 * `STANDARD_UNITS` order — the order `GainResources.makeOptions` builds).
 * `final` → the same `and`, wrapped as the chosen OR branch; branch 0 also
 * carries the card pick as its first child.
 *
 * Byte-identical to what the desktop VenusBonusContent POSTs — the two are
 * guarded against each other by `compositePrompts.spec.ts`.
 */
export function venusBonusResponse(
  meta: VenusBonusPromptMeta,
  state: BudgetState,
  wild: VenusWildChoice | undefined,
  wildCard: CardName | undefined,
): unknown {
  const amounts = andResponse(STANDARD_UNITS.map((unit) => amountResponse(laneValue(state, unit))));
  if (meta.kind === 'standard') {
    return amounts;
  }
  if (wild === 'onCard') {
    // Branch 0: AndOptions(SelectCard wild-on-card, GainResources(base)).
    return orWrappedResponse(0, andResponse([
      cardsResponse(wildCard === undefined ? [] : [wildCard]),
      amounts,
    ]));
  }
  // Branch 1: GainResources(base + 1) — the wild folded in as a standard.
  return orWrappedResponse(1, amounts);
}

/* ── STORMCRAFT: SPEND HEAT ─────────────────────────────────────────────── */

/**
 * Two lanes, and the whole reason this prompt is not a plain amount: stock heat
 * pays 1 each, a Stormcraft floater pays 2. The caps come from the SERVER's own
 * `SelectAmount.max` (it already applied `min(player.heat, target)` and
 * `min(floaters, ceil(target/2))`), so the surface can never offer a step the
 * server would reject.
 */
export function spendHeatLanes(prompt: AndOptionsModel): Array<BudgetLane> {
  const amounts = prompt.options.filter((o): o is SelectAmountModel => o.type === 'amount');
  const heat = amounts[0];
  const floaters = amounts[1];
  const lanes: Array<BudgetLane> = [];
  if (heat !== undefined) {
    lanes.push({
      key: 'heat',
      iconClass: iconClassFor('heat'),
      label: 'Heat',
      weight: 1,
      max: heat.max,
      available: heat.max,
    });
  }
  if (floaters !== undefined) {
    lanes.push({
      key: 'floaters',
      // `--floaters`, plural: the icon set names card resources in the plural
      // (a `--floater` class silently renders an empty frame).
      iconClass: 'resource_icon resource_icon--floaters',
      label: 'Floaters',
      weight: 2,
      max: floaters.max,
      available: floaters.max,
      noteKey: 'Each floater pays 2 heat',
    });
  }
  return lanes;
}

/** The `and` of the two amounts, in the server's own option order. */
export function spendHeatResponse(lanes: ReadonlyArray<BudgetLane>, state: BudgetState): unknown {
  return andResponse(lanes.map((lane) => amountResponse(laneValue(state, lane.key))));
}

/* ── ARES: SHIFT THE PLANETARY EVENT THRESHOLDS ─────────────────────────── */

export type AresDeltaKey = keyof AresGlobalParametersResponse;
export type AresDelta = -1 | 0 | 1;

export interface AresThresholdRow {
  key: AresDeltaKey;
  iconClass: string;
  /** English i18n key — DIEGETIC, never "Ares" (the UI is expansion-neutral). */
  label: string;
  /** What crossing this threshold does, so the row is not a bare number. */
  effectKey: string;
  unit: string;
  threshold: number;
  /** °C moves 2 per step; oceans and oxygen move 1. */
  stepSize: number;
}

/**
 * One row per threshold that has NOT fired yet. A fired threshold is not a
 * choice the player has — it is history — so it is absent rather than disabled.
 * Order and step sizes mirror the desktop premium widget exactly, because the
 * response sends all four deltas regardless of which rows are shown.
 */
export function aresThresholdRows(model: ShiftAresGlobalParametersModel): Array<AresThresholdRow> {
  const h: HazardData = model.aresData.hazardData;
  const rows: Array<AresThresholdRow> = [];
  if (h.erosionOceanCount.available) {
    rows.push({
      key: 'lowOceanDelta', iconClass: iconClassFor('ocean'), label: 'Erosions appear',
      effectKey: 'Erosion tiles are placed on Mars', unit: '', threshold: h.erosionOceanCount.threshold, stepSize: 1,
    });
  }
  if (h.removeDustStormsOceanCount.available) {
    rows.push({
      key: 'highOceanDelta', iconClass: iconClassFor('ocean'), label: 'Dust storms recede',
      effectKey: 'Dust storm tiles are removed', unit: '', threshold: h.removeDustStormsOceanCount.threshold, stepSize: 1,
    });
  }
  if (h.severeErosionTemperature.available) {
    rows.push({
      key: 'temperatureDelta', iconClass: iconClassFor('temperature'), label: 'Erosions intensify',
      effectKey: 'Erosion tiles become severe', unit: '°C', threshold: h.severeErosionTemperature.threshold, stepSize: 2,
    });
  }
  if (h.severeDustStormOxygen.available) {
    rows.push({
      key: 'oxygenDelta', iconClass: iconClassFor('oxygen'), label: 'Dust storms intensify',
      effectKey: 'Dust storm tiles become severe', unit: '%', threshold: h.severeDustStormOxygen.threshold, stepSize: 1,
    });
  }
  return rows;
}

export function aresResulting(row: AresThresholdRow, delta: AresDelta): number {
  return row.threshold + delta * row.stepSize;
}

/** All four deltas — a hidden row always sends 0, exactly like the desktop. */
export function aresResponse(deltas: Partial<Record<AresDeltaKey, AresDelta>>): unknown {
  return {
    type: 'aresGlobalParameters' as const,
    response: {
      lowOceanDelta: deltas.lowOceanDelta ?? 0,
      highOceanDelta: deltas.highOceanDelta ?? 0,
      temperatureDelta: deltas.temperatureDelta ?? 0,
      oxygenDelta: deltas.oxygenDelta ?? 0,
    },
  };
}

/* ── ROUTING HELPERS (shared by the router and the shell) ───────────────── */

/** The Venus bonus marker on a prompt, whichever shape it took (`and` for the
 *  base bonus, `or` for the final one). */
export function venusBonusMeta(wf: PlayerInputModel | undefined): VenusBonusPromptMeta | undefined {
  return wf?.venusBonusPrompt;
}

/**
 * The `GainResources` (an `and` of six amounts) inside the Venus prompt for the
 * given wild choice. For `standard` the prompt IS that `and`; for `final` it is
 * nested one or two levels down, and WHICH one depends on the branch — so the
 * caller passes the choice rather than the surface guessing.
 */
export function venusAmountsPrompt(
  wf: PlayerInputModel | undefined,
  meta: VenusBonusPromptMeta,
  wild: VenusWildChoice | undefined,
): AndOptionsModel | undefined {
  if (wf === undefined) {
    return undefined;
  }
  if (meta.kind === 'standard') {
    return wf.type === 'and' ? wf : undefined;
  }
  if (wf.type !== 'or') {
    return undefined;
  }
  const or = wf as OrOptionsModel;
  if (wild === 'onCard') {
    const branch = or.options[0];
    if (branch?.type !== 'and') {
      return undefined;
    }
    const inner = (branch as AndOptionsModel).options.find((o) => o.type === 'and');
    return inner as AndOptionsModel | undefined;
  }
  const branch = or.options[1];
  return branch?.type === 'and' ? (branch as AndOptionsModel) : undefined;
}
