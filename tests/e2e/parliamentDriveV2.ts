import {Page} from './consoleTest';

/*
 * «ЗАСЕДАНИЕ v2» — the walk's witnesses and the ONE sampler of the sitting's
 * frames, shared by the v2 probes (`console-parliament-sitting-v2*.spec.ts`).
 * Everything here reads the section's own attributes and the tiers' painted
 * state; the sampler is `setInterval` + `MutationObserver`, never rAF.
 */

/** The beat of the stage that is playing ('' at rest / a one-beat stage) — the director's own attribute. */
export async function sittingBeat(page: Page): Promise<string> {
  return (await page.locator('.con-parl__stage').getAttribute('data-sitting-beat')) ?? '';
}

/** The stage whose beats are playing ('' at rest). */
export async function sittingMotion(page: Page): Promise<string> {
  return (await page.locator('.con-parl__stage').getAttribute('data-sitting-motion')) ?? '';
}

export type SittingSample = {
  t: number;
  /** The sitting's page, the playing stage and beat, the reward step. */
  stage: string; motion: string; beat: string; step: string;
  /** Every `parliament-*` / `resource-transfer` hold standing. */
  holds: Array<string>;
  /** The Agenda: which steps each seat's marker is DRAWN on (visible cubes), the viewer's influence badge. */
  markers: Record<string, Array<number>>; influence: string;
  /** Lit popular-support places per party (the plaques as SHOWN). */
  support: Record<string, number>;
  /** The government: the card's face slug when PAINTED (visible), the empty seat, the ruler's party, the quest's closed state and text. */
  govCard: string; govEmpty: boolean; ruler: string; questClosed: boolean; questText: string;
  /** The voting area as SHOWN: every home's instance (+`!` when vacated) and the lit slot. */
  slots: string; litSlot: string;
  /** The party tiles' rects (by party) — the row must not move while the government changes. */
  tiles: Record<string, {x: number, y: number, w: number, h: number}>;
  /** The rail: the plants / M€ / heat readings and their delta chips; the transfer chips in the air. */
  rail: Record<string, {prod: string, stock: string}>; deltas: Record<string, number>;
  chips: Array<{id: string, x: number, y: number, res: string}>;
  /** The carrier card's printed mechanic rect (the wave's birthplace). */
  mech: {x: number, y: number, w: number, h: number} | undefined;
  /** The results card hidden / revealed, the door plate, the board live, the parliament mounted, the hot verb. */
  resultsHidden: boolean; door: boolean; placing: boolean; parl: boolean; hot: string;
};
export type SittingProbe = {samples: Array<SittingSample>};

/** THE PROBE of the sitting's frames — armed BEFORE the press. `setInterval` + `MutationObserver`, never rAF. */
export async function armSittingProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__sitV2: SittingProbe, __conReady?: () => {holds: Array<string>}};
    w.__sitV2 = {samples: []};
    const rect = (el: Element | null): {x: number, y: number, w: number, h: number} | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width < 1 ? undefined : {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
    };
    const painted = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      for (let a: Element | null = el; a !== null && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) {
          return false;
        }
      }
      return (el as HTMLElement).getBoundingClientRect().width > 0;
    };
    const sample = () => {
      const markers: Record<string, Array<number>> = {};
      for (const cube of Array.from(document.querySelectorAll<HTMLElement>('.con-parl__agenda-cube[data-agenda-cube]'))) {
        if (!painted(cube)) {
          continue;
        }
        const color = cube.getAttribute('data-agenda-cube') ?? '';
        const step = Number(cube.closest('[data-agenda-markers]')?.getAttribute('data-agenda-markers') ?? '-1');
        markers[color] = [...(markers[color] ?? []), step];
      }
      const support: Record<string, number> = {};
      const tiles: Record<string, {x: number, y: number, w: number, h: number}> = {};
      for (const tile of Array.from(document.querySelectorAll<HTMLElement>('.con-parl__party[data-party]'))) {
        const party = tile.getAttribute('data-party') ?? '';
        support[party] = tile.querySelectorAll('.con-pseal__support-place--on').length;
        const r = rect(tile);
        if (r !== undefined) {
          tiles[party] = r;
        }
      }
      const govCardEl = document.querySelector<HTMLElement>('[data-parl-gov] .con-parl__gov-card .pcard');
      const govCard = govCardEl !== null && painted(govCardEl) ? (Array.from(govCardEl.classList).find((c) => c.startsWith('pcard--rdx-')) ?? 'card') : '';
      const rail: Record<string, {prod: string, stock: string}> = {};
      const deltas: Record<string, number> = {};
      for (const key of ['plants', 'megacredits', 'heat']) {
        const row = document.querySelector(`.con-res__row--${key}`);
        rail[key] = {prod: row?.querySelector('.con-res__prod')?.textContent?.trim() ?? '', stock: row?.querySelector('.con-res__stockwrap')?.textContent?.trim() ?? ''};
        deltas[key] = row?.querySelectorAll('.delta-chip').length ?? 0;
      }
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        const icon = el.querySelector<HTMLElement>('.con-transfer__icon');
        const res = icon === null ? 'megacredits' : (Array.from(icon.classList).find((c) => c.startsWith('resource_icon--')) ?? '').replace('resource_icon--', '');
        return {id: `${el.dataset.transferId ?? '?'}:${res}`, x: r.left + r.width / 2, y: r.top + r.height / 2, res};
      });
      const quest = document.querySelector<HTMLElement>('[data-parl-quest]');
      w.__sitV2.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        motion: document.querySelector('.con-parl__stage')?.getAttribute('data-sitting-motion') ?? '',
        beat: document.querySelector('.con-parl__stage')?.getAttribute('data-sitting-beat') ?? '',
        step: document.querySelector('.con-sit')?.getAttribute('data-sit-step') ?? '',
        holds: (w.__conReady?.().holds ?? []).filter((h) => h.startsWith('parliament') || h.startsWith('resource-transfer')),
        markers,
        influence: document.querySelector('[data-parl-influence]')?.textContent?.trim() ?? '',
        support,
        govCard,
        govEmpty: document.querySelector('[data-parl-gov-empty]') !== null,
        ruler: document.querySelector('[data-parl-ruler] .con-parl__party[data-party]')?.getAttribute('data-party') ?? '',
        questClosed: quest?.hasAttribute('data-parl-quest-closed') === true,
        questText: quest?.querySelector('.con-parl__quest-text')?.textContent?.trim() ?? '',
        slots: Array.from(document.querySelectorAll('.con-parl__slots .con-parl__slot-home')).map((el) => `${el.getAttribute('data-home')}${el.hasAttribute('data-parl-slot-vacated') ? '!' : ''}`).join('|'),
        litSlot: document.querySelector('.con-parl__slot--lit')?.getAttribute('data-instance') ?? '',
        tiles,
        rail,
        deltas,
        chips,
        mech: rect(govCardEl?.querySelector('.pcard__mech') ?? null),
        resultsHidden: document.querySelector('[data-sit-results-hidden]') !== null,
        door: document.querySelector('[data-sit-door]') !== null,
        placing: document.querySelector('.con-board--placing, .con-board--locked') !== null,
        parl: document.querySelector('.con-parl') !== null,
        hot: Array.from(document.querySelectorAll('.con-cmdbar__cmd--hot .con-cmdbar__label')).map((el) => el.textContent?.trim() ?? '').join('|'),
      });
      if (w.__sitV2.samples.length > 12000) {
        w.__sitV2.samples.splice(0, 2000);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sitting-beat', 'data-sitting-motion', 'data-sit-step', 'data-parl-slot-vacated']});
    window.setInterval(sample, 16);
  });
}

export const readSittingProbe = (page: Page): Promise<SittingProbe> => page.evaluate(() => (window as unknown as {__sitV2: SittingProbe}).__sitV2);

/** The beats in the order they PLAYED (each named once, in first-seen order). */
export function beatOrder(samples: ReadonlyArray<SittingSample>): Array<string> {
  const out: Array<string> = [];
  for (const s of samples) {
    if (s.beat !== '' && !out.includes(s.beat)) {
      out.push(s.beat);
    }
  }
  return out;
}

/** The first sample index of a beat (−1 when it never played). */
export function beatStart(samples: ReadonlyArray<SittingSample>, beat: string): number {
  return samples.findIndex((s) => s.beat === beat);
}
