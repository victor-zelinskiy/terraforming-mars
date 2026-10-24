/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ONE DELEGATE TAKEN OFF THE TABLE, PLAYED WHERE IT WAS CONFIRMED (Turmoil Redux TR72 Banned Delegate:redux —
 * docs/TURMOIL_REDUX_BANNED_DELEGATE.md §4).
 *
 * The removal is a FACT of the answer (the server took the cube off its place and the ledger re-derived), so the
 * screen may show it only AFTER the answer — and must show it as the FIGURE travelling home, never as a ribbon that
 * lost a figure while a reserve jumped by one. The TR12 discard's grammar (`supportDiscard.ts`), with one difference
 * that makes it simpler: the answer carries its own RECORD (`ParliamentModel.lastRemoval` — the place, the owner,
 * the very vote's `seq`, where it went), so nothing is promised at the press and nothing is read off a diff:
 *
 *  · THE SEED (`seedDelegateRemovalHolds`) — in the transport's apply block, the SAME synchronous block as the view
 *    (parliament law 3): a record with a fresh `seq` → hold BOTH ends of the flight: the place keeps drawing the
 *    figure (`standing` — released on the LIFT-OFF) and the destination keeps its old count (`toDest` — released on
 *    the TOUCHDOWN). ONLY when the mode that will play it stands (the section's registered probe): a hold nobody
 *    plays freezes the table for good — then the table reads the server at once.
 *  · THE FLIGHT (`delegateRemovalScene.ts`) — «взял → понёс → поставил»: from its place on the ribbon / the plaque
 *    to its owner's reserve stack or the neutral supply on the bench.
 *
 * Pure + a reactive record: no DOM, no i18n, no timers.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentDelegateRemovalModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

export const delegateRemovalFlow = reactive({
  /** The removal the answer CARRIED and the mode still owes its flight. */
  owed: undefined as ParliamentDelegateRemovalModel | undefined,
  /** The figure still stands on its place (the lift-off releases it). */
  standing: false,
  /** The destination does not count the figure yet (the touchdown releases it). */
  toDest: false,
  /** Why the flight could not be flown (no measurable place) — '' when it flew. CONFESSED on the section root. */
  degraded: '',
  /** The last record this session has seen — a record is played once (an echo frame, a reload's first frame never replay it). */
  seenSeq: 0,
});

/** «Does the mode that would play a removal stand right now?» — registered by the Parliament section. */
let hostProbe: () => boolean = () => false;

export function registerDelegateRemovalHost(probe: (() => boolean) | undefined): void {
  hostProbe = probe ?? (() => false);
}

/**
 * THE APPLY-BLOCK SEED (`gameTransport.seedRewardHolds`, `App.update`): a FRESH removal record → keep the figure on its
 * place and out of its destination, and owe the flight — only while the mode stands. A first frame (no `before`)
 * only learns the seq: a reload never replays a removal.
 */
export function seedDelegateRemovalHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const record = after?.game.parliament?.lastRemoval;
  if (record === undefined || record.seq <= delegateRemovalFlow.seenSeq) {
    return;
  }
  delegateRemovalFlow.seenSeq = record.seq;
  const was = before?.game.parliament?.lastRemoval?.seq;
  if (before === undefined || (was !== undefined && was >= record.seq)) {
    return;
  }
  if (!hostProbe() || consoleReducedMotionActive()) {
    // Nobody stands to play it (or motion is reduced): the table and the bench show the server's numbers at once.
    return;
  }
  delegateRemovalFlow.owed = record;
  delegateRemovalFlow.standing = true;
  delegateRemovalFlow.toDest = true;
  delegateRemovalFlow.degraded = '';
}

/** The answer carried a removal the mode still owes. */
export function delegateRemovalOwed(): boolean {
  return delegateRemovalFlow.owed !== undefined;
}

/**
 * THE VOTE A BILL STILL DRAWS though the model has taken it — `{owner, seq}` for the bill of `instance` while the
 * figure has not lifted off (the ribbon re-inserts it at its place: a figure never vanishes before it is taken).
 */
export function delegateRemovalGhostVote(instance: string): {owner: Color | 'neutral', seq: number} | undefined {
  const owed = delegateRemovalFlow.owed;
  if (owed === undefined || !delegateRemovalFlow.standing || owed.place !== 'resolution' || owed.instance !== instance || owed.vote === undefined) {
    return undefined;
  }
  return {owner: owed.owner, seq: owed.vote};
}

/** The cubes the plaque of `party` still draws above the model (1 while a support figure has not lifted off). */
export function delegateRemovalSupportStanding(party: ReduxParty): number {
  const owed = delegateRemovalFlow.owed;
  return owed !== undefined && delegateRemovalFlow.standing && owed.place === 'support' && owed.party === party ? 1 : 0;
}

/** A seat's reserve does not count the figure yet (1 while it is in the air home). */
export function delegateRemovalReserveHeld(color: Color): number {
  const owed = delegateRemovalFlow.owed;
  return owed !== undefined && delegateRemovalFlow.toDest && owed.returnsTo === 'reserve' && owed.owner === color ? 1 : 0;
}

/** The common supply does not count the figure yet (1 while a neutral figure is in the air). */
export function delegateRemovalPoolHeld(): number {
  const owed = delegateRemovalFlow.owed;
  return owed !== undefined && delegateRemovalFlow.toDest && owed.returnsTo === 'supply' ? 1 : 0;
}

/** The figure LIFTED off its place (the proxy stands over it): the place stops drawing it, the count ticks. */
export function liftRemovedDelegate(): void {
  delegateRemovalFlow.standing = false;
}

/** The figure LANDED home: the destination counts it. */
export function landRemovedDelegate(): void {
  delegateRemovalFlow.toDest = false;
}

/** The flight is over (or was let go): the table and the bench read the server again. Idempotent. */
export function settleDelegateRemoval(): void {
  delegateRemovalFlow.owed = undefined;
  delegateRemovalFlow.standing = false;
  delegateRemovalFlow.toDest = false;
}
