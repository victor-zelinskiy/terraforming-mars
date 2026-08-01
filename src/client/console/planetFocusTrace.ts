/*
 * ⚠ TEMPORARY DIAGNOSTIC — DELETE ME.
 *
 * Per-frame trace of the PLANET FOCUS return, so the "jump" can be read off
 * real numbers from the real device instead of guessed at from code.
 *
 * TO REVERT, exactly two things:
 *   1. delete this file;
 *   2. remove the `planetFocusTrace` import + the `traceBoardWrite(...)`
 *      line in ConsoleBoardSection.vue (`applyBoardScale`) and the four
 *      `this.fitReason = '…'` assignments.
 *
 * It is self-driving: importing it installs a watcher on the focus phase.
 * Nothing renders until a focus cycle actually runs.
 *
 * WHAT IT RECORDS, every animation frame from the start of the return until
 * 2s after it lands — one line per CHANGE (identical frames are dropped):
 *   t      ms since the return started
 *   ph     the focus phase / arcsReturning flag
 *   scl    the `--board-scale` CSS variable (what the code ASKED for)
 *   tf     the LIVE animated scale from the computed transform matrix
 *   dxdy   the stage's centring vars
 *   stage  the clip box   [left,top WxH]
 *   cont   the planet box [left,top WxH]  ← the coordinates that matter
 *   cls    the focus classes in play
 * plus a WRITE line whenever the code writes a new scale, naming WHO wrote
 * it (observer / focus-fit / replay / calibrate / phase) — the discontinuity
 * plus its writer is the whole diagnosis.
 *
 * The finished trace is (a) drawn on screen, top-left, for screenshotting,
 * (b) console.log'ed with a `[PF]` prefix, (c) stashed in localStorage
 * under `tm_pf_trace`.
 */

import {watch} from 'vue';
import {planetFocusState} from '@/client/console/planetFocus';

/** Keep sampling this long after the phase lands, to catch late corrections. */
const TAIL_MS = 2000;
/** Hard ceiling so a stuck phase can never leave an rAF loop running. */
const MAX_MS = 12000;
const OVERLAY_ID = 'pf-trace-overlay';

let rows: Array<string> = [];
let raf = 0;
let t0 = 0;
let landedAt = 0;
let lastKey = '';

function box(r: DOMRect | undefined): string {
  if (r === undefined) {
    return '[--]';
  }
  return `[${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`;
}

/** The live scale out of the computed transform matrix (what the eye sees). */
function liveScale(el: HTMLElement): string {
  const tf = getComputedStyle(el).transform;
  if (tf === 'none') {
    return '1.0000';
  }
  const parts = tf.replace(/matrix3d\(|matrix\(|\)/g, '').split(',');
  return parts.length > 0 ? parseFloat(parts[0]).toFixed(4) : '?';
}

function els(): {board?: HTMLElement, stage?: HTMLElement, cont?: HTMLElement, dock?: HTMLElement} {
  if (typeof document === 'undefined') {
    return {};
  }
  return {
    board: document.querySelector<HTMLElement>('.con-board') ?? undefined,
    stage: document.querySelector<HTMLElement>('.con-board__stage') ?? undefined,
    cont: document.querySelector<HTMLElement>('.board-cont') ?? undefined,
    // The hand dock's pack — the player reads the jump as happening exactly
    // when this returns to its default pose, so record it in the same rows.
    dock: document.querySelector<HTMLElement>('.con-handdock__pack') ??
      document.querySelector<HTMLElement>('.con-handdock') ?? undefined,
  };
}

function push(line: string, dedupe: boolean): void {
  if (dedupe) {
    if (line === lastKey) {
      return;
    }
    lastKey = line;
  }
  rows.push(`${String(Math.round(now() - t0)).padStart(4, ' ')} ${line}`);
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Called by ConsoleBoardSection on every `--board-scale` write. */
export function traceBoardWrite(reason: string, scale: number): void {
  if (t0 === 0) {
    return; // not recording
  }
  const {stage} = els();
  const dx = stage?.style.getPropertyValue('--con-board-dx') ?? '';
  const dy = stage?.style.getPropertyValue('--con-board-dy') ?? '';
  rows.push(`${String(Math.round(now() - t0)).padStart(4, ' ')} >>> WRITE by=${reason} scale=${scale.toFixed(4)} dx=${dx || '-'} dy=${dy || '-'}`);
  lastKey = ''; // force the next sample line through
}

function sample(): void {
  const {board, stage, cont, dock} = els();
  if (board === undefined || stage === undefined || cont === undefined) {
    return;
  }
  const scl = document.documentElement.style.getPropertyValue('--board-scale') || '-';
  const dx = stage.style.getPropertyValue('--con-board-dx') || '-';
  const dy = stage.style.getPropertyValue('--con-board-dy') || '-';
  const cls = Array.from(board.classList)
    .filter((c) => c.indexOf('pfocus') >= 0 || c === 'con-board--fitted')
    .map((c) => c.replace('con-board--', ''))
    .join('|');
  push([
    `ph=${planetFocusState.phase}${planetFocusState.arcsReturning ? '+arcs' : ''}`,
    `scl=${scl}`,
    `tf=${liveScale(cont)}`,
    `d=${dx}/${dy}`,
    `stage=${box(stage.getBoundingClientRect())}`,
    `cont=${box(cont.getBoundingClientRect())}`,
    `dock=${dock === undefined ? '[--]' : box(dock.getBoundingClientRect())}`,
    cls,
  ].join(' '), true);
}

function tick(): void {
  raf = 0;
  sample();
  const elapsed = now() - t0;
  const done = (landedAt > 0 && now() - landedAt > TAIL_MS) || elapsed > MAX_MS;
  if (done) {
    finish();
    return;
  }
  raf = window.requestAnimationFrame(tick);
}

function finish(): void {
  if (raf !== 0) {
    window.cancelAnimationFrame(raf);
    raf = 0;
  }
  const cs = getComputedStyle(document.documentElement);
  const reduced = typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const head = [
    `[PF] ${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio}`,
    `rem=${cs.fontSize} ui=${cs.getPropertyValue('--con-ui-scale').trim() || '-'}`,
    `motion=${cs.getPropertyValue('--motion-scale').trim() || '1'}${reduced ? ' REDUCED' : ''}`,
    `perf=${document.documentElement.classList.contains('con-perf-lite') ? 'lite' : 'full'}`,
  ].join(' ');
  const text = [head, ...rows].join('\n');
  console.log(text);
  try {
    window.localStorage?.setItem('tm_pf_trace', text);
  } catch (err) {
    // storage unavailable — the on-screen dump is the delivery path anyway
  }
  paint(text);
  t0 = 0;
  landedAt = 0;
  rows = [];
  lastKey = '';
}

function paint(text: string): void {
  let box2 = document.getElementById(OVERLAY_ID);
  if (box2 === null) {
    box2 = document.createElement('pre');
    box2.id = OVERLAY_ID;
    box2.style.cssText = [
      'position:fixed', 'left:6px', 'top:6px', 'z-index:2147483000',
      'margin:0', 'padding:6px 8px', 'max-width:62vw', 'max-height:86vh',
      'overflow:hidden', 'pointer-events:none', 'white-space:pre',
      'font:11px/1.25 Consolas,monospace', 'color:#9ff', 'background:rgba(0,0,0,.82)',
      'border:1px solid rgba(120,220,255,.5)', 'border-radius:4px',
    ].join(';');
    document.body.appendChild(box2);
  }
  box2.textContent = text;
}

function start(): void {
  if (t0 !== 0 || typeof window === 'undefined') {
    return;
  }
  rows = [];
  lastKey = '';
  landedAt = 0;
  t0 = now();
  raf = window.requestAnimationFrame(tick);
}

if (typeof window !== 'undefined') {
  watch(() => planetFocusState.phase, (now2, was) => {
    if (now2 === 'exit-prep' || (now2 === 'exiting' && t0 === 0)) {
      start(); // the return begins — record it
    }
    if (now2 === 'idle' && was !== 'idle' && t0 !== 0) {
      landedAt = now(); // the phase landed; keep sampling the tail
    }
  });
}
