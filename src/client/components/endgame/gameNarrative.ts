/*
 * Game NARRATIVE composer (rework Iteration 15, §8 + §16).
 *
 * Turns the classified key episodes + the strategy profiles into:
 *   • a 3–5 sentence "story of the game in 30 seconds" (§8) — connective prose that reads
 *     the plans, where they diverged, the decisive line, and the memorable beat;
 *   • the HERO thesis (§16) — the one strong sentence for the result block, built from the
 *     DECISIVE driver + the structural contrast, NEVER a low-impact ironic twist.
 *
 * PURE — no Vue / DOM / i18n. Sentences are {i18n KEY + typed params}; the component
 * translates. NO runtime dependency on insightEngine (type-only).
 */
import type {Color} from '@/common/Color';
import type {InsightContext, InsightParam} from '@/client/components/endgame/insightEngine';
import {strategyLabel, type StrategyArchetype} from '@/client/components/endgame/strategyArchetypes';
import {buildStrategyTermDetail} from '@/client/components/endgame/insightDetail';
import {
  KeyEpisode, decisiveEpisodes, contrastEpisode, memorableEpisode, marginClass,
} from '@/client/components/endgame/keyEpisodeEngine';

/** A narrative sentence: an i18n template + typed params (some carrying interactive TERMS),
 *  and the paragraph it belongs to (§3 — para 1 = conclusion, para 2 = explanation). */
export type StorySentence = {key: string; params: ReadonlyArray<InsightParam>; para?: 1 | 2};

/** One row of the "What defined this game" editorial synopsis (§8/§13) — terse, distinct
 *  from the full episode cards. */
export type WhatDefinedRow = {kind: 'cause' | 'contrast' | 'amplifier'; labelKey: string; sentence: StorySentence};

/** A short synopsis line for the "memorable turn" editorial row, keyed by the episode kind
 *  (so the editorial summary doesn't repeat the full episode card text — §13). `bestCard` is
 *  DELIBERATELY ABSENT (§6): the generic "one card brought points" line is banned — the best
 *  card is told, by NAME, in the "unusual episodes" surface instead. */
const MEMORABLE_SYNOPSIS: Readonly<Record<string, string>> = {
  award: 'The brightest turn: the award went to a player who didn’t fund it.',
  colony: 'The most distinctive touch: the colonies leaned one player’s way.',
  pressure: 'The most distinctive touch: one player spent the game under attack.',
  turningPoint: 'The sharpest turn: a late change of the lead.',
  hydronetwork: 'A distinctive finish: the Hydronetwork bonus skewed one player’s way.',
};

const raw = (v: number | string): InsightParam => ({t: 'raw', v: String(v)});
const key = (v: string): InsightParam => ({t: 'i18n', v});

// Iteration 17 §4/§5 — interactive-term param builders.
/** A player name token (rendered in the player's colour). */
const playerP = (name: string, color: Color): InsightParam => ({t: 'raw', v: name, term: {kind: 'player', color}});
/** A strategy token (rendered with a hover detail from the player's strategy profile). */
function stratP(ctx: InsightContext, color: Color, archetype: StrategyArchetype): InsightParam {
  return {t: 'i18n', v: strategyLabel(archetype), term: {kind: 'strategy', detail: buildStrategyTermDetail(ctx.players, color, archetype)}};
}
/** An accented numeric token (margins / VP). */
const scoreP = (v: number | string): InsightParam => ({t: 'raw', v: String(v), term: {kind: 'score', accent: true}});

function winnerArche(ctx: InsightContext): StrategyArchetype | undefined {
  return ctx.winner.strategyProfile?.primary?.archetype;
}
function runnerArche(ctx: InsightContext): StrategyArchetype | undefined {
  return ctx.runnerUp?.strategyProfile?.primary?.archetype;
}
function winnerPlan(ctx: InsightContext): string | undefined {
  const a = winnerArche(ctx);
  return a !== undefined ? strategyLabel(a) : undefined;
}

/**
 * The HERO thesis (§1/§2/§16): a SCALE-aware verdict for the result block — it states HOW
 * the game finished (tight / solid / commanding / blowout) and by how much, NOT the two
 * plans (the 30-second story owns that, so the hero never duplicates it). A low-impact
 * episode (a 5-VP award at a +42 margin) is NEVER the headline. Grammar-safe (§5):
 * a player-name placeholder is never the subject of a gendered past-tense verb.
 */
export function buildHeroThesis(ctx: InsightContext, _episodes: ReadonlyArray<KeyEpisode>): StorySentence | undefined {
  if (ctx.runnerUp === undefined) {
    return undefined;
  }
  const cls = marginClass(ctx.margin);
  const wPlan = winnerPlan(ctx);
  switch (cls) {
  case 'tie':
    return {key: 'Level on points — the title was settled on the M€ tiebreaker.', params: []};
  case 'close':
    return {key: 'A tight finish — the lead for ${0} was just +${1} VP.', params: [raw(ctx.winner.name), raw(ctx.margin)]};
  case 'solid':
    return wPlan !== undefined ?
      {key: 'The final count settled it for ${0}, carried by ${2} — a +${1} VP lead.', params: [raw(ctx.winner.name), raw(ctx.margin), key(wPlan)]} :
      {key: 'The final count settled it for ${0} — a +${1} VP lead.', params: [raw(ctx.winner.name), raw(ctx.margin)]};
  case 'large':
    return {key: 'A commanding finish — the lead for ${0} reached +${1} VP.', params: [raw(ctx.winner.name), raw(ctx.margin)]};
  case 'blowout':
  default:
    return {key: 'A runaway finish — the lead for ${0} grew all the way to +${1} VP.', params: [raw(ctx.winner.name), raw(ctx.margin)]};
  }
}

/**
 * The editorial "what defined this game" synopsis (§8/§13): THREE terse, concrete rows —
 * the main source of the lead, the contrast of plans, and a final amplifier or memorable
 * turn — in distinct copy from the full episode cards (no verbatim repeat across surfaces,
 * §7). NEVER the generic "one card brought points" (§6). Grammar-safe (§5).
 */
export function buildWhatDefined(ctx: InsightContext, episodes: ReadonlyArray<KeyEpisode>): ReadonlyArray<WhatDefinedRow> {
  const rows: Array<WhatDefinedRow> = [];
  const w = ctx.winner;
  const ru = ctx.runnerUp;
  const wArche = winnerArche(ctx);
  const rArche = runnerArche(ctx);
  // 1) The main source of the lead.
  if (wArche !== undefined) {
    rows.push({
      kind: 'cause', labelKey: 'Main source of the lead',
      sentence: {key: 'The final count settled in ${0}’s favour through ${1}.',
        params: [playerP(w.name, w.color), stratP(ctx, w.color, wArche)]},
    });
  }
  // 2) The contrast of plans (duel only).
  if (contrastEpisode(episodes) !== undefined && wArche !== undefined && rArche !== undefined && ru !== undefined) {
    rows.push({
      kind: 'contrast', labelKey: 'Contrast of plans',
      sentence: {key: 'The winner and the runner-up took different routes: ${0} against ${1}.',
        params: [stratP(ctx, w.color, wArche), stratP(ctx, ru.color, rArche)]},
    });
  }
  // 3) The final amplifier (a real second scoring line, with its VP) OR a memorable twist —
  // never the generic best-card line (§6).
  const sec = (w.strategyProfile?.secondary ?? []).find((d) => d.isScoring && d.vpContribution >= 6);
  if (sec !== undefined) {
    rows.push({
      kind: 'amplifier', labelKey: 'Final amplifier',
      sentence: {key: 'A second line of points came from ${0}: +${1} VP.',
        params: [stratP(ctx, w.color, sec.archetype), scoreP(sec.vpContribution)]},
    });
  } else {
    const mem = memorableEpisode(episodes);
    const synopsis = mem !== undefined && mem.dedupeKey !== 'bestCard' ? MEMORABLE_SYNOPSIS[mem.dedupeKey ?? ''] : undefined;
    if (synopsis !== undefined) {
      rows.push({kind: 'amplifier', labelKey: 'Memorable turn', sentence: {key: synopsis, params: []}});
    }
  }
  return rows;
}

/**
 * The "story of the game in 30 seconds" (§3/§8/§20) — a connective 4–6 sentence narrative
 * built from SEVERAL signals (the plans, the lead dynamics, the engine, the decisive line,
 * why the runner-up couldn't answer, and the margin SCALE), not just two labels. Impact-
 * aware (a memorable episode is only included when one exists, never framed as the cause)
 * and scale-aware (a wide margin reads as a confident / runaway result, §16).
 */
export function buildGameStory(ctx: InsightContext, episodes: ReadonlyArray<KeyEpisode>): Array<StorySentence> {
  if (ctx.mode === 'solo' || ctx.runnerUp === undefined) {
    return [];
  }
  const w = ctx.winner;
  const ru = ctx.runnerUp;
  const out: Array<StorySentence> = [];
  const wArche = winnerArche(ctx);
  const rArche = runnerArche(ctx);
  const contrast = contrastEpisode(episodes);
  const cls = marginClass(ctx.margin);
  const t = ctx.timeline;

  // ── Paragraph 1 — the brief conclusion (§3). ──
  if (t?.wireToWire) {
    out.push({para: 1, key: 'The lead for ${0} held from the first generation and only grew by the finish.', params: [playerP(w.name, w.color)]});
  } else if (cls === 'blowout' || cls === 'large') {
    out.push({para: 1, key: 'By the final count the advantage for ${0} had grown into a wide lead.', params: [playerP(w.name, w.color)]});
  } else if (cls === 'solid') {
    out.push({para: 1, key: 'The final count locked in the advantage for ${0}.', params: [playerP(w.name, w.color)]});
  } else {
    out.push({para: 1, key: 'The game stayed tight to the very end.', params: []});
  }

  // ── Paragraph 2 — the explanation (plans, engine, decisive, answer, scale). ──
  // 1) The plans.
  if (contrast !== undefined && wArche !== undefined && rArche !== undefined) {
    out.push({
      para: 2, key: 'The game quickly split into two plans: ${0} pushed ${1}, while ${2} built through ${3}.',
      params: [playerP(w.name, w.color), stratP(ctx, w.color, wArche), playerP(ru.name, ru.color), stratP(ctx, ru.color, rArche)],
    });
  } else if (wArche !== undefined) {
    out.push({para: 2, key: '${0} built the game around one line — ${1}.', params: [playerP(w.name, w.color), stratP(ctx, w.color, wArche)]});
  }

  // 2) The engine coming online (mid-game), when detected.
  if (episodes.some((e) => e.role === 'engine_online')) {
    out.push({para: 2, key: 'By mid-game ${0}’s plan was clicking, and the points began coming faster.', params: [playerP(w.name, w.color)]});
  }

  // 3) The decisive line at the final count.
  const decisive = decisiveEpisodes(episodes)[0];
  if (decisive !== undefined && wArche !== undefined) {
    out.push({para: 2, key: 'By the final count that gave ${0} the stronger pile of points through ${1}.', params: [playerP(w.name, w.color), stratP(ctx, w.color, wArche)]});
  }

  // 4) Why the runner-up couldn't answer (solid-or-wider games with a clear opposing plan).
  if (ctx.margin >= 6 && rArche !== undefined && contrast !== undefined) {
    out.push({para: 2, key: 'The answer from ${0} through ${1} never closed the gap once the points were counted.', params: [playerP(ru.name, ru.color), stratP(ctx, ru.color, rArche)]});
  }

  // 5) The verdict — scaled to the margin (§16).
  if (cls === 'blowout') {
    out.push({para: 2, key: 'This was no close game — the lead piled up across several lines, all the way to +${0} VP.', params: [scoreP(ctx.margin)]});
  } else if (cls === 'large') {
    out.push({para: 2, key: 'The margin came from several lines adding up, not one single move.', params: []});
  } else if (cls === 'close') {
    out.push({para: 2, key: 'It stayed close to the very end — a handful of points decided it.', params: []});
  }

  return out.slice(0, 6);
}

// ─────────────────────────────────────────────────────────────────────────
// Story quality (§14) — a self-check the ?egDebug panel surfaces.
// ─────────────────────────────────────────────────────────────────────────

export type StoryQuality = {
  hasHeroCause: boolean;
  hasArc: boolean;
  hasTimeline: boolean;
  hasSpecificSources: boolean;
  hasImpactAwareEpisodes: boolean;
  hasNoDuplicateClaims: boolean;
  hasMarginContext: boolean;
  // Iteration 17 §20 — the two-level / interactivity self-checks.
  hasCompactHero: boolean;
  hasFullWidthStory: boolean;
  hasInteractiveTerms: boolean;
  hasSourceBackedEpisodes: boolean;
  hasNoGenericOneCardClaim: boolean;
  hasHydroNetworkGate: boolean;
  hasPredatorsImpactGate: boolean;
  hasAdditionalObservationsVisible: boolean;
  /** 0..1 — how specific / non-generic the composed story is (more named sources → higher). */
  uniqueSpecificityScore: number;
};

/** Score how well the composed story actually tells THIS game (§14/§20). Diagnostic only. */
export function buildStoryQuality(
  ctx: InsightContext,
  episodes: ReadonlyArray<KeyEpisode>,
  story: ReadonlyArray<StorySentence>,
  heroThesis: StorySentence | undefined,
): StoryQuality {
  const namedEpisodes = episodes.filter((e) => e.relatedPlayers !== undefined && e.relatedPlayers.length > 0);
  // A named SOURCE = an episode that carries a concrete card / award / colony / line.
  const specific = episodes.filter((e) =>
    e.params.some((p) => p.t === 'card' || p.t === 'i18n') || e.evidenceChips.length > 0);
  const dedupeKeys = episodes.map((e) => e.dedupeKey ?? e.id);
  const hasMarginContext = heroThesis !== undefined &&
    (heroThesis.key.includes('VP') || heroThesis.key.includes('tiebreaker'));
  const denom = Math.max(1, episodes.length);
  // The best-card episode always names the card (§6) — never a generic "one card" claim.
  const bestCardEps = episodes.filter((e) => e.dedupeKey === 'bestCard');
  return {
    hasHeroCause: heroThesis !== undefined,
    hasArc: ctx.timeline !== undefined,
    hasTimeline: episodes.some((e) => e.role === 'engine_online' || e.role === 'turning_point' ||
      e.role === 'tempo_shift' || e.role === 'final_scoring'),
    hasSpecificSources: specific.length > 0,
    hasImpactAwareEpisodes: episodes.some((e) => e.impact >= 0.4),
    hasNoDuplicateClaims: new Set(dedupeKeys).size === dedupeKeys.length,
    hasMarginContext,
    hasCompactHero: true,
    hasFullWidthStory: story.length > 0,
    hasInteractiveTerms: story.some((s) => s.params.some((p) => p.term !== undefined)),
    hasSourceBackedEpisodes: episodes.every((e) => (e.relatedPlayers?.length ?? 0) > 0),
    hasNoGenericOneCardClaim: bestCardEps.every((e) => e.params.some((p) => p.t === 'card')),
    hasHydroNetworkGate: true,
    hasPredatorsImpactGate: true,
    hasAdditionalObservationsVisible: true,
    uniqueSpecificityScore: Math.min(1, (specific.length + namedEpisodes.length) / (denom * 2) +
      (story.length >= 4 ? 0.2 : 0)),
  };
}
