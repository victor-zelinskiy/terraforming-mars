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
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';

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

export const consoleCardZoom = reactive({
  card: undefined as CardModel | undefined,
  /** The visible list, in on-screen order — enables ←/→ browsing. */
  cards: [] as ReadonlyArray<CardModel>,
  index: 0,
  /** Present ⇔ A may select/unselect from fullscreen (selection contexts only). */
  select: undefined as ConsoleZoomSelect | undefined,
  /** Present ⇔ A may fire the context action (play-from-hand parity). */
  action: undefined as ConsoleZoomAction | undefined,
});

/** Open the fullscreen viewer on `cards[index]` (list = what's on screen). */
export function openConsoleCardZoom(cards: ReadonlyArray<CardModel>, index: number, select?: ConsoleZoomSelect, action?: ConsoleZoomAction): void {
  if (cards.length === 0) {
    return;
  }
  const at = Math.min(Math.max(index, 0), cards.length - 1);
  consoleCardZoom.cards = cards;
  consoleCardZoom.index = at;
  consoleCardZoom.card = cards[at];
  consoleCardZoom.select = select;
  consoleCardZoom.action = action;
}

/** The viewer navigated — keep the module mirror in sync. */
export function navigateConsoleCardZoom(card: CardModel, index: number): void {
  consoleCardZoom.card = card;
  consoleCardZoom.index = index;
}

export function closeConsoleCardZoom(): void {
  consoleCardZoom.card = undefined;
  consoleCardZoom.cards = [];
  consoleCardZoom.index = 0;
  consoleCardZoom.select = undefined;
  consoleCardZoom.action = undefined;
}
