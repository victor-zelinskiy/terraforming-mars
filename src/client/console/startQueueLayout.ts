/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «СТАРТ ПАРТИИ › ПРОЛОГИ › РОЗЫГРЫШ» — THE DEPLOYMENT AT ONE GLANCE (TRP0 · DE, 2026-10-31). Two pure readings of the
 * first screen of every game:
 *
 *  1. THE SIZE OF A QUEUE CARD IS SOLVED FROM THE BOX (S1). The queue cards stood at a fixed `0.62 × uiScale` zoom —
 *     two small cards in a column of empty glass on a 4K TV. The size is the album's law (`consoleHandAlbum`): the
 *     column's box and a ROW CAPACITY, never the hand of the moment — one to four cards share one geometry (a card that
 *     leaves never makes the rest grow), five and more take a second row. The ceiling is the natural frame × uiScale,
 *     the floor the old short-viewport notch; the room under every card (the A pill, the reading line) is reserved, so
 *     nothing the row carries is ever clipped.
 *  2. THE READING UNDER EACH CARD (S2). Under every corporation / prelude of the queue ONE quiet line: the VERDICT word
 *     (`Можно разыграть` · what a waiting prelude lacks · «Сначала: <пролог>») — never a fact of the face (cost, tags,
 *     effect: the card above prints those). The table's answer rides beside it (the forecast row, drawn by the host).
 *
 * Pure: no Vue, no DOM — `tests/console/startQueueLayout.spec.ts` (server runner).
 */
import {CardName} from '@/common/cards/CardName';
import {CARD_NATURAL_H, CARD_NATURAL_W} from '@/client/components/console/consoleHandGrid';
import type {PreludeRisk} from '@/client/console/startPreludeRisk';

/** Cards one row of the queue holds before a second row opens (the size never depends on fewer). */
export const QUEUE_ROW_CAPACITY = 4;
/** The room under a card, in root rem: the A pill hanging off the card's foot + the reading line under it. */
export const QUEUE_CARD_FOOT_REM = 4.2;
/** The room over a row, in root rem: the focus kant and the pickband riding the card's top edge. */
export const QUEUE_CARD_HEAD_REM = 0.8;
/** The gap between two rows / two cards, in root rem (`.con-start__queue-row` — `gap: .9rem`). */
export const QUEUE_GAP_REM = 0.9;
/** The share of the solved height the cards take — the rest is air, so the row never reads as wall-to-wall. */
export const QUEUE_AIR = 0.88;
/** The old fixed zoom (the pre-solver look) — the fallback before the box is measured. */
export const QUEUE_LEGACY_ZOOM = 0.62;
/** The floor (the old short-viewport notch) and the ceiling (the natural frame), both × uiScale. */
export const QUEUE_MIN_ZOOM = 0.52;
export const QUEUE_MAX_ZOOM = 1;

export type StartQueueBox = {
  /** The queue's own box (`.con-start__queue` — the column minus the risk stage, which is absolute). */
  width: number;
  height: number;
  /** The width the row's OTHER blocks take (the bought projects, the campaign bonus / legacy rows) — measured. */
  othersWidth: number;
  /** How many of them stand in the row (each costs one gap). */
  others: number;
};

export type StartQueueLayout = {
  zoom: number;
  rows: number;
  cols: number;
  /** The card's rendered box at that zoom (px). */
  cardW: number;
  cardH: number;
};

/** Solve the queue card's zoom for `count` cards in `box`, at `remPx` px per root rem and the profile's `uiScale`. */
export function startQueueLayout(box: StartQueueBox, count: number, remPx: number, uiScale: number): StartQueueLayout {
  const s = uiScale > 0 ? uiScale : 1;
  const n = Math.max(1, Math.floor(count));
  const rows = n <= QUEUE_ROW_CAPACITY ? 1 : 2;
  // The width a row is solved for is its CAPACITY, never the cards of the moment (the album's law).
  const cols = rows === 1 ? QUEUE_ROW_CAPACITY : Math.ceil(n / 2);
  const gap = QUEUE_GAP_REM * remPx;
  const availW = Math.max(1, box.width - box.othersWidth - (cols - 1 + box.others) * gap);
  const availH = Math.max(1, box.height - rows * (QUEUE_CARD_FOOT_REM + QUEUE_CARD_HEAD_REM) * remPx - (rows - 1) * gap);
  const widthZoom = availW / (cols * CARD_NATURAL_W);
  const heightZoom = (availH * QUEUE_AIR) / (rows * CARD_NATURAL_H);
  const zoom = Math.max(QUEUE_MIN_ZOOM * s, Math.min(QUEUE_MAX_ZOOM * s, widthZoom, heightZoom));
  return {zoom, rows, cols, cardW: CARD_NATURAL_W * zoom, cardH: CARD_NATURAL_H * zoom};
}

/**
 * THE READING LINE of one queue card. `verdict` is the e2e hook's word (`data-qcard-verdict`); `text` the i18n key,
 * `params` its `${n}` values (`readingText`); `tone` the line's material. An entry with nothing to say reads `none`
 * and renders an empty line (its height stays — the row never moves).
 */
export type StartQueueReading = {
  verdict: 'playable' | 'waiting' | 'lost' | 'none';
  text: string | undefined;
  params: ReadonlyArray<string>;
  tone: 'ok' | 'wait' | 'loss' | 'quiet';
};

export type StartQueueReadingInput = {
  kind: 'corp' | 'candidate' | 'prelude';
  /** The card can be pressed right now (its prompt is live). */
  playable: boolean;
  /** A prelude's order-aware risk (`preludeRisk`), `undefined` when it can simply be played. */
  risk: PreludeRisk | undefined;
};

const NONE: StartQueueReading = {verdict: 'none', text: undefined, params: [], tone: 'quiet'};

/**
 * What one queue card's line says. A candidate (a draw / copy / merger pick) carries its own reason line already and
 * gets none; a card that cannot be pressed yet (the preludes before the corporation) says nothing. A waiting prelude
 * names WHAT it lacks — the badge on the card names the consequence — and, with exactly one prelude that would open
 * it, that prelude.
 */
export function startQueueReading(input: StartQueueReadingInput, translateCard: (name: CardName) => string): StartQueueReading {
  if (input.kind === 'candidate' || !input.playable) {
    return NONE;
  }
  const risk = input.risk;
  if (risk === undefined) {
    return {verdict: 'playable', text: 'Playable now', params: [], tone: 'ok'};
  }
  if (risk.tone === 'final') {
    return {verdict: 'lost', text: risk.title, params: [], tone: 'loss'};
  }
  if (risk.enablers.length === 1) {
    return {verdict: 'waiting', text: 'First: ${0}', params: [translateCard(risk.enablers[0])], tone: 'wait'};
  }
  return {verdict: 'waiting', text: risk.title, params: [], tone: 'wait'};
}
