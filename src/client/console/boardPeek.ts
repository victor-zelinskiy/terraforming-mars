/*
 * THE BOARD PEEK — «why on the FIELD» (TR45 Composting Initiative, the owner's
 * decision 2026-10-12: the composition line plus L3 «Показать на поле»). While
 * the hand's composer stands the board is `display: none` (the workspace
 * projects `section: 'hand'`), so the number «14 tiles on Mars» could only be
 * checked against a board the player cannot see. The peek is a LEVEL INSIDE
 * the composer, never a surface or a frame:
 *   · the SAME composer instance stays mounted (its picks, payment and cursor
 *     survive — «свернуть ≠ закрыть»); the shell shows the board UNDER it and
 *     the workspace recedes by opacity (`con-root--board-peek`), then comes
 *     back on L3 / B — two phrases of one motion, never a `v-if`;
 *   · the counted cells are the SERVER's (`ActionEffectBasis.parts[].spaces` —
 *     the census's own reading); the client lights them, it counts nothing;
 *   · the reading is a ROLL CALL by kind: one share at a time — its chip in the
 *     HUD strip lit, its cells pulsing on the board — so «4 города» is four
 *     hexes the eye can find; the uncounted cells stand amber, named in the
 *     strip. Reduced motion: no roll call, every counted cell marked at once.
 * A CLASS, not a card: any reading whose basis carries cells can open it.
 */
import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';
import {ActionEffectBasisPartKind} from '@/common/models/ActionPreviewModel';
import {CountedWhy} from '@/client/console/countedPlay';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';
import {findBoardOverlay} from '@/client/components/journal/boardCellHighlight';

export type BoardPeekTone = 'counted' | 'excluded';
export type BoardPeekGroup = {kind: ActionEffectBasisPartKind, tone: BoardPeekTone, spaces: ReadonlyArray<SpaceId>};
export type BoardPeek = {why: CountedWhy, groups: ReadonlyArray<BoardPeekGroup>};

/**
 * THE PEEK's state, module-level (the composer opens it, the shell shows the
 * board and the HUD, the DOM half lights the cells):
 *   · `peek`  — what is read (set from the open to the end of the return);
 *   · `shown` — the workspace has receded and the board is the screen (false
 *     while the board is being laid out under the workspace, and again from
 *     the press that ends the peek — the workspace returns first);
 *   · `lit`   — the share the roll call reads right now ('excluded' — the named
 *     uncounted cells), undefined between beats and under reduced motion.
 */
export const boardPeekState = reactive({
  peek: undefined as BoardPeek | undefined,
  /** The open peek's TOKEN — «is this still my peek?» is asked by it, never by identity (the store hands back a proxy). */
  seq: 0,
  shown: false,
  lit: undefined as ActionEffectBasisPartKind | 'excluded' | undefined,
});

/** The groups of cells a counted reading lights — counted shares in the strip's order, then the named uncounted. */
export function peekGroupsOf(why: CountedWhy): ReadonlyArray<BoardPeekGroup> {
  const counted = why.parts.filter((p) => p.spaces.length > 0).map((p): BoardPeekGroup => ({kind: p.kind, tone: 'counted', spaces: p.spaces}));
  const excluded = why.excluded.filter((p) => p.spaces.length > 0).map((p): BoardPeekGroup => ({kind: p.kind, tone: 'excluded', spaces: p.spaces}));
  return [...counted, ...excluded];
}

/** Can this reading open the peek — is there a cell to show? (The zero has none: the strip names it.) */
export function peekable(why: CountedWhy | undefined): boolean {
  return why !== undefined && peekGroupsOf(why).length > 0;
}

/** The roll call's beats: each counted share, then the uncounted as one beat. */
export function rollCallOf(peek: BoardPeek): ReadonlyArray<ActionEffectBasisPartKind | 'excluded'> {
  const beats: Array<ActionEffectBasisPartKind | 'excluded'> = peek.groups.filter((g) => g.tone === 'counted').map((g) => g.kind);
  if (peek.groups.some((g) => g.tone === 'excluded')) {
    beats.push('excluded');
  }
  return beats;
}

// ── the DOM half: classes on the board's own hex overlays ────────────────────

/** One beat of the roll call — long enough to find four hexes, short enough that the whole call reads in seconds. */
export const PEEK_BEAT_MS = 1500;
/** The workspace's recede / return (the same short fade both ways — `con-root--board-peek` in console.less). */
export const PEEK_FADE_MS = 220;

const CELL = 'con-peek-cell';
const CELL_EXCLUDED = 'con-peek-cell--excluded';
const CELL_LIT = 'con-peek-cell--lit';
/** On the cell's own SPACE: it stays lit while the rest of the board recedes (the spotlight). */
const SPACE = 'con-peek-space';

function eachCell(peek: BoardPeek, fn: (el: HTMLElement, group: BoardPeekGroup) => void): void {
  for (const group of peek.groups) {
    for (const space of group.spaces) {
      const el = findBoardOverlay(space);
      if (el !== undefined) {
        fn(el, group);
      }
    }
  }
}

let beatTimer = 0;

function stopRollCall(): void {
  if (beatTimer !== 0) {
    window.clearInterval(beatTimer);
    beatTimer = 0;
  }
}

/** Light ONE beat: its cells take the one-shot pulse (re-armed every beat), every other cell stands marked. */
function lightBeat(peek: BoardPeek, beat: ActionEffectBasisPartKind | 'excluded'): void {
  boardPeekState.lit = beat;
  eachCell(peek, (el, group) => {
    const on = beat === 'excluded' ? group.tone === 'excluded' : group.kind === beat && group.tone === 'counted';
    el.classList.remove(CELL_LIT);
    if (on) {
      void el.offsetWidth; // replay the one-shot pulse from its first frame
      el.classList.add(CELL_LIT);
    }
  });
}

/** Mark every cell of the peek (counted cyan, uncounted amber) and start the roll call. */
function markCells(peek: BoardPeek): void {
  eachCell(peek, (el, group) => {
    el.classList.add(CELL);
    el.classList.toggle(CELL_EXCLUDED, group.tone === 'excluded');
    el.closest('[data_space_id]')?.classList.add(SPACE);
  });
  const beats = rollCallOf(peek);
  if (consoleReducedMotionActive() || beats.length === 0) {
    return;
  }
  let i = 0;
  lightBeat(peek, beats[0]);
  beatTimer = window.setInterval(() => {
    i = (i + 1) % beats.length;
    lightBeat(peek, beats[i]);
  }, motionMs(PEEK_BEAT_MS));
}

function clearCells(peek: BoardPeek): void {
  stopRollCall();
  eachCell(peek, (el) => {
    el.classList.remove(CELL, CELL_EXCLUDED, CELL_LIT);
    el.closest('[data_space_id]')?.classList.remove(SPACE);
  });
  boardPeekState.lit = undefined;
}

// ── the phrase ───────────────────────────────────────────────────────────────

/**
 * Open the peek: the board is shown UNDER the standing workspace (the shell
 * reads `peek`), laid out, and only then does the workspace recede and the
 * roll call start — the board never flashes in mid-fit. Idempotent.
 */
export function openBoardPeek(why: CountedWhy): void {
  if (boardPeekState.peek !== undefined || !peekable(why)) {
    return;
  }
  const peek: BoardPeek = {why, groups: peekGroupsOf(why)};
  boardPeekState.peek = peek;
  const seq = ++boardPeekState.seq;
  // Two painted frames: the board section leaves `display: none` and fits its planet before anything moves over it.
  // (`probeTick`, never a bare rAF: the next painted frame OR its fallback — a quiet compositor must not strand the peek.)
  probeTick(() => probeTick(() => {
    if (boardPeekState.seq !== seq || boardPeekState.peek === undefined) {
      return;
    }
    boardPeekState.shown = true;
    markCells(peek);
  }));
}

/**
 * End the peek: the workspace returns first (the class drops — its own fade),
 * the cells let go with it, and the board leaves the screen only once the
 * workspace covers it again. `instant` — a teardown with no phrase (the
 * composer unmounting, a card change).
 */
export function closeBoardPeek(instant = false): void {
  const peek = boardPeekState.peek;
  if (peek === undefined) {
    return;
  }
  boardPeekState.shown = false;
  clearCells(peek);
  const seq = ++boardPeekState.seq;
  if (instant) {
    boardPeekState.peek = undefined;
    return;
  }
  window.setTimeout(() => {
    if (boardPeekState.seq === seq) {
      boardPeekState.peek = undefined;
    }
  }, motionMs(PEEK_FADE_MS) + 40);
}

/** Is a peek open (from the press until the workspace has fully returned)? */
export function boardPeekOpen(): boolean {
  return boardPeekState.peek !== undefined;
}
