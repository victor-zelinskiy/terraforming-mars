/*
 * Identity-preserving snapshot application — "structural sharing"
 * (REMOUNT_ANIMATION_REWORK_DESIGN.md, Phase 3 / the "умная модель" of the
 * brief's Цель A).
 *
 * Every server response carries a full fresh-parsed PlayerViewModel. Applying
 * it wholesale is CORRECT (Phase 1) but changes the identity of every
 * sub-object, so every child component re-renders even when its slice didn't
 * change. `shareViewSnapshot(prev, next)` walks the two trees and returns the
 * NEW tree with every deep-equal branch replaced by the PREVIOUS tree's
 * reference:
 *
 *   - the ROOT identity always changes → every existing identity-based
 *     watcher (App's playerView watcher, NotificationLayer, TurnHandoffLayer,
 *     StartGameFlow's playerViewTyped latch) keeps firing exactly as before;
 *   - an UNCHANGED branch (a board space, a player, a card) keeps its old
 *     reference → the child component's props are shallow-equal → Vue skips
 *     its re-render. 61 BoardSpaces stop re-rendering on a resource-only
 *     update; the resource panels stop re-rendering on a board-only update.
 *
 * This was deliberately chosen over an in-place reactive merge: a merge keeps
 * the root identity, silently BREAKING every identity-based watcher, needs
 * delete-handling for transient optional fields and a replace-list for
 * volatile subtrees. Sharing has none of those failure modes — the result is
 * CONTENT-IDENTICAL to `next` by construction (only ever substitutes a
 * reference when the branch is deep-equal), so the worst possible bug class
 * is "shared too little" (a wasted re-render), never wrong data.
 *
 * Rollback: `?patch=0` / localStorage `tm_patch=0` → plain wholesale
 * assignment (the Phase-1 behavior). Under the legacy `tm_remount` flag
 * sharing is also skipped so that mode stays byte-identical to the
 * historical client.
 */
import {legacyRemountEnabled} from './legacyRemount';

let cachedFlag: boolean | undefined;

/** Structural sharing enabled? Default ON; `?patch=0` / tm_patch=0 opt out. */
export function viewPatchEnabled(): boolean {
  if (cachedFlag !== undefined) {
    return cachedFlag;
  }
  cachedFlag = readFlag();
  return cachedFlag;
}

function readFlag(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    if (/[?&]patch=0/.test(window.location.search)) {
      return false;
    }
    const storage: Storage | undefined =
      (globalThis as {localStorage?: Storage}).localStorage ?? window.localStorage;
    return storage?.getItem('tm_patch') !== '0';
  } catch (err) {
    return true;
  }
}

/** Test-only: clear the memoised flag so specs can vary it. */
export function __resetViewPatchForTesting(): void {
  cachedFlag = undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Pure structural sharing: returns a tree CONTENT-IDENTICAL to `next`, with
 * every branch that is deep-equal to the corresponding `prev` branch replaced
 * by the `prev` reference (up to and including the whole tree). `prev` is
 * never mutated; `next` nodes are reused as-is where nothing could be shared.
 */
export function shareViewSnapshot<T>(prev: T, next: T): T {
  return shareValue(prev, next) as T;
}

function shareValue(prev: unknown, next: unknown): unknown {
  if (Object.is(prev, next)) {
    return prev;
  }
  if (Array.isArray(next)) {
    if (!Array.isArray(prev)) {
      return next;
    }
    return shareArray(prev, next);
  }
  if (isPlainObject(next)) {
    if (!isPlainObject(prev)) {
      return next;
    }
    return shareObject(prev, next);
  }
  // Primitives (and exotic values): `next` is authoritative. Equal primitives
  // were already handled by Object.is above.
  return next;
}

function shareArray(prev: ReadonlyArray<unknown>, next: ReadonlyArray<unknown>): unknown {
  // Index-aligned sharing. The snapshot's arrays are either stable-ordered
  // (spaces, players, milestones/awards, colonies) or append-mostly (tableau),
  // so index alignment shares the maximum. A shifted array (a card leaving the
  // middle of the hand) simply shares less — content stays authoritative.
  let allShared = prev.length === next.length;
  const out = new Array(next.length);
  for (let i = 0; i < next.length; i++) {
    const shared = shareValue(prev[i], next[i]);
    out[i] = shared;
    if (allShared && !Object.is(shared, prev[i])) {
      allShared = false;
    }
  }
  return allShared ? prev : out;
}

function shareObject(prev: Record<string, unknown>, next: Record<string, unknown>): unknown {
  const nextKeys = Object.keys(next);
  // A key present in prev but absent in next (a transient optional field like
  // `lastReveal` clearing) makes the objects differ — prev can't be reused.
  let allShared = nextKeys.length === Object.keys(prev).length;
  const out: Record<string, unknown> = {};
  for (const key of nextKeys) {
    const prevHas = Object.prototype.hasOwnProperty.call(prev, key);
    const shared = shareValue(prevHas ? prev[key] : undefined, next[key]);
    out[key] = shared;
    if (allShared && (!prevHas || !Object.is(shared, prev[key]))) {
      allShared = false;
    }
  }
  return allShared ? prev : out;
}

/**
 * The commit-path entry point: the view to ASSIGN for an incoming snapshot.
 * Applies structural sharing when enabled and the snapshot continues the same
 * participant's view; otherwise returns the incoming snapshot untouched
 * (initial load, participant change, flag off, legacy remount mode).
 */
export function nextViewSnapshot<T extends {id?: unknown}>(prev: T | undefined, incoming: T): T {
  if (!viewPatchEnabled() || legacyRemountEnabled()) {
    return incoming;
  }
  if (prev === undefined || prev.id !== incoming.id) {
    return incoming;
  }
  return shareViewSnapshot(prev, incoming);
}
