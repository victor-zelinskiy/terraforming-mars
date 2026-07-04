/*
 * CONSOLE CARD FULLSCREEN — the global «X = открыть карту» rule (P13).
 *
 * ONE module-level state drives ONE reused desktop CardZoomModal (mounted
 * in ConsoleShell) for EVERY console card context: the start wizard, the
 * card browser, the hand, reveals, the play confirm, the ceremony. The
 * modal is a native <dialog> — the generic `dialog[open]` gamepad scope
 * traps input (d-pad → its arrows, A = click, B = dialog-close), and
 * because every selection state lives in module state / components that
 * stay mounted, closing ALWAYS restores the exact previous context.
 * Callers pass only cards ALREADY visible to the viewer (hidden-info safe
 * by construction).
 */

import {reactive} from 'vue';
import {CardModel} from '@/common/models/CardModel';

export const consoleCardZoom = reactive({
  card: undefined as CardModel | undefined,
  /** The visible list, in on-screen order — enables ←/→ browsing. */
  cards: [] as ReadonlyArray<CardModel>,
  index: 0,
});

/** Open the fullscreen viewer on `cards[index]` (list = what's on screen). */
export function openConsoleCardZoom(cards: ReadonlyArray<CardModel>, index: number): void {
  if (cards.length === 0) {
    return;
  }
  const at = Math.min(Math.max(index, 0), cards.length - 1);
  consoleCardZoom.cards = cards;
  consoleCardZoom.index = at;
  consoleCardZoom.card = cards[at];
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
}
