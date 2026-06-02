import {SpaceId} from '@/common/Types';

/**
 * Premium board-cell highlight used by the journal when the player asks
 * to "show on map" a SPACE token (`LogMessageDataType.SPACE`).
 *
 * Mechanism: every `BoardSpace` / `MoonSpace` already renders a hidden
 * hex overlay `.board-log-highlight[data_log_highlight_id="<spaceId>"]`
 * (see BoardSpace.vue / MoonSpace.vue). We toggle a `.journal-pulse`
 * class on the matching overlay; `journal.less` drives a short, calm
 * 2–3 ring pulse (transform/opacity/drop-shadow only) and we strip the
 * class again once the animation has played.
 *
 * This is intentionally separate from the legacy `LogPanel.spaceClicked`
 * path (which adds the old white-blink `.highlight` and `scrollIntoView`s
 * the page). We do NOT scroll the viewport here — the fork's board is a
 * fixed, auto-scaled element and CLAUDE goal #2 / the journal spec both
 * require "поле не должно резко прыгать". Because the board slides left
 * when the journal opens, the cell is already on-screen.
 */

const PULSE_CLASS = 'journal-pulse';
// Slightly longer than the CSS animation so the final ring fully fades
// before we remove the class (avoids a visible cut on the last frame).
const PULSE_DURATION = 1900;

// One timer per space so repeated clicks on the same cell restart cleanly
// instead of stacking timeouts that strip the class mid-animation.
const activeTimers = new Map<SpaceId, number>();

// The board is split across a few independent regions depending on the
// expansions in play. Searching all of them keeps Mars + Moon working
// through the same entry point.
const BOARD_REGION_IDS = ['main_board', 'moon_board', 'moon_board_outer_spaces'];

function findOverlay(spaceId: SpaceId): HTMLElement | undefined {
  for (const region of BOARD_REGION_IDS) {
    const board = document.getElementById(region);
    if (board === null) {
      continue;
    }
    const candidates = Array.from(board.getElementsByClassName('board-log-highlight'));
    for (const candidate of candidates) {
      const el = candidate as HTMLElement;
      if (el.getAttribute('data_log_highlight_id') === spaceId) {
        return el;
      }
    }
  }
  return undefined;
}

export function highlightBoardSpace(spaceId: SpaceId): void {
  const el = findOverlay(spaceId);
  if (el === undefined) {
    return;
  }

  // Restart cleanly if the same cell is already pulsing.
  const prev = activeTimers.get(spaceId);
  if (prev !== undefined) {
    window.clearTimeout(prev);
    el.classList.remove(PULSE_CLASS);
    // Force reflow so re-adding the class replays the animation from 0.
    void el.offsetWidth;
  }

  el.classList.add(PULSE_CLASS);
  const timer = window.setTimeout(() => {
    el.classList.remove(PULSE_CLASS);
    activeTimers.delete(spaceId);
  }, PULSE_DURATION);
  activeTimers.set(spaceId, timer);
}
