/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ПРИЁМКА» — A CARD DRAWN IN THE PARLIAMENT IS RECEIVED IN THE PARLIAMENT (the owner, 2026-11-02: «карта должна лететь
 * на reveal в embedded режиме на workspace парламента, и он ждёт, пока пользователь не нажмёт забрать — общий премиум
 * язык embedded reveal на забор»).
 *
 * Two families of batch are BORN in the Parliament's own flows, and both used to leave it:
 *   · `agenda`        — a CARD step of the Career (the chairman quest's step, the sitting's ПОВЕСТКА, a law's КАРЬЕРА,
 *                       a card's walk): the cover lifted off the step and flew into the STANDALONE reveal, a scene
 *                       standing over the Parliament, while the quest and the ПОВЕСТКА went on under it;
 *   · `ruling-change` — a card's answer to a change of power (TR62 Tharsis Alliance): consumed with NO reveal at all,
 *                       face down off the deck into the dock.
 * ONE grammar now, the workspaces' own: the batch is presented by the ONE reveal instance, TELEPORTED into the
 * Parliament's draw stage (`ConsoleParliamentDrawStage` — `[data-embed-slot="parliament-draw"]`), the card flies into
 * its slot from its real source (the step's node / the deck pile), the player takes it («Взять» → the hand dock), and
 * the flow that drew it WAITS for that take (`parliamentDrawsSettled`) before its next beat.
 *
 * THE THREE FACTS, kept apart on purpose (the console's «ownership ≠ readiness» law):
 *   OWNERSHIP — `parliamentOwnsRevealBatch`: a batch of those families, while a Parliament stands on screen in a pose
 *               that can host it (`parliamentDrawState.hosts`, written by the sections — the viewer's own, or one a
 *               card's walk stands in the hand; never a nested scene, a warming mount, a sitting page with no draw
 *               layer). The shell then
 *               holds the reveal NOWHERE until the zone is ready — never the standalone band for a frame;
 *   READINESS — `parliamentDrawZone`: the stage has ENTERED (its unfold played — `paneIn`) and the zone node is mounted
 *               (`v-embed-zone`). Until then the cover / the deck scene wait for it (`parliamentDrawReady`);
 *   THE NET   — a stage that never comes (a pose nobody foresaw) cannot hold a batch: the section REFUSES the batch
 *               after `PARLIAMENT_DRAW_READY_NET_MS` and the ordinary road presents it, named. A card is never lost
 *               behind a zone that does not exist.
 *
 * Reactive state only (every predicate a computed caches moves at a reactive edge — invariant 17); no DOM beyond the
 * registry's own mount fact, no Vue components, no i18n.
 */
import {reactive, watch} from 'vue';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {pendingRevealEvents} from '@/client/components/drawnCards/drawnCardsState';
import {embedZoneMounted} from '@/client/console/embedZoneRegistry';
import {probeTick} from '@/client/console/probeTick';
import {beginCeilingWait} from '@/client/console/waitGraph/ceilingWait';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import {parliamentParksReveal} from './parliamentRewardBeat';
import {rulingChangeParksReveal} from './rulingChangeDraw';

/** The zone the shell teleports the reveal into — the draw stage's own slot, inside the Parliament's root. */
export const PARLIAMENT_DRAW_ZONE = '.con-parl [data-embed-slot="parliament-draw"]';

/** The net over a stage that never enters: past it the batch is refused and takes the ordinary road. */
export const PARLIAMENT_DRAW_READY_NET_MS = 4000;

/**
 * The wait for the player's take. A take is the PLAYER's (unbounded by design — a reading is never a wedge), so this is
 * only a net over a batch that neither presents nor leaves (a lost response): the flow goes on, named.
 */
export const PARLIAMENT_DRAW_TAKE_NET_MS = 180_000;

export const parliamentDrawState = reactive({
  /**
   * The Parliament sections that may host a draw right now (by instance — a warming mount and a visible one may stand at
   * once, and neither may overwrite the other's answer). Written by the sections (`setParliamentDrawHost`).
   */
  hosts: [] as Array<number>,
  /** The draw stage has ENTERED (its unfold / layer phrase played) — the zone may be measured and filled. */
  paneIn: false,
  /** Batches the Parliament gave up on (the readiness net fired) — they take the ordinary road. */
  refused: [] as Array<number>,
  /** How many batches the stage has hosted this session — a probe's counter. */
  hosted: 0,
});

/** Is `source` a batch the Parliament's own flows draw — a Career card step, a card's answer to a change of power? */
export function isParliamentDrawSource(source: CardDrawRevealSource | undefined): boolean {
  return source?.type === 'agenda' || source?.type === 'ruling-change';
}

/** Does the Parliament host this batch (judged by its ROOT source — a walk's card steps are one batch)? */
export function parliamentOwnsRevealBatch(batch: {id: number, source?: CardDrawRevealSource} | undefined): boolean {
  return batch !== undefined && parliamentDrawState.hosts.length > 0 && isParliamentDrawSource(batch.source) &&
    !parliamentDrawState.refused.includes(batch.id);
}

/** The zone the reveal may be teleported into RIGHT NOW, or '' (claimed but not ready — render nowhere). */
export function parliamentDrawZone(): string {
  return parliamentDrawState.paneIn && embedZoneMounted(PARLIAMENT_DRAW_ZONE) ? PARLIAMENT_DRAW_ZONE : '';
}

let drawHostIds = 0;

/** A section's id as a draw host — taken once, in its `setup` (a counter of this module: never the component
 *  instance's `uid`, which a `<script setup>` / Vapor component has no way to read). */
export function newParliamentDrawHostId(): number {
  return ++drawHostIds;
}

/** A section says whether it may host a draw now (its own host id — the answer of one never erases another's). */
export function setParliamentDrawHost(instance: number, on: boolean): void {
  const at = parliamentDrawState.hosts.indexOf(instance);
  if (on && at < 0) {
    parliamentDrawState.hosts.push(instance);
  } else if (!on && at >= 0) {
    parliamentDrawState.hosts.splice(at, 1);
  }
}

/** The stage's host: the stage has entered (the layer phrase / the body swap played). */
export function noteParliamentDrawPaneIn(): void {
  if (!parliamentDrawState.paneIn) {
    parliamentDrawState.paneIn = true;
    parliamentDrawState.hosted++;
  }
}

/** The stage left (its component unmounted): the zone is gone with it. */
export function noteParliamentDrawPaneOut(): void {
  parliamentDrawState.paneIn = false;
}

/** THE NET: the stage never came for `id` — the batch takes the ordinary road, named. */
export function refuseParliamentDraw(id: number, why: string): void {
  if (!parliamentDrawState.refused.includes(id)) {
    parliamentDrawState.refused.push(id);
    console.warn(`[parliament-draw] batch ${id} refused (${why}) — the ordinary reveal presents it`);
  }
}

/**
 * A batch of the Parliament's families STANDS for the player — pending, its cards untaken, and no park of the
 * Parliament's own holding it back (a step the marker has not reached, a change of power not told yet). Whoever
 * presents it (the draw stage, or the ordinary road after a refusal), the flow that drew it waits for it.
 */
export function parliamentDrawStanding(): boolean {
  return pendingRevealEvents().some((e) => isParliamentDrawSource(e.source) &&
    !parliamentParksReveal(e.source) && !rulingChangeParksReveal(e.source));
}

/** Resolve once `done()` holds — re-asked on every reactive change, bounded by the take's net (named). Never rejects. */
function waitUntil(done: () => boolean, what: string, node: {id: string, what: string}): Promise<void> {
  if (done()) {
    return Promise.resolve();
  }
  // A wait that has to wait is a node of the wait graph; the net ending it is said (`ceilingWait.ts`).
  const wait = beginCeilingWait({id: node.id, owner: 'parliamentDraw', what: node.what, maxMs: PARLIAMENT_DRAW_TAKE_NET_MS, target: 'player'});
  return new Promise((resolve) => {
    const onNet = (): void => {
      stop();
      forget();
      console.warn(`[parliament-draw] ${what} — the net let the flow go on`);
      wait.ceiling();
      resolve();
    };
    // The net WARNS, so it is a pacing timer of the session (a wall-clock bound, never a beat); a session that ends
    // under the wait lets the awaiting flow go SILENTLY — the take was not late, the game left.
    const owner = consoleSessionScope();
    const cancelNet = owner.after(PARLIAMENT_DRAW_TAKE_NET_MS, 'the take of a Parliament draw (the net)', onNet);
    const forget = owner.defer(() => {
      stop();
      wait.end();
      resolve();
    });
    const stop = watch(done, (ok) => {
      if (ok) {
        cancelNet();
        forget();
        stop();
        wait.met();
        resolve();
      }
    }, {flush: 'sync'});
  });
}

/**
 * THE FLOW WAITS FOR THE TAKE: resolves once no Parliament-born batch stands for the player (every card taken, or the
 * batch gone). The quest, the sitting's walk and the enactment's tail call it before their next beat — one press, the
 * surfaces in turn: the draw stage never stands under the next beat, the next beat never starts under the draw.
 */
export function parliamentDrawsSettled(): Promise<void> {
  return waitUntil(() => !parliamentDrawStanding(), 'a Parliament draw was never taken',
    {id: 'parliament-draw:settled', what: 'the take of every Parliament draw'});
}

/** Resolves once the batch `id` no longer stands (taken or gone). */
export function parliamentDrawTaken(id: number): Promise<void> {
  return waitUntil(() => !pendingRevealEvents().some((e) => e.id === id), `batch ${id} was never taken`,
    {id: 'parliament-draw:taken', what: 'the take of the drawn batch'});
}

/**
 * THE SCENES WAIT FOR THE ZONE: a flight into the reveal's slots (the cover off the Career's step, the deck's deal)
 * measures them only once the draw stage stands — or once the Parliament has let go of the batch (the ordinary
 * road). Bounded by the readiness net; polled on the probe tick (the zone's mount is the registry's epoch, but the
 * stage's entrance must also have LAID OUT).
 */
export function parliamentDrawReady(batch: {id: number, source?: CardDrawRevealSource}): Promise<void> {
  if (!parliamentOwnsRevealBatch(batch) || parliamentDrawZone() !== '') {
    return Promise.resolve();
  }
  const started = Date.now();
  const node = beginCeilingWait({id: 'parliament-draw:zone', owner: 'parliamentDraw', what: 'the draw stage zone of the Parliament', maxMs: PARLIAMENT_DRAW_READY_NET_MS});
  return new Promise((resolve) => {
    const poll = (): void => {
      if (!parliamentOwnsRevealBatch(batch) || parliamentDrawZone() !== '') {
        node.met();
        resolve();
        return;
      }
      if (Date.now() - started > PARLIAMENT_DRAW_READY_NET_MS) {
        node.ceiling();
        resolve();
        return;
      }
      probeTick(poll);
    };
    probeTick(poll);
  });
}

/** Full reset (a game switch, a test's cleanup). */
export function resetParliamentDraw(): void {
  parliamentDrawState.hosts = [];
  parliamentDrawState.paneIn = false;
  parliamentDrawState.refused = [];
}
