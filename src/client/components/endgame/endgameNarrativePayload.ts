/*
 * Build the SANITIZED `EndgameNarrativePayload` for the AI story layer (Iteration 20 §14).
 *
 * The deterministic engine has already decided EVERY fact (winner, margin, scale / pattern /
 * rarity, the scoring lines, the decisive vs. secondary vs. not-decisive roles, what must NOT
 * be over-claimed). This builder projects that into a plain, model-free payload the AI may
 * only RE-WORD. Translators are INJECTED (`t` for labels, `compose` for sentence templates)
 * so the module is pure + unit-testable; the client passes the real i18n functions.
 *
 * ── Architecture (the remaining server wiring, documented per §10–§12) ──
 *   1. On game end / first final open, the client POSTs this payload to a BACKEND route
 *      (e.g. `/api/game/endgame-story`). The OpenAI key lives ONLY in `process.env`
 *      (`OPENAI_API_KEY`), gated by `ENDGAME_AI_STORY_ENABLED`; the browser never sees it.
 *   2. The server calls OpenAI with the system prompt (§15), parses the JSON answer, runs
 *      `validateAiStory` (common/endgame/aiStory) — one repair retry, then deterministic
 *      fallback — and caches the result per game so every client sees the SAME story.
 *   3. The client polls the story STATE (disabled/pending/ready/failed/fallback) and renders
 *      the AI story when ready, a skeleton while pending, and the deterministic story
 *      otherwise. AI is an enhancement, never a dependency (§19).
 */
import type {EndgameModel} from '@/client/components/endgame/endgameModel';
import type {InsightParam} from '@/client/components/endgame/insightEngine';
import {strategyLabel} from '@/client/components/endgame/strategyArchetypes';
import {decisiveEpisodes, timelineEpisodes, unusualEpisodes, contrastEpisode} from '@/client/components/endgame/keyEpisodeEngine';
import type {EndgameNarrativePayload, StoryEvidenceLite} from '@/common/endgame/aiStory';

export type PayloadGameMeta = {name: string; generations: number; playerCount: number; expansions: ReadonlyArray<string>};
/** Translate an i18n key (label). */
export type TFn = (key: string) => string;
/** Compose a sentence template + typed params into final text. */
export type ComposeFn = (key: string, params: ReadonlyArray<InsightParam>) => string;

export function buildNarrativePayload(
  model: EndgameModel,
  meta: PayloadGameMeta,
  t: TFn,
  compose: ComposeFn,
): EndgameNarrativePayload | undefined {
  const winner = model.winner;
  if (winner === undefined || model.mode === 'solo') {
    return undefined;
  }
  const v = model.finishVerdict;
  const players = model.players.map((p) => {
    const prof = p.strategyProfile;
    const sources: Array<StoryEvidenceLite> = (prof?.all ?? [])
      .filter((d) => d.isScoring && d.vpContribution >= 6)
      .slice(0, 3)
      .map((d) => ({label: t(strategyLabel(d.archetype)), value: `+${d.vpContribution}`, confidence: d.confidence}));
    return {
      name: p.name,
      corporation: p.corporations.length > 0 ? t(p.corporations[0]) : '',
      score: p.total,
      primaryLine: prof?.primary !== undefined ? t(strategyLabel(prof.primary.archetype)) : undefined,
      secondaryLines: (prof?.secondary ?? []).map((d) => t(strategyLabel(d.archetype))),
      strongestSources: sources,
    };
  });

  // Decisive facts — the engine's roles (so the AI can't promote a secondary line).
  const decisiveFacts: Array<{role: 'main_driver' | 'secondary_driver' | 'contrast' | 'unusual' | 'not_decisive'; text: string}> = [];
  const drivers = decisiveEpisodes(model.keyEpisodes);
  drivers.forEach((e, i) => decisiveFacts.push({role: i === 0 ? 'main_driver' : 'secondary_driver', text: compose(e.textKey, e.params)}));
  const contrast = contrastEpisode(model.keyEpisodes);
  if (contrast !== undefined) {
    decisiveFacts.push({role: 'contrast', text: compose(contrast.textKey, contrast.params)});
  }

  const keyEpisodes = timelineEpisodes(model.keyEpisodes).map((e) => ({
    phase: e.generation !== undefined ? `gen ${e.generation}` : e.phase,
    sourceName: undefined,
    text: compose(e.textKey, e.params),
    confidence: e.confidence,
  }));
  const unusual = unusualEpisodes(model.keyEpisodes).map((e) => ({sourceName: undefined, text: compose(e.textKey, e.params)}));

  const rarity = v?.rarity ?? 'common';
  const isRare = rarity === 'rare' || rarity === 'legendary';
  return {
    locale: 'ru',
    game: {name: meta.name, generations: meta.generations, playerCount: meta.playerCount, expansions: meta.expansions},
    result: {
      winner: winner.name,
      runnerUp: model.runnerUp?.name,
      margin: model.margin,
      marginScale: v?.scale ?? 'large',
      finishPattern: v?.pattern ?? 'normal',
      rarity,
    },
    players,
    decisiveFacts,
    keyEpisodes,
    unusualEpisodes: unusual,
    constraints: {
      maxSentences: 4,
      tone: 'premium_fresh',
      // §16 — never let the model call the finish "rare" unless the engine did.
      doNotMention: isRare ? [] : ['редкий', 'редкость'],
      mustMention: [winner.name],
      forbiddenClaims: ['решил игру', 'решающая карта'],
      avoidOverclaiming: true,
    },
  };
}
