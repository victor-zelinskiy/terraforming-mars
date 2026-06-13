import {Color} from '../Color';
import {Units} from '../Units';
import {CardResource} from '../CardResource';
import {GlobalParameter} from '../GlobalParameter';
import {CardName} from '../cards/CardName';
import {GameEvent, GameEventType} from './GameEvent';
import {EventImpact} from './EventImpact';
import {EventSource, sourceKey} from './EventSource';

/**
 * PURE aggregation reducers over the {@link GameEvent} stream. No Vue / DOM /
 * server deps, so the SAME code can produce server-side aggregates (shipped to
 * the client) and run inside the insightEngine if raw events are ever shipped.
 * Deterministic + recomputable → an old save with no stream just yields empty
 * aggregates (graceful degradation).
 */

const UNIT_KEYS: ReadonlyArray<keyof Units> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

// Event types that count as "a use / a firing" of a source (for triggerCount).
const TRIGGER_TYPES: ReadonlyArray<GameEventType> = ['action', 'copied-action', 'effect-triggered', 'discount-applied'];

export type SourceStats = {
  source: EventSource;
  /** How many times this source fired / was used / applied. */
  triggerCount: number;
  stock: Units;
  production: Units;
  cardResources: Partial<Record<CardResource, number>>;
  tr: number;
  cardsDrawn: number;
  globalParameterSteps: Partial<Record<GlobalParameter, number>>;
  megacreditsSaved: number;
  vp: number;
  /** The most recent meaningful contribution — for the "last triggered" line. */
  lastTrigger?: {generation: number; impact: EventImpact};
};

/** True if an impact carries any factual delta (used to find the last meaningful event). */
function hasImpact(i: EventImpact): boolean {
  return i.stock !== undefined || i.production !== undefined || (i.cardResources?.length ?? 0) > 0 ||
    i.tr !== undefined || i.globalParameter !== undefined || i.cardsDrawn !== undefined ||
    i.cardsDiscarded !== undefined || i.vp !== undefined || i.tilesPlaced !== undefined ||
    i.megacreditsSaved !== undefined || i.megacreditsPaid !== undefined;
}

export type PlayerStats = Omit<SourceStats, 'source' | 'triggerCount'> & {
  color: Color;
  megacreditsPaid: number;
  tilesPlaced: number;
};

function emptyUnits(): Units {
  return {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0};
}

function addUnits(into: Units, delta: Partial<Units> | undefined): void {
  if (delta === undefined) {
    return;
  }
  for (const k of UNIT_KEYS) {
    const v = delta[k];
    if (v !== undefined) {
      into[k] += v;
    }
  }
}

function newSourceStats(source: EventSource): SourceStats {
  return {
    source,
    triggerCount: 0,
    stock: emptyUnits(),
    production: emptyUnits(),
    cardResources: {},
    tr: 0,
    cardsDrawn: 0,
    globalParameterSteps: {},
    megacreditsSaved: 0,
    vp: 0,
  };
}

/** Fold one event's factual impact into an accumulator. */
function foldImpact(acc: {
  stock: Units; production: Units; cardResources: Partial<Record<CardResource, number>>;
  tr: number; cardsDrawn: number; globalParameterSteps: Partial<Record<GlobalParameter, number>>;
  megacreditsSaved: number; vp: number;
}, impact: EventImpact): void {
  addUnits(acc.stock, impact.stock);
  addUnits(acc.production, impact.production);
  if (impact.cardResources !== undefined) {
    for (const cr of impact.cardResources) {
      acc.cardResources[cr.cardResource] = (acc.cardResources[cr.cardResource] ?? 0) + cr.amount;
    }
  }
  if (impact.tr !== undefined) {
    acc.tr += impact.tr;
  }
  if (impact.cardsDrawn !== undefined) {
    acc.cardsDrawn += impact.cardsDrawn;
  }
  if (impact.globalParameter !== undefined) {
    const p = impact.globalParameter.parameter;
    acc.globalParameterSteps[p] = (acc.globalParameterSteps[p] ?? 0) + impact.globalParameter.steps;
  }
  if (impact.megacreditsSaved !== undefined) {
    acc.megacreditsSaved += impact.megacreditsSaved;
  }
  if (impact.vp !== undefined) {
    acc.vp += impact.vp;
  }
}

/**
 * Totals per source ("Earth Catapult saved 22 M€ over 12 applications",
 * "Pets gained 8 animals"). Sums the impact of EVERY event carrying that
 * source; triggerCount counts only the trigger-like events so a marker +
 * its granular impact event don't double-count uses.
 */
export function aggregateBySource(events: ReadonlyArray<GameEvent>): Map<string, SourceStats> {
  const result = new Map<string, SourceStats>();
  for (const e of events) {
    if (e.source === undefined) {
      continue;
    }
    const key = sourceKey(e.source);
    let stats = result.get(key);
    if (stats === undefined) {
      stats = newSourceStats(e.source);
      result.set(key, stats);
    }
    foldImpact(stats, e.impact);
    if (hasImpact(e.impact)) {
      stats.lastTrigger = {generation: e.generation, impact: e.impact};
    }
    if (TRIGGER_TYPES.includes(e.type)) {
      stats.triggerCount++;
    }
  }
  return result;
}

/**
 * Corporation impact = direct corp-sourced events PLUS everything that happened
 * inside an action rooted at this corporation (e.g. VIRON copying a card's
 * action — the copied impact is attributed to Viron through the chain root).
 */
export function aggregateCorporationImpact(
  events: ReadonlyArray<GameEvent>,
  corp: CardName,
  owner?: Color): SourceStats {
  const stats = newSourceStats({kind: 'corporation', card: corp, owner});
  const byId = new Map<number, GameEvent>();
  for (const e of events) {
    byId.set(e.id, e);
  }

  const isThisCorp = (s: EventSource | undefined): boolean =>
    s?.kind === 'corporation' && s.card === corp && (owner === undefined || s.owner === undefined || s.owner === owner);

  for (const e of events) {
    const root = byId.get(e.correlationId);
    const direct = isThisCorp(e.source);
    const viaRoot = root !== undefined && root !== e && isThisCorp(root.source);
    if (!direct && !viaRoot) {
      continue;
    }
    foldImpact(stats, e.impact);
    // Count corp uses: roots (action / copied-action) and direct effect triggers.
    if (direct && TRIGGER_TYPES.includes(e.type)) {
      stats.triggerCount++;
    }
  }
  return stats;
}

/** Totals per player (who benefited from what across the whole game). */
export function aggregateByPlayer(events: ReadonlyArray<GameEvent>): Map<Color, PlayerStats> {
  const result = new Map<Color, PlayerStats>();
  for (const e of events) {
    if (e.player === undefined) {
      continue;
    }
    let stats = result.get(e.player);
    if (stats === undefined) {
      stats = {
        color: e.player,
        stock: emptyUnits(), production: emptyUnits(), cardResources: {},
        tr: 0, cardsDrawn: 0, globalParameterSteps: {}, megacreditsSaved: 0, vp: 0,
        megacreditsPaid: 0, tilesPlaced: 0,
      };
      result.set(e.player, stats);
    }
    foldImpact(stats, e.impact);
    if (e.impact.megacreditsPaid !== undefined) {
      stats.megacreditsPaid += e.impact.megacreditsPaid;
    }
    if (e.impact.tilesPlaced !== undefined) {
      stats.tilesPlaced += e.impact.tilesPlaced;
    }
  }
  return result;
}

/** Per-generation source totals — feeds the "engine value over time" timeline. */
export function aggregateByGeneration(events: ReadonlyArray<GameEvent>): Map<number, Map<string, SourceStats>> {
  const byGen = new Map<number, Array<GameEvent>>();
  for (const e of events) {
    const arr = byGen.get(e.generation);
    if (arr === undefined) {
      byGen.set(e.generation, [e]);
    } else {
      arr.push(e);
    }
  }
  const result = new Map<number, Map<string, SourceStats>>();
  for (const [gen, arr] of byGen) {
    result.set(gen, aggregateBySource(arr));
  }
  return result;
}

/**
 * Small per-source projection for the EFFECTS overlay — deliberately tiny
 * (the overlay must NOT pull the raw stream). Built from {@link SourceStats}.
 */
export type EffectOverlayStat = {
  sourceKey: string;
  kind: EventSource['kind'];
  card?: CardName;
  triggerCount: number;
  megacreditsSaved: number;
  cardsDrawn: number;
  stock: Units;
  production: Units;
  cardResources: Partial<Record<CardResource, number>>;
  tr: number;
  globalParameterSteps: Partial<Record<GlobalParameter, number>>;
  vp: number;
  lastTrigger?: {generation: number; impact: EventImpact};
};

export function toEffectOverlayStat(stats: SourceStats): EffectOverlayStat {
  const card = (stats.source.kind === 'card' || stats.source.kind === 'corporation' || stats.source.kind === 'standardProject') ?
    stats.source.card : undefined;
  return {
    sourceKey: sourceKey(stats.source),
    kind: stats.source.kind,
    card,
    triggerCount: stats.triggerCount,
    megacreditsSaved: stats.megacreditsSaved,
    cardsDrawn: stats.cardsDrawn,
    stock: stats.stock,
    production: stats.production,
    cardResources: stats.cardResources,
    tr: stats.tr,
    globalParameterSteps: stats.globalParameterSteps,
    vp: stats.vp,
    lastTrigger: stats.lastTrigger,
  };
}

/**
 * Lightweight per-source stats for the EFFECTS overlay of ONE player — the only
 * thing the overlay needs (NOT the raw stream, NOT endgame analytics). Filters
 * to the cards / corporations the player owns. `lookup(card)` returns the stat
 * by card name for a hover/focus panel.
 */
export function effectOverlayStats(events: ReadonlyArray<GameEvent>, owner: Color): Array<EffectOverlayStat> {
  const result: Array<EffectOverlayStat> = [];
  for (const stats of aggregateBySource(events).values()) {
    const s = stats.source;
    if ((s.kind === 'card' || s.kind === 'corporation') && (s.owner === undefined || s.owner === owner)) {
      result.push(toEffectOverlayStat(stats));
    }
  }
  return result;
}
