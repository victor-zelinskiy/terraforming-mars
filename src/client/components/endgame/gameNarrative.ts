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
  KeyEpisode, decisiveEpisodes, contrastEpisode, memorableEpisode,
} from '@/client/components/endgame/keyEpisodeEngine';

export type StorySentence = {key: string; params: ReadonlyArray<InsightParam>};

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
 * The HERO thesis (§16): decisive driver + structural contrast. A low-impact episode
 * (e.g. a 5-VP award at a +42 margin) is NEVER the headline.
 */
export function buildHeroThesis(ctx: InsightContext, episodes: ReadonlyArray<KeyEpisode>): StorySentence | undefined {
  if (ctx.runnerUp === undefined) {
    return undefined;
  }
  const wPlan = winnerPlan(ctx);
  const rPlan = runnerPlan(ctx);
  const contrast = contrastEpisode(episodes);
  const decisive = decisiveEpisodes(episodes)[0];
  if (contrast !== undefined && wPlan !== undefined && rPlan !== undefined) {
    return {
      key: '${0} won it at the final count: ${1} delivered the decisive points while ${2} led through ${3}.',
      params: [raw(ctx.winner.name), key(wPlan), raw(ctx.runnerUp.name), key(rPlan)],
    };
  }
  if (decisive !== undefined && wPlan !== undefined) {
    return {
      key: '${0} won through one clear line — ${1} delivered the decisive block of points by the finish.',
      params: [raw(ctx.winner.name), key(wPlan)],
    };
  }
  return {
    key: '${0} won with a steady, all-round game rather than one decisive move.',
    params: [raw(ctx.winner.name)],
  };
}

/**
 * The "story of the game in 30 seconds" (§8) — 3–5 connective sentences. Impact-aware:
 * the memorable episode is only included when one exists, and never framed as the cause.
 */
export function buildGameStory(ctx: InsightContext, episodes: ReadonlyArray<KeyEpisode>): Array<StorySentence> {
  if (ctx.mode === 'solo' || ctx.runnerUp === undefined) {
    return [];
  }
  const out: Array<StorySentence> = [];
  const wPlan = winnerPlan(ctx);
  const rPlan = runnerPlan(ctx);
  const contrast = contrastEpisode(episodes);

  // 1) The plans.
  if (contrast !== undefined && wPlan !== undefined && rPlan !== undefined) {
    out.push({
      key: 'The game quickly split into two plans: ${0} pushed ${1}, while ${2} built through ${3}.',
      params: [raw(ctx.winner.name), key(wPlan), raw(ctx.runnerUp.name), key(rPlan)],
    });
  } else if (wPlan !== undefined) {
    out.push({key: '${0} built the game around one line — ${1}.', params: [raw(ctx.winner.name), key(wPlan)]});
  }

  // 2) The engine coming online (mid-game), when detected.
  if (episodes.some((e) => e.role === 'engine_online')) {
    out.push({key: 'By mid-game ${0}’s plan was clicking, and the points began coming faster.', params: [raw(ctx.winner.name)]});
  }

  // 3) The decisive line at the final count.
  const decisive = decisiveEpisodes(episodes)[0];
  if (decisive !== undefined && wPlan !== undefined) {
    out.push({key: 'By the final count that gave ${0} the stronger pile of points through ${1}.', params: [raw(ctx.winner.name), key(wPlan)]});
  }

  // 4) The turning point OR the memorable episode (one, impact-aware).
  const turning = episodes.find((e) => e.role === 'turning_point' && e.impact >= 0.4);
  const memorable = memorableEpisode(episodes);
  if (turning !== undefined) {
    out.push({key: 'Late on, ${0} pulled ahead for good and held the lead to the finish.', params: [raw(ctx.winner.name)]});
  } else if (memorable !== undefined && memorable.role === 'ironic_twist') {
    out.push({
      key: 'The most memorable beat was the award going to the wrong player — a vivid turn of the final count, even if it didn’t decide the result.',
      params: [],
    });
  }

  // 5) The verdict — wide vs close.
  if (ctx.margin >= 20) {
    out.push({key: 'The margin came from several lines adding up, not one single move.', params: []});
  } else if (ctx.margin > 0 && ctx.margin <= 6) {
    out.push({key: 'It stayed close to the very end — a handful of points decided it.', params: []});
  }

  return out.slice(0, 5);
}
