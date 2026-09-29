/*
 * @console-shared LIVE — console native stands on this file.
 * ANOTHER SEAT'S DELEGATE ARRIVES (Turmoil Redux — docs/TURMOIL_REDUX_MARSBOT.md §8.4).
 *
 * Until now a rival's vote (a human's in multiplayer, MarsBot's Party Politics
 * and Lobbying) simply REDREW the ribbon: the cube was there, then it was
 * there. This beat gives the arrival the same physics as the viewer's own
 * vote: the cube LEAVES that seat's place on the delegates zone (its lobby
 * socket when the free delegate went, else the top of its reserve stack) and
 * LANDS on its place in the card's ribbon (`flyCube` — the sitting's own cube
 * flight); two in one response go one after another, in placement order.
 *
 * THE DETECTION IS BY PLACEMENT NUMBER, in the SAME synchronous block as the
 * view apply (`seedRivalVotes`, beside `seedParliamentSittingHolds`): a vote
 * whose `seq` is newer than the last one this device has SHOWN, owned by
 * neither the viewer nor the neutral player, is queued and its ribbon cube
 * HIDDEN (`parliamentHolds.hiddenCubes`) before any frame can paint it; the
 * source keeps PAINTING the cube (`sources`) until the proxy stands over it.
 * Seeded a tick late, the new cube would show for a frame before its flight —
 * the sitting's own law.
 *
 * WHEN THERE IS NO BEAT, honestly: the Parliament section is not mounted (the
 * news rides the notification and the turn review; on the next mount the
 * table is simply as it is), a sitting is in progress (the sitting's own
 * seeds and beats own every cube then), reduced motion (the cube appears
 * with the ribbon's arrival mark — a crossfade, never a blink). The hold is a
 * REGISTRY SUPPLIER over this reactive record (never a timer), with an
 * expiry that settles the record so a stalled flight cannot wedge the table.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {parliamentFlow, parliamentRootEl} from './consoleParliamentFlow';
import {parliamentHolds} from './parliamentDisplayHolds';
import {flyCube, placeCubeRect} from './parliamentFlights';

export type RivalArrival = {instance: string; seq: number; owner: Color; source: 'lobby' | 'reserve'};

/** The stages of the section in which a rival's cube may FLY in (the sitting owns its own cubes; a seat pick has nothing to do with votes). */
const FLYING_STAGES: ReadonlySet<string> = new Set(['browse', 'vote', 'submitting', 'paying', 'landed']);

export const rivalVotes = reactive({
  /** Cubes of other seats the model holds and the table does not show yet, in placement order. */
  queue: [] as Array<RivalArrival>,
  /** The one in the air (its proxy flies; its ribbon cube stays hidden until the touchdown). */
  flying: undefined as RivalArrival | undefined,
  /** Per seat: cubes the delegates zone STILL PAINTS at their source until each proxy stands over them. */
  sources: new Map<Color, {lobby: number; reserve: number}>(),
  /** Ribbon cubes that ARRIVED this session (`instance#seq`) — the ribbon's arrival mark plays once per cube. */
  arrived: new Set<string>(),
  /** The newest placement number this device has SHOWN — a cube older than it never flies (a mount, a reload). */
  seenSeq: 0,
});

function cubeKey(instance: string, seq: number): string {
  return `${instance}#${seq}`;
}

function newestSeq(model: ParliamentModel | undefined): number {
  let max = 0;
  for (const slot of model?.slots ?? []) {
    for (const vote of slot.votes) {
      max = Math.max(max, vote.seq);
    }
  }
  return max;
}

/** Does the table STAND where a rival's cube can fly in — the section mounted, out of a sitting, at a browsing stage? */
function tableStands(after: PlayerViewModel): boolean {
  return parliamentRootEl() !== undefined && after.game.parliament?.phase === undefined && FLYING_STAGES.has(parliamentFlow.stage);
}

/**
 * THE SEED — called in the view-apply block (the transport's `seedRewardHolds`
 * and its `App.update` twin), before any render of `after`. Pure over the two
 * views and this record; no DOM but the root registry's presence.
 */
export function seedRivalVotes(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const next = after?.game.parliament;
  if (after === undefined || next === undefined) {
    return;
  }
  const previous = before?.game.parliament;
  const viewer = after.thisPlayer?.color;
  const newest = newestSeq(next);
  // A FIRST reading of the table (no earlier view, another game's table, a sitting just closed and refreshed it):
  // nothing flies — the cubes are simply where they are.
  const fresh = previous === undefined || before === undefined || before.id !== after.id || previous.phase !== undefined;
  if (fresh || viewer === undefined) {
    rivalVotes.seenSeq = Math.max(rivalVotes.seenSeq, newest);
    if (fresh) {
      rivalVotes.seenSeq = newest;
    }
    return;
  }
  const since = Math.max(rivalVotes.seenSeq, newestSeq(previous));
  rivalVotes.seenSeq = newest;
  const stands = tableStands(after);
  const reduced = consoleReducedMotionActive();
  const lobbyUsed = new Set<Color>();
  const arrivals: Array<RivalArrival & {key: string}> = [];
  for (const slot of next.slots) {
    for (const vote of slot.votes) {
      if (vote.seq <= since || vote.owner === 'neutral' || vote.owner === viewer) {
        continue;
      }
      const owner = vote.owner;
      const wasInLobby = previous.players.find((p) => p.color === owner)?.lobby === true;
      const isInLobby = next.players.find((p) => p.color === owner)?.lobby === true;
      const source: 'lobby' | 'reserve' = wasInLobby && !isInLobby && !lobbyUsed.has(owner) ? 'lobby' : 'reserve';
      if (source === 'lobby') {
        lobbyUsed.add(owner);
      }
      arrivals.push({instance: slot.instance, seq: vote.seq, owner, source, key: cubeKey(slot.instance, vote.seq)});
    }
  }
  if (arrivals.length === 0) {
    return;
  }
  arrivals.sort((a, b) => a.seq - b.seq);
  if (!stands || reduced) {
    // No flight: the cube is simply there — with its arrival mark when the table is on screen (a crossfade, never a blink).
    if (stands) {
      for (const arrival of arrivals) {
        rivalVotes.arrived.add(arrival.key);
      }
    }
    return;
  }
  for (const arrival of arrivals) {
    parliamentHolds.hiddenCubes.add(arrival.key);
    const source = rivalVotes.sources.get(arrival.owner) ?? {lobby: 0, reserve: 0};
    source[arrival.source]++;
    rivalVotes.sources.set(arrival.owner, source);
    rivalVotes.queue.push({instance: arrival.instance, seq: arrival.seq, owner: arrival.owner, source: arrival.source});
  }
}

/** The proxy stands over the source: that cube may vanish from the zone now (the next one, if any, stays). */
function lifted(arrival: RivalArrival): void {
  const source = rivalVotes.sources.get(arrival.owner);
  if (source === undefined) {
    return;
  }
  source[arrival.source] = Math.max(0, source[arrival.source] - 1);
  if (source.lobby === 0 && source.reserve === 0) {
    rivalVotes.sources.delete(arrival.owner);
  }
}

/** Touchdown: the ribbon's own cube materializes under the proxy, marked as arrived; the next cube flies. */
function landed(arrival: RivalArrival): void {
  const key = cubeKey(arrival.instance, arrival.seq);
  parliamentHolds.hiddenCubes.delete(key);
  rivalVotes.arrived.add(key);
  lifted(arrival);
  if (rivalVotes.flying?.seq === arrival.seq) {
    rivalVotes.flying = undefined;
  }
  rivalVotes.queue = rivalVotes.queue.filter((entry) => entry.seq !== arrival.seq);
  runRivalVotes();
}

/**
 * THE DIRECTOR: fly the next queued cube — from the seat's real place on the
 * delegates zone to its real place on the ribbon (both measured now). Called
 * by the section when the queue grows and at every touchdown; a table that
 * cannot be measured settles the cube on the spot.
 */
export function runRivalVotes(): void {
  if (rivalVotes.flying !== undefined || rivalVotes.queue.length === 0) {
    return;
  }
  const root = parliamentRootEl();
  const next = rivalVotes.queue[0];
  rivalVotes.flying = next;
  const from = root === undefined ? undefined : placeCubeRect(root, next.source === 'lobby' ?
    `[data-parl-seat-lobby="${next.owner}"]` :
    `[data-parl-seat-reserve="${next.owner}"]`);
  const to = root === undefined ? undefined : placeCubeRect(root, `.con-parl__slot[data-instance="${next.instance}"] [data-seq="${next.seq}"]`);
  // `flyCube` settles the holds itself when nothing is measurable (it calls both continuations at once).
  flyCube(next.owner, from, to, 0, () => landed(next), {onLifted: () => lifted(next)});
}

/** Nothing is owed any more: every queued cube is simply where the model says (the section left, the hold expired). */
export function settleRivalVotes(): void {
  for (const entry of [...rivalVotes.queue, ...(rivalVotes.flying === undefined ? [] : [rivalVotes.flying])]) {
    parliamentHolds.hiddenCubes.delete(cubeKey(entry.instance, entry.seq));
  }
  rivalVotes.queue = [];
  rivalVotes.flying = undefined;
  rivalVotes.sources = new Map();
}

/** A spec's reset (module state is bundle-shared). */
export function resetRivalVotes(): void {
  settleRivalVotes();
  rivalVotes.arrived = new Set();
  rivalVotes.seenSeq = 0;
}

registerAnimationHoldSupplier('parliament-rival-vote', () => rivalVotes.queue.length > 0 || rivalVotes.flying !== undefined, {
  maxHoldMs: 8000,
  diagnose: () => ({queue: rivalVotes.queue.map((e) => `${e.owner}:${e.seq}`), flying: rivalVotes.flying?.seq}),
  expire: () => settleRivalVotes(),
});
