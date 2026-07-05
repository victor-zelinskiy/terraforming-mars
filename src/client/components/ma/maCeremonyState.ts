/**
 * Milestone / Award post-confirm CEREMONY — the shared module state.
 *
 * The premium confirm flows ARM a pending ceremony at submit time; the
 * ceremony FIRES only when the fresh `playerView` proves the action actually
 * resolved for the viewer (the milestone/award is now claimed/funded in the
 * VIEWER's colour). This mirrors the honest seed-then-diff idiom of
 * `terraformingCelebration`:
 *
 *  - a server rejection (someone claimed the slot in a race) never plays a
 *    celebration — the fresh view shows the slot taken by another colour and
 *    the pending arm is dropped;
 *  - reload / reconnect never replays it — the arm lives only in module
 *    memory for the session that submitted;
 *  - both shells (desktop `MaCeremonyOverlay`, console `ConsoleMaCeremony`)
 *    watch ONE `nonce` — one brain, two presentations.
 *
 * `wasRecentlyCelebrated` lets NotificationLayer suppress the viewer's OWN
 * milestone/award prestige card (the ceremony IS that announcement for the
 * actor); other players' cards are untouched.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {MaKind} from '@/client/components/ma/maArt';

export type MaCeremonyEvent = {
  kind: MaKind,
  name: string,
  color: Color,
  cost: number,
  free: boolean,
};

type PendingMaCeremony = MaCeremonyEvent & {armedAt: number};

/** A stale arm (a submit that never resolved) is dropped after this long. */
const PENDING_TTL_MS = 90_000;
/** How long a fired ceremony suppresses the viewer's own notification card. */
const CELEBRATED_TTL_MS = 30_000;

type MaCeremonyStateShape = {
  pending: PendingMaCeremony | undefined,
  current: MaCeremonyEvent | undefined,
  /** Bumped exactly once per fired ceremony — the one-shot watch signal. */
  nonce: number,
  celebrated: Array<{name: string, at: number}>,
};

export const maCeremonyState: MaCeremonyStateShape = reactive({
  pending: undefined,
  current: undefined,
  nonce: 0,
  celebrated: [],
});

/** Called at submit time — the ceremony is a CANDIDATE until the view proves it. */
export function armMaCeremony(event: MaCeremonyEvent, now: number = Date.now()): void {
  maCeremonyState.pending = {...event, armedAt: now};
}

/** The minimal slice of PlayerViewModel the observer needs (test-friendly). */
type MaCeremonyView = {
  thisPlayer?: {color: Color},
  game: {
    milestones: ReadonlyArray<{name: string, playerName?: string, color?: Color}>,
    awards: ReadonlyArray<{name: string, playerName?: string, color?: Color}>,
  },
};

/**
 * Observe a fresh playerView (called from NotificationLayer.update() — the
 * one per-commit hook shared by both shells). Returns true when the ceremony
 * fired on THIS observation.
 */
export function observeMaCeremony(view: MaCeremonyView | undefined, now: number = Date.now()): boolean {
  const pending = maCeremonyState.pending;
  if (pending === undefined || view === undefined) {
    return false;
  }
  if (now - pending.armedAt > PENDING_TTL_MS) {
    maCeremonyState.pending = undefined;
    return false;
  }
  const pool = pending.kind === 'milestone' ? view.game.milestones : view.game.awards;
  const model = pool.find((m) => m.name === pending.name);
  if (model === undefined || model.playerName === undefined || model.playerName === '') {
    return false; // not resolved yet — keep waiting
  }
  maCeremonyState.pending = undefined;
  const viewerColor = view.thisPlayer?.color;
  if (viewerColor === undefined || model.color !== viewerColor) {
    return false; // the race was lost — no celebration for a slot someone else took
  }
  maCeremonyState.current = {
    kind: pending.kind,
    name: pending.name,
    color: viewerColor,
    cost: pending.cost,
    free: pending.free,
  };
  maCeremonyState.nonce++;
  maCeremonyState.celebrated.push({name: pending.name, at: now});
  if (maCeremonyState.celebrated.length > 8) {
    maCeremonyState.celebrated.splice(0, maCeremonyState.celebrated.length - 8);
  }
  return true;
}

/** The viewer's OWN prestige notification is redundant right after the ceremony. */
export function wasRecentlyCelebrated(name: string, now: number = Date.now()): boolean {
  return maCeremonyState.celebrated.some((c) => c.name === name && now - c.at <= CELEBRATED_TTL_MS);
}

/** A different game opened in-session (same boundary the notifications use). */
export function resetMaCeremony(): void {
  maCeremonyState.pending = undefined;
  maCeremonyState.current = undefined;
  maCeremonyState.celebrated = [];
}
