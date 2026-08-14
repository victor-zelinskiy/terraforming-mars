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
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {MaKind} from '@/client/components/ma/maArt';

export type MaCeremonyEvent = {
  kind: MaKind,
  name: string,
  /** The claiming/funding player. */
  color: Color,
  /** The DISPLAY label of the actor — the Automa seat reads «Бот», not «MarsBot». */
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

// The viewer's OWN coronation / seal is a centre-stage cinematic: while it
// plays, notifications queue and the follow-up prompt (e.g. the claim's
// payment) waits for the beat to finish. The REMOTE beat is deliberately
// unobtrusive by design ("never covers open overlays or interrupts an
// action") and holds nothing. Releases when the host advances the queue.
registerAnimationHoldSupplier('ma-ceremony-own', () => maCeremonyState.current?.own === true);

// ── The EMBEDDED presentation claim (the MA workspace's focus stage) ────────
//
// When the viewer commits FROM the MA workspace's detail stage, the ceremony
// plays INSIDE that workspace (the hero emblem already on stage is the beat's
// entry object) — the global `ConsoleMaCeremony` shell must not also present
// the same beat (two emblems, two scenes). The claim is set at SUBMIT time and
// matches exactly one own beat; the claimant presents it and calls
// `advanceMaCeremony()` when its scene settles. Released on every exit path
// (completion, refusal, degrade, unmount) — an orphaned claim would silence
// the beat everywhere, which is worse than a double presentation.
//
// Remote beats and non-matching own beats are untouched: the global shell
// keeps presenting them (the top strip legally plays over the workspace).
export const maCeremonyEmbed = reactive({
  claim: undefined as {kind: MaKind, name: string} | undefined,
});

export function claimMaCeremonyEmbed(kind: MaKind, name: string): void {
  maCeremonyEmbed.claim = {kind, name};
}

export function releaseMaCeremonyEmbed(): void {
  maCeremonyEmbed.claim = undefined;
}

/**
 * Release the claim AND consume an already-CURRENT claimed beat. The global
 * shell's one-shot nonce watch already fired (and skipped) while the claim
 * stood, so a beat left current after a bare release would never be presented
 * by anyone — the queue (and the `ma-ceremony-own` hold) would hang until the
 * watchdog ceiling. One exit helper for every claimant teardown path.
 */
export function abandonMaCeremonyEmbed(now: number = Date.now()): void {
  const claimedCurrent = maCeremonyEventEmbedded(maCeremonyState.current);
  maCeremonyEmbed.claim = undefined;
  if (claimedCurrent) {
    advanceMaCeremony(now);
  }
}

/** True when this event is the claimant's own — the global shell skips it. */
export function maCeremonyEventEmbedded(event: MaCeremonyEvent | undefined): boolean {
  const claim = maCeremonyEmbed.claim;
  return claim !== undefined && event !== undefined && event.own &&
    event.kind === claim.kind && event.name === claim.name;
}

/** Drop an armed own-submit candidate (a refused commit must not leave the
 *  exact-cost arm behind to decorate an unrelated later claim). */
export function disarmMaCeremony(): void {
  maCeremonyState.pending = undefined;
}

/** Called at the viewer's own submit — carries the exact cost/free context. */
export function armMaCeremony(event: {kind: MaKind, name: string, cost: number, free: boolean}, now: number = Date.now()): void {
  maCeremonyState.pending = {kind: event.kind, name: event.name, cost: event.cost, free: event.free, armedAt: now};
}

/** The minimal slice of PlayerViewModel the observer needs (test-friendly). */
type MaCeremonyView = {
  thisPlayer?: {color: Color},
  /** The participant list — how the actor's VISIBLE label is resolved. */
  players?: ReadonlyArray<{color: Color, name: string, isMarsBot?: boolean}>,
  game: {
    milestones: ReadonlyArray<{name: string, playerName?: string, color?: Color}>,
    awards: ReadonlyArray<{name: string, playerName?: string, color?: Color}>,
  },
};

function takenKey(kind: MaKind, name: string): string {
  return `${kind === 'milestone' ? 'm' : 'a'}:${name}`;
}

/**
 * The actor's VISIBLE label. `ClaimedMilestoneModel.playerName` is the RAW
 * server name, so the Automa seat came through the ceremony as «MarsBot» while
 * every other surface said «Бот» — resolve it by COLOUR through the one display
 * helper, exactly like `ConsoleContextPanel.ownerDisplayName`. The raw name is
 * the fallback for a colour that isn't in the list (never in a live game).
 */
function actorNameOf(view: MaCeremonyView, color: Color, playerName: string): string {
  const player = view.players?.find((p) => p.color === color);
  return player !== undefined ? participantDisplayName(player) : playerName;
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
        actorName: actorNameOf(view, m.color, m.playerName),
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
  maCeremonyEmbed.claim = undefined;
}
