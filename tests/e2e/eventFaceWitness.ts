import {Page} from './consoleTest';

/**
 * «СОБЫТИЕ ПЛАТИТ ДО ВЗЛЁТА» (P84 · DK, the owner's direction of 2026-11-01) — the witness of a play's landing scene,
 * armed BEFORE the press and read after it. MutationObserver + setInterval (never rAF — headless drives rAF off the
 * compositor), one record per change:
 *  - the hero's phases (`data-hero-phase`) and the event's pay-back (`data-hero-payback`: paying → paid);
 *  - the PHASE at every token's birth on the transfer layer (`shipping` — the card still stands in the composer);
 *  - the hero proxy's flip on every sample of the flight (`flipCosMin` — the flip chassis' m11: 1 = face up, −1 = its
 *    back): an event turns over IN THE ARC, a non-event never does;
 *  - the destination pile's caption count, the reveal on the stage, the next surface's FIRST frame (the search's reveal
 *    in the hand's zone, or no workspace left and no hero layer — the board).
 * The births' places are the transfer witness's (`transferWitness.ts` — `printed:<sprite>` · `vp-badge` · `tag:<tag>`).
 */
export type EventFaceProbe = {
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

export async function armEventFaceProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const p: EventFaceProbe = {ticks: 0, flipCosMin: 1, counts: [], phases: [], paybacks: [], birthPhases: []};
    (window as unknown as {__eventFace: EventFaceProbe}).__eventFace = p;
    const seenChips = new WeakSet<Element>();
    const t0 = performance.now();
    const at = () => Math.round(performance.now() - t0);
    const sample = (tick: boolean) => {
      if (tick) {
        p.ticks++;
      }
      const layer = document.querySelector<HTMLElement>('.con-played-hero');
      const phase = layer?.dataset.heroPhase ?? '';
      if (phase !== '' && p.phases[p.phases.length - 1]?.[1] !== phase) {
        p.phases.push([at(), phase]);
      }
      const payback = layer?.dataset.heroPayback ?? '';
      if (payback !== '' && p.paybacks[p.paybacks.length - 1]?.[1] !== payback) {
        p.paybacks.push([at(), payback]);
      }
      if (payback === 'paid') {
        p.tPaid ??= at();
      }
      if (p.tArmed === undefined && phase !== '' && phase !== 'idle') {
        p.tArmed = at();
      }
      if (phase === 'lifting') {
        p.tLifting ??= at();
      }
      if (phase === 'flying' || phase === 'landing' || phase === 'lifting') {
        if (phase === 'flying') {
          p.tFlying ??= at();
        }
        const flip = document.querySelector<HTMLElement>('.con-played-hero__proxy .con-deal-proxy__flip');
        if (flip !== null) {
          const t = getComputedStyle(flip).transform;
          const m = new DOMMatrixReadOnly(t === 'none' ? undefined : t);
          p.flipCosMin = Math.min(p.flipCosMin, m.m11);
        }
      }
      document.querySelectorAll('.con-transfer__chip').forEach((chip) => {
        if (!seenChips.has(chip)) {
          seenChips.add(chip);
          p.birthPhases.push(phase === '' ? '-' : phase);
        }
      });
      if (document.querySelector('.con-recv [data-recv-front][data-played-key]') !== null) {
        p.tRevealed ??= at();
      }
      const count = (document.querySelector('.con-recv__caption-count')?.textContent ?? '').trim();
      if (count !== '' && p.counts[p.counts.length - 1]?.[1] !== count) {
        p.counts.push([at(), count]);
      }
      if (p.tArmed !== undefined && p.tNext === undefined) {
        if (document.querySelector('.con-hand__outcome .con-reveal') !== null) {
          p.tNext = at();
          p.nextKind = 'reveal';
        } else if (p.tRevealed !== undefined && document.querySelector('.con-ws') === null &&
            (layer === null || (layer.dataset.heroPhase ?? 'idle') === 'idle')) {
          p.tNext = at();
          p.nextKind = 'board';
        }
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample(true), 12);
  });
}

export const readEventFaceProbe = (page: Page): Promise<EventFaceProbe> =>
  page.evaluate(() => (window as unknown as {__eventFace: EventFaceProbe}).__eventFace);

/** One readable line of a probe (for the trail and the annotations). */
export function eventFaceLine(p: EventFaceProbe): string {
  const d = (t: number | undefined) => (t === undefined || p.tArmed === undefined ? '-' : String(t - p.tArmed));
  return `armed→paid ${d(p.tPaid)} · lifting ${d(p.tLifting)} · flying ${d(p.tFlying)} · revealed ${d(p.tRevealed)} · ` +
    `next(${p.nextKind ?? '-'}) ${d(p.tNext)} · flipCosMin ${p.flipCosMin.toFixed(3)} · payback ${p.paybacks.map(([, s]) => s).join('→') || '-'} · ` +
    `births ${p.birthPhases.join(' ')} · counts ${p.counts.map(([t, c]) => `${d(t)}:${c}`).join(' ')}`;
}
