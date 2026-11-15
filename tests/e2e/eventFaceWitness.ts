import {Page} from './consoleTest';
import {armWitness, witnessOf} from './witness';

/**
 * «СОБЫТИЕ ПЛАТИТ ДО ВЗЛЁТА» (P84 · DK, the owner's direction of 2026-11-01) — the witness of a play's landing scene,
 * armed BEFORE the press and read after it. RECORDED (FLAKE ZERO — `armWitness`: the product's own writes observed in
 * the task that makes them, a frame tick for the flip that only a transform moves, every change pushed to the Node side —
 * a reload neither loses nor stops it), folded here into one record:
 *  - the hero's phases (`data-hero-phase`) and the event's pay-back (`data-hero-payback`: paying → paid);
 *  - the PHASE at every token's birth on the transfer layer (`shipping` — the card still stands in the composer);
 *  - the hero proxy's flip on every recorded frame of the flight (`flipCosMin` — the flip chassis' m11: 1 = face up,
 *    −1 = its back): an event turns over IN THE ARC, a non-event never does;
 *  - the destination pile's caption count, the reveal on the stage, the next surface's FIRST frame (the search's reveal
 *    in the hand's zone, or no workspace left and no hero layer — the board).
 * The births' places are the transfer witness's (`transferWitness.ts` — `printed:<sprite>` · `vp-badge` · `tag:<tag>`).
 * Times are the PAGE's clock, in ms since the arm.
 */
export type EventFaceProbe = {
  /** How many distinct states were recorded (a liveness floor: zero = the recorder never ran). */
  ticks: number,
  /** ms since the arm, of the first sample where … */
  tArmed?: number, tLifting?: number, tFlying?: number, tRevealed?: number, tPaid?: number,
  tNext?: number, nextKind?: 'reveal' | 'board',
  /** The smallest m11 of the hero proxy's flip chassis seen while the proxy flew (1 → it never turned). */
  flipCosMin: number,
  /** The pile's caption count: [ms, text] at every change. */
  counts: Array<[number, string]>,
  /** The scene's phases in order (`data-hero-phase`). */
  phases: Array<[number, string]>,
  /** The pay-back's states in order (`data-hero-payback`). */
  paybacks: Array<[number, string]>,
  /** The hero phase at every token's BIRTH on the transfer layer. */
  birthPhases: Array<string>,
};

/** One recorded frame of the scene — an observation, folded by {@link readEventFaceProbe}. */
type FaceFrame = {
  phase: string, payback: string,
  /** the flip chassis' m11 while the proxy is up (lifting / flying / landing), else null */
  flip: number | null,
  /** every chip on the transfer layer with the phase at its FIRST sight */
  chips: Array<[number, string]>,
  revealed: boolean, count: string,
  handReveal: boolean, ws: boolean, heroIdle: boolean,
};

const KEY = 'event-face';
const ARMED_AT = new WeakMap<Page, number>();

export async function armEventFaceProbe(page: Page): Promise<void> {
  ARMED_AT.set(page, await page.evaluate(() => Date.now()));
  await armWitness<FaceFrame>(page, KEY, () => {
    const w = window as unknown as {__tmFaceChips?: WeakMap<Element, [number, string]>, __tmFaceSeq?: number};
    const born = (w.__tmFaceChips ??= new WeakMap<Element, [number, string]>());
    const layer = document.querySelector<HTMLElement>('.con-played-hero');
    const phase = layer?.dataset.heroPhase ?? '';
    let flip: number | null = null;
    if (phase === 'flying' || phase === 'landing' || phase === 'lifting') {
      const el = document.querySelector<HTMLElement>('.con-played-hero__proxy .con-deal-proxy__flip');
      if (el !== null) {
        const t = getComputedStyle(el).transform;
        flip = Math.round(new DOMMatrixReadOnly(t === 'none' ? undefined : t).m11 * 1000) / 1000;
      }
    }
    const chips: Array<[number, string]> = [];
    document.querySelectorAll('.con-transfer__chip').forEach((chip) => {
      let b = born.get(chip);
      if (b === undefined) {
        w.__tmFaceSeq = (w.__tmFaceSeq ?? 0) + 1;
        b = [w.__tmFaceSeq, phase === '' ? '-' : phase];
        born.set(chip, b);
      }
      chips.push(b);
    });
    return {
      phase, payback: layer?.dataset.heroPayback ?? '', flip, chips,
      revealed: document.querySelector('.con-recv [data-recv-front][data-played-key]') !== null,
      count: (document.querySelector('.con-recv__caption-count')?.textContent ?? '').trim(),
      handReveal: document.querySelector('.con-hand__outcome .con-reveal') !== null,
      ws: document.querySelector('.con-ws') !== null,
      heroIdle: layer === null || (layer.dataset.heroPhase ?? 'idle') === 'idle',
    };
  });
}

export async function readEventFaceProbe(page: Page): Promise<EventFaceProbe> {
  const samples = await witnessOf<FaceFrame>(page, KEY).samples();
  const t0 = ARMED_AT.get(page) ?? samples[0]?.t ?? 0;
  const p: EventFaceProbe = {ticks: samples.length, flipCosMin: 1, counts: [], phases: [], paybacks: [], birthPhases: []};
  const births = new Map<string, string>();
  for (const s of samples) {
    const at = Math.round(s.t - t0);
    const f = s.v;
    if (f.phase !== '' && p.phases[p.phases.length - 1]?.[1] !== f.phase) {
      p.phases.push([at, f.phase]);
    }
    if (f.payback !== '' && p.paybacks[p.paybacks.length - 1]?.[1] !== f.payback) {
      p.paybacks.push([at, f.payback]);
    }
    if (f.payback === 'paid') {
      p.tPaid ??= at;
    }
    if (p.tArmed === undefined && f.phase !== '' && f.phase !== 'idle') {
      p.tArmed = at;
    }
    if (f.phase === 'lifting') {
      p.tLifting ??= at;
    }
    if (f.phase === 'flying') {
      p.tFlying ??= at;
    }
    if (f.flip !== null) {
      p.flipCosMin = Math.min(p.flipCosMin, f.flip);
    }
    for (const [id, phase] of f.chips) {
      if (!births.has(`${s.doc}:${id}`)) {
        births.set(`${s.doc}:${id}`, phase);
        p.birthPhases.push(phase);
      }
    }
    if (f.revealed) {
      p.tRevealed ??= at;
    }
    if (f.count !== '' && p.counts[p.counts.length - 1]?.[1] !== f.count) {
      p.counts.push([at, f.count]);
    }
    if (p.tArmed !== undefined && p.tNext === undefined) {
      if (f.handReveal) {
        p.tNext = at;
        p.nextKind = 'reveal';
      } else if (p.tRevealed !== undefined && !f.ws && f.heroIdle) {
        p.tNext = at;
        p.nextKind = 'board';
      }
    }
  }
  return p;
}

/** One readable line of a probe (for the trail and the annotations). */
export function eventFaceLine(p: EventFaceProbe): string {
  const d = (t: number | undefined) => (t === undefined || p.tArmed === undefined ? '-' : String(t - p.tArmed));
  return `armed→paid ${d(p.tPaid)} · lifting ${d(p.tLifting)} · flying ${d(p.tFlying)} · revealed ${d(p.tRevealed)} · ` +
    `next(${p.nextKind ?? '-'}) ${d(p.tNext)} · flipCosMin ${p.flipCosMin.toFixed(3)} · payback ${p.paybacks.map(([, s]) => s).join('→') || '-'} · ` +
    `births ${p.birthPhases.join(' ')} · counts ${p.counts.map(([t, c]) => `${d(t)}:${c}`).join(' ')}`;
}
