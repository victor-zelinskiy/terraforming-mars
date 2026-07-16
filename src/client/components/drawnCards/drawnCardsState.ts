import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardDrawRevealModel, CardDrawRevealSource, CardDrawRevealStep} from '@/common/models/CardDrawRevealModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';

/**
 * Module-level reactive state for the "you drew cards" reveal flow
 * (DrawCardRevealFlow). Lives at module scope — NOT in any component's
 * `data()` — so it survives the `<player-home :key="playerkey">` remount that
 * fires on every server response (same trick as `journalState` /
 * `sellPatentsState`). The flow component is mounted at App level for the same
 * reason, so the deal/collect animation and the per-card "taken" progress are
 * never destroyed by a poll mid-reveal.
 *
 * Source of truth for WHICH batches exist is the server (the owner-only
 * `playerView.cardDrawReveals`, reconciled below). The per-card "taken" flag is
 * a CLIENT-ONLY visual staging concept: the server already put the cards in the
 * hand at draw time, but until the player presses ВЗЯТЬ they are subtracted from
 * the hand count + overlay so the "КАРТЫ" badge only ticks up on the actual take.
 */
export type DrawnCardEntry = {
  id: number;
  source?: CardDrawRevealSource;
  cards: ReadonlyArray<CardModel>;
  /**
   * The conditional search's reveal order (server truth — see
   * CardDrawRevealModel.sequence). Present only when the search really
   * discarded something; the console draw cinematic replays it verbatim.
   */
  sequence?: ReadonlyArray<CardDrawRevealStep>;
  /** Indices within `cards` the player has already taken (client-only). */
  takenIndices: Set<number>;
  /** True between firing the ack POST and its response landing. */
  acking: boolean;
  /**
   * Client-only: the batch is fully taken and has been dismissed from view
   * immediately (before the server ack round-trip lands), so the modal closes
   * without flashing an empty card tray. The entry lingers until the ack
   * response reconciles it out; reconcile preserves this flag so a poll
   * arriving mid-ack can't flicker the modal back.
   */
  dismissed: boolean;
};

type DrawnCardsState = {
  events: Array<DrawnCardEntry>;
  /** Card currently open fullscreen, or null. */
  fullscreen: {eventId: number, index: number} | null;
};

export const drawnCardsState: DrawnCardsState = reactive({
  events: [],
  fullscreen: null,
});

/**
 * Merge the server's reveal list into the local store on every playerView
 * update. New batches are added (empty taken set); batches the server no longer
 * reports (acked / undone / reset) are dropped; existing batches keep their
 * client-side taken/acking state but refresh their card models.
 */
export function reconcileDrawnCards(reveals: ReadonlyArray<CardDrawRevealModel>): void {
  const incomingIds = new Set(reveals.map((r) => r.id));
  drawnCardsState.events = drawnCardsState.events.filter((e) => incomingIds.has(e.id));
  for (const r of reveals) {
    const existing = drawnCardsState.events.find((e) => e.id === r.id);
    if (existing === undefined) {
      drawnCardsState.events.push({
        id: r.id,
        source: r.source,
        cards: r.cards,
        sequence: r.sequence,
        takenIndices: new Set<number>(),
        acking: false,
        dismissed: false,
      });
    } else {
      // Cost / unplayable reasons can shift between polls — refresh the models,
      // preserving the client-only take progress. The sequence is immutable
      // history (what the deck did when the batch was drawn), but refresh it
      // too so the batch stays one consistent server snapshot.
      existing.cards = r.cards;
      existing.source = r.source;
      existing.sequence = r.sequence;
    }
  }
  // Deterministic FIFO (server ids are monotonic).
  drawnCardsState.events.sort((a, b) => a.id - b.id);
  if (drawnCardsState.events.length === 0) {
    drawnCardsState.fullscreen = null;
  }
}

function untakenCount(e: DrawnCardEntry): number {
  return e.cards.length - e.takenIndices.size;
}

/**
 * True while at least one non-dismissed batch exists — drives the modal's
 * visibility (App-level v-if). Goes false the instant the last batch is
 * dismissed (full take / take-all), closing the modal without waiting for the
 * server ack, so the player never sees an empty card tray.
 */
export function hasVisibleReveal(): boolean {
  return drawnCardsState.events.some((e) => !e.dismissed);
}

/**
 * Multiset (by CardName) of cards still staged out of the hand. PlayerHome
 * subtracts these from the displayed hand so pending cards don't appear in the
 * "КАРТЫ" overlay (or its count) until taken. Keyed on takenIndices ONLY (NOT
 * `dismissed`), so closing the modal doesn't release the cards into the hand —
 * closeAndRelease marks them taken a couple of frames later, which is what
 * fires the КАРТЫ delta-chip (on a now-unblurred screen).
 */
export function untakenNameMultiset(): Map<CardName, number> {
  const m = new Map<CardName, number>();
  for (const e of drawnCardsState.events) {
    e.cards.forEach((c, i) => {
      if (!e.takenIndices.has(i)) {
        m.set(c.name, (m.get(c.name) ?? 0) + 1);
      }
    });
  }
  return m;
}

/** The oldest non-dismissed batch that still has untaken cards (the one shown). */
export function currentRevealEvent(): DrawnCardEntry | undefined {
  return drawnCardsState.events.find((e) => !e.dismissed && untakenCount(e) > 0);
}

/**
 * Mark a fully-taken batch dismissed so the modal closes immediately, before
 * the server ack round-trip. The entry stays in the store (so reconcile can
 * preserve the flag against a mid-ack poll) until the ack response removes it.
 */
export function dismissEvent(id: number): void {
  const e = drawnCardsState.events.find((ev) => ev.id === id);
  if (e !== undefined) {
    e.dismissed = true;
  }
}

export function markCardTaken(eventId: number, index: number): void {
  const e = drawnCardsState.events.find((ev) => ev.id === eventId);
  if (e !== undefined) {
    e.takenIndices.add(index);
  }
}

export function markAllTaken(eventId: number): void {
  const e = drawnCardsState.events.find((ev) => ev.id === eventId);
  if (e !== undefined) {
    e.cards.forEach((_c, i) => e.takenIndices.add(i));
  }
}

export function isEventFullyTaken(eventId: number): boolean {
  const e = drawnCardsState.events.find((ev) => ev.id === eventId);
  return e === undefined || untakenCount(e) === 0;
}

export function setAcking(eventId: number, value: boolean): void {
  const e = drawnCardsState.events.find((ev) => ev.id === eventId);
  if (e !== undefined) {
    e.acking = value;
  }
}

/**
 * Fire-and-forget server ack (shared by the desktop flow AND the console
 * reveal overlay — CTS-3.1). The batch is already dismissed client-side;
 * this only clears the server's transient queue. Deliberately does NOT
 * apply the response (a remount could cut the КАРТЫ delta-chip); the
 * lingering hidden entry is reconciled out by the next poll / input.
 */
export function acknowledgeDraw(viewId: string, id: number): void {
  fetch(
    apiUrl(paths.ACKNOWLEDGE_DRAW) + '?id=' + viewId + '&revealId=' + id,
    {method: 'POST'},
  )
    .then((resp) => {
      if (!resp.ok) {
        setAcking(id, false);
        console.warn('acknowledge-draw failed', resp.status);
      }
    })
    .catch((err) => {
      setAcking(id, false);
      console.error(err);
    });
}

/**
 * Close the reveal NOW (dismiss → the hosting surface unmounts via its
 * v-if → the blurred backdrop leaves the DOM), then release the
 * hand-staging (`releaseFn` marks the cards taken → the КАРТЫ count +
 * delta-chip fire) only AFTER the backdrop has painted out (two nested
 * rAFs = at least one clean frame), then ack. Module-state only — safe
 * to run after the calling component unmounts.
 */
export function closeAndReleaseEvent(viewId: string, id: number, releaseFn: () => void): void {
  const ev = drawnCardsState.events.find((e) => e.id === id);
  if (ev === undefined || ev.acking) {
    return;
  }
  setAcking(id, true);
  dismissEvent(id);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    releaseFn();
    acknowledgeDraw(viewId, id);
  }));
}
