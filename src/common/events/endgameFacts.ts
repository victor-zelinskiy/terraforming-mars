import {Color} from '../Color';
import {CardName} from '../cards/CardName';
import {GlobalParameter} from '../GlobalParameter';
import {GameEvent} from './GameEvent';
import {EventImpact} from './EventImpact';
import {EventSource, sourceKey} from './EventSource';
import {
  aggregateByPlayer,
  aggregateBySource,
  actionStatsBySource,
  aggregateAttacks,
  aggregateAttacksBySource,
  aggregateByPlayerGeneration,
} from './aggregate';

/**
 * PURE "fact" layer — the bridge from the raw {@link GameEvent} stream + the derived
 * aggregates to ANALYSIS-READY facts a future endgame analyzer turns into insights.
 *
 * GameEvents/Stats → Facts → (later) Insights. This module is the middle arrow: it
 * does NOT write insight prose (deliberately — see docs/EVENT_STAT_FOUNDATION.md Iteration 3
 * §17) and adds NO parallel data — every fact is derived from the existing stream, so
 * it stays the single source of truth. No Vue / DOM / manifest, so it runs under the
 * server runner and could run server-side at endgame OR client-side over a fetched
 * stream. The `cardHasAction` dependency is INJECTED (the manifest is not imported
 * here) so the engine stays pure + testable.
 *
 * Confidence is honest: `exact` = a precise tally, `partial` = exact facts but no M€
 * valuation (energy/titanium saved shown in units), `ruleOnly` = no numeric delta.
 * Severity (0..1) is a ROUGH importance hint for ranking, never a final verdict.
 */

export type FactType =
  'economy' | 'actionUsage' | 'passiveEffect' | 'globalParameter' |
  'colony' | 'negativeInteraction' | 'engineTiming' | 'notableEvent' | 'reveal' |
  'standardProject' | 'milestoneClaim' | 'awardFunding' | 'cardAttack' |
  'corporationImpact';

export type FactConfidence = 'exact' | 'partial' | 'approximate' | 'ruleOnly';

export type FactTag = 'economy' | 'blueAction' | 'passive' | 'colony' | 'attack' | 'global' | 'reveal' | 'timeline';

export type EndgameFact = {
  /** Deterministic id (no Date/random) — `type:player:source:gen`-ish. */
  id: string;
  type: FactType;
  player: Color;
  /** The card/corp/standard-project this fact is about, if any. */
  sourceCard?: CardName;
  /** For a cross-player fact (an attack), the other player. */
  targetPlayer?: Color;
  /** The generation this fact pins to, if it is a point-in-time fact. */
  generation?: number;
  /** ROUGH importance for ranking (0..1) — a hint, not a verdict. */
  severity: number;
  confidence: FactConfidence;
  /** Structured numbers (never prose). */
  metrics: Record<string, number>;
  /** The stream events this fact was derived from (for drill-down / journal link). */
  relatedEventIds: ReadonlyArray<number>;
  tags: ReadonlyArray<FactTag>;
};

export type BuildFactsOptions = {
  /** Injected manifest predicate — lets engine-timing detect "built but never
   *  activated" action cards without this pure module importing the card manifest. */
  cardHasAction?: (card: CardName) => boolean;
  /** The last generation played — lets a consumer flag late-game facts. */
  finalGeneration?: number;
};

const UNIT_KEYS = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'] as const;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function sumPositiveUnits(u: Partial<Record<typeof UNIT_KEYS[number], number>>): number {
  let total = 0;
  for (const k of UNIT_KEYS) {
    const v = u[k];
    if (v !== undefined && v > 0) {
      total += v;
    }
  }
  return total;
}

function sourceCardOf(s: EventSource | undefined): CardName | undefined {
  return (s?.kind === 'card' || s?.kind === 'corporation' || s?.kind === 'standardProject') ? s.card : undefined;
}

function sourceOwnerOf(s: EventSource | undefined): Color | undefined {
  return (s?.kind === 'card' || s?.kind === 'corporation') ? s.owner : undefined;
}

// ── Economy ──────────────────────────────────────────────────────────────────

function economyFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  const facts: Array<EndgameFact> = [];
  for (const [color, stats] of aggregateByPlayer(events)) {
    const td = stats.tradeDiscount;
    const pvb = stats.paymentValueBonus;
    // measured M€ value = discounts + resource-as-payment savings + payment value
    // bonus + the M€-valued trade-discount portion. Energy/titanium saved are shown
    // as units (no fake M€ conversion).
    const savedMC = stats.megacreditsSaved + pvb.bonusValue + td.megacredits;
    const tradeUnits = td.energy + td.titanium + td.megacredits;
    if (savedMC === 0 && tradeUnits === 0 && pvb.steel === 0 && pvb.titanium === 0) {
      continue;
    }
    facts.push({
      id: `economy:${color}`,
      type: 'economy',
      player: color,
      severity: clamp01(savedMC / 40),
      confidence: 'partial',
      metrics: {
        savedMegacredits: savedMC,
        discountAndPaymentSaved: stats.megacreditsSaved,
        paymentValueBonus: pvb.bonusValue,
        paymentValueBonusSteel: pvb.steel,
        paymentValueBonusTitanium: pvb.titanium,
        tradeDiscountEnergy: td.energy,
        tradeDiscountTitanium: td.titanium,
        tradeDiscountMegacredits: td.megacredits,
      },
      relatedEventIds: [],
      tags: ['economy'],
    });
  }
  return facts;
}

// ── Active blue-card actions ───────────────────────────────────────────────────

function actionUsageFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  const facts: Array<EndgameFact> = [];
  for (const [key, stats] of actionStatsBySource(events)) {
    const owner = sourceOwnerOf(stats.source);
    const card = sourceCardOf(stats.source);
    if (owner === undefined || card === undefined) {
      continue;
    }
    facts.push({
      id: `action:${key}`,
      type: 'actionUsage',
      player: owner,
      sourceCard: card,
      generation: stats.lastTrigger?.generation,
      severity: clamp01(stats.triggerCount / 8),
      confidence: stats.triggerCount > 0 && sumPositiveUnits(stats.stock) === 0 && stats.cardsDrawn === 0 && stats.tr === 0 ? 'ruleOnly' : 'exact',
      metrics: {
        activations: stats.triggerCount,
        resourcesGained: sumPositiveUnits(stats.stock),
        productionGained: sumPositiveUnits(stats.production),
        cardsDrawn: stats.cardsDrawn,
        tr: stats.tr,
        lastGeneration: stats.lastTrigger?.generation ?? 0,
      },
      relatedEventIds: [],
      tags: ['blueAction'],
    });
  }
  return facts;
}

// ── Passive effects ─────────────────────────────────────────────────────────

function passiveEffectFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  const passive = events.filter((e) => e.tags?.includes('passive-effect') === true);
  const facts: Array<EndgameFact> = [];
  for (const [key, stats] of aggregateBySource(passive)) {
    const owner = sourceOwnerOf(stats.source);
    const card = sourceCardOf(stats.source);
    if (owner === undefined || card === undefined || stats.triggerCount === 0) {
      continue;
    }
    const cardResourcesTotal = Object.values(stats.cardResources).reduce<number>((a, b) => a + (b ?? 0), 0);
    facts.push({
      id: `passive:${key}`,
      type: 'passiveEffect',
      player: owner,
      sourceCard: card,
      generation: stats.lastTrigger?.generation,
      severity: clamp01(stats.triggerCount / 10),
      confidence: 'exact',
      metrics: {
        triggers: stats.triggerCount,
        savedMegacredits: stats.megacreditsSaved,
        cardResourcesAdded: cardResourcesTotal,
        cardsDrawn: stats.cardsDrawn,
        tr: stats.tr,
      },
      relatedEventIds: [],
      tags: ['passive'],
    });
  }
  return facts;
}

// ── Global parameters ────────────────────────────────────────────────────────

const PARAMETER_KEY: Record<GlobalParameter, string> = {
  [GlobalParameter.OXYGEN]: 'oxygen',
  [GlobalParameter.TEMPERATURE]: 'temperature',
  [GlobalParameter.OCEANS]: 'oceans',
  [GlobalParameter.VENUS]: 'venus',
  [GlobalParameter.MOON_HABITAT_RATE]: 'moonHabitat',
  [GlobalParameter.MOON_MINING_RATE]: 'moonMining',
  [GlobalParameter.MOON_LOGISTIC_RATE]: 'moonLogistics',
};

function globalParameterFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  // player → {paramKey → steps} + total + the source card that moved the most steps.
  const byPlayer = new Map<Color, {metrics: Record<string, number>; total: number; bySource: Map<string, {card?: CardName; steps: number}>; ids: Array<number>}>();
  for (const e of events) {
    if (e.type !== 'global-parameter-changed' || e.impact.globalParameter === undefined || e.player === undefined) {
      continue;
    }
    const steps = e.impact.globalParameter.steps;
    const pk = PARAMETER_KEY[e.impact.globalParameter.parameter];
    let agg = byPlayer.get(e.player);
    if (agg === undefined) {
      agg = {metrics: {}, total: 0, bySource: new Map(), ids: []};
      byPlayer.set(e.player, agg);
    }
    agg.metrics[pk] = (agg.metrics[pk] ?? 0) + steps;
    agg.total += steps;
    agg.ids.push(e.id);
    const sk = sourceKey(e.source);
    const src = agg.bySource.get(sk) ?? {card: sourceCardOf(e.source), steps: 0};
    src.steps += steps;
    agg.bySource.set(sk, src);
  }
  const facts: Array<EndgameFact> = [];
  for (const [color, agg] of byPlayer) {
    const top = [...agg.bySource.values()].sort((a, b) => b.steps - a.steps)[0];
    facts.push({
      id: `global:${color}`,
      type: 'globalParameter',
      player: color,
      sourceCard: top?.card,
      severity: clamp01(agg.total / 20),
      confidence: 'exact',
      metrics: {...agg.metrics, totalSteps: agg.total, topSourceSteps: top?.steps ?? 0},
      relatedEventIds: agg.ids,
      tags: ['global'],
    });
  }
  return facts;
}

// ── Colonies ─────────────────────────────────────────────────────────────────

function colonyFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  const trades = new Map<Color, {count: number; ids: Array<number>}>();
  for (const e of events) {
    if (e.category === 'colony' && e.player !== undefined) {
      const t = trades.get(e.player) ?? {count: 0, ids: []};
      t.count += 1;
      t.ids.push(e.id);
      trades.set(e.player, t);
    }
  }
  const facts: Array<EndgameFact> = [];
  for (const [color, stats] of aggregateByPlayer(events)) {
    const t = trades.get(color);
    const ct = stats.colonyTrack;
    const td = stats.tradeDiscount;
    if ((t?.count ?? 0) === 0 && ct.count === 0 && td.count === 0) {
      continue;
    }
    facts.push({
      id: `colony:${color}`,
      type: 'colony',
      player: color,
      severity: clamp01((t?.count ?? 0) / 12),
      confidence: 'partial',
      metrics: {
        trades: t?.count ?? 0,
        trackBonusSteps: ct.steps,
        trackExtraReward: ct.extraReward,
        tradeDiscountUnits: td.energy + td.titanium + td.megacredits,
      },
      relatedEventIds: t?.ids ?? [],
      tags: ['colony'],
    });
  }
  return facts;
}

// ── Negative interactions (attacks) ────────────────────────────────────────────

function negativeInteractionFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  const facts: Array<EndgameFact> = [];
  for (const [attacker, victims] of aggregateAttacks(events)) {
    for (const v of victims) {
      facts.push({
        id: `attack:${attacker}->${v.color}`,
        type: 'negativeInteraction',
        player: attacker,
        targetPlayer: v.color,
        severity: clamp01(v.totalLost / 12),
        confidence: 'exact',
        metrics: {totalLost: v.totalLost, hits: v.hits, ...v.resources},
        relatedEventIds: [],
        tags: ['attack'],
      });
    }
  }
  return facts;
}

// ── Engine timing ("built, when, used how much") ───────────────────────────────

function engineTimingFacts(events: ReadonlyArray<GameEvent>, opts: BuildFactsOptions): Array<EndgameFact> {
  const cardHasAction = opts.cardHasAction;
  if (cardHasAction === undefined) {
    return []; // needs the manifest predicate to know which played cards are actions
  }
  const finalGen = opts.finalGeneration ?? events.reduce((m, e) => Math.max(m, e.generation), 0);
  // When each card was PLAYED (the card-play root) per owner.
  const played = new Map<string, {color: Color; card: CardName; gen: number; id: number}>();
  for (const e of events) {
    if (e.category === 'card-play' && e.player !== undefined) {
      const card = sourceCardOf(e.source);
      if (card !== undefined && cardHasAction(card)) {
        const k = `${e.player}:${card}`;
        if (!played.has(k)) {
          played.set(k, {color: e.player, card, gen: e.generation, id: e.id});
        }
      }
    }
  }
  const actionStats = actionStatsBySource(events);
  const facts: Array<EndgameFact> = [];
  for (const [, p] of played) {
    const stat = actionStats.get(sourceKey({kind: 'card', card: p.card, owner: p.color})) ??
      actionStats.get(sourceKey({kind: 'corporation', card: p.card, owner: p.color}));
    const activations = stat?.triggerCount ?? 0;
    const lastGen = stat?.lastTrigger?.generation ?? 0;
    const availableGens = Math.max(0, finalGen - p.gen + 1);
    const neverActivated = activations === 0;
    const lowUsage = !neverActivated && activations <= 1 && availableGens >= 3;
    facts.push({
      id: `engine:${p.color}:${p.card}`,
      type: 'engineTiming',
      player: p.color,
      sourceCard: p.card,
      generation: p.gen,
      // An unused / under-used engine card is the NOTABLE case (high severity).
      severity: neverActivated ? clamp01(availableGens / 6) : (lowUsage ? 0.4 : clamp01(activations / 10)),
      confidence: 'exact',
      metrics: {
        playedGeneration: p.gen,
        availableGenerations: availableGens,
        activations,
        lastActivatedGeneration: lastGen,
        neverActivated: neverActivated ? 1 : 0,
        lowUsage: lowUsage ? 1 : 0,
      },
      relatedEventIds: [p.id],
      tags: ['blueAction', 'timeline'],
    });
  }
  return facts;
}

// ── Source-aware card attacks (which CARD broke whose engine) ──────────────────

function cardAttackFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  const facts: Array<EndgameFact> = [];
  for (const [attacker, records] of aggregateAttacksBySource(events)) {
    for (const r of records) {
      facts.push({
        id: `cardAttack:${attacker}:${r.sourceCard}:${r.victim}:${r.scope}`,
        type: 'cardAttack',
        player: attacker,
        sourceCard: r.sourceCard,
        targetPlayer: r.victim,
        severity: clamp01(r.total / 10),
        confidence: 'exact',
        metrics: {total: r.total, production: r.scope === 'production' ? 1 : 0, transfer: r.transfer ? 1 : 0, ...r.resources},
        relatedEventIds: [],
        tags: ['attack'],
      });
    }
  }
  return facts;
}

// ── Milestone claims + award funding (the WHEN; the outcome is in the breakdown) ──

function maFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  const facts: Array<EndgameFact> = [];
  for (const e of events) {
    if (e.player === undefined) {
      continue;
    }
    if (e.category === 'milestone' && e.source?.kind === 'milestone') {
      facts.push({
        id: `milestone:${e.source.name}`, type: 'milestoneClaim', player: e.player, generation: e.generation,
        severity: 0.4, confidence: 'exact', metrics: {generation: e.generation},
        relatedEventIds: [e.id], tags: ['timeline'],
      });
    } else if (e.category === 'award' && e.source?.kind === 'award') {
      facts.push({
        id: `award:${e.source.name}`, type: 'awardFunding', player: e.player, generation: e.generation,
        severity: 0.4, confidence: 'exact', metrics: {generation: e.generation},
        relatedEventIds: [e.id], tags: ['timeline'],
      });
    }
  }
  return facts;
}

// ── Standard projects (infrastructure strategy) ────────────────────────────────

// Convert Heat / Convert Plants share the 'standard-project' journal category, but they are
// standard ACTIONS (resource conversions), NOT standard projects — they must not inflate the
// standard-project strategy count (Iteration 16 §13). Their parameter steps still count in the
// player's overall globalParameter fact (temperature / oxygen), so the conversion is credited
// to the planet, not to infrastructure.
const CONVERSION_STANDARD_ACTIONS: ReadonlySet<CardName> = new Set([CardName.CONVERT_HEAT, CardName.CONVERT_PLANTS]);
function isConversionAction(s: EventSource | undefined): boolean {
  const card = sourceCardOf(s);
  return card !== undefined && CONVERSION_STANDARD_ACTIONS.has(card);
}

function standardProjectFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  const byId = new Map<number, GameEvent>();
  for (const e of events) {
    byId.set(e.id, e);
  }
  // Per player: how many standard projects they ran + the parameter steps those drove.
  const byPlayer = new Map<Color, {count: number; paramSteps: number; ids: Array<number>}>();
  for (const e of events) {
    if (e.category === 'standard-project' && e.player !== undefined && !isConversionAction(e.source)) {
      const p = byPlayer.get(e.player) ?? {count: 0, paramSteps: 0, ids: []};
      p.count += 1;
      p.ids.push(e.id);
      byPlayer.set(e.player, p);
    }
    // Parameter steps under a (genuine) standard-project root — conversions excluded.
    if (e.type === 'global-parameter-changed' && e.impact.globalParameter !== undefined && e.player !== undefined) {
      const root = byId.get(e.correlationId);
      if (root?.category === 'standard-project' && !isConversionAction(root.source)) {
        const p = byPlayer.get(e.player) ?? {count: 0, paramSteps: 0, ids: []};
        p.paramSteps += e.impact.globalParameter.steps;
        byPlayer.set(e.player, p);
      }
    }
  }
  const facts: Array<EndgameFact> = [];
  for (const [color, p] of byPlayer) {
    if (p.count === 0) {
      continue;
    }
    facts.push({
      id: `standardProject:${color}`,
      type: 'standardProject',
      player: color,
      severity: clamp01(p.count / 8),
      confidence: 'exact',
      metrics: {projects: p.count, parameterSteps: p.paramSteps},
      relatedEventIds: p.ids,
      tags: ['global'],
    });
  }
  return facts;
}

// ── Reveal / search / show card flow ───────────────────────────────────────────

function revealFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  // per (player, source): revealed (deck) / shown (hand) / found (search hits) / count.
  const bySource = new Map<string, {player: Color; card?: CardName; revealed: number; shown: number; found: number; count: number; ids: Array<number>}>();
  for (const e of events) {
    if (e.type !== 'card-revealed' || e.impact.reveal === undefined || e.player === undefined) {
      continue;
    }
    const r = e.impact.reveal;
    const key = sourceKey(e.source);
    let agg = bySource.get(key);
    if (agg === undefined) {
      agg = {player: e.player, card: sourceCardOf(e.source), revealed: 0, shown: 0, found: 0, count: 0, ids: []};
      bySource.set(key, agg);
    }
    if (r.origin === 'deck') {
      agg.revealed += r.count;
    } else {
      agg.shown += r.count;
    }
    if (r.found === true) {
      agg.found += 1;
    }
    agg.count += 1;
    agg.ids.push(e.id);
  }
  const facts: Array<EndgameFact> = [];
  for (const [, agg] of bySource) {
    facts.push({
      id: `reveal:${agg.player}:${agg.card ?? 'unknown'}`,
      type: 'reveal',
      player: agg.player,
      sourceCard: agg.card,
      severity: clamp01((agg.revealed + agg.shown) / 12),
      confidence: 'exact',
      metrics: {revealed: agg.revealed, shown: agg.shown, searchHits: agg.found, events: agg.count},
      relatedEventIds: agg.ids,
      tags: ['reveal'],
    });
  }
  return facts;
}

// ── Notable single events ──────────────────────────────────────────────────────

function notableEventFacts(events: ReadonlyArray<GameEvent>): Array<EndgameFact> {
  const facts: Array<EndgameFact> = [];
  const pushBest = (
    type: FactType, tag: FactTag, idSuffix: string,
    pick: (e: GameEvent) => number, metricKey: string): void => {
    let best: GameEvent | undefined;
    let bestVal = 0;
    for (const e of events) {
      const v = pick(e);
      if (v > bestVal) {
        bestVal = v;
        best = e;
      }
    }
    if (best !== undefined && best.player !== undefined && bestVal > 0) {
      facts.push({
        id: `notable:${idSuffix}`,
        type,
        player: best.player,
        sourceCard: sourceCardOf(best.source),
        generation: best.generation,
        severity: clamp01(bestVal / 20),
        confidence: 'exact',
        metrics: {[metricKey]: bestVal},
        relatedEventIds: [best.id],
        tags: [tag, 'timeline'],
      });
    }
  };
  pushBest('notableEvent', 'economy', 'biggestDiscount',
    (e) => e.type === 'discount-applied' ? (e.impact.megacreditsSaved ?? 0) : 0, 'megacreditsSaved');
  pushBest('notableEvent', 'blueAction', 'biggestDraw',
    (e) => e.impact.cardsDrawn ?? 0, 'cardsDrawn');
  pushBest('notableEvent', 'attack', 'biggestAttack',
    (e) => negativeMagnitudeOfAttack(e), 'lost');
  pushBest('notableEvent', 'reveal', 'biggestReveal',
    (e) => e.impact.reveal?.count ?? 0, 'revealed');
  pushBest('notableEvent', 'blueAction', 'biggestProductionLoss',
    (e) => productionLossMagnitude(e), 'productionLost');

  // Strongest single-generation economy burst (from the per-player timeline).
  let burstPlayer: Color | undefined;
  let burstGen = 0;
  let burstVal = 0;
  for (const [color, perGen] of aggregateByPlayerGeneration(events)) {
    for (const [gen, stats] of perGen) {
      const saved = stats.megacreditsSaved + stats.paymentValueBonus.bonusValue;
      if (saved > burstVal) {
        burstVal = saved;
        burstPlayer = color;
        burstGen = gen;
      }
    }
  }
  if (burstPlayer !== undefined && burstVal > 0) {
    facts.push({
      id: 'notable:economyBurst',
      type: 'notableEvent',
      player: burstPlayer,
      generation: burstGen,
      severity: clamp01(burstVal / 20),
      confidence: 'partial',
      metrics: {savedMegacredits: burstVal, generation: burstGen},
      relatedEventIds: [],
      tags: ['economy', 'timeline'],
    });
  }

  // The most-used blue action (the engine workhorse).
  let topAction: {player: Color; card: CardName; activations: number} | undefined;
  for (const [, stats] of actionStatsBySource(events)) {
    const owner = sourceOwnerOf(stats.source);
    const card = sourceCardOf(stats.source);
    if (owner !== undefined && card !== undefined && (topAction === undefined || stats.triggerCount > topAction.activations)) {
      topAction = {player: owner, card, activations: stats.triggerCount};
    }
  }
  if (topAction !== undefined && topAction.activations > 0) {
    facts.push({
      id: 'notable:mostUsedAction',
      type: 'notableEvent',
      player: topAction.player,
      sourceCard: topAction.card,
      severity: clamp01(topAction.activations / 10),
      confidence: 'exact',
      metrics: {activations: topAction.activations},
      relatedEventIds: [],
      tags: ['blueAction'],
    });
  }
  return facts;
}

/** Magnitude of a single production LOSS event (0 if it isn't a production loss). */
function productionLossMagnitude(e: GameEvent): number {
  if (e.type !== 'production-changed' || e.impact.production === undefined) {
    return 0;
  }
  let total = 0;
  for (const k of UNIT_KEYS) {
    const v = e.impact.production[k];
    if (v !== undefined && v < 0) {
      total += -v;
    }
  }
  return total;
}

/** Magnitude of a single cross-player attack event (0 if not an attack). */
function negativeMagnitudeOfAttack(e: GameEvent): number {
  if (e.player === undefined) {
    return 0;
  }
  const isAttack = (e.target?.player !== undefined && e.target.player !== e.player) ||
    ((e.source?.kind === 'card' || e.source?.kind === 'corporation') && e.source.owner !== undefined && e.source.owner !== e.player);
  if (!isAttack) {
    return 0;
  }
  return magnitudeOfLosses(e.impact);
}

function magnitudeOfLosses(impact: EventImpact): number {
  let total = 0;
  for (const k of UNIT_KEYS) {
    const sv = impact.stock?.[k];
    if (sv !== undefined && sv < 0) {
      total += -sv;
    }
    const pv = impact.production?.[k];
    if (pv !== undefined && pv < 0) {
      total += -pv;
    }
  }
  for (const cr of impact.cardResources ?? []) {
    if (cr.amount < 0) {
      total += -cr.amount;
    }
  }
  return total;
}

// ── Corporations (the identity layer) ──────────────────────────────────────────
//
// A corporation is NOT an ordinary card: it sets the start, may carry a passive rule,
// and may have an activatable action. The event stream already marks corp-sourced
// events first-class (`source.kind === 'corporation'`), tags passive-effect impacts,
// and categorises actions ('corporation-action' / 'copied-action'), so the WHOLE corp
// fact is derived from the existing stream — no parallel store, no new bridge.
//
// One fact per (owner, corporation) the player PLAYED — split into PASSIVE (the corp's
// ongoing rule), ACTION (its activatable button) and EARLY tempo (the owner's measured
// generation 1–3 activity, which contextualises a high-capital start). A corp that was
// played but did nothing measurable still gets a fact (so the "built but barely used
// action corp" case is detectable). Starting CAPITAL is static reference data and lives
// in the client corporationStories registry — this fact carries only what the stream
// measured. Honest confidence: 'partial' (mixed units, no fake M€ valuation).
function corporationFacts(events: ReadonlyArray<GameEvent>, opts: BuildFactsOptions): Array<EndgameFact> {
  // Every corporation a player actually played shows up as a corp-sourced event (at
  // minimum its 'card-play' root). Discover them (owner + card), de-duped.
  const corps = new Map<string, {owner: Color; corp: CardName}>();
  for (const e of events) {
    if (e.source?.kind === 'corporation' && e.source.owner !== undefined) {
      corps.set(`${e.source.owner}:${e.source.card}`, {owner: e.source.owner, corp: e.source.card});
    }
  }
  if (corps.size === 0) {
    return [];
  }
  // Aggregations computed ONCE (the loop just looks each corp up by sourceKey).
  const passive = aggregateBySource(events.filter((e) => e.tags?.includes('passive-effect') === true));
  const actions = actionStatsBySource(events); // category 'corporation-action' / 'copied-action'
  const perGen = aggregateByPlayerGeneration(events);

  const facts: Array<EndgameFact> = [];
  for (const {owner, corp} of corps.values()) {
    const key = sourceKey({kind: 'corporation', card: corp, owner});
    const p = passive.get(key);
    const a = actions.get(key);

    const passiveTriggers = p?.triggerCount ?? 0;
    const passiveSaved = p?.megacreditsSaved ?? 0;
    const passiveResources = p !== undefined ? sumPositiveUnits(p.stock) : 0;
    const passiveProduction = p !== undefined ? sumPositiveUnits(p.production) : 0;
    const passiveCardResources = p !== undefined ? Object.values(p.cardResources).reduce<number>((s, v) => s + (v ?? 0), 0) : 0;
    const passiveTr = p?.tr ?? 0;
    const passiveCardsDrawn = p?.cardsDrawn ?? 0;

    // ACTION: triggerCount counts activations (incl. Viron's copied-action roots). The
    // copied OUTPUT is attributed to the copied card, so a copy corp's actionValue stays
    // low by design — its story is the REPETITION (activations), not raw output.
    const actionActivations = a?.triggerCount ?? 0;
    const actionResources = a !== undefined ? sumPositiveUnits(a.stock) : 0;
    const actionProduction = a !== undefined ? sumPositiveUnits(a.production) : 0;
    const actionCardsDrawn = a?.cardsDrawn ?? 0;
    const actionTr = a?.tr ?? 0;
    const actionLastGeneration = a?.lastTrigger?.generation ?? 0;

    // EARLY tempo: the OWNER's measured economy + gains over generations 1–3. Honestly
    // the player's early activity (not the corp's alone) — it contextualises a start boost.
    let earlyValue = 0;
    let earlyResources = 0;
    let earlyCardsDrawn = 0;
    const og = perGen.get(owner);
    if (og !== undefined) {
      for (const [gen, st] of og) {
        if (gen <= 3) {
          earlyValue += st.megacreditsSaved + st.paymentValueBonus.bonusValue;
          earlyResources += sumPositiveUnits(st.stock) + sumPositiveUnits(st.production);
          earlyCardsDrawn += st.cardsDrawn;
        }
      }
    }

    const passiveValue = passiveSaved + passiveResources + passiveProduction + passiveCardResources + passiveTr * 2 + passiveCardsDrawn;
    const actionValue = actionResources + actionProduction + actionCardsDrawn + actionTr * 2;
    const totalMeasuredValue = passiveValue + actionValue;
    const lastGeneration = Math.max(p?.lastTrigger?.generation ?? 0, actionLastGeneration);

    facts.push({
      id: `corporation:${owner}:${corp}`,
      type: 'corporationImpact',
      player: owner,
      sourceCard: corp,
      generation: lastGeneration > 0 ? lastGeneration : undefined,
      severity: clamp01(totalMeasuredValue / 40),
      confidence: 'partial',
      metrics: {
        passiveTriggers, passiveSaved, passiveResources, passiveProduction,
        passiveCardResources, passiveTr, passiveCardsDrawn,
        actionActivations, actionResources, actionProduction, actionCardsDrawn,
        actionTr, actionLastGeneration,
        earlyValue, earlyResources, earlyCardsDrawn,
        passiveValue, actionValue, totalMeasuredValue,
        hasAction: opts.cardHasAction?.(corp) === true ? 1 : 0,
        lastGeneration,
      },
      relatedEventIds: [],
      tags: ['economy', 'timeline'],
    });
  }
  return facts;
}

/**
 * Build every analysis-ready fact from the event stream. Pure + deterministic — the
 * SAME stream always yields the SAME facts (ids are content-derived, no Date/random),
 * so it is replayable + snapshot-testable. Restrict / rank downstream.
 */
export function buildEndgameFacts(events: ReadonlyArray<GameEvent>, opts: BuildFactsOptions = {}): Array<EndgameFact> {
  return [
    ...economyFacts(events),
    ...actionUsageFacts(events),
    ...passiveEffectFacts(events),
    ...globalParameterFacts(events),
    ...colonyFacts(events),
    ...negativeInteractionFacts(events),
    ...revealFacts(events),
    ...standardProjectFacts(events),
    ...cardAttackFacts(events),
    ...maFacts(events),
    ...engineTimingFacts(events, opts),
    ...notableEventFacts(events),
    ...corporationFacts(events, opts),
  ];
}
