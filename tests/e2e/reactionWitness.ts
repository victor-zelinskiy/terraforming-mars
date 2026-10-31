/*
 * THE REACTION IDENTITY WITNESS (P82 Special Permit's polish — «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА», the owner's
 * field report of 2026-10-31: «иногда вместе с фактической картой сработавшего эффекта рядом поднимаются ещё ЛЕВЫЕ
 * карты, а иногда карта поднимается с левой картой ПОД ней»). A frame grab sees a pose; this witness sees the CHAIN:
 * a `MutationObserver` on the reaction layer and every lift attribute, plus a `setInterval` sampler every 16 ms (never
 * rAF — a quiet compositor stops it exactly while these scenes run), each sample reading the live DOM against the
 * director's DECLARATION (`__conReady().reaction.declared` — every reactor it brought forward, its group's `seq`, how):
 *
 *  - DECLARED  — the groups the chain says are on screen;
 *  - PAINTED   — every `.con-reaction__face` with computed visibility ≠ hidden and opacity > .05;
 *  - LIFTED    — every `[data-reaction-lifted]` and the card hooks inside the element that moves;
 *  - VERDICT   — `foreign-face` · `stacked-faces` (> 20 % of the smaller) · `lift-carries-another` · `two-instances` ·
 *                `warm-painted` — the same five rules as the product's sentinel (`reactionIdentity.ts`).
 *
 * `armReactionWitness(page)` before the press, `reactionStory(page)` after the scene. The harness arms it on EVERY page
 * when `TM_E2E_REACTION_WITNESS=1` (`consoleTest.ts` `reactionFaceGuard` — the audit runs of «до / после»).
 */
import type {Page} from '@playwright/test';

export type ReactionVerdictKind = 'foreign-face' | 'stacked-faces' | 'lift-carries-another' | 'two-instances' | 'warm-painted';

export type ReactionVerdict = {kind: ReactionVerdictKind, card: string, why: string, t: number};

export type ReactionStory = {
  samples: number,
  /** Every distinct card that stood PAINTED in the layer or LIFTED in its place, with how often. */
  faces: Record<string, number>,
  /** The most faces (layer + lifted) on screen at once. */
  maxFaces: number,
  /** Every verdict (deduped by kind × card), with the first time it was seen (ms from arming) and how many samples. */
  verdicts: Array<ReactionVerdict & {count: number}>,
  /** The cards the director declared at any point. */
  declared: Array<string>,
};

/**
 * The page-side sampler — SELF-CONTAINED (it runs through `page.evaluate` and through `addInitScript`). Idempotent:
 * a second install restarts it.
 */
export function installReactionWitness(everyMs: number): void {
  type Declared = {key: string, seq: number, card: string, via: 'place' | 'seat'};
  type W = {samples: number, faces: Record<string, number>, maxFaces: number, verdicts: Record<string, {kind: string, card: string, why: string, t: number, count: number}>, declared: Record<string, true>, stop: () => void};
  const win = window as unknown as {__reactionWitness?: W, __conReady?: () => {reaction?: {declared?: Array<Declared>}}};
  win.__reactionWitness?.stop();
  const t0 = performance.now();
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
  const w: W = {samples: 0, faces: {}, maxFaces: 0, verdicts: {}, declared: {}, stop: () => {}};
  const note = (kind: string, card: string, why: string) => {
    const id = `${kind}|${card}`;
    const v = w.verdicts[id];
    if (v === undefined) {
      w.verdicts[id] = {kind, card, why, t: Math.round(performance.now() - t0), count: 1};
    } else {
      v.count++;
    }
  };
  const sample = () => {
    if (typeof document === 'undefined' || document.body === null) {
      return;
    }
    // The DECLARATION is read on EVERY sample: a reactor the host's own stage brings forward (the receiving stage's
    // emergence) paints nothing in the layer and wears no lift attribute — only the declaration says it rose.
    let declared: Array<Declared> = [];
    try {
      declared = win.__conReady?.().reaction?.declared ?? [];
    } catch {
      declared = [];
    }
    declared.forEach((d) => {
      w.declared[d.card] = true;
    });
    const layerFaces = Array.from(document.querySelectorAll<HTMLElement>('.con-reaction__face'));
    const lifted = Array.from(document.querySelectorAll<HTMLElement>('[data-reaction-lifted]'));
    if (layerFaces.length === 0 && lifted.length === 0) {
      return;
    }
    const byKey = new Map(declared.map((d) => [d.key, d]));
    const liftedCards = new Set(declared.filter((d) => d.via === 'place').map((d) => d.card));
    w.samples++;
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
      w.faces[card] = (w.faces[card] ?? 0) + 1;
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
      w.faces[`${card}@place`] = (w.faces[`${card}@place`] ?? 0) + 1;
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
    w.maxFaces = Math.max(w.maxFaces, shown.length + liftedCount);
  };
  const timer = window.setInterval(sample, everyMs);
  let observer: MutationObserver | undefined;
  const observe = () => {
    if (typeof MutationObserver === 'undefined' || document.documentElement === null) {
      return;
    }
    observer = new MutationObserver(() => sample());
    observer.observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['data-reaction-lifted', 'data-reaction-card', 'data-reaction-warm', 'style', 'class']});
  };
  if (document.documentElement !== null) {
    observe();
  } else {
    document.addEventListener('DOMContentLoaded', observe, {once: true});
  }
  w.stop = () => {
    window.clearInterval(timer);
    observer?.disconnect();
  };
  win.__reactionWitness = w;
}

/** Arm the witness on `page` (idempotent) — before the press that starts the scene. */
export async function armReactionWitness(page: Page, everyMs = 16): Promise<void> {
  await page.evaluate(installReactionWitness, everyMs);
}

/** What the witness saw since it was armed (it keeps sampling). */
export async function reactionStory(page: Page): Promise<ReactionStory> {
  return page.evaluate(() => {
    const w = (window as unknown as {__reactionWitness?: {samples: number, faces: Record<string, number>, maxFaces: number, verdicts: Record<string, ReactionVerdict & {count: number}>, declared: Record<string, true>}}).__reactionWitness;
    if (w === undefined) {
      return {samples: 0, faces: {}, maxFaces: 0, verdicts: [], declared: []};
    }
    return {samples: w.samples, faces: {...w.faces}, maxFaces: w.maxFaces, verdicts: Object.values(w.verdicts), declared: Object.keys(w.declared)};
  });
}

/** A one-line reading of a story for a failure message / an annotation. */
export function describeReactionStory(story: ReactionStory): string {
  const verdicts = story.verdicts.map((v) => `${v.kind}:${v.card}×${v.count}@${v.t}ms (${v.why})`).join('; ');
  return `samples=${story.samples} maxFaces=${story.maxFaces} declared=[${story.declared.join(', ')}] faces=${JSON.stringify(story.faces)}${verdicts === '' ? '' : ` VERDICTS: ${verdicts}`}`;
}
