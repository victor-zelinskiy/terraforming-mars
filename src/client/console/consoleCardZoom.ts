/*
 * CONSOLE CARD FULLSCREEN — the global «X = открыть карту» rule (P13/P15).
 *
 * ONE module-level state drives ONE reused desktop CardZoomModal (mounted
 * in ConsoleShell) for EVERY console card context: the start wizard, the
 * card browser, the hand, reveals, the play confirm, the ceremony.
 *
 * P15: the viewer is CONTROLLER-NATIVE — while it is open the shell owns
 * the pad (carve-out BEFORE resolveScope): LB/RB and ←/→ page through the
 * SAME visible list, B (or X again) closes, and — ONLY when the opener
 * passed a `select` context — A toggles the zoomed card's selection
 * without leaving the viewer. Read-only contexts (ceremony candidates,
 * reveals, opponent info) pass NO context, so A can never fire a game
 * action from fullscreen. Because every selection state lives in module
 * state / components that stay mounted, closing ALWAYS restores the exact
 * previous context. Callers pass only cards ALREADY visible to the viewer
 * (hidden-info safe by construction).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ZoomCard} from '@/client/components/card/cardZoomTypes';

/** A SAFE selection bridge from the opening context (P15). */
export type ConsoleZoomSelect = {
  /** Is the given card currently picked in the source context? */
  isSelected: (name: CardName) => boolean,
  /** Toggle the pick — must be a pure selection-state flip, NEVER a submit. */
  toggle: (name: CardName) => void,
  /** The A-hint verb (i18n key); defaults to Select / Deselect. */
  selectLabel?: string,
  deselectLabel?: string,
};

/**
 * A context ACTION bridge (P17 — desktop parity): the opener may attach a
 * per-card primary action (e.g. «Play now» for a playable hand card). A
 * card with NO action label instead surfaces its structured «why not»
 * reasons — the viewer is never mute about playability. `execute` hands
 * off to the EXISTING flow (the play confirm) — the viewer itself never
 * submits anything.
 */
export type ConsoleZoomAction = {
  /** The A-verb (i18n key) for the given card, or undefined → not actionable. */
  labelFor: (name: CardName) => string | undefined,
  /** Translated "why not" lines for a non-actionable card (empty → silent). */
  reasonsFor: (name: CardName) => ReadonlyArray<string>,
  /** Hand off to the existing flow (called AFTER the viewer closes). */
  execute: (name: CardName) => void,
  /**
   * Present when `execute` OPENS a surface that shows this very card (the
   * play-confirm composer): return a CSS selector of that surface's card
   * slot. The fullscreen card then FLIES INTO the new modal (execute fires
   * FIRST, the modal mounts UNDER the top-layer dialog, the card lands in
   * its slot, the viewer closes) instead of returning to the table — see
   * consoleZoomMotion.playZoomHandoff. Undefined → the normal close flight.
   */
  handoffTarget?: (name: CardName) => string | undefined,
};

/**
 * A card-RECEIVE bridge (the «Получены карты» reveal). The opener lets A take
 * the card at the viewer's CURRENT index and RT take everything, WITHOUT
 * leaving the viewer for a non-final take. Taking mutates the SHARED
 * drawnCardsState; the opener keeps `consoleCardZoom.cards` synced to the live
 * untaken list, so the CardZoomModal's «consume» swap advances to the next
 * card, and closes the viewer + releases the batch when the last card is taken.
 * The take LOGIC is the opener's — the viewer only routes the button.
 */
export type ConsoleZoomReceive = {
  /** The A-verb (i18n key), e.g. «Take card». */
  takeLabel: string,
  /** Take the card currently at fullscreen `index` in the viewer's list. */
  takeAt: (index: number) => void,
  /** The RT-verb (i18n key) — omit to hide the take-all affordance. */
  takeAllLabel?: string,
  /** Take every remaining card (closes the viewer). Omit → no take-all. */
  takeAll?: () => void,
  /**
   * SINGLE-CARD reveal: the take DEPARTS from fullscreen INTO THE HAND (the
   * hand-intake flight — the card arcs off the stage rect into the dock,
   * flipping to its back), instead of closing back to a source slot.
   * `takeAt` is then the BARE commit — the premium flight is
   * `playZoomDepart`, run by the shell (the dialog closes the frame the
   * flight proxy takes over). The multi-card fullscreen take (omit this)
   * closes first, then the reveal modal's own hand intake lifts the card
   * off its strip slot.
   */
  departFromFullscreen?: boolean,
};

/**
 * A ROLE-SWAP bridge (the single-card «Получены карты» reveal). L3 flips the
 * fullscreen between the two paired cards — the RECEIVED card ⇄ the DRAW
 * SOURCE — without a nested viewer or a full recreation (the shell crossfades
 * the same stage via `CardZoomModal.runSwap`). The opener re-points the module
 * state inside `swap()` (received: receive bridge + take, source: read-only).
 */
export type ConsoleZoomSwap = {
  /** The L3-verb naming the OTHER role (i18n key): «Source» / «Received card». */
  label: string,
  /** The OTHER card's name — the swap chip shows it («ИСТОЧНИК · <name>»). */
  otherName: CardName,
  /** Re-point the viewer to the other paired card (received ⇄ source). */
  swap: () => void,
};

/**
 * WHERE the fullscreen opened from — drives the open/close choreography
 * (consoleZoomMotion.ts). Three documented modes:
 *
 *  physical — opened from a VISIBLE card tile under focus. The viewer card
 *      physically lifts OUT of that slot and, on close, returns INTO the
 *      slot of the card currently on screen (`resolve(index)` — re-queried
 *      live, so browsing then closing lands on the RIGHT slot). A null /
 *      zero-rect resolve gracefully falls back to the textual entrance.
 *  textual — opened from a name chip / link / summary (journal, bot turn,
 *      composer source) where no card tile exists. A premium "inspector"
 *      rise-from-depth entrance; close is the mirrored dive — never a fake
 *      collapse into a nonexistent slot.
 *  none — no source semantics at all (defensive default; same visuals as
 *      textual).
 */
export type ZoomOrigin = {
  kind: 'physical' | 'textual' | 'none',
  /** The live slot element for the card at `index` in the zoom list. */
  resolve?: (index: number) => HTMLElement | null,
  /**
   * Keep the UNDERLYING focus in lockstep while the player browses LB/RB —
   * the host moves its own cursor (and scrolls it into view), so closing
   * lands the focus on the card the player looked at LAST, and the close
   * flight has a visible slot to return into.
   */
  onBrowse?: (index: number) => void,
};

/**
 * Build a physical origin for hosts whose card slots carry a
 * `data-zoom-slot` attribute. `keyOf(i)` derives the slot key for the
 * zoom-list index (usually the card name; append `#i` when the list can
 * contain duplicates). Resolution is LIVE and scoped to the host root.
 */
export function slotZoomOrigin(
  getRoot: () => HTMLElement | null | undefined,
  keyOf: (index: number) => string,
  onBrowse?: (index: number) => void,
): ZoomOrigin {
  return {
    kind: 'physical',
    resolve: (index: number) => {
      const root = getRoot();
      if (root === null || root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const key = keyOf(index);
      if (key === '') {
        return null;
      }
      // CSS.escape guards card names with quotes/odd glyphs.
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-zoom-slot="${esc}"]`);
    },
    onBrowse,
  };
}

/** Optional extras attached at open time (receive bridge + a caption). */
export type ConsoleZoomExtra = {
  /** Present ⇔ A takes the focused card / RT takes all (reveal flow). */
  receive?: ConsoleZoomReceive,
  /**
   * A caption shown in the viewer bar (i18n key), e.g. «Ход MarsBot» /
   * «Действия карты» — a small read-only marker for an inspector opened from
   * a chip/summary. A never acts on it.
   */
  contextLabel?: string,
  /**
   * A PROMINENT role status (i18n key) shown as a pill in the viewer bar —
   * WHAT the card on screen is: «ПОЛУЧЕННАЯ КАРТА» / «ИСТОЧНИК ДОБОРА». Unlike
   * `contextLabel` (a faint caption), the status leads the bar so the player
   * always tells a received card from the draw source at a glance.
   */
  statusLabel?: string,
  /**
   * Present ⇔ L3 flips the fullscreen between two paired cards (single-card
   * reveal: received ⇄ source). Drives the swap chip + the L3 handler.
   */
  swap?: ConsoleZoomSwap,
  /**
   * MANDATORY: the viewer cannot be dismissed by B / X / Esc / backdrop — the
   * single-card reveal is completed ONLY by taking the received card (A).
   * Every close path is gated so the player can't return to the game with the
   * card untaken.
   */
  mandatory?: boolean,
  /**
   * The «ПОЛУЧЕНО N» count shown in the viewer bar (single-card reveal — for
   * parity with the multi-card modal's header count). 0 / undefined → hidden.
   */
  receivedCount?: number,
  /**
   * A STATIC source chip (i18n `label` + already-translated `name`) for a
   * source that is NOT an inspectable card — e.g. «ИСТОЧНИК · Бонус клетки»
   * (a tile / colony bonus). A card source is shown INTERACTIVELY via `swap`
   * (L3) instead, so this stays undefined for it. Persists across the swap.
   */
  sourceInfo?: {label: string, name: string},
  /** Open/close choreography source — see ZoomOrigin. Default: 'none'. */
  origin?: ZoomOrigin,
};

export const consoleCardZoom = reactive({
  // A ZoomCard entry: a normal project `CardModel` OR an Automa bonus entry.
  // The select/action/receive bridges below are CardName-based and only ever
  // attached to project-card lists — a bonus list (the bot-turn review) passes
  // none, so a BonusCardId `name` never reaches them.
  card: undefined as ZoomCard | undefined,
  /** The visible list, in on-screen order — enables ←/→ browsing. */
  cards: [] as ReadonlyArray<ZoomCard>,
  index: 0,
  /** Present ⇔ A may select/unselect from fullscreen (selection contexts only). */
  select: undefined as ConsoleZoomSelect | undefined,
  /** Present ⇔ A may fire the context action (play-from-hand parity). */
  action: undefined as ConsoleZoomAction | undefined,
  /** Present ⇔ A takes / RT takes all (the drawn-cards reveal flow). */
  receive: undefined as ConsoleZoomReceive | undefined,
  /** A read-only caption (i18n key) — e.g. the bot-turn / card-actions viewer. */
  contextLabel: undefined as string | undefined,
  /** A prominent role status pill (i18n key) — «ПОЛУЧЕННАЯ КАРТА» / «ИСТОЧНИК ДОБОРА». */
  statusLabel: undefined as string | undefined,
  /** Present ⇔ L3 swaps the paired cards (single-card reveal: received ⇄ source). */
  swap: undefined as ConsoleZoomSwap | undefined,
  /** MANDATORY: no B / X / Esc / backdrop dismissal (single-card reveal). */
  mandatory: false,
  /** The «ПОЛУЧЕНО N» count in the viewer bar (single-card reveal). 0 = hidden. */
  receivedCount: 0,
  /** A static source chip (i18n label + translated name) for a non-card source. */
  sourceInfo: undefined as {label: string, name: string} | undefined,
  /** Open/close choreography source (see ZoomOrigin). */
  origin: {kind: 'none'} as ZoomOrigin,
});

/** Open the fullscreen viewer on `cards[index]` (list = what's on screen). */
export function openConsoleCardZoom(cards: ReadonlyArray<ZoomCard>, index: number, select?: ConsoleZoomSelect, action?: ConsoleZoomAction, extra?: ConsoleZoomExtra): void {
  if (cards.length === 0) {
    return;
  }
  const at = Math.min(Math.max(index, 0), cards.length - 1);
  consoleCardZoom.cards = cards;
  consoleCardZoom.index = at;
  consoleCardZoom.card = cards[at];
  consoleCardZoom.select = select;
  consoleCardZoom.action = action;
  consoleCardZoom.receive = extra?.receive;
  consoleCardZoom.contextLabel = extra?.contextLabel;
  consoleCardZoom.statusLabel = extra?.statusLabel;
  consoleCardZoom.swap = extra?.swap;
  consoleCardZoom.mandatory = extra?.mandatory === true;
  consoleCardZoom.receivedCount = extra?.receivedCount ?? 0;
  consoleCardZoom.sourceInfo = extra?.sourceInfo;
  consoleCardZoom.origin = extra?.origin ?? {kind: 'none'};
}

/** The viewer navigated — keep the module mirror in sync. */
export function navigateConsoleCardZoom(card: ZoomCard, index: number): void {
  consoleCardZoom.card = card;
  consoleCardZoom.index = index;
}

/**
 * RE-POINT the OPEN viewer to a different single card + bridges WITHOUT
 * re-running the open choreography (the single-card reveal swap: received ⇄
 * source). The dialog stays mounted (`card` never goes undefined, so the
 * shell's undefined→defined open watcher never fires); the caller crossfades
 * the stage via `CardZoomModal.runSwap`. `origin` / `mandatory` / `receivedCount`
 * / `sourceInfo` are preserved (stable across the swap); `select`/`action`/
 * `contextLabel` stay cleared (a reveal is never a selection/action context).
 */
export function repointConsoleCardZoom(card: ZoomCard, opts: {receive?: ConsoleZoomReceive, swap?: ConsoleZoomSwap, statusLabel?: string}): void {
  consoleCardZoom.card = card;
  consoleCardZoom.cards = [card];
  consoleCardZoom.index = 0;
  consoleCardZoom.receive = opts.receive;
  consoleCardZoom.swap = opts.swap;
  consoleCardZoom.statusLabel = opts.statusLabel;
}

export function closeConsoleCardZoom(): void {
  consoleCardZoom.card = undefined;
  consoleCardZoom.cards = [];
  consoleCardZoom.index = 0;
  consoleCardZoom.select = undefined;
  consoleCardZoom.action = undefined;
  consoleCardZoom.receive = undefined;
  consoleCardZoom.contextLabel = undefined;
  consoleCardZoom.statusLabel = undefined;
  consoleCardZoom.swap = undefined;
  consoleCardZoom.mandatory = false;
  consoleCardZoom.receivedCount = 0;
  consoleCardZoom.sourceInfo = undefined;
  consoleCardZoom.origin = {kind: 'none'};
}
