import type {Color} from '@/common/Color';
import type {EndgameFact} from '@/common/events/endgameFacts';
import type {InsightCandidate, InsightContext, InsightParam} from '@/client/components/endgame/insightEngine';

/*
 * SPECIAL CARD STORY REGISTRY (Iteration 8).
 *
 * An EXTENSIBLE registry of scenario detectors for rare / impactful / unusual CARD
 * stories — "this card DID something notable", never "this card was played". Each
 * entry is a thresholded `detect(ctx)` returning at most one `InsightCandidate`; the
 * single `analyzeSpecialCardStories` analyzer (registered in insightEngine's
 * FACT_ANALYZERS) runs them all. Designed to grow over many iterations.
 *
 * Type-only imports of the engine types (no runtime value import) so there is NO
 * module cycle with insightEngine. Self-contained param/fact helpers for the same
 * reason. PURE + deterministic, like the rest of the engine.
 *
 * This first wave covers the genuine GAP: SOURCE-AWARE attacks (which CARD broke whose
 * engine), read from the `cardAttack` fact. The other classes from the brief (huge
 * single-card VP, penalty tradeoff, economy/colony/blue-action/card-flow engines,
 * Vermin/Predators counters) are ALREADY covered by existing analyzers — re-adding them
 * would be duplication/spam (see the audit in EVENT_STAT_FOUNDATION.md), so they are
 * intentionally not repeated here.
 */

// ── Self-contained helpers (no runtime dep on insightEngine) ──
const raw = (v: number | string): InsightParam => ({t: 'raw', v: String(v)});
const key = (v: string): InsightParam => ({t: 'i18n', v});

function facts(ctx: InsightContext, type: EndgameFact['type']): ReadonlyArray<EndgameFact> {
  return (ctx.facts ?? []).filter((f) => f.type === type);
}
function name(ctx: InsightContext, color: Color): string {
  return ctx.players.find((p) => p.color === color)?.name ?? '';
}
function boardVp(ctx: InsightContext, color: Color): number {
  return ctx.categories.find((c) => c.key === 'board')?.values[color] ?? 0;
}
const metric = (f: EndgameFact, k: string): number => f.metrics[k] ?? 0;
const duelBonus = (ctx: InsightContext): number => (ctx.mode === 'duel' ? 0.85 : 0);

export type SpecialCardStory = {
  id: string;
  detect: (ctx: InsightContext) => InsightCandidate | undefined;
};

/** The card-resource keys (NOT standard resources / production) on a cardAttack fact. */
const STANDARD_KEYS = new Set(['plants', 'energy', 'heat', 'steel', 'titanium', 'megacredits', 'total', 'production', 'transfer']);

// ── 1. Production steal / redirect — a card intercepted the engine ──
const productionSteal: SpecialCardStory = {
  id: 'special.productionSteal',
  detect(ctx) {
    const hit = [...facts(ctx, 'cardAttack')]
      .filter((f) => metric(f, 'production') === 1 && metric(f, 'total') >= 2 && f.sourceCard !== undefined && f.targetPlayer !== undefined)
      .sort((a, b) => metric(b, 'total') - metric(a, 'total'))[0];
    if (hit === undefined || hit.sourceCard === undefined || hit.targetPlayer === undefined) {
      return undefined;
    }
    const transfer = metric(hit, 'transfer') === 1;
    return {
      id: 'special.productionSteal', group: 'cards', priority: 64, severity: 'normal', icon: 'target',
      badge: transfer ? 'Production heist' : 'Engine hit', color: hit.player,
      textKey: transfer ?
        '${0} hijacked ${1} production from ${2} with ${3} — a direct hit on the engine.' :
        '${0} knocked ${1} production off ${2} with ${3}, throttling the engine.',
      params: [raw(name(ctx, hit.player)), raw(metric(hit, 'total')), raw(name(ctx, hit.targetPlayer)), card(hit.sourceCard)],
      family: 'negativeDrama', uiVariant: 'normal', storyCluster: 'productionSteal',
      scores: {drama: 0.65, rarity: 0.55, relevance: 0.65, duelRelevance: duelBonus(ctx), confidence: 1},
      relatedPlayers: [hit.player, hit.targetPlayer], relatedCards: [hit.sourceCard],
    };
  },
};

// ── 2. Resource-on-card disruption — a card ate someone's microbe/floater engine ──
const resourceOnCardDisruption: SpecialCardStory = {
  id: 'special.resourceDisruption',
  detect(ctx) {
    // The biggest card-resource loss (microbe/floater/…), EXCLUDING animals (Predators
    // owns that story) — a hit on a resource-on-card scoring engine.
    let best: {fact: EndgameFact; res: string; amount: number} | undefined;
    for (const f of facts(ctx, 'cardAttack')) {
      if (f.sourceCard === undefined || f.targetPlayer === undefined) {
        continue;
      }
      for (const [k, v] of Object.entries(f.metrics)) {
        if (STANDARD_KEYS.has(k) || k === 'Animal' || v < 4) {
          continue;
        }
        if (best === undefined || v > best.amount) {
          best = {fact: f, res: k, amount: v};
        }
      }
    }
    if (best === undefined || best.fact.sourceCard === undefined || best.fact.targetPlayer === undefined) {
      return undefined;
    }
    return {
      id: 'special.resourceDisruption', group: 'cards', priority: 70, severity: 'major', icon: 'target',
      badge: 'Engine broken', color: best.fact.player,
      textKey: '${0} broke ${1}’s engine with ${2}, stripping ${3} ${4} that could have scored.',
      params: [raw(name(ctx, best.fact.player)), raw(name(ctx, best.fact.targetPlayer)), card(best.fact.sourceCard), raw(best.amount), key(best.res)],
      family: 'rareEvent', uiVariant: 'major', storyCluster: 'resourceDisruption',
      scores: {drama: 0.75, rarity: 0.8, relevance: 0.65, duelRelevance: duelBonus(ctx), confidence: 1},
      relatedPlayers: [best.fact.player, best.fact.targetPlayer], relatedCards: [best.fact.sourceCard],
    };
  },
};

// ── 3. Plant denial — a card stripped the greenery fuel ──
const plantDenial: SpecialCardStory = {
  id: 'special.plantDenial',
  detect(ctx) {
    const hit = [...facts(ctx, 'cardAttack')]
      .filter((f) => metric(f, 'production') === 0 && metric(f, 'plants') >= 6 && f.sourceCard !== undefined && f.targetPlayer !== undefined)
      .sort((a, b) => metric(b, 'plants') - metric(a, 'plants'))[0];
    if (hit === undefined || hit.sourceCard === undefined || hit.targetPlayer === undefined) {
      return undefined;
    }
    return {
      id: 'special.plantDenial', group: 'cards', priority: 62, severity: 'normal', icon: 'target',
      badge: 'Scorched', color: hit.player,
      textKey: '${0} torched ${1} plants off ${2} with ${3} — greenery fuel that never grew.',
      params: [raw(name(ctx, hit.player)), raw(metric(hit, 'plants')), raw(name(ctx, hit.targetPlayer)), card(hit.sourceCard)],
      family: 'negativeDrama', uiVariant: 'normal', storyCluster: 'plantDenial',
      scores: {drama: 0.6, rarity: 0.55, relevance: 0.6, duelRelevance: duelBonus(ctx), confidence: 1},
      relatedPlayers: [hit.player, hit.targetPlayer], relatedCards: [hit.sourceCard],
    };
  },
};

// ── 4. Counter-style — an attack that hit the rival's OWN strength ──
const counterStyle: SpecialCardStory = {
  id: 'special.counterStyle',
  detect(ctx) {
    // A plant attack on a BOARD-heavy victim = a direct counter to their greenery/board
    // plan (more pointed than a generic plant-denial).
    const hit = [...facts(ctx, 'cardAttack')]
      .filter((f) => f.sourceCard !== undefined && f.targetPlayer !== undefined &&
        metric(f, 'plants') >= 4 && boardVp(ctx, f.targetPlayer) >= 12)
      .sort((a, b) => boardVp(ctx, b.targetPlayer ?? b.player) - boardVp(ctx, a.targetPlayer ?? a.player))[0];
    if (hit === undefined || hit.sourceCard === undefined || hit.targetPlayer === undefined) {
      return undefined;
    }
    return {
      id: 'special.counterStyle', group: 'cards', priority: 74, severity: 'major', icon: 'target',
      badge: 'Hard counter', color: hit.player,
      textKey: '${0} answered ${1}’s board game in kind: ${2} struck the plants feeding their greenery push.',
      params: [raw(name(ctx, hit.player)), raw(name(ctx, hit.targetPlayer)), card(hit.sourceCard)],
      family: 'rareEvent', uiVariant: 'major', storyCluster: 'counterStyle',
      scores: {drama: 0.7, rarity: 0.75, relevance: 0.7, duelRelevance: duelBonus(ctx), confidence: 0.9},
      // The pointed counter supersedes the plain plant-denial telling of the same hit.
      suppresses: ['special.plantDenial'],
      relatedPlayers: [hit.player, hit.targetPlayer], relatedCards: [hit.sourceCard],
    };
  },
};

export const SPECIAL_CARD_STORIES: ReadonlyArray<SpecialCardStory> = [
  productionSteal,
  resourceOnCardDisruption,
  plantDenial,
  counterStyle,
];

/** Run the whole registry → at most one candidate per story (deduped downstream). */
export function analyzeSpecialCardStories(ctx: InsightContext): Array<InsightCandidate> {
  const out: Array<InsightCandidate> = [];
  for (const story of SPECIAL_CARD_STORIES) {
    const c = story.detect(ctx);
    if (c !== undefined) {
      out.push(c);
    }
  }
  return out;
}

// `card()` param helper kept last (used above) — a card-name token the UI translates.
function card(v: string): InsightParam {
  return {t: 'card', v};
}
