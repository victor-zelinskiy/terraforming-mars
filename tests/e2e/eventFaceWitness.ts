import {Page} from './consoleTest';

/**
 * «СОБЫТИЕ ПЛАТИТ ЛИЦОМ» (P84 · DK) — the witness of a play's landing scene, armed BEFORE the press and read after it.
 * MutationObserver + setInterval (never rAF — headless drives rAF off the compositor), one record per change:
 *  - the HERO PROXY's side on every sample of the flight (`flipCos` — the flip chassis' m11: 1 = face up, −1 = its back;
 *    the standalone table's event alone still turns in the arc);
 *  - the landed EVENT's side on the stage (`[data-event-side]`: up → turning → down) and its touchdown on the pile
 *    (`[data-event-landed]`), with the pile's caption count;
 *  - the scene's own milestones: the press (`data-hero-phase` leaves idle), the reveal, `told`, the next surface's FIRST
 *    frame (the search's reveal in the hand's zone, or no workspace left and no hero layer — the board).
 * The births themselves are the transfer witness's (`transferWitness.ts` — `printed:<sprite>` · `vp-badge` · `recv:front`).
 */
export type EventFaceProbe = {
  ticks: number,
  /** ms since the arm, of the first sample where … */
  tArmed?: number, tFlying?: number, tRevealed?: number, tTurnStart?: number, tTurned?: number, tLanded?: number,
  tNext?: number, nextKind?: 'reveal' | 'board',
  /** The smallest m11 of the hero proxy's flip chassis seen while the proxy flew (1 → it never turned). */
  flipCosMin: number,
  /** The pile's caption count: [ms, text] at every change. */
  counts: Array<[number, string]>,
  /** The scene's phases in order (`data-hero-phase`). */
  phases: Array<[number, string]>,
  /** The landed event's side at every token's BIRTH on the transfer layer (`up` — it paid face up; `-` — no event stage). */
  birthSides: Array<string>,
};

export async function armEventFaceProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const p: EventFaceProbe = {ticks: 0, flipCosMin: 1, counts: [], phases: [], birthSides: []};
    const seenChips = new WeakSet<Element>();
    (window as unknown as {__eventFace: EventFaceProbe}).__eventFace = p;
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
      if (p.tArmed === undefined && phase !== '' && phase !== 'idle') {
        p.tArmed = at();
      }
      if (phase === 'flying' || phase === 'landing' || phase === 'lifting') {
        p.tFlying ??= at();
        const flip = document.querySelector<HTMLElement>('.con-played-hero__proxy .con-deal-proxy__flip');
        if (flip !== null) {
          const m = new DOMMatrixReadOnly(getComputedStyle(flip).transform === 'none' ? undefined : getComputedStyle(flip).transform);
          p.flipCosMin = Math.min(p.flipCosMin, m.m11);
        }
      }
      const front = document.querySelector<HTMLElement>('.con-recv [data-recv-front][data-played-key]');
      if (front !== null) {
        p.tRevealed ??= at();
      }
      const side = document.querySelector<HTMLElement>('.con-recv [data-event-side]');
      if (side !== null) {
        if (side.dataset.eventSide !== 'up') {
          p.tTurnStart ??= at();
        }
        if (side.dataset.eventSide === 'down') {
          p.tTurned ??= at();
        }
        if (side.hasAttribute('data-event-landed')) {
          p.tLanded ??= at();
        }
      }
      document.querySelectorAll('.con-transfer__chip').forEach((chip) => {
        if (!seenChips.has(chip)) {
          seenChips.add(chip);
          p.birthSides.push(side?.dataset.eventSide ?? '-');
        }
      });
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
  return `armed→flying ${d(p.tFlying)} · revealed ${d(p.tRevealed)} · turn ${d(p.tTurnStart)}–${d(p.tTurned)} · landed ${d(p.tLanded)} · ` +
    `next(${p.nextKind ?? '-'}) ${d(p.tNext)} · flipCosMin ${p.flipCosMin.toFixed(3)} · counts ${p.counts.map(([t, c]) => `${d(t)}:${c}`).join(' ')}`;
}
