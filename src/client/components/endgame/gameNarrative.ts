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
import type {InsightContext, InsightParam} from '@/client/components/endgame/insightEngine';
import {strategyLabel} from '@/client/components/endgame/strategyArchetypes';
import {
  KeyEpisode, decisiveEpisodes, contrastEpisode, memorableEpisode, marginClass,
} from '@/client/components/endgame/keyEpisodeEngine';

export type StorySentence = {key: string; params: ReadonlyArray<InsightParam>};

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

function winnerPlan(ctx: InsightContext): string | undefined {
  const a = ctx.winner.strategyProfile?.primary?.archetype;
  return a !== undefined ? strategyLabel(a) : undefined;
}
function runnerPlan(ctx: InsightContext): string | undefined {
  const a = ctx.runnerUp?.strategyProfile?.primary?.archetype;
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
  const wPlan = winnerPlan(ctx);
  // 1) The main source of the lead.
  if (wPlan !== undefined) {
    rows.push({
      kind: 'cause', labelKey: 'Main source of the lead',
      sentence: {key: 'The final count settled in ${0}’s favour through ${1}.', params: [raw(ctx.winner.name), key(wPlan)]},
    });
  }
  // 2) The contrast of plans (duel only).
  const rPlan = runnerPlan(ctx);
  if (contrastEpisode(episodes) !== undefined && wPlan !== undefined && rPlan !== undefined) {
    rows.push({
      kind: 'contrast', labelKey: 'Contrast of plans',
      sentence: {key: 'The winner and the runner-up took different routes: ${0} against ${1}.', params: [key(wPlan), key(rPlan)]},
    });
  }
  // 3) The final amplifier (a real second scoring line, with its VP) OR a memorable twist —
  // never the generic best-card line (§6).
  const sec = (ctx.winner.strategyProfile?.secondary ?? []).find((d) => d.isScoring && d.vpContribution >= 6);
  if (sec !== undefined) {
    rows.push({
      kind: 'amplifier', labelKey: 'Final amplifier',
      sentence: {key: 'A second line of points came from ${0}: +${1} VP.', params: [key(strategyLabel(sec.archetype)), raw(sec.vpContribution)]},
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
  const out: Array<StorySentence> = [];
  const wPlan = winnerPlan(ctx);
  const rPlan = runnerPlan(ctx);
  const contrast = contrastEpisode(episodes);
  const cls = marginClass(ctx.margin);

  // 1) The plans.
  if (contrast !== undefined && wPlan !== undefined && rPlan !== undefined) {
    out.push({
      key: 'The game quickly split into two plans: ${0} pushed ${1}, while ${2} built through ${3}.',
      params: [raw(ctx.winner.name), key(wPlan), raw(ctx.runnerUp.name), key(rPlan)],
    });
  } else if (wPlan !== undefined) {
    out.push({key: '${0} built the game around one line — ${1}.', params: [raw(ctx.winner.name), key(wPlan)]});
  }

  // 2) The lead dynamics (how the game developed), when the timeline pins a shape.
  const t = ctx.timeline;
  if (t !== undefined) {
    if (t.wireToWire) {
      out.push({key: 'The lead for ${0} held from the first generation, and the gap only widened.', params: [raw(ctx.winner.name)]});
    } else if (t.maxDeficit < 4 && ctx.margin >= 16) {
      out.push({key: 'It ran level for a long stretch — the lead for ${0} grew only towards the finish.', params: [raw(ctx.winner.name)]});
    }
  }

  // 3) The engine coming online (mid-game), when detected.
  if (episodes.some((e) => e.role === 'engine_online')) {
    out.push({key: 'By mid-game ${0}’s plan was clicking, and the points began coming faster.', params: [raw(ctx.winner.name)]});
  }

  // 4) The decisive line at the final count.
  const decisive = decisiveEpisodes(episodes)[0];
  if (decisive !== undefined && wPlan !== undefined) {
    out.push({key: 'By the final count that gave ${0} the stronger pile of points through ${1}.', params: [raw(ctx.winner.name), key(wPlan)]});
  }

  // 5) Why the runner-up couldn't answer (solid-or-wider games with a clear opposing plan).
  if (ctx.margin >= 6 && rPlan !== undefined && contrast !== undefined) {
    out.push({key: 'The answer from ${0} through ${1} never closed the gap once the points were counted.', params: [raw(ctx.runnerUp.name), key(rPlan)]});
  }

  // 6) The verdict — scaled to the margin (§16).
  if (cls === 'blowout') {
    out.push({key: 'This was no close game — the lead piled up across several lines, all the way to +${0} VP.', params: [raw(ctx.margin)]});
  } else if (cls === 'large') {
    out.push({key: 'The margin came from several lines adding up, not one single move.', params: []});
  } else if (cls === 'solid') {
    out.push({key: '${0} stayed in front across the board and closed it out without drama.', params: [raw(ctx.winner.name)]});
  } else if (cls === 'close') {
    out.push({key: 'It stayed close to the very end — a handful of points decided it.', params: []});
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
  /** 0..1 — how specific / non-generic the composed story is (more named sources → higher). */
  uniqueSpecificityScore: number;
};

/** Score how well the composed story actually tells THIS game (§14). Diagnostic only. */
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
  return {
    hasHeroCause: heroThesis !== undefined,
    hasArc: ctx.timeline !== undefined,
    hasTimeline: episodes.some((e) => e.role === 'engine_online' || e.role === 'turning_point' ||
      e.role === 'tempo_shift' || e.role === 'final_scoring'),
    hasSpecificSources: specific.length > 0,
    hasImpactAwareEpisodes: episodes.some((e) => e.impact >= 0.4),
    hasNoDuplicateClaims: new Set(dedupeKeys).size === dedupeKeys.length,
    hasMarginContext,
    uniqueSpecificityScore: Math.min(1, (specific.length + namedEpisodes.length) / (denom * 2) +
      (story.length >= 4 ? 0.2 : 0)),
  };
}
