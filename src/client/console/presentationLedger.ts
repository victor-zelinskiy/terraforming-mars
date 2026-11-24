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

import {registerLivenessRelease} from '@/client/console/consoleLiveness';
import {consoleSessionScope, sessionState} from '@/client/console/session/consoleSession';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {FrameWatch, watchFrames} from '@/client/console/kernel/frameWitness';

/** The heartbeat cadence. A missed release edge costs at most one beat. */
export const LEDGER_TICK_MS = 250;

/** A story is not re-driven more often than this (its own edges still fire
 *  the owner directly — the ledger is the net, not the metronome). */
export const LEDGER_REDRIVE_MIN_GAP_MS = 500;

/** How long past its due a story that is BEING TOLD may still finish (`OwedStory.telling`). */
export const STORY_TELLING_GRACE_MS = 10_000;

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
  /**
   * IS THE STORY BEING TOLD RIGHT NOW (its release has begun — the park's drain is running)? A story that is being
   * told when its due comes is not overdue: the degrade would CUT the telling it exists to protect (the scales
   * snapping to their values mid-glide). It is given `STORY_TELLING_GRACE_MS` more, once, bounded — a telling that
   * outlives that is degraded like any other. (The box's whole games, 2026-11-24 — game 107: the board came into
   * view in the last second of the park's thirty, the drain opened, and the due degraded it under its own motion:
   * «watchable: true, draining: true, drains: 1».)
   */
  telling?: () => boolean,
  /** The honest degrade. Optional — some owners keep their own bounded
   *  safety and only want the redrive net + diagnostics. */
  degrade?: () => void,
  /**
   * Optional leak-diagnosis hook (the animation-hold registry's own idiom):
   * called ONCE at the degrade, its return appended to the warn — so a story
   * that waited out its whole dueMs says WHICH gate never opened («watchable
   * false» = the player sat in a screen; «drain blocked» = a wedge), instead
   * of the bare «the release edge never came» that cannot tell an honest
   * multiplayer wait from a deadlock. Guarded; cheap (degrade path only).
   */
  diagnose?: () => unknown,
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
  /**
   * WHAT the lie is made of — the story's `diagnose` twin, appended to the heal warn. A heal that only says «healing»
   * names the net and hides the hole: the field log of 2026-10-14 carried four bare heals of
   * «workspace-conclusion-owed» and nothing about which hold refused the conclusion. Guarded; called only on a heal.
   */
  diagnose?: () => unknown,
};

/** `owner` — the owe that wrote this entry (a handle settles only its own owe — inventory H1). */
/**
 * AN OWED STORY IS A `story` SCOPE OF THE SESSION (architecture v2 — PLAN §10 · C3): it stands in the flow tree from
 * its first deferral to its settle / degrade (`story:owed:<id>#n`, its release edge a row of the wait table bounded by
 * `dueMs`), and it ENDS WITH ITS SESSION — a debt of a game screen that left is not re-driven into the next one. The
 * book (`stories`) is that scope's mirror in the ledger's vocabulary: redrive, due, degrade.
 */
type StoryEntry = OwedStory & {since: number, lastRedriveAt: number, owner: object, scope: FlowScope<'story'>, painted: FrameWatch};

/*
 * A STORY's DUE IS JUDGED AGAINST THE FRAMES THE PAGE PAINTED (freeze zero, stage 1 — CI `fz1` · duo,
 * `info-dossier-rich`, 2026-11-19: the page BEHIND, «the page gave the motion 3375 of 32138 ms», and beside it two
 * defects — the board beat's drain and the scale step's rating, each «degraded after 30 s — the release edge never
 * came» over a marker that was MOVING all that time at a frame a second). A story is released by a scene that plays on
 * frames; thirty seconds of the wall on a page nobody looks at gave it three. Its watch stands from the story's first
 * owe to its retirement (it rides the frame witness's one loop — a counter, never a second loop) and rides the scope.
 */
function openStoryScope(id: string, dueMs: number): {scope: FlowScope<'story'>, painted: FrameWatch} {
  const scope = consoleSessionScope().open('story', `owed:${id}`);
  const painted = watchFrames();
  scope.defer(() => painted.stop());
  scope.note('its release edge (re-driven by the ledger)', () => {}, dueMs);
  // The session ended under an owed story: it leaves the book (its owner's own reset lets its values go).
  scope.defer(() => {
    if (stories.get(id)?.scope === scope) {
      stories.delete(id);
      presentationLedgerStats.owedNow = stories.size;
      stopHeartbeatIfIdle();
    }
  });
  return {scope, painted};
}

/** Take a story out of the book and end its scope (`how` — settled by its owner, or degraded at its due / by a rung). */
function retireStory(entry: StoryEntry, how: 'settled' | 'degraded'): void {
  if (stories.get(entry.id) === entry) {
    stories.delete(entry.id);
  }
  if (how === 'settled') {
    entry.scope.end();
  } else {
    entry.scope.end({how: 'expired', bound: `its due ${entry.dueMs}ms (degraded)`});
  }
}
type WitnessEntry = TruthWitness & {lyingSince: number | undefined, lastHealAt: number};

const stories = new Map<string, StoryEntry>();
const witnesses = new Map<string, WitnessEntry>();
/** The heartbeat's stop — an owned tick of the session, standing only while a story or a witness does. */
let heartbeat: (() => void) | undefined;

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

/** Run a story's (or a witness's) diagnose hook safely — a throwing/absent hook degrades to ''. */
function storyDiagnose(story: {diagnose?: () => unknown}): string {
  if (story.diagnose === undefined) {
    return '';
  }
  try {
    const info = story.diagnose();
    return info === undefined ? '' : ` — ${typeof info === 'string' ? info : JSON.stringify(info)}`;
  } catch (e) {
    return ` — (diagnose threw: ${String(e)})`;
  }
}

function ensureHeartbeat(): void {
  if (heartbeat !== undefined) {
    return;
  }
  if (stories.size === 0 && witnesses.size === 0) {
    return;
  }
  const owner = consoleSessionScope();
  const stopTick = owner.every(LEDGER_TICK_MS, 'the presentation ledger\'s heartbeat', () => settlePresentationDue());
  // The session ending under it takes the tick back: the mark goes too, so the next story arms a fresh one.
  const forget = owner.defer(() => {
    if (heartbeat === stop) {
      heartbeat = undefined;
    }
  });
  const stop = (): void => {
    stopTick();
    forget();
  };
  heartbeat = stop;
}

function stopHeartbeatIfIdle(): void {
  if (heartbeat !== undefined && stories.size === 0 && witnesses.size === 0) {
    heartbeat();
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
  const owner = {};
  // A re-owe is the SAME story deferring again: it keeps its scope, as it keeps its clock — and the scope's own watch
  // of the frames the page painted since.
  const {scope, painted} = existing !== undefined && existing.scope.ended === undefined ? existing :
    // (The scope's bound is the latest the story can end: its due, and the telling's grace where it has one.)
    openStoryScope(story.id, story.dueMs + (story.telling !== undefined ? STORY_TELLING_GRACE_MS : 0));
  stories.set(story.id, {
    ...story,
    since: existing?.since ?? now(),
    lastRedriveAt: existing?.lastRedriveAt ?? 0,
    owner,
    scope,
    painted,
  });
  ensureHeartbeat();
  return {
    // THIS owe only (wait graph inventory H1): an older handle of the same id — a wait that already ended — never settles
    // the story a newer wait re-owed (it lost its re-drive and its degrade, and waited with no net).
    settle: () => {
      const entry = stories.get(story.id);
      if (entry !== undefined && entry.owner === owner) {
        retireStory(entry, 'settled');
        stopHeartbeatIfIdle();
      }
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

/** One look at one story: may it play right now (`ready`)? Then it is re-driven — no more often than the gap. */
function redriveIfReady(story: StoryEntry, t: number): void {
  if (t - story.lastRedriveAt < LEDGER_REDRIVE_MIN_GAP_MS) {
    return;
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
    if (t - story.since >= story.dueMs) {
      // …UNLESS IT IS BEING TOLD (`telling`): the release has begun — it finishes, within its bounded grace.
      if (story.telling !== undefined && t - story.since < story.dueMs + STORY_TELLING_GRACE_MS) {
        let telling = false;
        try {
          telling = story.telling();
        } catch (err) {
          console.error(`[presentation-ledger] telling() of «${story.id}» failed`, err);
        }
        if (telling) {
          // (The heartbeat keeps LOOKING through the grace: a story that stands at its own gate is re-asked there.)
          redriveIfReady(story, t);
          continue;
        }
      }
      // PAST DUE — the honest degrade, NAMED. Never silent: this line is the
      // whole point («the safety fired» stops being invisible).
      // (Read BEFORE the story is retired — its scope takes the watch with it. No parenthesis inside the reason: the
      // line prints it as `(planned: …)`.)
      const starved = story.painted.starved()?.replace(/[()]/g, '');
      retireStory(story, 'degraded');
      presentationLedgerStats.degrades++;
      console.warn(`[presentation-ledger] story «${story.id}» degraded after ${Math.round((t - story.since) / 1000)}s — the release edge never came${storyDiagnose(story)}` +
        (starved !== undefined ? ` (planned: ${starved})` : ''));
      try {
        story.degrade?.();
      } catch (err) {
        console.error(`[presentation-ledger] degrade of «${story.id}» failed`, err);
      }
      continue;
    }
    redriveIfReady(story, t);
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
    console.warn(`[presentation-ledger] witness «${witness.id}» healing — the lie outlived its grace (${witness.graceMs}ms, lying ${t - witness.lyingSince}ms)${storyDiagnose(witness)}`);
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

/**
 * THE LIVENESS ARBITER'S RUNG (rank 0 — truth before story): every owed story degrades NOW, named, instead of at its
 * own due. A story's degrade is its owner's HONEST release (the park snaps its values, the step-rating ticks its
 * cell) — nothing a player is waiting on can be lost by it, and a debt that stood on a condition the player's own
 * surface held is exactly what the arbiter is cutting. Returns what it degraded ('' = nothing owed).
 */
export function degradePresentationStories(reason: string): string {
  const degraded: Array<string> = [];
  const t = now();
  for (const story of [...stories.values()]) {
    retireStory(story, 'degraded');
    presentationLedgerStats.degrades++;
    degraded.push(`${story.id}@${Math.round((t - story.since) / 1000)}s`);
    console.warn(`[presentation-ledger] story «${story.id}» degraded by ${reason} after ${Math.round((t - story.since) / 1000)}s${storyDiagnose(story)}`);
    try {
      story.degrade?.();
    } catch (err) {
      console.error(`[presentation-ledger] degrade of «${story.id}» failed`, err);
    }
  }
  presentationLedgerStats.owedNow = stories.size;
  stopHeartbeatIfIdle();
  return degraded.join(', ');
}

/**
 * DEGRADE ONE STORY now (the wait graph's door for a story that yields in a cycle, Э3): the same honest degrade its own
 * due runs — named, its `degrade` hook run. `false` when no story of that id is owed.
 */
export function degradePresentationStory(id: string, reason: string): boolean {
  const story = stories.get(id);
  if (story === undefined) {
    return false;
  }
  retireStory(story, 'degraded');
  presentationLedgerStats.degrades++;
  console.warn(`[presentation-ledger] story «${id}» degraded by ${reason} after ${Math.round((now() - story.since) / 1000)}s${storyDiagnose(story)}`);
  try {
    story.degrade?.();
  } catch (err) {
    console.error(`[presentation-ledger] degrade of «${id}» failed`, err);
  }
  presentationLedgerStats.owedNow = stories.size;
  stopHeartbeatIfIdle();
  return true;
}

registerLivenessRelease({rank: 0, name: 'presentation-ledger', release: () => degradePresentationStories('the liveness arbiter')});

/**
 * Snapshot for diagnostics surfaces / e2e. Every owed story carries WHY it is still waiting — its own `diagnose`
 * (PL-778: a scale-step token born 5 s late once, with nothing on record to tell «the screen produced no frame» from
 * «the stage was not ready, and here is the term that held it»).
 */
export function presentationLedgerSnapshot(): {
  stories: Array<{id: string, ageMs: number, dueMs: number, why: string}>,
  witnesses: Array<{id: string, lyingMs: number}>,
  } {
  const t = now();
  return {
    stories: [...stories.values()].map((s) => ({id: s.id, ageMs: t - s.since, dueMs: s.dueMs, why: storyDiagnose(s).replace(/^ — /, '')})),
    witnesses: [...witnesses.values()].map((w) => ({
      id: w.id,
      lyingMs: w.lyingSince === undefined ? 0 : t - w.lyingSince,
    })),
  };
}

/** Full reset (game switch / tests). Retires everything, stops the beat. */
export function resetPresentationLedger(): void {
  for (const story of [...stories.values()]) {
    stories.delete(story.id);
    story.scope.end({how: 'cancelled', reason: 'the ledger was reset'});
  }
  witnesses.clear();
  if (heartbeat !== undefined) {
    heartbeat();
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

// THE GAME SCREEN LEAVES: this state goes with it — declared here, taken down by the session's ordered pass
// (architecture v2 — PLAN §10 · C5; the number is its place in that pass — `leaveConsoleSession`).
// The presentation ledger with it: a dead shell's closures must never redrive the next game (the transport
// re-registers its witness at the next start; the park re-owes on its next seed).
sessionState('presentation-ledger', resetPresentationLedger, 100);
