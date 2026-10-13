/*
 * «СБРОШЕННЫЕ» — THE DISCARD PILE, ONE OBJECT OF THE TABLE (TR52, the owner's concept (a) of 2026-10-13).
 *
 * Before this object the console had THREE piles for one idea: the conditional draw's tray parked at 66 % / 38vh of
 * the VIEWPORT (wherever the workspace stood), the reveal's berth in the far corner of the zone it was teleported
 * into, and the hand discard's own tray (Pluto, Mars University) in the same viewport spot or a colony section's
 * corner. None of them knew its host, so the discard was «not in its place» in every host — the owner's words.
 *
 * Now there is ONE pile, and its home is the TABLE's: it hangs from the status strip right beside the HUD project
 * deck — the deck's twin. The deck is where every card of a search comes from, so a card the rules throw away
 * travels the shortest honest path (off the top of the deck, aside onto the discard), while a found card travels
 * DOWN into the host's zone. The place is the same in every host (the hand, the start, «Действия карт», the
 * colonies, over the board): the HUD never moves.
 *
 * The pile is OUT while somebody holds a LEASE on it, and every holder names itself:
 *   · `scene:<id>`   — the deck-draw scene, from the first card off the deck to the scene's end;
 *   · `reveal:<id>`  — the reveal presenting a batch that threw cards away (R3 «Сброшенные» opens its viewer OUT of
 *                      this pile — the physical origin);
 *   · `stream:<id>`  — a workspace's own arrival beat dealing the thrown-away cards («Действия карт»);
 *   · `hand-discard` — a card leaving the HAND (the shared card-discard cinematic);
 *   · `colony`       — a colony resolution that has discarded (its receipt between the cycles).
 * The last lease released closes the pile with its own phrase (it slides back under the strip); an episode's count
 * is reset only once the pile is fully closed. No lease is ever held by a timer — each is released by its owner's
 * own end, and a game switch resets the whole object.
 *
 * Module-level reactive (the shell mounts ONE `ConsoleDiscardPile`; every director reads this module).
 */
import {reactive} from 'vue';

/** A plain rect (screen px) — DOMRect-compatible, test-friendly. */
export type PileRect = {left: number, top: number, width: number, height: number};

/** Where the pile's clip hangs from: its top-left corner (screen px) — the plate rests a chip lane lower. */
export type DiscardPileAnchor = {left: number, top: number};

export const discardPileState = reactive({
  /** The pile is out (some lease stands). Its leave plays when this falls. */
  visible: false,
  /** Where the plate hangs — measured when the pile opens (the HUD never moves while it is out). */
  anchor: undefined as DiscardPileAnchor | undefined,
  /** Cards that have PHYSICALLY landed on the pile in this episode — ticks on contact. */
  count: 0,
  /** Bumped on every landing — the component replays its one-shot pulse on it. */
  pulseNonce: 0,
  /** The leases standing right now, by name (read by the e2e probe and the diagnostics). */
  holders: [] as Array<string>,
});

const leases = new Set<string>();
let slotEl: HTMLElement | undefined;
let stackEl: HTMLElement | undefined;
let closedWaiters: Array<() => void> = [];

function syncHolders(): void {
  discardPileState.holders = [...leases].sort();
}

/**
 * THE PLATE'S HOME — UNDER the HUD deck, below the strip's chip lane: the plate's left edge is the deck pile's (the
 * two stacks stand one under the other — the deck's twin, literally), shifted left only as far as the safe right edge
 * demands; its box starts at the strip's bottom edge (the clip the plate slides out from under) and the plate itself
 * rests one CHIP LANE lower (`.con-dpile { padding-top }`): every delta chip of the strip — the deck's own «−N», which
 * pops centred under its count — lives in that lane, and the plate may never cover it. It used to stand RIGHT of
 * the deck's count, flush with the strip, and narrow when the room ran short (PL-271); once the status strip lost its
 * events counter (2026-10-13) the room right of the count was the generation cell's width alone, on every profile,
 * and the plate clamped over the very chip the scene ticks. Pure.
 */
export function discardPileAnchorOf(o: {
  /** The deck's own pile (`.con-deckstack__pile`) — the plate's left edge, the stack under the stack. */
  deck: PileRect | undefined,
  /** The deck's count readout (`.con-deckstack__count`) — the fallback when the pile is not measurable. */
  count: PileRect | undefined,
  /** The status strip's bottom edge. */
  stripBottom: number,
  viewportW: number,
  /** The plate's width (px) and the safe right inset (px). */
  plateW: number,
  safeRight: number,
}): DiscardPileAnchor {
  const top = Math.max(0, Math.round(o.stripBottom));
  const edge = o.viewportW - o.safeRight;
  const from = o.deck ?? o.count;
  const left = from === undefined ? edge - o.plateW : Math.min(from.left, edge - o.plateW);
  return {left: Math.max(0, Math.round(left)), top};
}

/** The plate's natural width in rem — the LESS block authors the same number (`.con-dpile__plate`). */
export const DISCARD_PILE_PLATE_W_REM = 10.6;

/** The DOM read of the anchor (the deck, the strip, the root rem) — measured once, as the pile opens. */
export function measureDiscardPileAnchor(): DiscardPileAnchor {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return {left: 0, top: 0};
  }
  const rect = (sel: string): PileRect | undefined => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 ? {left: r.left, top: r.top, width: r.width, height: r.height} : undefined;
  };
  const rem = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 20;
  const strip = rect('.con-status');
  return discardPileAnchorOf({
    deck: rect('.con-deckstack__pile'),
    count: rect('.con-deckstack__count'),
    stripBottom: strip !== undefined ? strip.top + strip.height : 2.7 * rem,
    viewportW: window.innerWidth,
    plateW: DISCARD_PILE_PLATE_W_REM * rem,
    safeRight: 0.9 * rem,
  });
}

/**
 * OPEN — a holder takes a lease (idempotent per name). The first lease measures the home and brings the pile out;
 * a later one simply joins the standing pile (the count carries on: one episode, one pile).
 */
export function openDiscardPile(owner: string): void {
  if (leases.has(owner)) {
    return;
  }
  leases.add(owner);
  syncHolders();
  if (!discardPileState.visible) {
    discardPileState.anchor = measureDiscardPileAnchor();
    discardPileState.visible = true;
  }
}

/** RELEASE — the holder is done. The last release closes the pile (its leave is the component's phrase). */
export function releaseDiscardPile(owner: string): void {
  if (!leases.delete(owner)) {
    return;
  }
  syncHolders();
  if (leases.size === 0) {
    discardPileState.visible = false;
  }
}

/** Release every lease whose name starts with `prefix` and is not in `keep` (a family's sweep). */
export function releaseDiscardPileExcept(prefix: string, keep: ReadonlyArray<string>): void {
  for (const owner of [...leases]) {
    if (owner.startsWith(prefix) && !keep.includes(owner)) {
      releaseDiscardPile(owner);
    }
  }
}

export function discardPileHeldBy(owner: string): boolean {
  return leases.has(owner);
}

/** One card has PHYSICALLY landed on the pile: the count ticks and the pile answers with its pulse. */
export function landOnDiscardPile(): void {
  discardPileState.count++;
  discardPileState.pulseNonce++;
}

/**
 * The pile must say at least `n` (a reveal that presents a batch whose flights it never saw — a reload, an aborted
 * scene: the server's discards are the truth, never a smaller number). Never lowers the count.
 */
export function ensureDiscardPileCount(n: number): void {
  if (n > discardPileState.count) {
    discardPileState.count = n;
  }
}

/** The component registers the landing box and the stack (the R3 viewer's physical origin). */
export function registerDiscardPileEls(slot: HTMLElement | undefined, stack: HTMLElement | undefined): void {
  slotEl = slot;
  stackEl = stack;
}

/** The box a flying card aims at — present only while the pile is out. */
export function discardPileSlotEl(): HTMLElement | undefined {
  return discardPileState.visible ? slotEl : undefined;
}

/** The stack as painted — the fullscreen viewer of the thrown-away cards lifts out of it. */
export function discardPileStackEl(): HTMLElement | null {
  return discardPileState.visible ? stackEl ?? null : null;
}

/** The component reports: the leave has played to its end. The episode is over — the count starts afresh. */
export function noteDiscardPileClosed(): void {
  if (discardPileState.visible) {
    return; // re-opened during the leave — the same pile carries on
  }
  discardPileState.count = 0;
  discardPileState.anchor = undefined;
  const waiters = closedWaiters;
  closedWaiters = [];
  waiters.forEach((w) => w());
}

/** Resolves once the pile is fully closed (immediately when it already is). Bounded by the caller. */
export function whenDiscardPileClosed(): Promise<void> {
  if (!discardPileState.visible && discardPileState.anchor === undefined) {
    return Promise.resolve();
  }
  return new Promise((resolve) => closedWaiters.push(resolve));
}

/** Full reset (tests / the game-switch boundary). */
export function resetDiscardPile(): void {
  leases.clear();
  syncHolders();
  discardPileState.visible = false;
  discardPileState.anchor = undefined;
  discardPileState.count = 0;
  discardPileState.pulseNonce = 0;
  const waiters = closedWaiters;
  closedWaiters = [];
  waiters.forEach((w) => w());
}
