/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DISCARD OF A POPULAR SUPPORT AREA, PLAYED WHERE IT WAS CONFIRMED (Turmoil
 * Redux TR12 Party Sanctions — docs/TURMOIL_REDUX_PARTY_SANCTIONS.md §5).
 *
 * The discard is a FACT of the answer (the server emptied the area into the
 * common supply), so the screen may show it only AFTER the answer — and must
 * show it as cubes travelling, never as an area that blinked empty while the
 * pool jumped. Three beats, one owner each (the colony track's grammar,
 * `colonyTrackMove.ts`):
 *
 *  · THE PROMISE (`promiseSupportDiscard`) — set at A by whoever submits the
 *    pick (the staged commit, the live door's confirm): which party, whose
 *    card. Nothing moves yet; nothing is held.
 *  · THE SEED (`seedSupportDiscardHolds`) — in the transport's apply block, the
 *    SAME synchronous block as the view (parliament law 3: a hold seeded a tick
 *    late paints the empty area and the fuller pool for a frame first). It
 *    reads the DIFF of the two views — the promised area shrank — and holds
 *    BOTH ends of the flight: the plaque keeps drawing the cubes (`standing`,
 *    one released per LIFT-OFF) and the pool keeps its old count (`toPool`, one
 *    released per TOUCHDOWN). ONLY when the mode that will play it stands (the
 *    section's registered probe): a hold nobody plays freezes the area for good.
 *  · THE FLIGHTS (`supportDiscardScene.ts`) — each cube from its own place on
 *    the plaque to the pool on the bench, one after another.
 *
 * A promise whose answer never emptied the area (a PARKED tail, a re-ask)
 * stays a promise until the flow that made it ends (`clearSupportDiscard`).
 *
 * Pure + a reactive record: no DOM, no i18n, no timers.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** The confirmed pick: the party whose area goes, and the card whose effect it is (absent on a live pick with no named giver). */
export type SupportDiscardPromise = {party: ReduxParty, card?: CardName};

export const supportDiscardFlow = reactive({
  /** The pick the player CONFIRMED, awaiting its answer. */
  promised: undefined as SupportDiscardPromise | undefined,
  /** The discard the answer CARRIED — `count` cubes left the party's area for the common supply. */
  owed: undefined as {party: ReduxParty, count: number} | undefined,
  /** Cubes the plaque still DRAWS (each lift-off takes one) — the area as shown is the model's + this. */
  standing: 0,
  /** Cubes the pool does not COUNT yet (each touchdown adds one) — the pool as shown is the model's − this. */
  toPool: 0,
  /** Why the flights could not be flown (no measurable place) — '' when they flew. CONFESSED on the section root. */
  degraded: '',
});

/** «Does the mode that would play a discard stand right now?» — registered by the Parliament section. */
let hostProbe: () => boolean = () => false;

export function registerSupportDiscardHost(probe: (() => boolean) | undefined): void {
  hostProbe = probe ?? (() => false);
}

/** A: the pick is on the wire. */
export function promiseSupportDiscard(promise: SupportDiscardPromise): void {
  supportDiscardFlow.promised = promise;
  supportDiscardFlow.degraded = '';
}

function areaOf(view: PlayerViewModel | undefined, party: ReduxParty): number | undefined {
  return view?.game.parliament?.popularSupport[party];
}

/**
 * THE APPLY-BLOCK SEED (`gameTransport.seedRewardHolds`, `App.update`): the
 * promised party's area shrank between the two views → keep the cubes drawn on
 * the plaque and out of the pool, and owe the flights — only while the mode
 * stands. A no-op for every other answer.
 */
export function seedSupportDiscardHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const promise = supportDiscardFlow.promised;
  if (promise === undefined || after === undefined) {
    return;
  }
  const was = areaOf(before, promise.party) ?? 0;
  const now = areaOf(after, promise.party) ?? 0;
  if (now >= was) {
    // Not landed (yet): a parked tail lands with a later answer, a re-ask never does. The promise stays.
    return;
  }
  supportDiscardFlow.promised = undefined;
  if (!hostProbe() || consoleReducedMotionActive()) {
    // Nobody stands to play it (or motion is reduced): the area and the pool show the server's numbers at once.
    return;
  }
  const count = was - now;
  supportDiscardFlow.owed = {party: promise.party, count};
  supportDiscardFlow.standing = count;
  supportDiscardFlow.toPool = count;
}

/** The answer carried a discard the mode still owes. */
export function supportDiscardOwed(): boolean {
  return supportDiscardFlow.owed !== undefined;
}

/** The cubes the plaque of `party` still draws above the model (0 for every other party). */
export function supportDiscardStanding(party: ReduxParty): number {
  return supportDiscardFlow.owed?.party === party ? supportDiscardFlow.standing : 0;
}

/** The cubes the pool on the bench does not count yet. */
export function supportDiscardPoolHeld(): number {
  return supportDiscardFlow.owed === undefined ? 0 : supportDiscardFlow.toPool;
}

/** A cube LIFTED off its place (the proxy stands over it): the plaque stops drawing it. */
export function liftSupportDiscardCube(): void {
  supportDiscardFlow.standing = Math.max(0, supportDiscardFlow.standing - 1);
}

/** A cube LANDED in the pool: the pool counts it. */
export function landSupportDiscardCube(): void {
  supportDiscardFlow.toPool = Math.max(0, supportDiscardFlow.toPool - 1);
}

/** Every cube of the owed discard has landed (or was let go): the area and the pool read the server again. */
export function settleSupportDiscard(): void {
  supportDiscardFlow.owed = undefined;
  supportDiscardFlow.standing = 0;
  supportDiscardFlow.toPool = 0;
}

/** The flow that promised the discard is over (or was refused): every hold of its own released. Idempotent. */
export function clearSupportDiscard(): void {
  supportDiscardFlow.promised = undefined;
  settleSupportDiscard();
}
