import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, press, settle} from './consoleStart';

/**
 * «СТАНДАРТНЫЕ ПРОЕКТЫ» STAND STILL (the owner, 2026-11-01, after P86): «при входе в "Продажу патентов" все карты мигают,
 * плитки стандартных проектов тоже мигают при открытии workspace, компоновка индикаторов глобальных параметров в верхнем
 * баре скачет при навигации по стандартным проектам». Three witnesses, each sampled from BEFORE its press (16 ms):
 *
 *   A · the workspace opens: every project tile, once painted (opacity ≥ .95), never dips below .9 again;
 *   B · the d-pad walks every row: the four parameter cells of the top strip keep their box (±0.5 px) — the pre-select
 *       ring is a pseudo-element, never padding / margin (Venus's separator gap made the old «net zero» a jump);
 *   C · the sale opens its hosted hand: the album, once painted, never dips (the step's entry must not RESTART when the
 *       open flight ends — it was keyed on a state attribute that fell).
 *
 * Every sample series is written to `screenshots/stdp-open-stability/` (the evidence of a red). TIMING class.
 */

const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'stdp-open-stability');

type Frame = {t: number, root: number, panel: number, cards: Array<{k: string, o: number, own: number, inline: string, cls: string}>, params: Array<{k: string, x: number, w: number}>, hand: number, slots: number};

async function armProbe(page: Page, ms: number): Promise<void> {
  await page.evaluate((span) => {
    const frames: Array<unknown> = [];
    (window as unknown as {__stdpProbe: Array<unknown>}).__stdpProbe = frames;
    const t0 = performance.now();
    const opacityChain = (el: Element | null): number => {
      let o = 1;
      for (let e = el; e !== null; e = e.parentElement) {
        o *= Number(getComputedStyle(e).opacity);
      }
      return Math.round(o * 1000) / 1000;
    };
    const timer = window.setInterval(() => {
      const cards = [...document.querySelectorAll<HTMLElement>('.con-stdp__card')].map((el, i) => ({
        k: (el.querySelector('.con-stdp__name')?.textContent ?? String(i)).trim(),
        o: opacityChain(el),
        own: Number(getComputedStyle(el).opacity),
        inline: el.style.opacity,
        cls: el.className,
      }));
      const root = document.querySelector<HTMLElement>('.con-stdp');
      const panel = root?.querySelector<HTMLElement>('[data-motion-panel]') ?? root;
      const params = [...document.querySelectorAll('.con-status__param')].map((el) => {
        const r = el.getBoundingClientRect();
        return {k: [...el.classList].find((c) => c.startsWith('con-status__param--') && !c.endsWith('--ghost')) ?? '?', x: Math.round(r.left * 10) / 10, w: Math.round(r.width * 10) / 10};
      });
      const hand = document.querySelector('.con-stdp .con-hand');
      const slots = [...document.querySelectorAll('.con-stdp .con-hand__slot')];
      frames.push({
        t: Math.round(performance.now() - t0),
        root: root === null ? -1 : Number(getComputedStyle(root).opacity),
        panel: panel === null || panel === undefined ? -1 : Number(getComputedStyle(panel).opacity),
        cards, params,
        hand: hand === null ? -1 : opacityChain(hand),
        slots: slots.length === 0 ? -1 : Math.min(...slots.map((s) => opacityChain(s))),
      });
      if (performance.now() - t0 >= span) {
        window.clearInterval(timer);
      }
    }, 16);
  }, ms);
}

async function readProbe(page: Page, name: string, span: number): Promise<Array<Frame>> {
  await page.waitForFunction((s) => {
    const f = (window as unknown as {__stdpProbe?: Array<{t: number}>}).__stdpProbe ?? [];
    return f.length > 0 && f[f.length - 1].t >= s - 20;
  }, span, {timeout: span + 20_000});
  const frames = await page.evaluate(() => (window as unknown as {__stdpProbe: Array<unknown>}).__stdpProbe) as Array<Frame>;
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(frames));
  return frames;
}

/** A value that, once it reached `up`, fell below `floor` again — the blink. */
function dipsAfterUp(series: ReadonlyArray<{t: number, v: number}>, up = 0.95, floor = 0.9): Array<string> {
  let reached = false;
  const out: Array<string> = [];
  for (const s of series) {
    if (s.v >= up) {
      reached = true;
    } else if (reached && s.v >= 0 && s.v < floor) {
      out.push(`t=${s.t} ${s.v}`);
    }
  }
  return out;
}

/**
 * A value that composes to its REST (the last sample) must do so monotonically: never past the rest (an overshoot that
 * then dims back), never back under it once it got there (a dip). An unavailable tile rests at .62 — «up to 1» was the
 * wrong reference, which is how the open's blink stayed green.
 */
function unsteadyAroundRest(series: ReadonlyArray<{t: number, v: number}>, tol = 0.05): Array<string> {
  const live = series.filter((s) => s.v >= 0);
  if (live.length === 0) {
    return [];
  }
  const rest = live[live.length - 1].v;
  const out: Array<string> = [];
  let reached = false;
  for (const s of live) {
    if (s.v > rest + tol) {
      out.push(`t=${s.t} ${s.v} over rest ${rest}`);
    }
    if (s.v >= rest - tol) {
      reached = true;
    } else if (reached && s.v < rest - 2 * tol) {
      out.push(`t=${s.t} ${s.v} under rest ${rest}`);
    }
  }
  return out;
}

const focusedRow = async (page: Page) =>
  (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';

test.describe(`the Standard Projects workspace stands still · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A open · B walk · C the sale\'s hosted hand: no blink, no jump', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixture(page, request, 'unexpected-application', {query: PRESET.query});
    await settle(page);

    // ── A · the workspace opens.
    await armProbe(page, 2500);
    await press(page, 'Comma', 900);
    await press(page, 'Enter', 200);
    const open = await readProbe(page, 'a-open', 2500);
    await page.waitForSelector('.con-stdp', {timeout: 15_000});
    await settle(page);
    const names = [...new Set(open.flatMap((f) => f.cards.map((c) => c.k)))];
    expect(names.length, 'the tiles were sampled').toBeGreaterThan(3);
    const blinks: Record<string, Array<string>> = {};
    for (const k of names) {
      const d = unsteadyAroundRest(open.map((f) => ({t: f.t, v: f.cards.find((c) => c.k === k)?.o ?? -1})));
      if (d.length > 0) {
        blinks[k] = d.slice(0, 6);
      }
    }
    expect(blinks, 'a project tile composes to its rest monotonically while the workspace opens (no dip, no overshoot)').toEqual({});

    // ── B · the walk: the parameter cells keep their box.
    await armProbe(page, 6000);
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
    for (const k of keys) {
      await press(page, k, 240);
    }
    const walk = await readProbe(page, 'b-walk', 6000);
    const moved: Array<string> = [];
    const base = walk[0]?.params ?? [];
    for (const f of walk) {
      for (const p of f.params) {
        const b = base.find((x) => x.k === p.k);
        if (b !== undefined && (Math.abs(b.x - p.x) > 0.5 || Math.abs(b.w - p.w) > 0.5)) {
          moved.push(`t=${f.t} ${p.k} x ${b.x}→${p.x} w ${b.w}→${p.w}`);
        }
      }
    }
    expect(moved.slice(0, 8), 'the top strip\'s parameter cells never move while the projects are walked').toEqual([]);

    // ── C · the sale opens its hosted hand.
    for (let i = 0; i < 12 && !/продажа патентов/i.test(await focusedRow(page)); i++) {
      await press(page, i < 6 ? 'ArrowUp' : 'ArrowRight', 240);
    }
    for (let i = 0; i < 12 && !/продажа патентов/i.test(await focusedRow(page)); i++) {
      await press(page, 'ArrowDown', 240);
    }
    expect(await focusedRow(page)).toMatch(/продажа патентов/i);
    await armProbe(page, 3000);
    await press(page, 'Enter', 200);
    const sale = await readProbe(page, 'c-sale', 3000);
    const handDips = dipsAfterUp(sale.map((f) => ({t: f.t, v: f.hand})));
    const slotDips = dipsAfterUp(sale.map((f) => ({t: f.t, v: f.slots})));
    expect({hand: handDips.slice(0, 6), slots: slotDips.slice(0, 6)}, 'the sale\'s album, once painted, never dips').toEqual({hand: [], slots: []});
    await settle(page);
    await page.screenshot({path: path.join(OUT, 'c-sale-settled.png')});
  });
});
