/*
 * AI-generated endgame STORY — shared types + output validation (Iteration 20 §10–§20).
 *
 * The AI is a strictly-bounded EDITORIAL layer: the deterministic engine builds a SANITIZED
 * `EndgameNarrativePayload` of already-verified facts, the model only re-words them, and the
 * server VALIDATES the output before it is ever shown. The AI never decides facts.
 *
 * This module is PURE (no Vue / DOM / network) so both the server route and the unit tests
 * share one validator. Putting it in `common` keeps the contract identical on both sides.
 */

export type EndgameAiStoryStatus = 'disabled' | 'pending' | 'ready' | 'failed' | 'fallback';

export type EndgameAiStory = {
  title: string;
  paragraphs: ReadonlyArray<string>;
  mentionedFactIds: ReadonlyArray<string>;
  model?: string;
  generatedAt?: string;
  storyVersion?: string;
  confidence?: 'high' | 'medium' | 'low';
};

export type EndgameAiStoryState = {
  status: EndgameAiStoryStatus;
  story?: EndgameAiStory;
  errorCode?: string;
};

/** A thin evidence row in the payload (no client types — plain data only). */
export type StoryEvidenceLite = {label: string; value?: string; confidence: 'measured' | 'partial' | 'derived' | 'low' | 'medium' | 'high'};

/** The SANITIZED structured recap sent to the model — already-verified facts only. */
export type EndgameNarrativePayload = {
  locale: 'ru';
  game: {name: string; generations: number; playerCount: number; expansions: ReadonlyArray<string>};
  result: {winner: string; runnerUp?: string; margin: number; marginScale: string; finishPattern: string; rarity: string};
  players: ReadonlyArray<{
    name: string;
    corporation: string;
    score: number;
    primaryLine?: string;
    secondaryLines: ReadonlyArray<string>;
    strongestSources: ReadonlyArray<StoryEvidenceLite>;
  }>;
  decisiveFacts: ReadonlyArray<{role: 'main_driver' | 'secondary_driver' | 'contrast' | 'unusual' | 'not_decisive'; text: string}>;
  keyEpisodes: ReadonlyArray<{phase?: string; sourceName?: string; text: string; confidence: string}>;
  unusualEpisodes: ReadonlyArray<{sourceName?: string; text: string}>;
  constraints: {
    maxSentences: number;
    tone: string;
    doNotMention: ReadonlyArray<string>;
    mustMention: ReadonlyArray<string>;
    forbiddenClaims: ReadonlyArray<string>;
    avoidOverclaiming: boolean;
  };
};

export type AiStoryValidation = {ok: boolean; errors: ReadonlyArray<string>};

/** Every number the model is ALLOWED to use (margin, scores, source values). */
function allowedNumbers(payload: EndgameNarrativePayload): Set<number> {
  const nums = new Set<number>();
  nums.add(payload.result.margin);
  nums.add(payload.game.generations);
  for (const p of payload.players) {
    nums.add(p.score);
    for (const s of p.strongestSources) {
      const v = s.value !== undefined ? parseInt(s.value.replace(/[^\d-]/g, ''), 10) : NaN;
      if (!Number.isNaN(v)) {
        nums.add(Math.abs(v));
      }
    }
  }
  return nums;
}

/**
 * Validate a model's story against the payload (§16). Rejects: wrong shape, too many
 * sentences, invented numbers, invented player names, "редкий"-class claims when the
 * finish is not rare/legendary, and explicit forbidden claims. Returns the error list.
 */
export function validateAiStory(output: unknown, payload: EndgameNarrativePayload): AiStoryValidation {
  const errors: Array<string> = [];
  const o = output as Partial<EndgameAiStory> | null;
  if (o === null || typeof o !== 'object' || typeof o.title !== 'string' || !Array.isArray(o.paragraphs)) {
    return {ok: false, errors: ['shape: expected {title: string, paragraphs: string[]}']};
  }
  const paragraphs = o.paragraphs.filter((p): p is string => typeof p === 'string');
  if (paragraphs.length === 0) {
    errors.push('empty: no paragraphs');
  }
  const text = [o.title, ...paragraphs].join(' ');

  // Sentence count.
  const sentences = text.split(/[.!?…]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (sentences.length > payload.constraints.maxSentences + 1) {
    errors.push(`length: ${sentences.length} sentences > max ${payload.constraints.maxSentences}`);
  }

  // The winner (and every must-mention) has to appear.
  for (const must of payload.constraints.mustMention) {
    if (!text.includes(must)) {
      errors.push(`mustMention: missing "${must}"`);
    }
  }

  // Rarity honesty — no "редк…" wording unless the finish is genuinely rare/legendary.
  const claimsRare = /редк/i.test(text);
  if (claimsRare && payload.result.rarity !== 'rare' && payload.result.rarity !== 'legendary') {
    errors.push('overclaim: "редк…" used on a non-rare finish');
  }
  // Explicit forbidden claims + the do-not-mention list.
  for (const phrase of [...payload.constraints.forbiddenClaims, ...payload.constraints.doNotMention]) {
    if (phrase.length > 0 && text.toLowerCase().includes(phrase.toLowerCase())) {
      errors.push(`forbidden: contains "${phrase}"`);
    }
  }

  // Invented player names: any capitalised Latin token must be a known player/corp name.
  const knownNames = new Set<string>();
  for (const p of payload.players) {
    knownNames.add(p.name);
    if (p.corporation.length > 0) {
      knownNames.add(p.corporation);
    }
  }
  for (const token of text.match(/[A-Z][A-Za-z]{2,}/g) ?? []) {
    if (![...knownNames].some((n) => n.includes(token))) {
      errors.push(`invented name: "${token}"`);
    }
  }

  // Invented numbers: every number used must be an allowed one.
  const allowed = allowedNumbers(payload);
  for (const tok of text.match(/\d+/g) ?? []) {
    const n = parseInt(tok, 10);
    if (!allowed.has(n)) {
      errors.push(`invented number: ${n}`);
    }
  }

  return {ok: errors.length === 0, errors};
}
