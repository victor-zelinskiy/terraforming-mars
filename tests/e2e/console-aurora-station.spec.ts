import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, openConsole, openInfoPlayedTable, playCardFromHand, press, pressUntil, pressUntilVisible, settle,
  waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * TR27 «СТАНЦИЯ АВРОРА» — THE THIRD FLEET DOCK: THE CARD PAYS A CARD
 * (docs/TURMOIL_REDUX_WATER_HAULING.md §10). One flow from the colonies overview
 * to the board, on two profiles, with a second client watching:
 *
 *   1. The stage: «КОЛОНИИ › СТАНЦИЯ АВРОРА › ТОРГОВЛЯ», the «КУДА» row EMPTY
 *      (two Venus floater holders — a choice, never pre-chosen), «Торговать»
 *      refused, nothing sent.
 *   2. The target step one level deeper: both holders, the dock itself standing
 *      as «ЭТА КАРТА», each reading «n → n + 2»; B returns with no choice made;
 *      the choice of Floating Habs names the row, re-aims the chip, and moves no
 *      block of the stage.
 *   3. A → EXACTLY ONE POST: the destination `{fleetDock}` and the target's
 *      `{type: 'card'}` as its tail.
 *   4. The scene, by ORDER (MutationObserver + setInterval — never rAF): the
 *      receiving card stands before the first token → token 1 born inside the
 *      first printed floater icon, token 2 inside the second, the production
 *      token inside the production plate → the card's counter 1 on every sample
 *      before the first touchdown, 2 between, 3 after → the VP cell and the
 *      «ДОП. РЕСУРСЫ» satellite never ahead of it → the M€ production k until its
 *      token lands, k + 1 after → the workspace leaves. Never a token above the
 *      screen or over the command bar; no degradation named; no question after
 *      the landing. (A starved 4K compositor — 70–170 ms frames — folds births
 *      ~90 ms apart into one frame: the ORDER is asserted where the births are
 *      distinguishable, «never ahead of its own token» always.)
 *   5. The board: no workspace, nothing stranded, no `[console-overflow]`, no page
 *      error; the server agrees (Habs 1 → 3, +1 M€ production, one trade, the
 *      fleet on the station).
 *   6. One holder (Floating Habs gone): the recipient is NAMED with no step, the
 *      tokens land on the hero's own counter, its point on the second touchdown.
 *   7. The play from the hand: the city's cell is EMPTY while the workspace
 *      stands → a proxy flies → the tile stands; the cell overlaps no neighbour
 *      and no scale.
 *   8. The watcher (red, never reloaded): the trade named in its feed, the fleet
 *      on the station in blue's «РАЗЫГРАНО».
 *   9. Three docks in one tableau (fhd, 4K AND the Deck — the narrowest column):
 *      tableau order, the planet grid as large as with one dock, every status
 *      whole inside the column, every card inside it below a whole «ПРИЧАЛЫ»
 *      title, the ring ↑ / ↓ with a felt edge, ◀ back, A on the station opens its
 *      own stage.
 *
 * Fixture `aurora-station` (tests/e2e/fixtures/generate.ts). Heavy 4K: run with
 * `--workers=1`. Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const AURORA = 'Aurora Station';
const AURORA_RU = 'СТАНЦИЯ АВРОРА';
const HABS = 'Floating Habs';
const HAULING = 'Water Hauling';
const LINER = 'UNMI Liner';
const OUT = path.resolve('screenshots', 'aurora-station');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {
    color: string, energy: number, megaCreditProduction?: number, megacreditProduction: number, tradesThisGeneration: number,
    tableau: Array<{name: string, resources?: number, fleetDocked?: string}>,
    victoryPointsBreakdown: {total: number},
  },
  game: {spaces: Array<{id: string, tileType?: number, color?: string}>},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  try {
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  } catch (err) {
    if (!/ECONNRESET|socket hang up/.test(String(err))) {
      throw err;
    }
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  }
}

const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

/** The wheel's «Торговля» — the colonies workspace, verified by its own root. */
async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  await expect(colonies, 'the colonies workspace opened').toHaveCount(1, {timeout: 10_000});
  await settle(page, {timeoutMs: 15_000});
}

/** A value read until it stands still: every read behind a FORCED frame (a tiny screenshot is a BeginFrame). */
async function settled(page: Page, read: () => Promise<string>): Promise<string> {
  let last = await read();
  let equal = 0;
  for (let i = 0; i < 60 && equal < 2; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
    const now = await read();
    equal = now === last ? equal + 1 : 0;
    last = now;
  }
  return last;
}

type Rect = {l: number, t: number, r: number, b: number};

/** The boxes of every element `selector` matches whose inline background names `needle` ('' = any), settled. */
async function settledRects(page: Page, selector: string, needle = ''): Promise<Array<Rect>> {
  const raw = await settled(page, () => page.evaluate(([sel, bg]) => Array.from(document.querySelectorAll<HTMLElement>(sel))
    .filter((el) => bg === '' || el.style.backgroundImage.includes(bg))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width >= 2)
    .map((r) => [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v * 10) / 10).join(','))
    .join(' '), [selector, needle] as const));
  return raw === '' ? [] : raw.split(' ').map((one) => {
    const [l, t, r, b] = one.split(',').map(Number);
    return {l, t, r, b};
  });
}

/** The dock the cursor stands on ('' while it is in the grid). */
const focusedDock = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-colonies__dockslot--focused [data-fleet-dock]')?.getAttribute('data-fleet-dock') ?? '');

async function enterDocks(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await focusedDock(page) === ''; i++) {
    await press(page, 'ArrowRight', 350);
  }
  expect(await focusedDock(page), 'the cursor stands in the docks column').not.toBe('');
}

/** The planet tiles' scale as the grid's own fit solved it. */
const tileScale = (page: Page) => settled(page, () => page.evaluate(() => {
  const host = document.querySelector<HTMLElement>('.con-colonies');
  return host === null ? '' : host.style.getPropertyValue('--coltile-scale').trim();
}));

/** The dock faces' zoom as the column's own fit solved it (`--con-dock-zoom`). */
const dockZoom = (page: Page) => settled(page, () => page.evaluate(() =>
  document.querySelector<HTMLElement>('.con-colonies__docks')?.style.getPropertyValue('--con-dock-zoom').trim() ?? ''));

/** The docks' status lines as PAINTED: the pill against the COLUMN that clips it, the text against its own box (PL-016). */
const statusLines = (page: Page) => page.evaluate(() => {
  const col = document.querySelector('.con-colonies__docks')?.getBoundingClientRect();
  return Array.from(document.querySelectorAll<HTMLElement>('.con-fleetdock-tile__status')).map((pill) => {
    const r = pill.getBoundingClientRect();
    const text = pill.querySelector<HTMLElement>('.con-fleetdock-tile__status-text');
    return {
      text: (text?.textContent ?? '').trim(),
      insideColumn: col !== undefined && r.width > 0 && r.left >= col.left - 0.5 && r.right <= col.right + 0.5,
      whole: text !== null && text.scrollWidth <= text.clientWidth + 1,
    };
  });
});

/** The boxes of the stage's own blocks — what must stand still while the choice changes. */
const stageBlocks = (page: Page) => settled(page, () => page.evaluate(() => ['[data-fleet-dock-hero]', '[data-fleet-dock-target]', '[data-fleet-dock-result]', '.con-fleetdock__config']
  .map((sel) => {
    const r = document.querySelector(`.con-fleetdock ${sel}`)?.getBoundingClientRect();
    return r === undefined ? '-' : [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  }).join(' | ')));

type Chip = {id: string, x: number, y: number, w: number, h: number};
type Sample = {
  t: number, tick: boolean, ws: number, crumb: string, stage: boolean, scene: string, receiving: boolean,
  chips: Array<Chip>, counter: string, hero: string, vp: string, sat: string, prod: string,
  degraded: string, stranded: boolean, asked: boolean, bar: string,
};
type Probe = {samples: Array<Sample>, ticks: number, births: Array<Chip & {t: number}>};

/** MutationObserver + setInterval — never rAF. Every NEW chip is recorded at its first sighting (its birth point). */
async function armProbe(page: Page, receiving: string): Promise<void> {
  await page.evaluate((card) => {
    const w = window as unknown as {__tr27: Probe};
    const p: Probe = {samples: [], ticks: 0, births: []};
    w.__tr27 = p;
    const t0 = performance.now();
    let seq = 0;
    const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el: HTMLElement | null) => {
      if (el === null) {
        return false;
      }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };
    const sample = (tick: boolean) => {
      if (tick) {
        p.ticks++;
      }
      const now = Math.round(performance.now() - t0);
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter(shown).map((el) => {
        if (el.dataset.tr27 === undefined) {
          el.dataset.tr27 = String(seq++);
          const r = el.getBoundingClientRect();
          p.births.push({id: el.dataset.tr27, t: now, x: Math.round((r.left + r.width / 2) * 10) / 10, y: Math.round((r.top + r.height / 2) * 10) / 10, w: Math.round(r.width), h: Math.round(r.height)});
        }
        const r = el.getBoundingClientRect();
        return {id: el.dataset.tr27, x: Math.round((r.left + r.width / 2) * 10) / 10, y: Math.round((r.top + r.height / 2) * 10) / 10, w: Math.round(r.width), h: Math.round(r.height)};
      });
      const stage = document.querySelector<HTMLElement>('.con-fleetdock');
      const s: Sample = {
        t: now,
        tick,
        ws: document.querySelectorAll('.con-ws').length,
        crumb: text(document.querySelector('.con-colonies .con-wshead')).toUpperCase(),
        stage: stage !== null,
        scene: stage?.getAttribute('data-fleet-dock-scene') ?? '',
        receiving: document.querySelector('[data-fleet-dock-receiving]') !== null,
        chips,
        counter: text(document.querySelector(`[data-fleet-dock-receiving] [data-played-key="${card}"] .pcard__res`)),
        hero: text(document.querySelector('.con-fleetdock [data-fleet-dock-hero] .pcard__res')),
        vp: text(document.querySelector('.con-res .con-score__cell--vp .con-score__value')),
        sat: text(document.querySelector('.con-res-aux__cell[data-aux-resource="floater"]')),
        prod: text(document.querySelector('.con-res .con-res__row--megacredits .con-res__prod')),
        degraded: stage?.getAttribute('data-fleet-dock-degraded') ?? '',
        stranded: document.querySelector('.con-stranded') !== null,
        asked: document.querySelector('.con-ptsel') !== null && stage === null,
        bar: text(document.querySelector('.con-cmdbar__cmds--right')),
      };
      const last = p.samples[p.samples.length - 1];
      if (last === undefined || JSON.stringify({...last, t: 0, tick: false}) !== JSON.stringify({...s, t: 0, tick: false})) {
        p.samples.push(s);
      }
      if (p.samples.length > 8000) {
        p.samples.splice(0, 1000);
      }
    };
    sample(true);
    new MutationObserver(() => sample(false)).observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['class', 'style', 'data-fleet-dock-scene', 'data-fleet-dock-degraded'],
    });
    window.setInterval(() => sample(true), 30);
  }, receiving);
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr27: Probe}).__tr27);

const inside = (chip: {x: number, y: number}, rect: Rect, slack: number) =>
  chip.x >= rect.l - slack && chip.x <= rect.r + slack && chip.y >= rect.t - slack && chip.y <= rect.b + slack;

/** The first sample index at which `read` reports `value` (−1 when never). */
const firstAt = (samples: ReadonlyArray<Sample>, read: (s: Sample) => string, value: string) => samples.findIndex((s) => read(s) === value);

function trail(samples: ReadonlyArray<Sample>): string {
  return samples.slice(0, 120).map((s) =>
    `${s.t}${s.tick ? 't' : 'm'} scene=${s.scene} recv=${+s.receiving} chips=${s.chips.map((c) => `${c.id}@${c.x},${c.y}`).join('/')} card=${s.counter} hero=${s.hero} vp=${s.vp} sat=${s.sat} prod=${s.prod} ws=${s.ws} bar=«${s.bar}»${s.degraded === '' ? '' : ` DEGRADED=${s.degraded}`}`).join('\n');
}

/** Stand on the station's stage from the board: the colonies, the docks column, A. */
async function openStationStage(page: Page): Promise<void> {
  await openColonies(page);
  await enterDocks(page);
  expect(await focusedDock(page), 'the cursor stands on the station').toBe(AURORA);
  await press(page, 'Enter', 900);
  await expect(page.locator(`.con-fleetdock[data-fleet-dock-stage="${AURORA}"]`), 'A opened the station\'s stage').toHaveCount(1, {timeout: 10_000});
  await settle(page, {timeoutMs: 15_000});
  await expect.poll(() => page.locator('.con-fleetdock').getAttribute('data-fleet-dock-category'), {message: 'the reward lands on a card — the server\'s category', timeout: 10_000}).toBe('card');
}

/** The candidate the target step's cursor stands on (the self proxy reads as the dock). */
const focusedCandidate = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector('.con-fleetdock [data-ptsel-cell][data-focused="1"]');
  if (cell === null) {
    return '';
  }
  return cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
});

for (const preset of PRESETS) {
  test.describe(`TR27 Aurora Station · the card pays a card · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('two holders: the target named on the stage → one POST → two tokens onto the chosen card → the production → the board; red watches', async ({page, request, context}) => {
      test.setTimeout(600_000);
      const errors: Array<string> = [];
      const overflow: Array<string> = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      page.on('console', (msg) => {
        if (msg.text().includes('[console-overflow]')) {
          overflow.push(msg.text());
        }
      });
      const {playerId, seats} = await bootFixtureSeats(page, request, 'aurora-station', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      expect(resourcesOf(before, HABS), 'Floating Habs holds 1 floater').toBe(1);
      expect(resourcesOf(before, AURORA), 'the station holds none').toBe(0);
      const prod0 = before.thisPlayer.megacreditProduction;

      const redErrors: Array<string> = [];
      const red = await context.newPage();
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await red.evaluate(() => {
        const w = window as unknown as {__redFeed: Array<string>};
        w.__redFeed = [];
        const read = () => {
          for (const card of Array.from(document.querySelectorAll('.con-notif'))) {
            const line = (card.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (line !== '' && !w.__redFeed.includes(line)) {
              w.__redFeed.push(line);
            }
          }
        };
        new MutationObserver(read).observe(document.body, {subtree: true, childList: true, characterData: true});
        window.setInterval(read, 200);
      });
      await page.bringToFront();

      // ── 1. The stage: the «КУДА» row empty, «Торговать» refused, nothing sent.
      const posts: Array<string> = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
          posts.push(req.postData() ?? '');
        }
      });
      await openStationStage(page);
      const crumb = ((await page.locator('.con-colonies .con-wshead').textContent()) ?? '').replace(/\s+/g, ' ').toUpperCase();
      expect(crumb, `the crumb reads «КОЛОНИИ › СТАНЦИЯ АВРОРА › ТОРГОВЛЯ» — got «${crumb}»`).toMatch(/КОЛОНИИ.*СТАНЦИЯ АВРОРА.*ТОРГОВЛЯ/);
      const row = page.locator('[data-fleet-dock-target]');
      await expect(row, 'the «КУДА» row stands').toHaveCount(1);
      expect(await row.getAttribute('data-fleet-dock-target-card'), 'nothing is pre-chosen').toBe('');
      await expect(row, 'the row reads as a missing decision').toHaveClass(/con-colfocus__steprow--missing/);
      const barTrade = page.locator('.con-cmdbar .con-cmdbar__cmd', {hasText: /Торговать/i});
      await expect(barTrade, 'the bar names the trade').toHaveCount(1);
      await expect(barTrade, '«Торговать» is refused while no card is named').toHaveClass(/con-cmdbar__cmd--disabled/);
      await press(page, 'Enter', 600);
      expect(posts, 'A on the path with no target sent nothing').toEqual([]);
      await shoot(page, preset.id, '01-stage-no-target');
      const blocks0 = await stageBlocks(page);

      // ── 2. The target step: both holders, the station as «ЭТА КАРТА», each «n → n + 2»; B returns with nothing chosen.
      // ↓ walks the payment rows first (the live paths), then reaches the «КУДА» row below them.
      const rowFocused = async () => ((await row.getAttribute('class')) ?? '').includes('con-colfocus__steprow--focused');
      for (let i = 0; i < 6 && !await rowFocused(); i++) {
        await press(page, 'ArrowDown', 400);
      }
      await expect(row, 'the cursor stands on the «КУДА» row').toHaveClass(/con-colfocus__steprow--focused/);
      await pressUntilVisible(page, 'Enter', '.con-fleetdock .con-colfocus__targetstage', {tries: 3, settleMs: 900});
      await settle(page, {timeoutMs: 15_000});
      expect(((await page.locator('.con-colonies .con-wshead').textContent()) ?? '').replace(/\s+/g, ' ').toUpperCase(), 'only the tail advances').toMatch(/КОЛОНИИ.*СТАНЦИЯ АВРОРА.*ЦЕЛЬ НАГРАДЫ/);
      await expect(page.locator('.con-fleetdock [data-ptsel-cell]'), 'two candidates').toHaveCount(2);
      await expect(page.locator('.con-fleetdock [data-ptsel-self]'), 'the station stands as «ЭТА КАРТА», never a second face').toHaveCount(1);
      await expect(page.locator(`.con-fleetdock [data-zoom-slot="${HABS}"]`), 'Floating Habs as its own face').toHaveCount(1);
      await shoot(page, preset.id, '02-target-step');
      await press(page, 'Escape', 900);
      await expect(page.locator('.con-fleetdock .con-colfocus__targetstage'), 'B folds the step').toHaveCount(0, {timeout: 10_000});
      expect(await row.getAttribute('data-fleet-dock-target-card'), 'B is not a choice').toBe('');
      await pressUntilVisible(page, 'Enter', '.con-fleetdock .con-colfocus__targetstage', {tries: 3, settleMs: 900});
      await settle(page, {timeoutMs: 15_000});
      for (let i = 0; i < 4 && await focusedCandidate(page) !== HABS; i++) {
        await press(page, 'ArrowRight', 400);
      }
      expect(await focusedCandidate(page), 'the cursor stands on Floating Habs').toBe(HABS);
      await press(page, 'Enter', 900);
      await expect(page.locator('.con-fleetdock .con-colfocus__targetstage'), 'A answered the step').toHaveCount(0, {timeout: 10_000});
      await settle(page, {timeoutMs: 15_000});
      expect(await row.getAttribute('data-fleet-dock-target-card'), 'the row names the choice').toBe(HABS);
      const result = ((await page.locator('[data-fleet-dock-result]').textContent()) ?? '').replace(/\s+/g, ' ');
      expect(result, `the chip re-aimed at Habs — «${result}»`).toMatch(/1\s*→\s*3/);
      expect(await stageBlocks(page), 'no block of the stage moved with the choice').toBe(blocks0);
      expect(posts, 'nothing was sent while choosing').toEqual([]);
      await shoot(page, preset.id, '03-target-chosen');

      // ── 3–4. Back to the CHOSEN path (A on another path would select it, not trade), A → ONE POST, the scene.
      const onChosen = () => page.locator('.con-fleetdock .con-colfocus__payrow--focused.con-colfocus__payrow--chosen').count();
      for (let i = 0; i < 6 && await onChosen() === 0; i++) {
        await press(page, 'ArrowUp', 400);
      }
      expect(await onChosen(), 'the cursor stands on the chosen payment path').toBe(1);
      await expect(page.locator('.con-cmdbar .con-cmdbar__cmd', {hasText: /Торговать/i}), '«Торговать» is live once the card is named').not.toHaveClass(/con-cmdbar__cmd--disabled/);
      const icons = await settledRects(page, '.con-fleetdock [data-fleet-dock-hero] .pcard-ic', 'floater');
      const prodPlate = (await settledRects(page, '.con-fleetdock [data-fleet-dock-hero] .pcard-prod'))[0];
      const barTop = (await settledRects(page, '.con-cmdbar'))[0]?.t;
      expect(icons.length, 'the hero prints TWO floater icons').toBeGreaterThanOrEqual(2);
      expect(prodPlate, 'the production plate is measurable').toBeDefined();
      await armProbe(page, HABS);
      const stopStory = await storyboard(page, preset.id, 'trade');
      await press(page, 'Enter', 200);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), HABS), {timeout: 30_000, message: 'the server put both floaters on Habs'}).toBe(3);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000, message: 'the workspace left'}).toBe(0);
      await settle(page, {timeoutMs: 30_000});
      await stopStory();
      const probe = await readProbe(page);
      const samples = probe.samples;
      console.log(`[${preset.id}] icons=${JSON.stringify(icons)} prod=${JSON.stringify(prodPlate)} births=${JSON.stringify(probe.births)}\n${trail(samples)}`);
      expect(probe.ticks, 'the probe was alive').toBeGreaterThan(10);
      expect(posts.length, 'A sent EXACTLY ONE request').toBe(1);
      expect(posts[0], 'the destination is the station').toContain(`"fleetDock":"${AURORA}"`);
      expect(posts[0], 'and the target rides it as the tail').toContain(`{"type":"card","cards":["${HABS}"]}`);

      expect(samples.every((s) => s.degraded === ''), 'no degradation was ever named').toBe(true);
      expect(samples.some((s) => s.asked), 'no question rose after the landing').toBe(false);
      const firstReceiving = samples.findIndex((s) => s.receiving);
      const firstChip = samples.findIndex((s) => s.chips.length > 0);
      expect(firstReceiving, 'the receiving card stood on the stage').toBeGreaterThanOrEqual(0);
      expect(firstChip, 'a token left the station').toBeGreaterThan(firstReceiving);
      expect(probe.births.length, 'three tokens: two floaters, then the production').toBe(3);
      expect(inside(probe.births[0], icons[0], 2), `token 1 is born inside the FIRST printed floater — ${JSON.stringify(probe.births[0])} vs ${JSON.stringify(icons[0])}`).toBe(true);
      expect(inside(probe.births[1], icons[1], 2), `token 2 is born inside the SECOND printed floater — ${JSON.stringify(probe.births[1])} vs ${JSON.stringify(icons[1])}`).toBe(true);
      expect(inside(probe.births[2], prodPlate!, 2), `the production token is born inside the production plate — ${JSON.stringify(probe.births[2])} vs ${JSON.stringify(prodPlate)}`).toBe(true);
      // THE COUNTER: 1 → 2 → 3, each tick after its own token was born; nothing derived from it ahead of it.
      const shown = samples.filter((s) => s.counter !== '');
      expect(shown.length, 'the receiving card\'s counter was read').toBeGreaterThan(0);
      // A STARVED compositor (4K software rendering: 70–170 ms frames) can fold the two TOUCHDOWNS (~90 ms apart) into
      // ONE frame even when the births were sampled apart — the intermediate «2» then never reaches a sample. Two claims
      // hold ALWAYS: the counter never shows more floaters than tokens born so far, and it reaches 3 only after a token
      // left. The ORDER (2 before 3) is asserted whenever the intermediate value was sampled at all.
      const birthT = (k: number) => probe.births[k].t;
      const bornBy = (t: number) => probe.births.slice(0, 2).filter((b) => b.t <= t).length;
      const at2 = firstAt(samples, (s) => s.counter, '2');
      const at3 = firstAt(samples, (s) => s.counter, '3');
      expect(at3, 'the last touchdown ticks it to 3').toBeGreaterThan(firstChip);
      const ahead = samples.filter((s) => s.counter !== '' && Number(s.counter) - 1 > bornBy(s.t));
      expect(ahead.map((s) => `${s.t}: ${s.counter}`), `the card never counts a floater whose token was not yet born (births at ${birthT(0)} / ${birthT(1)} ms)`).toEqual([]);
      if (at2 >= 0) {
        expect(at3, 'the second touchdown ticks it to 3, after the first ticked it to 2').toBeGreaterThan(at2);
        expect(samples.slice(firstReceiving, at2).filter((s) => s.counter !== '').every((s) => s.counter === '1'), 'the card reads 1 on every sample before the first touchdown').toBe(true);
      }
      const vpUp = samples.findIndex((s) => s.vp === String(before.thisPlayer.victoryPointsBreakdown.total + 1));
      expect(vpUp, 'the VP cell ticked').toBeGreaterThanOrEqual(0);
      expect(vpUp, 'the VP cell (Habs 1 → 2 makes «1 / 2» pay) never ahead of the floater that brings it').toBeGreaterThanOrEqual(at2 >= 0 ? at2 : at3);
      const satNumber = (s: Sample) => Number((s.sat.match(/\d+/) ?? ['0'])[0]);
      expect(samples.filter((s) => s.counter !== '' && s.sat !== '').every((s) => satNumber(s) <= Number(s.counter)), 'the satellite never counts a floater the card has not shown landing').toBe(true);
      const prodUp = samples.findIndex((s) => s.prod.includes(String(prod0 + 1)));
      expect(prodUp, 'the M€ production ticked').toBeGreaterThanOrEqual(0);
      expect(samples[prodUp].t, 'the production never ticks before its own token was born').toBeGreaterThan(birthT(2));
      expect(prodUp, 'and comes after the floaters — the printed order').toBeGreaterThanOrEqual(at3);
      const flown = samples.flatMap((s) => s.chips);
      const highest = Math.min(...flown.map((c) => c.y - c.h / 2));
      expect.soft(highest, `the tokens stay ON SCREEN — the highest top edge reached y = ${highest}`).toBeGreaterThanOrEqual(0);
      if (barTop !== undefined) {
        expect(flown.every((c) => c.y + c.h / 2 <= barTop), 'no token flies over the command bar').toBe(true);
      }
      const scenes = [...new Set(samples.map((s) => s.scene).filter((s) => s !== ''))];
      expect(scenes, 'the card answered, the reward flew, the result was read').toEqual(expect.arrayContaining(['answer', 'reward', 'read']));
      expect(scenes, 'the reward is delivered: the card has no departure of its own').not.toContain('leave');
      // PL-018: past the press the bar is a STATUS, never the stage's verbs gone inert.
      const sceneBars = samples.filter((s) => s.stage && ['answer', 'reward', 'read'].includes(s.scene)).map((s) => s.bar);
      expect(sceneBars.filter((bar) => /Торговать|Осмотреть|Назад/.test(bar)), `the stage's verbs are gone past the press — ${[...new Set(sceneBars)].join(' ¦ ')}`).toEqual([]);
      expect(sceneBars.some((bar) => bar.includes('Выполняется')), 'the bar says «Выполняется…» while the card answers').toBe(true);
      const crumbMisses = samples.filter((s) => s.stage && !(s.crumb.includes('КОЛОНИИ') && s.crumb.includes(AURORA_RU)));
      expect(crumbMisses.length, 'the crumb held its root and the card on every stage sample').toBe(0);
      const lastStage = samples.map((s) => s.stage).lastIndexOf(true);
      expect(lastStage, 'the stage stood through the whole delivery').toBeGreaterThanOrEqual(prodUp);
      expect(samples.some((s) => s.stranded), 'nothing stranded on the way').toBe(false);

      // ── 5. The board, quiet; the server agrees.
      await waitForBoardHome(page);
      await shoot(page, preset.id, '04-board');
      const after = await wireOf(request, playerId);
      expect(resourcesOf(after, HABS), 'both floaters on Habs').toBe(3);
      expect(resourcesOf(after, AURORA), 'none on the station').toBe(0);
      expect(after.thisPlayer.megacreditProduction, '+1 M€ production').toBe(prod0 + 1);
      expect(after.thisPlayer.tradesThisGeneration, 'it was a trade').toBe(1);
      expect(after.thisPlayer.tableau.find((c) => c.name === AURORA)?.fleetDocked, 'the fleet stands on the station').toBe(blue);
      expect(await page.locator('.con-ws').count(), 'no workspace').toBe(0);
      expect(await strandedReports(page), 'no prompt was stranded').toEqual([]);
      expect(overflow, `no [console-overflow] — ${overflow.join(' | ')}`).toEqual([]);
      expect(errors, `no page error — ${errors.join(' | ')}`).toEqual([]);

      // ── 8. The watcher: red, never reloaded — told of the trade, and the fleet on the station in «РАЗЫГРАНО».
      await expect.poll(() => red.evaluate(() => (window as unknown as {__redFeed: Array<string>}).__redFeed.length), {timeout: 30_000, message: 'red was told'}).toBeGreaterThan(0);
      const redFeed = await red.evaluate(() => (window as unknown as {__redFeed: Array<string>}).__redFeed);
      expect(redFeed.some((line) => line.includes('Станция Аврора')), `red's feed named the station — it read: ${redFeed.join(' ¦ ')}`).toBe(true);
      await red.bringToFront();
      const redOnBoard = () => red.evaluate(() => {
        const board = document.querySelector<HTMLElement>('.con-board');
        return board !== null && board.offsetParent !== null;
      });
      expect(await pressUntil(red, 'Escape', redOnBoard, {tries: 4, settleMs: 1200}), 'red stands on its board').toBe(true);
      // The flank's fifth cell on the WATCHER's board, carrying blue's city (a held tile reads `--placement-cleared`).
      expect(await red.evaluate(() => {
        const tile = document.querySelector('.board-space[data_space_id="80"] [class*="board-space-tile--"]');
        return tile !== null && !tile.className.includes('board-space-tile--placement-cleared');
      }), 'red\'s board draws the flank\'s fifth cell with blue\'s city on it').toBe(true);
      await settle(red, {timeoutMs: 30_000, notifications: true});
      await press(red, 'KeyY', 1200);
      await expect(red.locator('.con-info'), 'red opened the Information workspace').toBeVisible();
      const onBlue = async () => ((await red.locator('.con-info .con-wshead').textContent()) ?? '').includes('player1');
      for (let i = 0; i < 4 && !await onBlue(); i++) {
        await press(red, 'KeyE', 900);
      }
      expect(await onBlue(), 'blue\'s seat is on stage').toBe(true);
      await openInfoPlayedTable(red);
      const focusedFamily = () => red.evaluate(() => document.querySelector('.con-played__family--focused')?.className ?? '');
      const onActive = async () => (await focusedFamily()).includes('con-played__family--active');
      expect(await walkFocusUntil(red, onActive, focusedFamily, 10, 500), `red's cursor stands on blue's ACTIVE pile — «${await focusedFamily()}»`).toBe(true);
      await pressUntilVisible(red, 'Enter', '.con-played-cat', {tries: 3, settleMs: 900});
      await settle(red, {timeoutMs: 20_000});
      await expect.poll(() => red.evaluate((name) => document.querySelector(`.con-played-cat [data-fleet-berth="card:${name}"] .colony-fleet-icon`) !== null, AURORA),
        {timeout: 20_000, message: 'the station carries blue\'s fleet on its ▲ in the watcher\'s reading of «РАЗЫГРАНО»'}).toBe(true);
      await shoot(red, preset.id, '05-watcher-played');
      expect(redErrors, `no page error on the watcher — ${redErrors.join(' | ')}`).toEqual([]);
    });

    test('one holder: the recipient named with no step; the tokens land on the station\'s OWN counter, its point on the second', async ({page, request}) => {
      test.setTimeout(300_000);
      const errors: Array<string> = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      const {playerId} = await bootFixtureSeats(page, request, 'aurora-station', {
        query: preset.query,
        arrange: (serialized) => {
          const blue = (serialized.players as Array<{playedCards: Array<{name: string}>}>)[0];
          blue.playedCards = blue.playedCards.filter((card) => card.name !== HABS);
        },
      });
      await settle(page);
      const before = await wireOf(request, playerId);
      const posts: Array<string> = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
          posts.push(req.postData() ?? '');
        }
      });
      await openStationStage(page);
      const row = page.locator('[data-fleet-dock-target]');
      expect(await row.getAttribute('data-fleet-dock-target-card'), 'the one holder is NAMED').toBe(AURORA);
      expect(((await row.textContent()) ?? '').replace(/\s+/g, ' '), 'with its own «0 → 2»').toMatch(/0\s*→\s*2/);
      await press(page, 'ArrowDown', 400);
      await expect(row, 'a statement, never a cursor stop').not.toHaveClass(/con-colfocus__steprow--focused/);
      await press(page, 'ArrowUp', 400);
      await shoot(page, preset.id, '06-one-holder-stage');
      const icons = await settledRects(page, '.con-fleetdock [data-fleet-dock-hero] .pcard-ic', 'floater');
      await armProbe(page, AURORA);
      const stopStory = await storyboard(page, preset.id, 'one-holder');
      await press(page, 'Enter', 200);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), AURORA), {timeout: 30_000, message: 'the server put both floaters on the station'}).toBe(2);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000, message: 'the workspace left'}).toBe(0);
      await settle(page, {timeoutMs: 30_000});
      await stopStory();
      const probe = await readProbe(page);
      const samples = probe.samples;
      console.log(`[${preset.id}] one holder — births=${JSON.stringify(probe.births)}\n${trail(samples)}`);
      expect(posts.length, 'ONE POST').toBe(1);
      expect(posts[0], 'nothing to answer — no card tail').not.toContain('"type":"card"');
      expect(samples.some((s) => s.receiving), 'no second copy of the station on the stage').toBe(false);
      expect(inside(probe.births[0], icons[0], 2), 'token 1 from the first printed icon').toBe(true);
      expect(inside(probe.births[1], icons[1], 2), 'token 2 from the second').toBe(true);
      const at1 = firstAt(samples, (s) => s.hero.replace(/\D/g, ''), '1');
      const at2 = firstAt(samples, (s) => s.hero.replace(/\D/g, ''), '2');
      const firstChip = samples.findIndex((s) => s.chips.length > 0);
      expect(at2, 'the hero\'s counter reached 2 on the last touchdown').toBeGreaterThan(firstChip);
      // (The two-holder case's law: never more than the tokens born so far — always; 1 before 2 whenever «1» was sampled.)
      const bornBy = (t: number) => probe.births.slice(0, 2).filter((b) => b.t <= t).length;
      const ahead = samples.filter((s) => s.hero.replace(/\D/g, '') !== '' && Number(s.hero.replace(/\D/g, '')) > bornBy(s.t));
      expect(ahead.map((s) => `${s.t}: ${s.hero}`), 'the hero never counts a floater whose token was not yet born').toEqual([]);
      if (at1 >= 0) {
        expect(at2, 'the counter reached 2 after it read 1').toBeGreaterThan(at1);
      }
      const vpUp = samples.findIndex((s) => s.vp === String(before.thisPlayer.victoryPointsBreakdown.total + 1));
      expect(vpUp, 'the station\'s point (0 → 2 floaters, «1 / 2») ticks on the SECOND touchdown, never before').toBeGreaterThanOrEqual(at2);
      expect(samples.every((s) => s.degraded === ''), 'no degradation').toBe(true);
      await waitForBoardHome(page);
      expect(errors, `no page error — ${errors.join(' | ')}`).toEqual([]);
    });

    test('the play from the hand: the cell stays EMPTY while the workspace stands, then a proxy lands the city on the flank', async ({page, request}) => {
      test.setTimeout(300_000);
      const errors: Array<string> = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      const {playerId} = await bootFixtureSeats(page, request, 'aurora-station', {
        query: preset.query,
        arrange: (serialized) => {
          const blue = (serialized.players as Array<{playedCards: Array<{name: string}>, cardsInHand: Array<string>, megaCredits: number}>)[0];
          blue.playedCards = blue.playedCards.filter((card) => card.name !== AURORA);
          blue.cardsInHand = [...blue.cardsInHand, AURORA];
          blue.megaCredits = 14;
          const board = (serialized as unknown as {board: {spaces: Array<{id: string, tile?: unknown, player?: string}>}}).board;
          const cell = board.spaces.find((space) => space.id === '80')!;
          delete cell.tile;
          delete cell.player;
        },
      });
      await settle(page);
      const cellRect = async () => (await settledRects(page, '.board-space[data_space_id="80"]'))[0];
      const neighbours = await page.evaluate(() => ['70', '71', '72', '73'].map((id) => {
        const r = document.querySelector(`.board-space[data_space_id="${id}"]`)?.getBoundingClientRect();
        return r === undefined ? undefined : {l: r.left, t: r.top, r: r.right, b: r.bottom};
      }));
      const cell0 = await cellRect();
      expect(cell0, 'the board draws the fifth cell of the Venus flank').toBeDefined();
      const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
      for (const n of neighbours) {
        if (n !== undefined) {
          expect(overlap(cell0!, n) / ((cell0!.r - cell0!.l) * (cell0!.b - cell0!.t)), 'the cell overlaps no Venus city').toBeLessThan(0.05);
        }
      }
      // The cell is EMPTY on every sample while a workspace stands; the tile appears only once it has left.
      await page.evaluate(() => {
        // The tile is the cell's child with a TYPE suffix; a HELD tile keeps reading as empty (`--placement-cleared`).
        const w = window as unknown as {__cell: Array<{ws: number, tile: boolean, proxy: boolean}>};
        w.__cell = [];
        const read = () => {
          const tile = document.querySelector('.board-space[data_space_id="80"] [class*="board-space-tile--"]');
          w.__cell.push({
            ws: document.querySelectorAll('.con-ws').length,
            tile: tile !== null && !tile.className.includes('board-space-tile--placement-cleared'),
            proxy: document.querySelector('.con-tileplace__tile--remote') !== null,
          });
        };
        new MutationObserver(read).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
        window.setInterval(read, 30);
      });
      expect(await playCardFromHand(page, AURORA), 'the station was played').toBe(true);
      await expect.poll(async () => (await wireOf(request, playerId)).game.spaces.find((s) => s.id === '80')?.tileType !== undefined, {timeout: 30_000, message: 'the server placed the city'}).toBe(true);
      await waitForBoardHome(page);
      await settle(page, {timeoutMs: 30_000});
      const cellSamples = await page.evaluate(() => (window as unknown as {__cell: Array<{ws: number, tile: boolean, proxy: boolean}>}).__cell);
      expect(cellSamples.length, 'the cell was sampled').toBeGreaterThan(5);
      const underWorkspace = cellSamples.filter((s) => s.ws > 0 && s.tile).length;
      expect(underWorkspace, `the cell reads EMPTY while a workspace stands — ${underWorkspace} of ${cellSamples.length} samples`).toBe(0);
      expect(cellSamples.some((s) => s.proxy && s.ws === 0), 'the city FLEW onto the flank over a board the player can see').toBe(true);
      expect(cellSamples[cellSamples.length - 1].tile, 'and the city stands at the end').toBe(true);
      await shoot(page, preset.id, '07-city-on-the-flank');
      expect(errors, `no page error — ${errors.join(' | ')}`).toEqual([]);
    });
  });
}

// THREE DOCKS — the column's fit on all three profiles (the Deck's column is the narrowest: 7rem).
for (const preset of [...PRESETS, {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'}] as const) {
  test.describe(`TR27 Aurora Station · three docks · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('three docks in one tableau: the grid as large as with one, every status whole in its column, the ring, the station\'s own stage', async ({page, request}) => {
      test.setTimeout(300_000);
      const errors: Array<string> = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      // The control: the fixture as it is — ONE dock.
      await bootFixtureSeats(page, request, 'aurora-station', {query: preset.query});
      await settle(page);
      await openColonies(page);
      await expect(page.locator('.con-colonies__docks [data-fleet-dock]'), 'the control holds ONE dock').toHaveCount(1);
      const scaleOne = await tileScale(page);
      expect(Number(scaleOne), `the control's grid has a scale — got «${scaleOne}»`).toBeGreaterThan(0.3);
      const zoomOne = await dockZoom(page);

      // The table: the two sisters beside the station (serialized with their own `data`, as a save carries them).
      await bootFixtureSeats(page, request, 'aurora-station', {
        query: preset.query,
        arrange: (serialized) => {
          const blue = (serialized.players as Array<{playedCards: Array<{name: string, resourceCount?: number, data?: unknown}>}>)[0];
          blue.playedCards.push({name: HAULING, resourceCount: 0, data: {dockedGeneration: -1}});
          blue.playedCards.push({name: LINER, resourceCount: 0, data: {dockedGeneration: -1}});
        },
      });
      await settle(page);
      await openColonies(page);
      const docks = page.locator('.con-colonies__docks [data-fleet-dock]');
      await expect(docks, 'the column holds THREE docks').toHaveCount(3);
      expect(await docks.evaluateAll((els) => els.map((el) => el.getAttribute('data-fleet-dock'))), 'in tableau order').toEqual([AURORA, HAULING, LINER]);
      expect(await page.locator('[data-fleet-dock-status="free"]').count(), 'all three are free').toBe(3);
      const scaleThree = await tileScale(page);
      console.log(`[${preset.id}] --coltile-scale: one dock ${scaleOne} · three docks ${scaleThree}`);
      expect(scaleThree, 'the docks take NOTHING more from the planet grid (the column is a width token)').toBe(scaleOne);
      const lines = await statusLines(page);
      expect(lines, 'each status line reads whole, inside its column').toEqual([0, 1, 2].map(() => ({text: 'Причал свободен', insideColumn: true, whole: true})));
      const cards = await settledRects(page, '.con-colonies__docks [data-fleet-dock]');
      const column = (await settledRects(page, '.con-colonies__docks'))[0];
      expect(cards.length, 'three measurable dock cards').toBe(3);
      // The column's title stands whole above them (an overfull column once shrank it to 0 px and the fit took that
      // as its room), and the first card starts below it.
      const title = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.con-colonies__docks-title');
        const r = el?.getBoundingClientRect();
        return {h: Math.round(r?.height ?? 0), b: Math.round(r?.bottom ?? 0), whole: el !== null && el.scrollHeight <= el.clientHeight + 1, text: (el?.textContent ?? '').trim()};
      });
      expect(title.text, 'the column is titled').toBe('Причалы');
      expect(title.h, `the title has its height — ${JSON.stringify(title)}`).toBeGreaterThan(8);
      expect(title.whole, 'the title is not cut').toBe(true);
      expect(cards[0].t, 'the first dock stands below the title').toBeGreaterThanOrEqual(title.b - 0.5);
      for (let i = 0; i < cards.length; i++) {
        expect(cards[i].t >= column.t - 0.5 && cards[i].b <= column.b + 0.5, `dock ${i + 1} stands inside the column — ${JSON.stringify(cards[i])} vs ${JSON.stringify(column)}`).toBe(true);
        if (i > 0) {
          expect(cards[i].t, `dock ${i + 1} does not overlap dock ${i}`).toBeGreaterThanOrEqual(cards[i - 1].b - 0.5);
        }
      }
      await shoot(page, preset.id, '08-overview-three-docks');

      // The ring: ▶ enters, ↓ walks all three with a felt edge, ◀ returns to the tile it left.
      await enterDocks(page);
      const entered = await focusedDock(page);
      expect([AURORA, HAULING, LINER], 'the cursor entered the column').toContain(entered);
      for (let i = 0; i < 3; i++) {
        await press(page, 'ArrowUp', 350);
      }
      expect(await focusedDock(page), '↑ stops at the top').toBe(AURORA);
      await press(page, 'ArrowDown', 350);
      expect(await focusedDock(page), '↓ the second').toBe(HAULING);
      await press(page, 'ArrowDown', 350);
      expect(await focusedDock(page), '↓ the third').toBe(LINER);
      await press(page, 'ArrowDown', 350);
      expect(await focusedDock(page), '…and the edge is felt (no wrap)').toBe(LINER);
      await press(page, 'ArrowLeft', 350);
      expect(await focusedDock(page), '◀ leaves the column').toBe('');
      await press(page, 'ArrowRight', 350);
      for (let i = 0; i < 3 && await focusedDock(page) !== AURORA; i++) {
        await press(page, 'ArrowUp', 350);
      }
      expect(await focusedDock(page), 'back on the station').toBe(AURORA);

      // A on the station opens ITS stage, and the reward is still read off the server: a card.
      await press(page, 'Enter', 900);
      await expect(page.locator(`.con-fleetdock[data-fleet-dock-stage="${AURORA}"]`), 'A opened the station\'s stage').toHaveCount(1, {timeout: 10_000});
      await settle(page, {timeoutMs: 15_000});
      await expect.poll(() => page.locator('.con-fleetdock').getAttribute('data-fleet-dock-category'), {timeout: 10_000, message: 'the category'}).toBe('card');
      await expect(page.locator('[data-fleet-dock-target]'), 'its «КУДА» row').toHaveCount(1);
      await shoot(page, preset.id, '09-station-stage-among-three');

      // ALL THREE TAKEN (B6's last cell of the matrix): every status reads its short form whole inside the column, the
      // face's zoom is the same as when they were free (a status never re-fits the column).
      const zoomThreeFree = await dockZoom(page);
      await bootFixtureSeats(page, request, 'aurora-station', {
        query: preset.query,
        arrange: (serialized) => {
          const generation = (serialized as unknown as {generation: number}).generation;
          const blue = (serialized.players as Array<{playedCards: Array<{name: string, resourceCount?: number, data?: {dockedGeneration: number}}>}>)[0];
          blue.playedCards.push({name: HAULING, resourceCount: 0, data: {dockedGeneration: generation}});
          blue.playedCards.push({name: LINER, resourceCount: 0, data: {dockedGeneration: generation}});
          const station = blue.playedCards.find((card) => card.name === AURORA)!;
          station.data = {dockedGeneration: generation};
        },
      });
      await settle(page);
      await openColonies(page);
      await expect(page.locator('[data-fleet-dock-status="docked"]'), 'all three are taken').toHaveCount(3);
      expect(await statusLines(page), 'each taken status reads its short form whole, inside its column')
        .toEqual([0, 1, 2].map(() => ({text: 'Флот на карте', insideColumn: true, whole: true})));
      const zoomThreeTaken = await dockZoom(page);
      console.log(`[${preset.id}] dock face zoom: one ${zoomOne} · three free ${zoomThreeFree} · three taken ${zoomThreeTaken}`);
      expect(zoomThreeTaken, 'a status never re-fits the column').toBe(zoomThreeFree);
      await shoot(page, preset.id, '10-overview-three-docks-taken');
      expect(errors, `no page error — ${errors.join(' | ')}`).toEqual([]);
    });
  });
}
