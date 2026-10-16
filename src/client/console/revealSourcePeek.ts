/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SOURCE PEEK of the received-cards scene (TR57 «НАГРАДА ВНЕ WORKSPACE», decision 6): «откуда эти карты?».
 * A card source answers L3 with the card itself (the viewer); a CELL source had no answer at all — the head said
 * «Бонус клетки» and the board under the dim never said which. L3 now shows it: the scene recedes by opacity, the
 * dim lets go, and the paying cell wears the TR45 board-peek ring (the journal's «Показать» overlay, amber — the
 * source badge's own tone). L3 / B bring the cards back; everything else is absorbed. A LEVEL inside the scene,
 * never a surface: nothing unmounts, the focus and the batch stay as they were.
 *
 * Module-level reactive: the overlay opens / closes it, the shell's command bar reads it.
 */
import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';
import {findBoardOverlay} from '@/client/components/journal/boardCellHighlight';

const RING = ['con-peek-cell', 'con-peek-cell--source'];

export const revealSourcePeekState = reactive({
  /** The cell the scene is showing, undefined while the cards are the screen. */
  cell: undefined as SpaceId | undefined,
});

function ring(cell: SpaceId, on: boolean): void {
  const el = findBoardOverlay(cell);
  if (el === undefined) {
    return;
  }
  if (on) {
    void el.offsetWidth; // the ring's one-shot pulse from its first frame
    el.classList.add(...RING);
  } else {
    el.classList.remove(...RING);
  }
}

/** Show the paying cell (idempotent). */
export function openRevealSourcePeek(cell: SpaceId): void {
  if (revealSourcePeekState.cell === cell) {
    return;
  }
  closeRevealSourcePeek();
  revealSourcePeekState.cell = cell;
  ring(cell, true);
}

/** Back to the cards (idempotent — also the scene's teardown). */
export function closeRevealSourcePeek(): void {
  const cell = revealSourcePeekState.cell;
  if (cell === undefined) {
    return;
  }
  ring(cell, false);
  revealSourcePeekState.cell = undefined;
}

export function revealSourcePeekOpen(): boolean {
  return revealSourcePeekState.cell !== undefined;
}
