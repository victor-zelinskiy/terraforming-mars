/**
 * Milestone / Award CEREMONY — the shared module state.
 *
 * The ceremony is the ONE announcement channel for "a milestone was claimed /
 * an award was funded" — for EVERY player at the table (it REPLACES the
 * milestone/award prestige notification; the journal record is untouched):
 *
 *  - the ACTOR gets the full post-confirm beat (centre-stage coronation /
 *    seal — armed at submit time so the exact paid cost / free flag ride
 *    along, and fired only when the fresh playerView proves the action
 *    resolved);
 *  - EVERY OTHER player gets an unobtrusive REMOTE beat (compact, edge-of-
 *    screen, pointer-events none — never covers open overlays or interrupts
 *    an action) that names WHO took WHAT.
 *
 * Detection is the honest seed-then-diff idiom (like passes / scale-bonus
 * claims): the public `game.milestones` / `game.awards` models flip
 * `playerName` from unset to a colour exactly once per slot. The first
 * observation seeds silently, so reload / reconnect never replays; a lost
 * race drops the actor's arm AND plays the rival's remote beat instead —
 * the player SEES why their claim didn't happen.
 *
 * Events queue FIFO (a poll can surface two fundings at once); the mounted
 * shell (desktop `MaCeremonyOverlay` / console `ConsoleMaCeremony`) shows
 * one at a time and calls `advanceMaCeremony()` when its beat finishes.
 *
 * The ceremony REPLACES the milestone/award notification card entirely
 * (NotificationLayer drops those variants unconditionally): the game-model
 * diff is guaranteed to see every slot exactly once, so the announcement
 * can never be silently lost — whichever of the two feeds (journal fetch /
 * game-model commit) arrives first, only the ceremony presents it.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {MaKind} from '@/client/components/ma/maArt';

export type MaCeremonyEvent = {
  kind: MaKind,
  name: string,
  /** The claiming/funding player. */
  color: Color,
  actorName: string,
  /** True when the VIEWER did it — the full centre-stage presentation. */
  own: boolean,
  /** The exact paid price — known only for the viewer's own armed submit. */
  cost?: number,
  free: boolean,
  at: number,
};

type PendingMaCeremony = {kind: MaKind, name: string, cost: number, free: boolean, armedAt: number};

/** A stale arm (a submit that never resolved) is dropped after this long. */
const PENDING_TTL_MS = 90_000;
/** A queued beat older than this is dropped instead of shown (shell was away). */
const QUEUE_TTL_MS = 45_000;

type MaCeremonyStateShape = {
  pending: PendingMaCeremony | undefined,
  /** Slots already accounted for (`m:<name>` / `a:<name>`), seeded silently. */
  seenTaken: Set<string>,
  seeded: boolean,
  queue: Array<MaCeremonyEvent>,
  current: MaCeremonyEvent | undefined,
  /** Bumped once per SHOWN beat — the shells' one-shot watch signal. */
  nonce: number,
};

export const maCeremonyState: MaCeremonyStateShape = reactive({
  pending: undefined,
  seenTaken: new Set<string>(),
  seeded: false,
  queue: [],
  current: undefined,
  nonce: 0,
});

/** Called at the viewer's own submit — carries the exact cost/free context. */
export function armMaCeremony(event: {kind: MaKind, name: string, cost: number, free: boolean}, now: number = Date.now()): void {
  maCeremonyState.pending = {kind: event.kind, name: event.name, cost: event.cost, free: event.free, armedAt: now};
}

/** The minimal slice of PlayerViewModel the observer needs (test-friendly). */
type MaCeremonyView = {
  thisPlayer?: {color: Color},
  game: {
    milestones: ReadonlyArray<{name: string, playerName?: string, color?: Color}>,
    awards: ReadonlyArray<{name: string, playerName?: string, color?: Color}>,
  },
};

function takenKey(kind: MaKind, name: string): string {
  return `${kind === 'milestone' ? 'm' : 'a'}:${name}`;
}

/**
 * Observe a fresh playerView (called from NotificationLayer.update() — the
 * one per-commit hook shared by both shells). Diffs the public taken slots;
 * returns true when at least one new beat was enqueued on THIS observation.
 */
export function observeMaCeremony(view: MaCeremonyView | undefined, now: number = Date.now()): boolean {
  if (view === undefined) {
    return false;
  }
  const pending = maCeremonyState.pending;
  if (pending !== undefined && now - pending.armedAt > PENDING_TTL_MS) {
    maCeremonyState.pending = undefined;
  }
  const pools: Array<[MaKind, MaCeremonyView['game']['milestones']]> = [
    ['milestone', view.game.milestones],
    ['award', view.game.awards],
  ];
  // First observation (load / reconnect): account for everything already
  // taken WITHOUT playing a beat — history is the journal's job.
  if (!maCeremonyState.seeded) {
    for (const [kind, pool] of pools) {
      for (const m of pool) {
        if (m.playerName !== undefined && m.playerName !== '') {
          maCeremonyState.seenTaken.add(takenKey(kind, m.name));
        }
      }
    }
    maCeremonyState.seeded = true;
    return false;
  }
  const viewerColor = view.thisPlayer?.color;
  let fired = false;
  for (const [kind, pool] of pools) {
    for (const m of pool) {
      if (m.playerName === undefined || m.playerName === '' || m.color === undefined) {
        continue;
      }
      const key = takenKey(kind, m.name);
      if (maCeremonyState.seenTaken.has(key)) {
        continue;
      }
      maCeremonyState.seenTaken.add(key);
      const own = viewerColor !== undefined && m.color === viewerColor;
      const armed = maCeremonyState.pending;
      const matchesArm = armed !== undefined && armed.kind === kind && armed.name === m.name;
      if (matchesArm) {
        // Resolved (own) or raced away (rival) — either way the arm is spent.
        maCeremonyState.pending = undefined;
      }
      enqueueMaCeremony({
        kind,
        name: m.name,
        color: m.color,
        actorName: m.playerName,
        own,
        cost: own && matchesArm ? armed.cost : undefined,
        free: own && matchesArm ? armed.free : false,
        at: now,
      });
      fired = true;
    }
  }
  return fired;
}

function enqueueMaCeremony(event: MaCeremonyEvent): void {
  maCeremonyState.queue.push(event);
  if (maCeremonyState.current === undefined) {
    advanceMaCeremony(event.at);
  }
}

/**
 * Show the next queued beat (called by the mounted shell when its current
 * beat finished, and internally on the first enqueue). Stale queue entries
 * (the shell was away) are dropped, never replayed late.
 */
export function advanceMaCeremony(now: number = Date.now()): void {
  let next = maCeremonyState.queue.shift();
  while (next !== undefined && now - next.at > QUEUE_TTL_MS) {
    next = maCeremonyState.queue.shift();
  }
  maCeremonyState.current = next;
  if (next !== undefined) {
    maCeremonyState.nonce++;
  }
}

/** A different game opened in-session (same boundary the notifications use). */
export function resetMaCeremony(): void {
  maCeremonyState.pending = undefined;
  maCeremonyState.seenTaken = new Set<string>();
  maCeremonyState.seeded = false;
  maCeremonyState.queue = [];
  maCeremonyState.current = undefined;
}
