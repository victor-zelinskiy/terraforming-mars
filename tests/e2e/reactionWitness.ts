/*
 * THE REACTION IDENTITY WITNESS (P82 Special Permit's polish — «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА», the owner's
 * field report of 2026-10-31: «иногда вместе с фактической картой сработавшего эффекта рядом поднимаются ещё ЛЕВЫЕ
 * карты, а иногда карта поднимается с левой картой ПОД ней»). A frame grab sees a pose; this witness sees the CHAIN,
 * RECORDED on the replace-proof recorder (`transientRecorder.ts`, FLAKE ZERO): every write of the product observed in
 * the task that makes it, `settled` (the verdicts are COEXISTENCE claims — two faces at once, a lift carrying another —
 * so a sample is the state a task LEAVES, never one between two of its writes), plus a frame tick for what only a
 * compositor-driven motion moves; each change pushed to the Node side at once (a page the product replaces neither loses
 * the story nor stops it). Each sample reads the live DOM against the director's DECLARATION
 * (`__conReady().reaction.declared` — every reactor it brought forward, its group's `seq`, how):
 *
 *  - DECLARED  — the groups the chain says are on screen;
 *  - PAINTED   — every `.con-reaction__face` with computed visibility ≠ hidden and opacity > .05;
 *  - LIFTED    — every `[data-reaction-lifted]` and the card hooks inside the element that moves;
 *  - VERDICT   — `foreign-face` · `stacked-faces` (> 20 % of the smaller) · `lift-carries-another` · `two-instances` ·
 *                `warm-painted` — the same five rules as the product's sentinel (`reactionIdentity.ts`).
 *
 * `armReactionWitness(page)` before the press, `reactionStory(page)` after the scene. The harness arms it on EVERY page
 * of the test's context when `TM_E2E_REACTION_WITNESS=1` (`consoleTest.ts` `reactionFaceGuard` through
 * `armReactionWitnessOn` — the audit runs of «до / после»).
 */
import type {BrowserContext, Page} from '@playwright/test';
import {readTransient, recordTransient, TransientSample} from './transientRecorder';

export type ReactionVerdictKind = 'foreign-face' | 'stacked-faces' | 'lift-carries-another' | 'two-instances' | 'warm-painted';

export type ReactionVerdict = {kind: ReactionVerdictKind, card: string, why: string, t: number};

export type ReactionStory = {
  /** The distinct recorded states with a reaction face on screen (painted in the layer or lifted in its place). */
  samples: number,
  /** Every distinct card that stood PAINTED in the layer or LIFTED in its place, with in how many of those states. */
  faces: Record<string, number>,
  /** The most faces (layer + lifted) on screen at once. */
  maxFaces: number,
  /** Every verdict (deduped by kind × card), with the first time it was seen (ms from arming) and in how many states. */
  verdicts: Array<ReactionVerdict & {count: number}>,
  /** The cards the director declared at any point. */
  declared: Array<string>,
};

/** One reading: the declaration, and — while a face is on screen — what stands and what the rules say about it. */
type ReactionObservation = {
  declared: Array<string>,
  /** A face painted in the layer or lifted in its place. */
  on: boolean,
  /** Each painted layer face by its card, each lifted one as `<card>@place`. */
  faces: Array<string>,
  /** Faces on screen at once (layer + lifted). */
  count: number,
  /** `[kind, card, why]`, one per kind × card. */
  verdicts: Array<[ReactionVerdictKind, string, string]>,
};

const KEY = 'reaction-witness';
/** The page's `Date.now()` at the arm — the origin of a verdict's `t`. */
const ORIGIN = new WeakMap<Page, number>();

/** The page half — SELF-CONTAINED (serialized into every document the page loads). */
function readReactions(): ReactionObservation {
  type Declared = {key: string, seq: number, card: string, via: 'place' | 'seat'};
  const win = window as unknown as {__conReady?: () => {reaction?: {declared?: Array<Declared>}}};
  // The DECLARATION is read on EVERY sample: a reactor the host's own stage brings forward (the receiving stage's
  // emergence) paints nothing in the layer and wears no lift attribute — only the declaration says it rose.
  let declared: Array<Declared> = [];
  try {
    declared = win.__conReady?.().reaction?.declared ?? [];
  } catch {
    declared = [];
  }
  const declaredCards = declared.map((d) => d.card);
  const layerFaces = Array.from(document.querySelectorAll<HTMLElement>('.con-reaction__face'));
  const lifted = Array.from(document.querySelectorAll<HTMLElement>('[data-reaction-lifted]'));
  if (layerFaces.length === 0 && lifted.length === 0) {
    return {declared: declaredCards, on: false, faces: [], count: 0, verdicts: []};
  }
  const HOOKS = '[data-reaction-home], [data-composer-card], [data-played-key]';
  const ATTRS = ['data-reaction-home', 'data-composer-card', 'data-played-face', 'data-played-key'];
  const cardOf = (el: Element): string | undefined => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v !== null && v !== '') {
        return v;
      }
    }
    return undefined;
  };
  const painted = (el: HTMLElement): boolean => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') {
      return false;
    }
    const o = Number.parseFloat(cs.opacity);
    if (Number.isFinite(o) && o <= 0.05) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const overlap = (a: DOMRect, b: DOMRect): number => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w <= 0 || h <= 0) {
      return 0;
    }
    const smaller = Math.min(a.width * a.height, b.width * b.height);
    return smaller <= 0 ? 0 : (w * h) / smaller;
  };
  const verdicts: Array<[ReactionVerdictKind, string, string]> = [];
  const note = (kind: ReactionVerdictKind, card: string, why: string) => {
    if (!verdicts.some(([k, c]) => k === kind && c === card)) {
      verdicts.push([kind, card, why]);
    }
  };
  const faces: Array<string> = [];
  const byKey = new Map(declared.map((d) => [d.key, d]));
  const liftedCards = new Set(declared.filter((d) => d.via === 'place').map((d) => d.card));
  const shown: Array<{card: string, rect: DOMRect}> = [];
  for (const el of layerFaces) {
    if (!painted(el)) {
      continue;
    }
    const warm = el.getAttribute('data-reaction-warm');
    if (warm !== null) {
      note('warm-painted', warm, 'a warm face (mounted ahead of its rise) is painted');
      continue;
    }
    const card = el.getAttribute('data-reaction-card') ?? '?';
    const key = el.getAttribute('data-reaction-key') ?? '';
    const d = byKey.get(key);
    if (d === undefined || d.via !== 'seat') {
      note('foreign-face', card, `a layer face (${key}) no rise of the chain declared`);
    }
    faces.push(card);
    shown.push({card, rect: el.getBoundingClientRect()});
  }
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const share = overlap(shown[i].rect, shown[j].rect);
      if (share > 0.2) {
        note('stacked-faces', `${shown[i].card}+${shown[j].card}`, `two layer faces overlap ${Math.round(share * 100)} %`);
      }
    }
  }
  let liftedCount = 0;
  for (const el of lifted) {
    const hook = el.matches(HOOKS) ? el : el.closest(HOOKS);
    const card = hook === null ? undefined : cardOf(hook);
    liftedCount++;
    if (card === undefined) {
      note('foreign-face', '?', 'a lifted element on no card face');
      continue;
    }
    faces.push(`${card}@place`);
    if (!liftedCards.has(card)) {
      note('foreign-face', card, 'a face lifted in its place that no rise of the chain declared');
    }
    const others = Array.from(el.querySelectorAll(HOOKS)).map(cardOf).filter((c): c is string => c !== undefined && c !== card);
    if (others.length > 0) {
      note('lift-carries-another', card, `the lift moves ${[...new Set(others)].join(', ')} too`);
    }
    if (shown.some((f) => f.card === card)) {
      note('two-instances', card, 'lifted in its place AND painted in the layer');
    }
  }
  return {declared: declaredCards, on: true, faces, count: shown.length + liftedCount, verdicts};
}

/** The story of a recording — the declaration's union, and every state a face stood in. */
function foldStory(recorded: ReadonlyArray<TransientSample<ReactionObservation | null>>, origin: number | undefined): ReactionStory {
  const base = origin ?? recorded[0]?.t ?? 0;
  const story: ReactionStory = {samples: 0, faces: {}, maxFaces: 0, verdicts: [], declared: []};
  const verdicts = new Map<string, ReactionVerdict & {count: number}>();
  for (const s of recorded) {
    const v = s.v;
    if (v === null) {
      continue;
    }
    for (const card of v.declared) {
      if (!story.declared.includes(card)) {
        story.declared.push(card);
      }
    }
    if (!v.on) {
      continue;
    }
    story.samples++;
    for (const face of v.faces) {
      story.faces[face] = (story.faces[face] ?? 0) + 1;
    }
    story.maxFaces = Math.max(story.maxFaces, v.count);
    for (const [kind, card, why] of v.verdicts) {
      const id = `${kind}|${card}`;
      const known = verdicts.get(id);
      if (known === undefined) {
        verdicts.set(id, {kind, card, why, t: Math.round(s.t - base), count: 1});
      } else {
        known.count++;
      }
    }
  }
  story.verdicts = [...verdicts.values()];
  return story;
}

/** Arm the witness on `page` — before the press that starts the scene. Re-arming starts a fresh story. */
export async function armReactionWitness(page: Page): Promise<void> {
  ORIGIN.set(page, await page.evaluate(() => Date.now()));
  await recordTransient(page, KEY, readReactions, {settled: true, max: 100_000});
}

/**
 * Arm the witness on EVERY page of `context` — the ones open now and every one it opens later (the audit runs'
 * `TM_E2E_REACTION_WITNESS=1`). A page armed before its first navigation is recorded from that document's start (the
 * recorder's init script); resolves once the pages open now are armed. Never throws — a page that closes while it is
 * being armed has nothing to file.
 */
export async function armReactionWitnessOn(context: BrowserContext): Promise<void> {
  const arm = (page: Page) => armReactionWitness(page).catch(() => undefined);
  context.on('page', (page) => void arm(page));
  await Promise.all(context.pages().map(arm));
}

/** What the witness saw since it was armed (it keeps recording). */
export async function reactionStory(page: Page): Promise<ReactionStory> {
  return foldStory(await readTransient<ReactionObservation | null>(page, KEY), ORIGIN.get(page));
}

/** A one-line reading of a story for a failure message / an annotation. */
export function describeReactionStory(story: ReactionStory): string {
  const verdicts = story.verdicts.map((v) => `${v.kind}:${v.card}×${v.count}@${v.t}ms (${v.why})`).join('; ');
  return `samples=${story.samples} maxFaces=${story.maxFaces} declared=[${story.declared.join(', ')}] faces=${JSON.stringify(story.faces)}${verdicts === '' ? '' : ` VERDICTS: ${verdicts}`}`;
}
