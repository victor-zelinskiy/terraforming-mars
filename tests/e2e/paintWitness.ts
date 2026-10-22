/*
 * THE PAINT WITNESS (T12 / CA — «жетон никогда не красится под поверхностью, на которую садится»). A rect probe cannot
 * see paint (`fixed-layer-is-a-stacking-context`: three weeks of green specs over invisible flights), and the hit test
 * cannot see a `pointer-events: none` cover (the shade, the satellite, a seat's intake plaque) — so on every sample the
 * witness makes the TOKEN and those known covers hit-testable for one `elementsFromPoint` and asks what is painted on
 * top at the token's centre: the token itself (or a sibling token), or a named surface. A token under the cockpit's
 * HULL (the rail, the strip and its plaques, the satellite, the dock, the bars) is the owner's defect — «летит ПОД
 * панель»; a token under the shade or a band while its centre is still over the covered board is the board's own
 * background story (by plan). Sampled on `setInterval` — never rAF (a quiet compositor stops rAF exactly when these
 * scenes run).
 */
import {Page} from './consoleTest';

export type PaintSample = {
  t: number,
  id: string,
  x: number,
  y: number,
  opacity: number,
  /** `lit` / `under` (the twin layers' own attribute), `demoted` (a pre-T12 layer carrying `con-flight-to-board`). */
  layer: string,
  /** `self` — the token (or another token) is on top; else what is painted over it. */
  top: string,
  /** What is on top belongs to the cockpit's hull — the token is UNDER THE PANEL. */
  hull: boolean,
  wsOpen: boolean,
};

export type PaintToken = {
  id: string,
  birth: PaintSample,
  touchdown: PaintSample,
  /** Every sample the token stood under the hull — the owner's defect. */
  underHull: ReadonlyArray<PaintSample>,
  /** The layers it painted in, in order (a handover reads `under → lit`). */
  layers: ReadonlyArray<string>,
};

export type PaintWitness = {samples: ReadonlyArray<PaintSample>, tokens: ReadonlyArray<PaintToken>};

/** Arm the sampler (idempotent) — before the press that starts the scene. */
export async function armPaintWitness(page: Page, everyMs = 16): Promise<void> {
  await page.evaluate((ms) => {
    const w = window as unknown as {__paintWitness?: {samples: Array<unknown>, stop: () => void}};
    w.__paintWitness?.stop();
    const samples: Array<unknown> = [];
    const t0 = performance.now();
    const HULL = '.con-res, .con-res-host, .con-res-aux, .con-status, .con-handdock, .con-footer, .con-cmdbar, .con-hand__verdictbar';
    const COVERS = '.con-shade, .con-res-aux, .con-status__intake';
    const name = (el: Element): string => `${el.tagName.toLowerCase()}${Array.from(el.classList).slice(0, 2).map((c) => `.${c}`).join('')}`;
    const sample = () => {
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip'));
      if (chips.length === 0) {
        return;
      }
      const covers = Array.from(document.querySelectorAll<HTMLElement>(COVERS));
      const wsOpen = document.querySelector('.con-root')?.classList.contains('con-root--ws-open') ?? false;
      for (const chip of chips) {
        const cs = getComputedStyle(chip);
        const opacity = Number(cs.opacity);
        if (cs.visibility === 'hidden' || opacity < 0.05) {
          continue;
        }
        const r = chip.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (r.width <= 0 || x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
          continue;
        }
        const saved = [chip, ...covers].map((el) => el.style.pointerEvents);
        [chip, ...covers].forEach((el) => {
          el.style.pointerEvents = 'auto';
        });
        let top: Element | undefined;
        try {
          top = document.elementsFromPoint(x, y)[0];
        } finally {
          [chip, ...covers].forEach((el, i) => {
            el.style.pointerEvents = saved[i];
          });
        }
        const own = top === undefined || top.closest('.con-transfer') !== null;
        const hullEl = own ? null : top!.closest(HULL);
        const surface = own ? null : (hullEl ?? top!.closest('.con-ws, .con-shade, .con-start'));
        const layer = chip.getAttribute('data-transfer-layer') ?? (chip.closest('.con-flight-to-board') !== null ? 'demoted' : 'lit');
        samples.push({
          t: Math.round(performance.now() - t0),
          id: chip.getAttribute('data-transfer-id') ?? '?',
          x: Math.round(x), y: Math.round(y),
          opacity: Math.round(opacity * 100) / 100,
          layer,
          top: own ? 'self' : surface !== null && surface !== top ? `${name(top!)} in ${name(surface)}` : name(top!),
          hull: hullEl !== null,
          wsOpen,
        });
      }
    };
    const timer = window.setInterval(sample, ms);
    w.__paintWitness = {samples, stop: () => window.clearInterval(timer)};
  }, everyMs);
}

/** Stop the sampler and read it — per token: the birth, the touchdown, every sample under the hull, the layers walked. */
export async function readPaintWitness(page: Page): Promise<PaintWitness> {
  const samples = await page.evaluate(() => {
    const w = window as unknown as {__paintWitness?: {samples: Array<unknown>, stop: () => void}};
    w.__paintWitness?.stop();
    return (w.__paintWitness?.samples ?? []) as Array<PaintSample>;
  });
  const byId = new Map<string, Array<PaintSample>>();
  for (const s of samples) {
    byId.set(s.id, [...(byId.get(s.id) ?? []), s]);
  }
  const tokens: Array<PaintToken> = [...byId.entries()].map(([id, list]) => {
    const layers: Array<string> = [];
    for (const s of list) {
      if (layers[layers.length - 1] !== s.layer) {
        layers.push(s.layer);
      }
    }
    return {id, birth: list[0], touchdown: list[list.length - 1], underHull: list.filter((s) => s.hull), layers};
  });
  return {samples, tokens};
}

/** One line per token for a report: «#12 lit→… birth self · touchdown div.con-res__row in div.con-res · under hull 9×». */
export function paintReport(w: PaintWitness): string {
  return w.tokens.map((k) => `#${k.id} ${k.layers.join('→')} · birth ${k.birth.top} @(${k.birth.x},${k.birth.y}) ws=${k.birth.wsOpen} · ` +
    `touchdown ${k.touchdown.top} @(${k.touchdown.x},${k.touchdown.y}) · under hull ${k.underHull.length}× ` +
    `${k.underHull.length > 0 ? `[${[...new Set(k.underHull.map((s) => s.top))].join(' | ')}]` : ''}`).join('\n');
}
