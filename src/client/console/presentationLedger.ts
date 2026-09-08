/*
 * PRESENTATION LEDGER — the ONE debt book of deferred presentation
 * (mechanism B of docs/claude/console/presentation-reconciliation.md).
 *
 * The console deliberately shows «a presented lie» in several places: a
 * display freeze (the board-beat park's held scale values), a hidden
 * committed tile (the remote reveal hold), a parked batch. Each owner keeps
 * its own release EDGE (a Vue watcher on a derived predicate) — and this
 * codebase's best-documented footguns live exactly there: a true→true edge
 * fires nothing, a block→free inside one flush is invisible, a non-reactive
 * first term silently drops the watcher's dependency. Before this module the
 * only net under a missed edge was each owner's private safety timer — a
 * 15–30 s SILENT snap, which the player reads as «анимация потерялась и
 * значения устарели».
 *
 * The ledger generalizes the codebase's own debt idiom (`deferredViewRefresh`,
 * `owedConclusion`): every deferral REGISTERS an owed story; one heartbeat
 * re-drives due stories through their owner's OWN entry point (never a
 * re-implementation); past `dueMs` the owner's honest degrade runs WITH A
 * NAMED WARN — a safety stops being silent. TRUTH WITNESSES cover the class
 * «the edge was lost and nobody owes it»: a self-contained «is the player
 * being lied to?» probe with its own grace window and heal.
 *
 * DELIBERATELY AN INTERVAL, NOT A WATCH (the deferredViewRefresh precedent):
 * the predicates live in many modules and not all of them are backed by
 * reactive state; an interval over plain function calls cannot be starved by
 * a non-reactive read. It ticks only while something is owed — free when the
 * book is empty.
 */

/** The heartbeat cadence. A missed release edge costs at most one beat. */
export const LEDGER_TICK_MS = 250;

/** A story is not re-driven more often than this (its own edges still fire
 *  the owner directly — the ledger is the net, not the metronome). */
export const LEDGER_REDRIVE_MIN_GAP_MS = 500;

export type OwedStory = {
  /** Stable name — diagnostics speak it («board-beat-park», «remote-tile:05»). */
  id: string,
  /** May the story play right now? Checked before every redrive. */
  ready: () => boolean,
  /** The owner's OWN entry point (idempotent — the owner retires the story
   *  via its handle when the work is done). */
  redrive: () => void,
  /** Past this age the story degrades honestly (owner's snap) and retires. */
  dueMs: number,
  /** The honest degrade. Optional — some owners keep their own bounded
   *  safety and only want the redrive net + diagnostics. */
  degrade?: () => void,
};

export type TruthWitness = {
  id: string,
  /** «Is the player being lied to right now?» — cheap, side-effect free. */
  lying: () => boolean,
  /** The lie must hold continuously this long before the heal fires (a
   *  legitimately-deferring story is a lie WITH an owner — give the owner's
   *  own machinery room to act first). */
  graceMs: number,
  /** Re-drive the owning subsystem. Idempotent. */
  heal: () => void,
};

type StoryEntry = OwedStory & {since: number, lastRedriveAt: number};
type WitnessEntry = TruthWitness & {lyingSince: number | undefined, lastHealAt: number};

const stories = new Map<string, StoryEntry>();
const witnesses = new Map<string, WitnessEntry>();
let heartbeat: ReturnType<typeof setInterval> | undefined;

/** Diagnostics (the `__foregroundDiag` idiom): every silent-degrade class
 *  becomes a visible counter. */
export const presentationLedgerStats = {
  owedNow: 0,
  redrives: 0,
  degrades: 0,
  heals: 0,
  oldestOwedMs: 0,
};

export type OwedStoryHandle = {
  /** The work is DONE (or no longer applies) — retire the story. Idempotent. */
  settle: () => void,
};

function now(): number {
  return Date.now();
}

function ensureHeartbeat(): void {
  if (heartbeat !== undefined || typeof setInterval !== 'function') {
    return;
  }
  if (stories.size === 0 && witnesses.size === 0) {
    return;
  }
  heartbeat = setInterval(settlePresentationDue, LEDGER_TICK_MS);
}

function stopHeartbeatIfIdle(): void {
  if (heartbeat !== undefined && stories.size === 0 && witnesses.size === 0) {
    clearInterval(heartbeat);
    heartbeat = undefined;
  }
}

/**
 * Register an owed story. A second owe under the same id REPLACES the entry
 * but keeps the ORIGINAL clock — the debt is as old as its first deferral
 * (a re-owe is the same story deferring again, not a fresh one).
 */
export function owePresentation(story: OwedStory): OwedStoryHandle {
  const existing = stories.get(story.id);
  stories.set(story.id, {
    ...story,
    since: existing?.since ?? now(),
    lastRedriveAt: existing?.lastRedriveAt ?? 0,
  });
  ensureHeartbeat();
  return {
    settle: () => {
      stories.delete(story.id);
      stopHeartbeatIfIdle();
    },
  };
}

/** Register a truth witness. Returns its unregister. */
export function registerTruthWitness(witness: TruthWitness): () => void {
  witnesses.set(witness.id, {...witness, lyingSince: undefined, lastHealAt: 0});
  ensureHeartbeat();
  return () => {
    witnesses.delete(witness.id);
    stopHeartbeatIfIdle();
  };
}

/**
 * ONE PASS over the book — the heartbeat body, also callable from an EDGE
 * (the shell's «board became watchable» watcher calls it directly so a story
 * whose stage just opened plays within the same tick, not a beat later).
 */
export function settlePresentationDue(): void {
  const t = now();
  let oldest = 0;
  for (const story of stories.values()) {
    oldest = Math.max(oldest, t - story.since);
    if (t - story.since > story.dueMs) {
      // PAST DUE — the honest degrade, NAMED. Never silent: this line is the
      // whole point («the safety fired» stops being invisible).
      stories.delete(story.id);
      presentationLedgerStats.degrades++;
      console.warn(`[presentation-ledger] story «${story.id}» degraded after ${Math.round((t - story.since) / 1000)}s — the release edge never came`);
      try {
        story.degrade?.();
      } catch (err) {
        console.error(`[presentation-ledger] degrade of «${story.id}» failed`, err);
      }
      continue;
    }
    if (t - story.lastRedriveAt < LEDGER_REDRIVE_MIN_GAP_MS) {
      continue;
    }
    let ready = false;
    try {
      ready = story.ready();
    } catch (err) {
      console.error(`[presentation-ledger] ready() of «${story.id}» failed`, err);
    }
    if (ready) {
      story.lastRedriveAt = t;
      presentationLedgerStats.redrives++;
      try {
        story.redrive();
      } catch (err) {
        console.error(`[presentation-ledger] redrive of «${story.id}» failed`, err);
      }
    }
  }
  for (const witness of witnesses.values()) {
    let lying = false;
    try {
      lying = witness.lying();
    } catch (err) {
      console.error(`[presentation-ledger] witness «${witness.id}» failed`, err);
    }
    if (!lying) {
      witness.lyingSince = undefined;
      continue;
    }
    if (witness.lyingSince === undefined) {
      witness.lyingSince = t;
      continue;
    }
    if (t - witness.lyingSince < witness.graceMs) {
      continue;
    }
    if (t - witness.lastHealAt < LEDGER_REDRIVE_MIN_GAP_MS) {
      continue;
    }
    witness.lastHealAt = t;
    presentationLedgerStats.heals++;
    console.warn(`[presentation-ledger] witness «${witness.id}» healing — the lie outlived its grace (${witness.graceMs}ms)`);
    try {
      witness.heal();
    } catch (err) {
      console.error(`[presentation-ledger] heal of «${witness.id}» failed`, err);
    }
  }
  presentationLedgerStats.owedNow = stories.size;
  presentationLedgerStats.oldestOwedMs = oldest;
  stopHeartbeatIfIdle();
}

/** Snapshot for diagnostics surfaces / e2e. */
export function presentationLedgerSnapshot(): {
  stories: Array<{id: string, ageMs: number, dueMs: number}>,
  witnesses: Array<{id: string, lyingMs: number}>,
} {
  const t = now();
  return {
    stories: [...stories.values()].map((s) => ({id: s.id, ageMs: t - s.since, dueMs: s.dueMs})),
    witnesses: [...witnesses.values()].map((w) => ({
      id: w.id,
      lyingMs: w.lyingSince === undefined ? 0 : t - w.lyingSince,
    })),
  };
}

/** Full reset (game switch / tests). Retires everything, stops the beat. */
export function resetPresentationLedger(): void {
  stories.clear();
  witnesses.clear();
  if (heartbeat !== undefined) {
    clearInterval(heartbeat);
    heartbeat = undefined;
  }
  presentationLedgerStats.owedNow = 0;
  presentationLedgerStats.oldestOwedMs = 0;
}

/* READ-ONLY e2e / diagnostics probe (the `__foregroundDiag` idiom). */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__presentationLedgerDiag = () => ({
    ...presentationLedgerStats,
    ...presentationLedgerSnapshot(),
  });
}
