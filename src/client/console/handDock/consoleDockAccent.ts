/*
 * THE HAND DOCK'S INTAKE ACCENT — a BOUNDED lease, never a read of foreign
 * flags.
 *
 * The dock's presence contract (docs/claude/console/hand-dock-presence.md)
 * says: a busy screen puts the pack in its COMPACT pose, and while cards are
 * physically arriving the pack rises to FULL whatever is open. The second half
 * is what this module owns.
 *
 * ── WHY A LEASE AND NOT A PREDICATE ──────────────────────────────────────
 *
 * The first cut derived the accent from three foreign booleans
 * (`isHandDeliveryActive() || isHandRevealEpisodeRunning() ||
 * handRevealState.holdSlots || dockHeld.length > 0`). Each is owned by a
 * different director with its own completion paths, and ANY of them sticking
 * pins the accent ON — which silently disables the compact pose for the REST
 * OF THE GAME. That is exactly what happened: the hand-reveal director sets
 * `phase='opening'` + `holdSlots=true` BEFORE it measures, and the shell's
 * section watcher deliberately skips resetting the `opening`/`closing` phases
 * — so a section change inside that pre-install window left `holdSlots`
 * latched true forever.
 *
 * A pose that silently stops working is worse than a pose that is slightly
 * wrong for a moment. So the accent is a LEASE with a hard ceiling:
 *
 *  · begin → the caller gets a release function; the pose is FULL;
 *  · release → the pose returns to whatever the screen calls for;
 *  · and every lease expires on its own after `ACCENT_MAX_MS` no matter what.
 *
 * A director that dies mid-flight, an episode that never installs, a promise
 * that never settles — none of them can outlive the ceiling. The worst case
 * is «the pack stayed full a few seconds too long», never «the compact pose
 * is dead until the player restarts».
 *
 * Pure + unit-tested (`tests/client/components/console/consoleDockAccent.spec.ts`).
 */

import {reactive} from 'vue';

/**
 * The hard ceiling of ONE lease (ms). Generous enough for the longest real
 * intake (a full hand's dock → grid opening at the slow motion preset, plus
 * its settle) and short enough that a leak is a blip, not a mode.
 */
export const ACCENT_MAX_MS = 6000;

type Lease = {id: number, label: string, timer: number | undefined};

const state = reactive({
  /** Live lease count — the reactive signal the shell reads. */
  active: 0,
});

let leases: Array<Lease> = [];
let nextId = 1;

/** Are cards physically arriving at (or leaving) the dock right now? */
export function dockIntakeAccentActive(): boolean {
  return state.active > 0;
}

/** Diagnostic: what is currently holding the accent. */
export function dockIntakeAccentLabels(): ReadonlyArray<string> {
  return leases.map((l) => l.label);
}

function drop(id: number): void {
  const i = leases.findIndex((l) => l.id === id);
  if (i < 0) {
    return;
  }
  const [lease] = leases.splice(i, 1);
  if (lease.timer !== undefined) {
    window.clearTimeout(lease.timer);
  }
  state.active = leases.length;
}

/**
 * Hold the dock in its FULL pose while an intake presentation runs. Returns
 * the release — idempotent, and safe to drop entirely: the ceiling releases
 * it anyway.
 *
 * `label` is for diagnostics only (a stuck accent names its owner instead of
 * being an anonymous mode).
 */
export function beginDockIntakeAccent(label: string): () => void {
  const id = nextId++;
  const lease: Lease = {id, label, timer: undefined};
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    lease.timer = window.setTimeout(() => {
      if (process.env.NODE_ENV !== 'production' && leases.some((l) => l.id === id)) {
        console.warn(`[dock-accent] «${label}» outlived ${ACCENT_MAX_MS}ms and was released — ` +
          'the compact pose must never be disabled by a leaked presentation.');
      }
      drop(id);
    }, ACCENT_MAX_MS);
  }
  leases.push(lease);
  state.active = leases.length;
  return () => drop(id);
}

/**
 * Wrap a presentation in the accent: the lease lives exactly as long as the
 * promise, and is released on BOTH outcomes (a rejected flight must not pin
 * the pose).
 */
export async function holdDockIntakeAccent<T>(label: string, run: Promise<T>): Promise<T> {
  const release = beginDockIntakeAccent(label);
  try {
    return await run;
  } finally {
    release();
  }
}

/** A new game / epoch — nothing may survive it. */
export function resetDockIntakeAccent(): void {
  for (const lease of leases) {
    if (lease.timer !== undefined) {
      window.clearTimeout(lease.timer);
    }
  }
  leases = [];
  state.active = 0;
}
