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
   * A caption shown in the viewer bar (i18n key), e.g. «Источник добора карт»
   * when the viewer is inspecting the SOURCE of a draw rather than a card
   * being decided. Marks a read-only context: A never acts on it.
   */
  contextLabel?: string,
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
  /** A read-only caption (i18n key) — e.g. the «Источник добора карт» viewer. */
  contextLabel: undefined as string | undefined,
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
  consoleCardZoom.origin = extra?.origin ?? {kind: 'none'};
}

/** The viewer navigated — keep the module mirror in sync. */
export function navigateConsoleCardZoom(card: ZoomCard, index: number): void {
  consoleCardZoom.card = card;
  consoleCardZoom.index = index;
}

export function closeConsoleCardZoom(): void {
  consoleCardZoom.card = undefined;
  consoleCardZoom.cards = [];
  consoleCardZoom.index = 0;
  consoleCardZoom.select = undefined;
  consoleCardZoom.action = undefined;
  consoleCardZoom.receive = undefined;
  consoleCardZoom.contextLabel = undefined;
  consoleCardZoom.origin = {kind: 'none'};
}
