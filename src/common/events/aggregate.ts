import {Color} from '../Color';
import {Units} from '../Units';
import {CardResource} from '../CardResource';
import {GlobalParameter} from '../GlobalParameter';
import {CardName} from '../cards/CardName';
import {ColonyName} from '../colonies/ColonyName';
import {GameEvent, GameEventType, JournalActionCategory} from './GameEvent';
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

/**
 * Steel/Titanium spent UNDER a payment-value modifier + the EXACT extra M€ it
 * gave (Advanced Alloys / Rego Plastics / PhoboLog …). `count` = how many payments
 * the modifier touched (one per payment-bonus event).
 */
export type PaymentValueBonusStats = {steel: number; titanium: number; bonusValue: number; count: number};

/**
 * Colony-track steps a trade-offset effect (Trading Colony) advanced + the EXACT
 * extra trade-reward units the bumps produced, broken down per colony. `count` =
 * how many trades the effect boosted.
 */
export type ColonyTrackStats = {steps: number; extraReward: number; count: number; colonies: Partial<Record<ColonyName, number>>};

/**
 * Trade resources a trade-discount effect (Cryo-Sleep / Rim Freighters) saved —
 * per resource (energy/titanium/M€) and per colony. `count` = trades discounted.
 */
export type TradeDiscountStats = {energy: number; titanium: number; megacredits: number; count: number; colonies: Partial<Record<ColonyName, number>>};

export type SourceStats = {
  source: EventSource;
  /** How many times this source fired / was used / applied. */
  triggerCount: number;
  stock: Units;
  production: Units;
  cardResources: Partial<Record<CardResource, number>>;
  /** Card resources SPENT as payment (Psychrophiles microbes, Carbon Nanosystems
   *  graphene, …) — kept separate from `cardResources` (accumulation). */
  paymentResources: Partial<Record<CardResource, number>>;
  /** Steel/Titanium value-modifier savings (Advanced Alloys, …). */
  paymentValueBonus: PaymentValueBonusStats;
  /** Colony-track advances from a trade-offset effect (Trading Colony). */
  colonyTrack: ColonyTrackStats;
  /** Trade resources saved by a trade-discount effect (Cryo-Sleep, …). */
  tradeDiscount: TradeDiscountStats;
  tr: number;
  cardsDrawn: number;
  globalParameterSteps: Partial<Record<GlobalParameter, number>>;
  megacreditsSaved: number;
  vp: number;
  /** The most recent meaningful contribution — for the "last triggered" line. */
  lastTrigger?: {generation: number; impact: EventImpact};
};

function emptyPaymentValueBonus(): PaymentValueBonusStats {
  return {steel: 0, titanium: 0, bonusValue: 0, count: 0};
}

function emptyColonyTrack(): ColonyTrackStats {
  return {steps: 0, extraReward: 0, count: 0, colonies: {}};
}

function emptyTradeDiscount(): TradeDiscountStats {
  return {energy: 0, titanium: 0, megacredits: 0, count: 0, colonies: {}};
}

/** True if an impact carries any factual delta (used to find the last meaningful event). */
function hasImpact(i: EventImpact): boolean {
  return i.stock !== undefined || i.production !== undefined || (i.cardResources?.length ?? 0) > 0 ||
    i.tr !== undefined || i.globalParameter !== undefined || i.cardsDrawn !== undefined ||
    i.cardsDiscarded !== undefined || i.vp !== undefined || i.tilesPlaced !== undefined ||
    i.megacreditsSaved !== undefined || i.megacreditsPaid !== undefined ||
    (i.cardResourcesSpentAsPayment?.length ?? 0) > 0 ||
    (i.paymentValueBonus?.length ?? 0) > 0 || (i.colonyTrackAdvanced?.length ?? 0) > 0 ||
    (i.tradeDiscountSaved?.length ?? 0) > 0;
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
    paymentResources: {},
    paymentValueBonus: emptyPaymentValueBonus(),
    colonyTrack: emptyColonyTrack(),
    tradeDiscount: emptyTradeDiscount(),
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
  paymentResources: Partial<Record<CardResource, number>>;
  paymentValueBonus: PaymentValueBonusStats; colonyTrack: ColonyTrackStats; tradeDiscount: TradeDiscountStats;
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
  if (impact.cardResourcesSpentAsPayment !== undefined) {
    for (const cr of impact.cardResourcesSpentAsPayment) {
      acc.paymentResources[cr.cardResource] = (acc.paymentResources[cr.cardResource] ?? 0) + cr.amount;
    }
  }
  if (impact.paymentValueBonus !== undefined) {
    for (const pb of impact.paymentValueBonus) {
      acc.paymentValueBonus[pb.resource] += pb.amountSpent;
      acc.paymentValueBonus.bonusValue += pb.bonusValue;
    }
    // One payment-bonus event = one payment the modifier touched.
    acc.paymentValueBonus.count += 1;
  }
  if (impact.colonyTrackAdvanced !== undefined) {
    for (const ct of impact.colonyTrackAdvanced) {
      acc.colonyTrack.steps += ct.steps;
      acc.colonyTrack.extraReward += ct.extraReward;
      acc.colonyTrack.colonies[ct.colony] = (acc.colonyTrack.colonies[ct.colony] ?? 0) + ct.steps;
    }
    acc.colonyTrack.count += 1;
  }
  if (impact.tradeDiscountSaved !== undefined) {
    for (const td of impact.tradeDiscountSaved) {
      acc.tradeDiscount[td.resource] += td.amount;
      acc.tradeDiscount.colonies[td.colony] = (acc.tradeDiscount.colonies[td.colony] ?? 0) + td.amount;
    }
    acc.tradeDiscount.count += 1;
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
        stock: emptyUnits(), production: emptyUnits(), cardResources: {}, paymentResources: {},
        paymentValueBonus: emptyPaymentValueBonus(), colonyTrack: emptyColonyTrack(), tradeDiscount: emptyTradeDiscount(),
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

function groupByGeneration(events: ReadonlyArray<GameEvent>): Map<number, Array<GameEvent>> {
  const byGen = new Map<number, Array<GameEvent>>();
  for (const e of events) {
    const arr = byGen.get(e.generation);
    if (arr === undefined) {
      byGen.set(e.generation, [e]);
    } else {
      arr.push(e);
    }
  }
  return byGen;
}

/** Per-generation source totals — feeds the "engine value over time" timeline. */
export function aggregateByGeneration(events: ReadonlyArray<GameEvent>): Map<number, Map<string, SourceStats>> {
  const result = new Map<number, Map<string, SourceStats>>();
  for (const [gen, arr] of groupByGeneration(events)) {
    result.set(gen, aggregateBySource(arr));
  }
  return result;
}

/**
 * Per-player, per-generation totals — the analysis-ready TIMELINE for "when did
 * the economy / terraforming / engine kick in". `result.get(color).get(gen)` is the
 * {@link PlayerStats} for that player IN that generation (so a consumer can plot
 * discounts / params / draws / attacks over time). Derived purely from the stream.
 */
export function aggregateByPlayerGeneration(events: ReadonlyArray<GameEvent>): Map<Color, Map<number, PlayerStats>> {
  const result = new Map<Color, Map<number, PlayerStats>>();
  for (const [gen, arr] of groupByGeneration(events)) {
    for (const [color, stats] of aggregateByPlayer(arr)) {
      let perGen = result.get(color);
      if (perGen === undefined) {
        perGen = new Map<number, PlayerStats>();
        result.set(color, perGen);
      }
      perGen.set(gen, stats);
    }
  }
  return result;
}

/**
 * One player's RESOURCE LOSSES to another player's action — the victim breakdown.
 * `totalLost` is the summed magnitude of every negative delta; `resources` is the
 * per-resource breakdown (standard resource / production / card-resource keys), in
 * POSITIVE units lost. `hits` = how many loss events that victim suffered.
 */
export type VictimRecord = {
  color: Color;
  hits: number;
  totalLost: number;
  resources: Record<string, number>;
};

/** Positive magnitudes of every NEGATIVE delta in an impact (a loss), keyed by
 *  resource / production / card-resource. */
function negativeLosses(impact: EventImpact): {resources: Record<string, number>; total: number} {
  const resources: Record<string, number> = {};
  let total = 0;
  const add = (key: string, lost: number) => {
    if (lost > 0) {
      resources[key] = (resources[key] ?? 0) + lost;
      total += lost;
    }
  };
  for (const k of UNIT_KEYS) {
    const sv = impact.stock?.[k];
    if (sv !== undefined && sv < 0) {
      add(k, -sv);
    }
    const pv = impact.production?.[k];
    if (pv !== undefined && pv < 0) {
      add(k, -pv);
    }
  }
  for (const cr of impact.cardResources ?? []) {
    if (cr.amount < 0) {
      add(cr.cardResource, -cr.amount);
    }
  }
  return {resources, total};
}

/**
 * Per-action VICTIM breakdown — for every action-category root owned by `attacker`,
 * the OTHER players who LOST resources inside that action's chain (a destroy / steal /
 * production reduction). Derived from the same structured loss events the negative
 * notifications read (an event with `player !== attacker` + a negative impact under the
 * attacker's action correlationId) — never from text, never a parallel system. Keyed by
 * the action's `sourceKey`. Closes the Iteration-2 "actions lose victim/target" gap.
 */
export function actionVictimBreakdown(events: ReadonlyArray<GameEvent>, attacker: Color): Map<string, Array<VictimRecord>> {
  const byId = new Map<number, GameEvent>();
  for (const e of events) {
    byId.set(e.id, e);
  }
  const isAttackerActionRoot = (e: GameEvent | undefined): boolean =>
    e !== undefined && e.category !== undefined && ACTION_CATEGORIES.includes(e.category) &&
    (e.source?.kind === 'card' || e.source?.kind === 'corporation') && e.source.owner === attacker;

  const bySource = new Map<string, Map<Color, VictimRecord>>();
  for (const e of events) {
    const root = byId.get(e.correlationId);
    if (!isAttackerActionRoot(root) || root === undefined || root.source === undefined) {
      continue;
    }
    if (e.player === undefined || e.player === attacker) {
      continue; // only OTHER players' events can be a victim loss
    }
    const losses = negativeLosses(e.impact);
    if (losses.total === 0) {
      continue;
    }
    const key = sourceKey(root.source);
    let victims = bySource.get(key);
    if (victims === undefined) {
      victims = new Map<Color, VictimRecord>();
      bySource.set(key, victims);
    }
    let record = victims.get(e.player);
    if (record === undefined) {
      record = {color: e.player, hits: 0, totalLost: 0, resources: {}};
      victims.set(e.player, record);
    }
    record.hits += 1;
    record.totalLost += losses.total;
    for (const [k, v] of Object.entries(losses.resources)) {
      record.resources[k] = (record.resources[k] ?? 0) + v;
    }
  }
  const result = new Map<string, Array<VictimRecord>>();
  for (const [key, victims] of bySource) {
    result.set(key, [...victims.values()].sort((a, b) => b.totalLost - a.totalLost));
  }
  return result;
}

/**
 * The attacker behind a victim-LOSS event (`e.player` = the victim) — the recipient
 * (steal / transfer, via `target.player`) or the source card's owner (destroy /
 * reduction). `undefined` ⇒ not a cross-player attack (a cost / global event / the
 * player's own spend). Mirrors the notification model's `attackerOf`, generalised to
 * any viewer so the fact engine can attribute attacks across the whole game.
 */
export function eventAttacker(e: GameEvent): Color | undefined {
  if (e.target?.player !== undefined && e.target.player !== e.player) {
    return e.target.player;
  }
  const s = e.source;
  if ((s?.kind === 'card' || s?.kind === 'corporation') && s.owner !== undefined && s.owner !== e.player) {
    return s.owner;
  }
  return undefined;
}

/**
 * Whole-game attack ledger: which opponents EACH player made lose resources (from a
 * card PLAY or a blue ACTION), with the per-victim loss breakdown. Built from the same
 * structured loss events as the negative notifications. Feeds the negative-interaction
 * facts ("Nastya pressured Victor through plant attacks ×3").
 */
export function aggregateAttacks(events: ReadonlyArray<GameEvent>): Map<Color, Array<VictimRecord>> {
  const byAttacker = new Map<Color, Map<Color, VictimRecord>>();
  for (const e of events) {
    if (e.player === undefined) {
      continue;
    }
    const losses = negativeLosses(e.impact);
    if (losses.total === 0) {
      continue;
    }
    const attacker = eventAttacker(e);
    if (attacker === undefined) {
      continue; // a cost / global event / the player's own spend — not an attack
    }
    let victims = byAttacker.get(attacker);
    if (victims === undefined) {
      victims = new Map<Color, VictimRecord>();
      byAttacker.set(attacker, victims);
    }
    let record = victims.get(e.player);
    if (record === undefined) {
      record = {color: e.player, hits: 0, totalLost: 0, resources: {}};
      victims.set(e.player, record);
    }
    record.hits += 1;
    record.totalLost += losses.total;
    for (const [k, v] of Object.entries(losses.resources)) {
      record.resources[k] = (record.resources[k] ?? 0) + v;
    }
  }
  const result = new Map<Color, Array<VictimRecord>>();
  for (const [attacker, victims] of byAttacker) {
    result.set(attacker, [...victims.values()].sort((a, b) => b.totalLost - a.totalLost));
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
  /** Card resources SPENT as payment (kept separate from accumulation). */
  paymentResources: Partial<Record<CardResource, number>>;
  /** Steel/Titanium value-modifier savings (Advanced Alloys, …). */
  paymentValueBonus: PaymentValueBonusStats;
  /** Colony-track advances from a trade-offset effect (Trading Colony). */
  colonyTrack: ColonyTrackStats;
  /** Trade resources saved by a trade-discount effect (Cryo-Sleep, …). */
  tradeDiscount: TradeDiscountStats;
  tr: number;
  globalParameterSteps: Partial<Record<GlobalParameter, number>>;
  vp: number;
  lastTrigger?: {generation: number; impact: EventImpact};
  /** For an ACTION stat: the opponents this action made LOSE resources (attacks).
   *  Only populated by `actionOverlayStats`; absent for effects. */
  victims?: ReadonlyArray<VictimRecord>;
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
    paymentResources: stats.paymentResources,
    paymentValueBonus: stats.paymentValueBonus,
    colonyTrack: stats.colonyTrack,
    tradeDiscount: stats.tradeDiscount,
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
// The root-action categories that represent an ACTIVATABLE blue-card / corp / CEO
// action (as opposed to a card PLAY, a standard project, a milestone/award, …).
const ACTION_CATEGORIES: ReadonlyArray<JournalActionCategory> =
  ['card-action', 'corporation-action', 'ceo-action', 'copied-action'];

/**
 * Per-source ACTIVE-ACTION stats — "what each blue-card / corp / CEO ACTION
 * accomplished this game", told apart from the card's on-PLAY gains by the root
 * event's {@link JournalActionCategory}. For every action-category root owned by
 * `owner`, folds the action's OWN output (events sourced to the action card, or
 * sourceless events inheriting the action scope) into that card's stats; nested
 * OTHER-card passive effects the action happened to trigger stay attributed to
 * their own card (the effects overlay), not double-counted as the action's output.
 * `triggerCount` = how many times the action was activated.
 */
export function actionStatsBySource(events: ReadonlyArray<GameEvent>, owner?: Color): Map<string, SourceStats> {
  const byId = new Map<number, GameEvent>();
  for (const e of events) {
    byId.set(e.id, e);
  }
  const isActionRoot = (e: GameEvent | undefined): boolean =>
    e !== undefined && e.category !== undefined && ACTION_CATEGORIES.includes(e.category) &&
    (e.source?.kind === 'card' || e.source?.kind === 'corporation') &&
    (owner === undefined || e.source.owner === undefined || e.source.owner === owner);

  const result = new Map<string, SourceStats>();
  for (const e of events) {
    const root = byId.get(e.correlationId);
    if (!isActionRoot(root) || root === undefined || root.source === undefined) {
      continue;
    }
    const key = sourceKey(root.source);
    let stats = result.get(key);
    if (stats === undefined) {
      stats = newSourceStats(root.source);
      result.set(key, stats);
    }
    // Count an activation on the root event itself.
    if (e === root) {
      stats.triggerCount++;
    }
    // Only the action's OWN output — its source card, or a sourceless event that
    // inherited the action scope. A nested effect of ANOTHER card is not this
    // action's output (it's that card's effect, shown in the effects overlay).
    const ownOutput = e.source === undefined || sourceKey(e.source) === key;
    if (!ownOutput) {
      continue;
    }
    foldImpact(stats, e.impact);
    if (hasImpact(e.impact)) {
      stats.lastTrigger = {generation: e.generation, impact: e.impact};
    }
  }
  return result;
}

/**
 * Lightweight per-source ACTION stats for ONE player's owned cards — the action
 * twin of {@link effectOverlayStats}, feeding the Actions overlay's "this game"
 * usage summary + the endgame analyzer's "which blue cards were the engine".
 */
export function actionOverlayStats(events: ReadonlyArray<GameEvent>, owner: Color): Array<EffectOverlayStat> {
  const victims = actionVictimBreakdown(events, owner);
  const result: Array<EffectOverlayStat> = [];
  for (const stats of actionStatsBySource(events, owner).values()) {
    const s = stats.source;
    if ((s.kind === 'card' || s.kind === 'corporation') && (s.owner === undefined || s.owner === owner)) {
      const stat = toEffectOverlayStat(stats);
      const v = victims.get(stat.sourceKey);
      if (v !== undefined && v.length > 0) {
        stat.victims = v;
      }
      result.push(stat);
    }
  }
  return result;
}

export function effectOverlayStats(events: ReadonlyArray<GameEvent>, owner: Color): Array<EffectOverlayStat> {
  // The overlay shows ONLY what a card's PASSIVE EFFECTS did — NOT the card's
  // immediate on-play `behavior` gains (those run under an 'action' scope and are
  // untagged). Passive-effect impacts, discounts and resource-as-payment savings
  // all carry the 'passive-effect' tag (the markers too), so this filter isolates
  // them — e.g. Solar Logistics' on-play "+2 titanium" no longer leaks onto its
  // discount / card-draw effects.
  const passiveEvents = events.filter((e) => e.tags?.includes('passive-effect') === true);
  const result: Array<EffectOverlayStat> = [];
  for (const stats of aggregateBySource(passiveEvents).values()) {
    const s = stats.source;
    if ((s.kind === 'card' || s.kind === 'corporation') && (s.owner === undefined || s.owner === owner)) {
      result.push(toEffectOverlayStat(stats));
    }
  }
  return result;
}
