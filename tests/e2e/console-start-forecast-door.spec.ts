import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, crumbText, fetchPlayerModel, focusCard, openConsole, pickCards, playQueueCard, pressUntil, sendPlayerInput,
  settle, soloGameConfig, submitSummary, waitQueueIdle, walkToSummary,
} from './consoleStart';

/**
 * THE WITNESS OF «СРАБОТАЕТ» ON THE PRELUDES' DEPLOYMENT (P79 · DI, the owner's frame of 2026-10-31: «убрать из центра
 * экрана, компактная и лаконичная подача внизу, бесшовное переключение на осмотр R3»). Proteus' start (the second
 * Building prelude wakes the corporation's data), three profiles:
 *   (а) the table's answer stands ONCE on the scene — one `[data-forecast-row]`, one R3 key, both on the status rail;
 *       nothing of it under the queue cards;
 *   (б) the rail is one line — name · state · answer, the answer right of the state, the R3 key its last element; the
 *       rail's height is the same before, during and after the layer; the chips read louder than the kicker;
 *   (в) R3: the panel's FIRST painted frame is the row's own span on the panel's foot (it grows OUT of the rail), its
 *       LAST stands above the rail inside the queue's space; the focused prelude keeps its box (±1 px) and its paint in
 *       every sample; the other queue blocks and the shelf are parked (≤ .2) by the end; the queue's own box never dims;
 *   (г) the crumb gains «ЭФФЕКТЫ» exactly while the layer stands;
 *   (д) B folds it back: every box where it was, the focus on the same card, the answer's content back, no request;
 *   (е) the scene never scrolls.
 * «ДО» this polish (а) and (в) were red: the answer stood twice (a reading line under the card + the rail), the panel
 * opened in the first action's room and the whole queue dimmed by a CSS class.
 */

type Preset = {id: string, viewport: {width: number, height: number}, query: string};
// Three profiles on purpose: the lane beside the hero and the narrow composition are profile-specific numbers.
const PRESETS: ReadonlyArray<Preset> = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: ''},
];
const OUT = path.resolve('screenshots', 'p79', process.env.TM_E2E_SHOTS_TAG ?? '');
const PROTEUS = 'Proteus';
const MOHOLE = 'Mohole';
const MARTIAN = 'Martian Industries';

type Box = {x: number, y: number, w: number, h: number};
type Sample = {
  t: number,
  panel?: Box,
  painted?: Box,
  hero?: Box,
  heroAlpha: number,
  queueAlpha: number,
  othersAlpha: Array<number>,
  shelfAlpha: number,
  rail?: Box,
};

const proteusData = async (request: APIRequestContext, id: string): Promise<number> =>
  ((await fetchPlayerModel(request, id) as unknown as {thisPlayer: {tableau: Array<{name: string, resources?: number}>}})
    .thisPlayer.tableau.find((c) => c.name === PROTEUS)?.resources ?? 0);

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset.id, `${name}.png`)});
}

/** The scene's door, rail and queue as they stand. */
async function doorRead(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10};
    };
    const scene = document.querySelector('.con-start');
    const door = document.querySelector('[data-start-prelude-forecast]');
    const row = door?.querySelector('[data-forecast-row]') ?? null;
    const label = row?.querySelector('.con-forecast__label') ?? null;
    const chip = row?.querySelector('.con-forecast__chip .action-effect-chip') ?? null;
    const kids = row === null ? [] : Array.from(row.children);
    const ceremony = document.querySelector<HTMLElement>('.con-start__ceremony');
    return {
      rows: scene?.querySelectorAll('[data-forecast-row]').length ?? 0,
      keys: scene?.querySelectorAll('[data-forecast-row] .con-forecast__key').length ?? 0,
      rowsOnRail: door?.querySelectorAll('[data-forecast-row]').length ?? 0,
      underCards: document.querySelectorAll('.con-start__qcard .con-forecast').length,
      rail: box(document.querySelector('.con-start__statusrail')),
      name: box(document.querySelector('.con-start__statusrail .con-start__status-name')),
      state: box(document.querySelector('.con-start__statusrail .con-start__status-state')),
      answer: box(door),
      keyLast: kids.length > 0 && kids[kids.length - 1].classList.contains('con-forecast__key'),
      kickerPx: label === null ? 0 : parseFloat(getComputedStyle(label).fontSize),
      chipPx: chip === null ? 0 : parseFloat(getComputedStyle(chip).fontSize),
      remPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
      focused: document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '',
      layer: document.querySelector('.con-start [data-forecast-layer]') !== null,
      scrolls: ceremony !== null && ceremony.scrollHeight > ceremony.clientHeight + 1,
      queuecol: box(document.querySelector('.con-start__queuecol')),
    };
  });
}

/** Arm the transition probe BEFORE the press: a MutationObserver + a 16 ms task clock, never rAF. */
async function armDoorProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__door: Array<Sample>};
    w.__door = [];
    const t0 = performance.now();
    const box = (r: DOMRect): Box => ({x: r.left, y: r.top, w: r.width, h: r.height});
    const alpha = (el: Element | null): number => {
      let a = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden') {
          return 0;
        }
        a *= parseFloat(cs.opacity);
      }
      return Math.round(a * 1000) / 1000;
    };
    const sample = () => {
      const surface = document.querySelector<HTMLElement>('.con-start [data-forecast-surface]');
      const hero = document.querySelector('.con-start__qcard[data-forecast-hero]');
      const s: Sample = {
        t: Math.round(performance.now() - t0),
        heroAlpha: alpha(hero),
        queueAlpha: alpha(document.querySelector('.con-start__queue')),
        othersAlpha: Array.from(document.querySelectorAll('.con-start__queue-row > *')).filter((el) => el !== hero).map(alpha),
        shelfAlpha: alpha(document.querySelector('.con-start__played')),
      };
      if (hero !== null) {
        s.hero = box(hero.getBoundingClientRect());
      }
      const rail = document.querySelector('.con-start__statusrail');
      if (rail !== null) {
        s.rail = box(rail.getBoundingClientRect());
      }
      if (surface !== null) {
        const r = surface.getBoundingClientRect();
        s.panel = box(r);
        // What of the panel is PAINTED: its box minus the unfold's clip (`inset(t r b l …)` in its own px).
        const m = /inset\(([-\d.]+)px(?:\s+([-\d.]+)px)?(?:\s+([-\d.]+)px)?(?:\s+([-\d.]+)px)?/.exec(getComputedStyle(surface).clipPath);
        const k = surface.offsetWidth > 0 ? r.width / surface.offsetWidth : 1;
        if (m !== null) {
          const top = parseFloat(m[1]);
          const right = m[2] === undefined ? top : parseFloat(m[2]);
          const bottom = m[3] === undefined ? top : parseFloat(m[3]);
          const left = m[4] === undefined ? right : parseFloat(m[4]);
          s.painted = {x: r.left + left * k, y: r.top + top * k, w: r.width - (left + right) * k, h: r.height - (top + bottom) * k};
        } else {
          s.painted = s.panel;
        }
      }
      w.__door.push(s);
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 16);
  });
}

async function doorSamples(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => (window as unknown as {__door?: Array<Sample>}).__door ?? []);
}

const near = (a: Box | undefined, b: Box | undefined, tol = 1): boolean =>
  a !== undefined && b !== undefined && Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol && Math.abs(a.w - b.w) <= tol && Math.abs(a.h - b.h) <= tol;

for (const preset of PRESETS) {
  test.describe(`console · P79 «Сработает» on the deployment · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('one answer on the rail; R3 grows the layer out of it beside the standing prelude; B folds it back', async ({page, request}) => {
      test.setTimeout(360_000);
      const posts: Array<string> = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input|\/api\/player/.test(r.url())) {
          posts.push(r.url());
        }
      });
      const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
        expansions: {colonies: true, turmoilRedux: true, prelude: true},
        startingCorporations: 1,
        customCorporationsList: [PROTEUS],
        customPreludes: [MOHOLE, MARTIAN, 'Allied Bank', 'Business Empire'],
      })});
      await openConsole(page, playerId, preset.query);
      await walkToSummary(page, {
        onStep: async (p, kind) => {
          if (kind === 'corporation') {
            expect(await pickCards(p, [PROTEUS]), 'Proteus was offered and picked').toContain(PROTEUS);
          } else if (kind === 'prelude') {
            expect(await pickCards(p, [MOHOLE, MARTIAN]), 'both Building Preludes were picked').toEqual(expect.arrayContaining([MOHOLE, MARTIAN]));
          }
        },
      });
      await submitSummary(page);
      await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
      await settle(page, {timeoutMs: 30_000});
      expect(await playQueueCard(page, PROTEUS), 'the corporation was played from the queue').toBe(true);
      for (let i = 0; i < 20; i++) {
        const wf = (await fetchPlayerModel(request, playerId) as unknown as {waitingFor?: {type: string, coloniesModel?: Array<{name: string}>}}).waitingFor;
        if (wf?.type === 'colony') {
          await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wf.coloniesModel ?? [])[0]?.name ?? ''});
          break;
        }
        if (await proteusData(request, playerId) > 0) {
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      await waitQueueIdle(page);
      await settle(page, {timeoutMs: 30_000});
      expect(await focusCard(page, MOHOLE), `never focused «${MOHOLE}»`).toBe(true);
      expect(await playQueueCard(page, MOHOLE), 'the first Prelude was played').toBe(true);
      await waitQueueIdle(page);
      await settle(page, {timeoutMs: 40_000});

      // ── (а) (б) the answer of the second Prelude: ONE place, on the rail ──
      expect(await focusCard(page, MARTIAN), `never focused «${MARTIAN}»`).toBe(true);
      await expect(page.locator('[data-start-prelude-forecast] [data-forecast-row]'), '«Сработает» stands on the rail').toHaveCount(1, {timeout: 20_000});
      await settle(page);
      const before = await doorRead(page);
      await shoot(page, preset, 'g-queue-one-answer');
      console.log(`[forecast-door] ${preset.id} before: ${JSON.stringify(before)}`);
      expect(before.rows, '(а) ONE «Сработает» row on the scene').toBe(1);
      expect(before.keys, '(а) ONE R3 key on the scene').toBe(1);
      expect(before.rowsOnRail, '(а) …and it is the rail\'s').toBe(1);
      expect(before.underCards, '(а) nothing of the answer under a queue card').toBe(0);
      expect(before.answer!.x, '(б) the answer stands right of the state').toBeGreaterThanOrEqual(before.state!.x + before.state!.w - 1);
      expect(before.name!.y + before.name!.h / 2, '(б) name and answer on one line').toBeCloseTo(before.answer!.y + before.answer!.h / 2, -1);
      expect(before.answer!.x + before.answer!.w, '(б) the answer inside the rail').toBeLessThanOrEqual(before.rail!.x + before.rail!.w + 1);
      expect(before.keyLast, '(б) the R3 key is the row\'s last element').toBe(true);
      expect(before.chipPx / before.kickerPx, `(б) the chip ${before.chipPx}px reads louder than the kicker ${before.kickerPx}px`).toBeGreaterThanOrEqual(1.4);
      if (preset.id === 'tv4k') {
        expect(before.kickerPx, '(б) the kicker at the couch floor').toBeGreaterThanOrEqual(0.8 * before.remPx - 0.5);
      }
      expect(before.scrolls, '(е) the deployment never scrolls').toBe(false);

      // ── (в) (г) R3 → the layer grows out of the rail into the queue's space ──
      const postsBefore = posts.length;
      await armDoorProbe(page);
      expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-start [data-forecast-layer]').count() > 0, {tries: 3, settleMs: 1100}),
        'R3 opens the «Эффекты» layer').toBeTruthy();
      await settle(page);
      expect((await crumbText(page)).toUpperCase(), '(г) the crumb gains its tail').toMatch(/ЭФФЕКТЫ/);
      await expect(page.locator('.con-cmdbar'), '(г) the bar is the layer\'s').toContainText(/Закрыть/i);
      await shoot(page, preset, 'e-layer-open');
      const open = await doorRead(page);
      const samples = await doorSamples(page);
      const withPanel = samples.filter((s) => s.panel !== undefined && s.painted !== undefined && s.painted.w > 0 && s.painted.h > 0);
      expect(withPanel.length, 'the probe saw the panel').toBeGreaterThan(0);
      const first = withPanel[0];
      const last = samples[samples.length - 1];
      const rowBox = before.answer!;
      console.log(`[forecast-door] ${preset.id} first=${JSON.stringify(first)} last=${JSON.stringify(last)} row=${JSON.stringify(rowBox)}`);
      // The first painted frame: the row's own span, on the panel's foot right over the rail.
      const firstMid = first.painted!.x + first.painted!.w / 2;
      expect(first.painted!.w, `(в) the panel is born the row's width (${first.painted!.w} vs ${rowBox.w})`).toBeLessThanOrEqual(rowBox.w + 3);
      expect(firstMid >= rowBox.x - 2 && firstMid <= rowBox.x + rowBox.w + 2, `(в) …at the row's x (${firstMid} in ${rowBox.x}…${rowBox.x + rowBox.w})`).toBe(true);
      expect(Math.abs(first.painted!.y + first.painted!.h - (first.panel!.y + first.panel!.h)), '(в) …on the panel\'s foot').toBeLessThanOrEqual(3);
      // The last: above the rail, inside the queue's space.
      expect(last.panel!.y + last.panel!.h, '(в) the panel stands above the rail').toBeLessThanOrEqual(open.rail!.y + 2);
      expect(last.panel!.y, '(в) …and inside the queue\'s space').toBeGreaterThanOrEqual(open.queuecol!.y - 2);
      expect(near(last.painted, last.panel, 2), '(в) …fully open').toBe(true);
      // The hero stands: one box, painted, in every sample; nothing of the panel over it.
      for (const s of samples) {
        expect(near(s.hero, samples[0].hero), `(в) the focused prelude kept its box at ${s.t} ms: ${JSON.stringify(s.hero)} vs ${JSON.stringify(samples[0].hero)}`).toBe(true);
        expect(s.heroAlpha, `(в) …and its paint at ${s.t} ms`).toBeGreaterThanOrEqual(0.95);
        expect(s.queueAlpha, `(в) the queue's own box never dims (${s.t} ms)`).toBeGreaterThanOrEqual(0.95);
        expect(near(s.rail, samples[0].rail), `(б) the rail stands (${s.t} ms)`).toBe(true);
      }
      const hero = last.hero!;
      const overlap = Math.min(hero.x + hero.w, last.panel!.x + last.panel!.w) - Math.max(hero.x, last.panel!.x);
      expect(overlap, '(в) the panel opens BESIDE the hero, never over it').toBeLessThanOrEqual(0);
      expect(Math.max(0, ...last.othersAlpha), '(в) the queue\'s other blocks parked').toBeLessThanOrEqual(0.2);
      expect(last.shelfAlpha, '(в) the shelf parked').toBeLessThanOrEqual(0.2);
      expect(open.rail!.h, '(б) the rail\'s height under the layer').toBeCloseTo(before.rail!.h, 0);
      expect(open.scrolls, '(е) the deployment never scrolls under the layer').toBe(false);

      // ── (д) B folds it back ──
      await armDoorProbe(page);
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-start [data-forecast-layer]').count() === 0, {tries: 3, settleMs: 900}),
        'B folds the layer').toBeTruthy();
      await settle(page);
      await shoot(page, preset, 'h-folded');
      const after = await doorRead(page);
      const back = await doorSamples(page);
      const rest = back[back.length - 1];
      expect((await crumbText(page)).toUpperCase(), '(г) the tail is gone with the layer').not.toMatch(/ЭФФЕКТЫ/);
      expect(after.focused, '(д) the focus on the same card').toBe(MARTIAN);
      expect(near(after.answer, before.answer, 1), `(д) the answer back where it was: ${JSON.stringify(after.answer)} vs ${JSON.stringify(before.answer)}`).toBe(true);
      expect(after.rows, '(д) one row again').toBe(1);
      expect(near(after.rail, before.rail, 1), '(д) the rail where it was').toBe(true);
      for (const s of back) {
        expect(near(s.hero, back[0].hero), `(д) the hero stood through the fold (${s.t} ms)`).toBe(true);
      }
      expect(Math.min(...rest.othersAlpha, 1), '(д) the queue\'s blocks back').toBeGreaterThanOrEqual(0.95);
      expect(rest.shelfAlpha, '(д) the shelf back').toBeGreaterThanOrEqual(0.95);
      const rowAlpha = await page.evaluate(() => {
        const kids = Array.from(document.querySelectorAll('[data-start-prelude-forecast] [data-forecast-row] > *'));
        return Math.min(1, ...kids.map((k) => getComputedStyle(k).visibility === 'hidden' ? 0 : parseFloat(getComputedStyle(k).opacity)));
      });
      expect(rowAlpha, '(д) the row\'s content returned').toBeGreaterThanOrEqual(0.95);
      expect(posts.length - postsBefore, '(д) the round trip sent nothing').toBe(0);
    });
  });
}
