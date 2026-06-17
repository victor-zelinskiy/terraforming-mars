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
} from './aggregate';

/**
 * PURE "fact" layer — the bridge from the raw {@link GameEvent} stream + the derived
 * aggregates to ANALYSIS-READY facts a future endgame analyzer turns into insights.
 *
 * GameEvents/Stats → Facts → (later) Insights. This module is the middle arrow: it
 * does NOT write insight prose (deliberately — see EVENT_STAT_FOUNDATION.md Iteration 3
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
  'colony' | 'negativeInteraction' | 'engineTiming' | 'notableEvent' | 'reveal';

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
  return facts;
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
    ...engineTimingFacts(events, opts),
    ...notableEventFacts(events),
  ];
}
