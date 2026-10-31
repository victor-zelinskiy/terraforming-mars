/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE IDENTITY OF A RISE — «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА» (P82 Special Permit's polish, the owner's
 * field report of 2026-10-31: «иногда вместе с фактической картой сработавшего эффекта рядом поднимаются ещё ЛЕВЫЕ
 * карты, а иногда карта поднимается с левой картой ПОД ней»; contract `docs/claude/console/card-reaction.md`
 * § ИДЕНТИЧНОСТЬ ПОДЪЁМА). The director DECLARES every reactor it brings forward (`noteReactorRising` — before the
 * face moves, never after) and lets it go once it has settled (`noteReactorSettled`); this module reads the LIVE DOM
 * against that declaration and names every face the player can see moving that nobody declared:
 *
 *  - `foreign-face`         a painted layer face, or a face lifted in its place, whose group is not declared;
 *  - `stacked-faces`        two painted layer faces overlapping more than a fifth of the smaller one;
 *  - `lift-carries-another` the element a lift in place moves holds ANOTHER card's face;
 *  - `two-instances`        one card both lifted in its place AND painted in the layer;
 *  - `warm-painted`         a WARM face (mounted ahead of its rise) painted.
 *
 * The verdicts are a READ — nothing here moves, waits or hides anything. The director asks after every step of a
 * chain (a rise, a settle) and the sentinel says it out loud in every build: `[reaction] foreign face …` — red on
 * every e2e spec (`tests/e2e/consoleTest.ts` `reactionFaceGuard`). The e2e witness (`tests/e2e/reactionWitness.ts`)
 * runs the same five checks page-side every 16 ms against `__conReady().reaction` — the declaration published here.
 */
import {CardName} from '@/common/cards/CardName';

export type RisenVia = 'place' | 'seat';

/** One reactor the director has declared on screen: its group (the record's `seq`), its card, how it came forward. */
export type DeclaredReactor = {key: string; seq: number; card: CardName; via: RisenVia};

export type ReactionIdentityVerdictKind = 'foreign-face' | 'stacked-faces' | 'lift-carries-another' | 'two-instances' | 'warm-painted';

export type ReactionIdentityVerdict = {kind: ReactionIdentityVerdictKind; card: string; why: string};

const declared = new Map<string, DeclaredReactor>();

/** The groups let go without a rise (expired / summarized / cut), newest last — the probe's read. */
const letGo: Array<{card: CardName; seq: number; why: string}> = [];

/** Declare a reactor BEFORE its face moves (a lift in place, a seat at the stage). */
export function noteReactorRising(reactor: DeclaredReactor): void {
  declared.set(reactor.key, reactor);
}

/** The reactor has settled / receded — its face no longer moves for the chain. */
export function noteReactorSettled(key: string): void {
  declared.delete(key);
}

/** Every declaration dropped (a cut, an abort, a reset). */
export function clearDeclaredReactors(): void {
  declared.clear();
}

/** A group the chain let go without bringing it forward (named — never a silent drop). */
export function noteReactionLetGo(card: CardName, seq: number, why: string): void {
  letGo.push({card, seq, why});
  if (letGo.length > 16) {
    letGo.splice(0, letGo.length - 16);
  }
}

export function declaredReactors(): Array<DeclaredReactor> {
  return [...declared.values()];
}

/** The readout `__conReady().reaction` publishes (the e2e witness's «declared»). */
export function reactionIdentitySnapshot(): {declared: Array<DeclaredReactor>, letGo: Array<{card: CardName, seq: number, why: string}>} {
  return {declared: declaredReactors(), letGo: [...letGo]};
}

/** Every product hook a card face stands on, with the attribute that names its card. */
const FACE_HOOK_ATTRS = ['data-reaction-home', 'data-composer-card', 'data-played-face', 'data-played-key'] as const;
export const CARD_FACE_HOOKS = '[data-reaction-home], [data-composer-card], [data-played-key]';

/** The card a hook element SHOWS (`data-played-face` beats the slot's key — the start shelf's loan). */
export function hookCardOf(el: Element): string | undefined {
  for (const attr of FACE_HOOK_ATTRS) {
    const v = el.getAttribute(attr);
    if (v !== null && v !== '') {
      return v;
    }
  }
  return undefined;
}

/** The hook element a lifted element belongs to (itself, or the nearest ancestor carrying a hook). */
function hookOfLifted(el: Element): Element | null {
  return el.matches(CARD_FACE_HOOKS) ? el : el.closest(CARD_FACE_HOOKS);
}

/**
 * The cards a LIFT TARGET carries besides `card`: every face hook inside the element that moves (its descendants) that
 * names another card. A lift moves its whole subtree — a wrapper holding two faces raises both.
 */
export function otherCardsInside(target: Element, card: string): Array<string> {
  const out: Array<string> = [];
  for (const el of Array.from(target.querySelectorAll(CARD_FACE_HOOKS))) {
    const name = hookCardOf(el);
    if (name !== undefined && name !== card && !out.includes(name)) {
      out.push(name);
    }
  }
  return out;
}

function painted(el: HTMLElement): boolean {
  if (typeof getComputedStyle !== 'function') {
    return false;
  }
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none') {
    return false;
  }
  const opacity = Number.parseFloat(cs.opacity);
  if (Number.isFinite(opacity) && opacity <= 0.05) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

function overlapShare(a: DOMRect, b: DOMRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (w <= 0 || h <= 0) {
    return 0;
  }
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller <= 0 ? 0 : (w * h) / smaller;
}

/** Two painted layer faces overlapping more than this share of the smaller one are STACKED. */
export const STACKED_FACE_SHARE = 0.2;

/**
 * THE FIVE CHECKS against the live DOM and the declaration — a pure read. `declaredNow` defaults to the director's
 * declaration; the e2e witness runs the same rules page-side.
 */
export function reactionIdentityVerdicts(root: Pick<Document, 'querySelectorAll'> = document, declaredNow: ReadonlyArray<DeclaredReactor> = declaredReactors()): Array<ReactionIdentityVerdict> {
  const out: Array<ReactionIdentityVerdict> = [];
  const byKey = new Map(declaredNow.map((d) => [d.key, d]));
  const liftedCards = new Set(declaredNow.filter((d) => d.via === 'place').map((d) => d.card as string));
  const layerFaces: Array<{el: HTMLElement, card: string, rect: DOMRect}> = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('.con-reaction__face'))) {
    if (!painted(el)) {
      continue;
    }
    const warm = el.getAttribute('data-reaction-warm');
    if (warm !== null) {
      out.push({kind: 'warm-painted', card: warm, why: 'a warm face (mounted ahead of its rise) is painted'});
      continue;
    }
    const card = el.getAttribute('data-reaction-card') ?? '?';
    const key = el.getAttribute('data-reaction-key') ?? '';
    const d = byKey.get(key);
    if (d === undefined || d.via !== 'seat') {
      out.push({kind: 'foreign-face', card, why: `a layer face (${key}) no rise of the chain declared`});
    }
    layerFaces.push({el, card, rect: el.getBoundingClientRect()});
  }
  for (let i = 0; i < layerFaces.length; i++) {
    for (let j = i + 1; j < layerFaces.length; j++) {
      const share = overlapShare(layerFaces[i].rect, layerFaces[j].rect);
      if (share > STACKED_FACE_SHARE) {
        out.push({kind: 'stacked-faces', card: `${layerFaces[i].card}+${layerFaces[j].card}`, why: `two layer faces overlap ${Math.round(share * 100)} %`});
      }
    }
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-reaction-lifted]'))) {
    const hook = hookOfLifted(el);
    const card = hook === null ? undefined : hookCardOf(hook);
    if (card === undefined) {
      out.push({kind: 'foreign-face', card: '?', why: 'a lifted element on no card face'});
      continue;
    }
    if (!liftedCards.has(card)) {
      out.push({kind: 'foreign-face', card, why: 'a face lifted in its place that no rise of the chain declared'});
    }
    const others = otherCardsInside(el, card);
    if (others.length > 0) {
      out.push({kind: 'lift-carries-another', card, why: `the lift moves ${others.join(', ')} too`});
    }
    if (layerFaces.some((f) => f.card === card)) {
      out.push({kind: 'two-instances', card, why: 'lifted in its place AND painted in the layer'});
    }
  }
  return out;
}

const reported = new Set<string>();

/**
 * THE SENTINEL — after a step of the chain (`step`: a rise, a settle), every verdict said out loud once per
 * card × kind × step key. Every build (the e2e harness turns it red on every spec).
 */
export function checkReactionIdentity(step: string): Array<ReactionIdentityVerdict> {
  if (typeof document === 'undefined') {
    return [];
  }
  const verdicts = reactionIdentityVerdicts(document);
  for (const v of verdicts) {
    const id = `${step}|${v.kind}|${v.card}`;
    if (reported.has(id)) {
      continue;
    }
    reported.add(id);
    if (reported.size > 256) {
      reported.clear();
    }
    console.warn(`[reaction] foreign face — ${v.kind}: ${v.card} at ${step} (${v.why})`);
  }
  return verdicts;
}

/** Test-only reset. */
export function resetReactionIdentity(): void {
  declared.clear();
  letGo.splice(0);
  reported.clear();
}
