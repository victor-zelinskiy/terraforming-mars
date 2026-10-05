import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, openConsole, openInfoPlayedTable, placeTile, press, pressUntil, pressUntilVisible, settle, waitForBoardHome,
  walkFocusUntil,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * TR26 «ЛАЙНЕР UNMI» — THE SECOND FLEET DOCK: THE REWARD LANDS ON THE RAIL
 * (docs/TURMOIL_REDUX_WATER_HAULING.md §9). One flow from the colonies overview
 * to the board, on two profiles, with TWO docks in one tableau and a second
 * client watching:
 *
 *   1. The overview: the «ПРИЧАЛЫ» column holds TWO tiles, both free, and costs
 *      the planet grid nothing a single dock did not (the tiles' scale equals a
 *      control load of the same table with one dock); ▶ enters the column at the
 *      row's height, ↓ / ↑ walk it with a felt edge, ◀ returns to the very tile.
 *   2. The liner's stage: «КОЛОНИИ › ЛАЙНЕР UNMI › ТОРГОВЛЯ», the server's chips
 *      (the rating N → N+1, the fleets 3 → 2), the table's answer named BEFORE
 *      the press (the ruling Greens' «+2»), no «after confirming» line — and no
 *      request reaches the server before A.
 *   3. A → EXACTLY ONE POST; its destination answers `{fleetDock: 'UNMI Liner'}`.
 *   4. The scene, by ORDER (a probe of MutationObserver + setInterval — never
 *      rAF): the fleet lands on the card's ▲ → the card answers → a token is
 *      born INSIDE the printed TR icon → the rail's rating reads N on every
 *      sample until the token is at the rating's cell → N + 1 → the Greens' M€
 *      no earlier than that sample → the workspace leaves. No degradation was
 *      ever named; never two tokens; the card had no departure beat of its own.
 *   5. The board: no workspace, nothing stranded, no `[console-overflow]`, no
 *      page error. The server agrees: +1 TR, one trade, the liner docked.
 *   6. The colonies again: the liner reads «флот на карте» with the ship in its
 *      owner's livery, «Перевозка воды» is still free → a trade with it → its
 *      ocean's placement stands over a CLEAN board (TR06 on the generalized
 *      scene) → the ocean is placed.
 *   7. The watcher (red, never reloaded): the trade is NAMED to it (a notification
 *      that says where the fleet went), and blue's two docks carry their fleets
 *      in blue's «РАЗЫГРАНО» as red reads it.
 *
 * Fixture `unmi-liner` (tests/e2e/fixtures/generate.ts). Heavy 4K: run with
 * `--workers=1` (two 4K workers starve the headless compositor).
 */

const LINER = 'UNMI Liner';
const LINER_RU = 'ЛАЙНЕР UNMI';
const HAULING = 'Water Hauling';
const OUT = path.resolve('screenshots', 'unmi-liner');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  waitingFor?: {type: string},
  thisPlayer: {
    color: string, energy: number, megacredits: number, terraformRating: number, tradesThisGeneration: number,
    tableau: Array<{name: string, fleetDocked?: string}>,
  },
  players: Array<{color: string, tableau: Array<{name: string, fleetDocked?: string}>}>,
  game: {oceans: number, colonies: Array<{name: string, visitor?: string}>},
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

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

/**
 * A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor actually produced, by CDP
 * screencast, named by its time — the acceptance's eyes on a flight a settled screenshot cannot show.
 */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true}); // a storyboard is ONE run's frames
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

/** A value read until it stands still: every read behind a FORCED frame (a tiny screenshot is a BeginFrame), three equal reads end the wait. */
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

/** The planet tiles' scale as the grid's own fit solved it. */
const tileScale = (page: Page) => settled(page, () => page.evaluate(() => {
  const host = document.querySelector<HTMLElement>('.con-colonies');
  return host === null ? '' : host.style.getPropertyValue('--coltile-scale').trim();
}));

/**
 * The docks' status lines as they are PAINTED: the pill against the COLUMN that clips it, and the text against its
 * own box. Both are needed — a line longer than the column once widened its own tile, so the text «fitted» its box
 * (306 / 306) while the column cut the sentence at both ends («арте · вернётся в следующ», PL-016).
 */
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

/** The planet tiles' boxes, settled. */
const tileRects = (page: Page) => settled(page, () => page.evaluate(() => Array.from(document.querySelectorAll('.con-colonies__slot')).map((el) => {
  const r = el.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height].map(Math.round).join(',');
}).join(' ')));

type Rect = {l: number, t: number, r: number, b: number};

/** An element's box, settled; `pick` runs in the page and returns the element (or null). */
async function settledRect(page: Page, selector: string, needle = ''): Promise<Rect | undefined> {
  const raw = await settled(page, () => page.evaluate(([sel, bg]) => {
    const el = Array.from(document.querySelectorAll<HTMLElement>(sel)).find((node) => bg === '' || node.style.backgroundImage.includes(bg));
    const r = el?.getBoundingClientRect();
    return r === undefined || r.width < 2 ? '' : [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v * 10) / 10).join(',');
  }, [selector, needle] as const));
  if (raw === '') {
    return undefined;
  }
  const [l, t, r, b] = raw.split(',').map(Number);
  return {l, t, r, b};
}

/** The dock the cursor stands on ('' while it is in the grid). */
const focusedDock = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-colonies__dockslot--focused [data-fleet-dock]')?.getAttribute('data-fleet-dock') ?? '');
/** The planet tile the cursor stands on ('' while it is in the column). */
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-colonies__slot--focused [data-test^="con-colony-"], .con-coltile--focused[data-test^="con-colony-"]')?.getAttribute('data-test') ?? '');

/** Walk ▶ into the docks column — one press at a time, each verified by the cursor itself. */
async function enterDocks(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await focusedDock(page) === ''; i++) {
    await press(page, 'ArrowRight', 350);
  }
  expect(await focusedDock(page), 'the cursor stands in the docks column').not.toBe('');
}

/** Stand the cursor on ONE dock: enter the column, then ↑ / ↓ until its card is the focused one. */
async function focusDock(page: Page, card: string): Promise<void> {
  await enterDocks(page);
  for (let i = 0; i < 4 && await focusedDock(page) !== card; i++) {
    await press(page, 'ArrowDown', 350);
  }
  for (let i = 0; i < 4 && await focusedDock(page) !== card; i++) {
    await press(page, 'ArrowUp', 350);
  }
  expect(await focusedDock(page), `the cursor stands on «${card}»`).toBe(card);
}

type Chip = {x: number, y: number, w: number, h: number};
type Sample = {
  t: number, tick: boolean, ws: number, crumb: string, stage: boolean, scene: string, category: string, leaving: boolean,
  ship: boolean, mark: boolean, chip: Chip | undefined, chips: number,
  rating: string, mc: string, energy: string, degraded: string, placing: boolean, stranded: boolean, bar: string,
};
type Probe = {samples: Array<Sample>, ticks: number};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page, card: string): Promise<void> {
  await page.evaluate((dock) => {
    const w = window as unknown as {__tr26: Probe};
    const p: Probe = {samples: [], ticks: 0};
    w.__tr26 = p;
    const t0 = performance.now();
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
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter(shown);
      const cr = chips[0]?.getBoundingClientRect();
      const stage = document.querySelector<HTMLElement>('.con-fleetdock');
      const s: Sample = {
        t: Math.round(performance.now() - t0),
        tick,
        ws: document.querySelectorAll('.con-ws').length,
        crumb: text(document.querySelector('.con-colonies .con-wshead')).toUpperCase(),
        stage: stage !== null,
        scene: stage?.getAttribute('data-fleet-dock-scene') ?? '',
        category: stage?.getAttribute('data-fleet-dock-category') ?? '',
        leaving: stage?.classList.contains('con-fleetdock--leaving') ?? false,
        ship: shown(document.querySelector<HTMLElement>('.con-fleet-ship')),
        mark: document.querySelector(`.con-fleetdock [data-fleet-berth="card:${dock}"] .colony-fleet-icon`) !== null,
        chip: cr === undefined ? undefined : {x: Math.round((cr.left + cr.width / 2) * 10) / 10, y: Math.round((cr.top + cr.height / 2) * 10) / 10, w: Math.round(cr.width), h: Math.round(cr.height)},
        chips: chips.length,
        rating: text(document.querySelector('.con-res .con-score__value--tr')),
        mc: text(document.querySelector('.con-res .con-res__row--megacredits .con-res__digits')),
        energy: text(document.querySelector('.con-res .con-res__row--energy .con-res__digits')),
        degraded: stage?.getAttribute('data-fleet-dock-degraded') ?? '',
        placing: document.querySelector('.con-board--placing') !== null,
        stranded: document.querySelector('.con-stranded') !== null,
        bar: text(document.querySelector('.con-cmdbar')),
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
  }, card);
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr26: Probe}).__tr26);

const inside = (chip: Chip, rect: Rect, slack: number) =>
  chip.x >= rect.l - slack && chip.x <= rect.r + slack && chip.y >= rect.t - slack && chip.y <= rect.b + slack;

function trail(samples: ReadonlyArray<Sample>): string {
  return samples.slice(0, 90).map((s) =>
    `${s.t}${s.tick ? 't' : 'm'} scene=${s.scene} ship=${+s.ship} mark=${+s.mark} chip=${s.chip === undefined ? '-' : `${s.chip.x},${s.chip.y}`} tr=${s.rating} mc=${s.mc} en=${s.energy} ws=${s.ws}${s.degraded === '' ? '' : ` DEGRADED=${s.degraded}`}`).join('\n');
}

for (const preset of PRESETS) {
  test.describe(`TR26 UNMI Liner · the reward lands on the rail · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('two docks → the liner\'s stage → one POST → the fleet lands → the TR flies to the rail → the board → the other dock → the ocean; red watches', async ({page, request, context}) => {
      test.setTimeout(600_000);
      const errors: Array<string> = [];
      const overflow: Array<string> = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      page.on('console', (msg) => {
        if (msg.text().includes('[console-overflow]')) {
          overflow.push(msg.text());
        }
      });

      // ── 0. The control: the SAME table with ONE dock — what the planet grid's scale is when the column holds one tile.
      await bootFixtureSeats(page, request, 'unmi-liner', {
        query: preset.query,
        arrange: (serialized) => {
          const blue = (serialized.players as Array<{playedCards: Array<{name: string}>}>)[0];
          blue.playedCards = blue.playedCards.filter((card) => card.name !== HAULING);
        },
      });
      await settle(page);
      await openColonies(page);
      await expect(page.locator('.con-colonies__docks [data-fleet-dock]'), 'the control holds ONE dock').toHaveCount(1);
      const scaleOne = await tileScale(page);
      expect(Number(scaleOne), `the control's grid has a scale — got «${scaleOne}»`).toBeGreaterThan(0.3);

      // ── The table itself: both docks; red opens beside it and is never reloaded.
      const {playerId, seats} = await bootFixtureSeats(page, request, 'unmi-liner', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      const N = before.thisPlayer.terraformRating;
      expect(before.thisPlayer.energy, 'the fixture holds 9 energy (three fees)').toBe(9);
      expect(before.thisPlayer.megacredits, 'the fixture holds 20 M€').toBe(20);

      const redErrors: Array<string> = [];
      const red = await context.newPage();
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      // What red's notification feed SAYS while blue plays — collected in the page (a card lives a few seconds).
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

      // ── 1. The overview: two docks, both free; the grid as large as with one; the cursor's ring.
      await openColonies(page);
      await expect(page.locator('.con-colonies__docks [data-fleet-dock]'), 'the column holds TWO docks').toHaveCount(2);
      expect(await page.locator('.con-colonies__docks [data-fleet-dock]').evaluateAll((els) => els.map((el) => el.getAttribute('data-fleet-dock'))),
        'in tableau order').toEqual([LINER, HAULING]);
      expect(await page.locator('[data-fleet-dock-status="free"]').count(), 'both docks are free').toBe(2);
      const scaleTwo = await tileScale(page);
      expect(scaleTwo, 'the second dock takes NOTHING from the planet grid (the column is a width token)').toBe(scaleOne);
      console.log(`[${preset.id}] --coltile-scale: one dock ${scaleOne} · two docks ${scaleTwo}`);
      expect(await statusLines(page), 'each status line reads whole, inside its column').toEqual([
        {text: 'Причал свободен', insideColumn: true, whole: true},
        {text: 'Причал свободен', insideColumn: true, whole: true},
      ]);
      const grid0 = await tileRects(page);
      await enterDocks(page);
      expect(await focusedDock(page), '▶ from the first row enters the column at that row\'s height').toBe(LINER);
      expect(await tileRects(page), 'walking into the column moves no planet tile').toEqual(grid0);
      await press(page, 'ArrowLeft', 350);
      expect(await focusedDock(page), '◀ leaves the column').toBe('');
      const edgeTile = await focusedTile(page);
      expect(edgeTile, 'the cursor is back on a planet tile — the row\'s last').not.toBe('');
      await press(page, 'ArrowRight', 350);
      expect(await focusedDock(page), '▶ from that tile enters the column again').toBe(LINER);
      await press(page, 'ArrowDown', 350);
      expect(await focusedDock(page), '↓ walks to the second dock').toBe(HAULING);
      await press(page, 'ArrowDown', 350);
      expect(await focusedDock(page), '…and the edge is felt (no wrap)').toBe(HAULING);
      await press(page, 'ArrowLeft', 350);
      expect(await focusedTile(page), '◀ returns to the very tile the cursor left, whichever dock it walked to').toBe(edgeTile);
      await press(page, 'ArrowRight', 350);
      await press(page, 'ArrowUp', 350);
      await press(page, 'ArrowUp', 350);
      expect(await focusedDock(page), '↑ walks back and stops at the top').toBe(LINER);
      await focusDock(page, LINER);
      await shoot(page, preset.id, '01-overview-two-docks');

      // ── 2. The liner's stage.
      const posts: Array<{url: string, body: string}> = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
          posts.push({url: req.url(), body: req.postData() ?? ''});
        }
      });
      await press(page, 'Enter', 900);
      await expect(page.locator('.con-fleetdock'), 'A opened the dock\'s stage').toHaveCount(1, {timeout: 10_000});
      await settle(page, {timeoutMs: 15_000});
      await expect(page.locator(`.con-fleetdock[data-fleet-dock-stage="${LINER}"]`), 'it is the liner\'s').toHaveCount(1);
      expect(await page.locator('.con-ws').count(), 'one workspace — the stage is inside it').toBe(1);
      const crumb = ((await page.locator('.con-colonies .con-wshead').textContent()) ?? '').replace(/\s+/g, ' ').toUpperCase();
      expect(crumb, `the crumb reads «КОЛОНИИ › ЛАЙНЕР UNMI › ТОРГОВЛЯ» — got «${crumb}»`).toMatch(/КОЛОНИИ.*ЛАЙНЕР UNMI.*ТОРГОВЛЯ/);
      await expect.poll(() => page.locator('.con-fleetdock').getAttribute('data-fleet-dock-category'), {message: 'the reward\'s category is read off the server\'s preview', timeout: 10_000}).toBe('rail');
      const result = ((await page.locator('[data-fleet-dock-result]').textContent()) ?? '').replace(/\s+/g, ' ');
      expect(result, `the result reads the rating — got «${result}»`).toMatch(new RegExp(`${N}\\s*→\\s*${N + 1}`));
      expect(result, 'and the fleets').toMatch(/3\s*→\s*2/);
      await expect(page.locator('[data-fleet-dock-result] [data-forecast-vfx]'), 'the table\'s answer is named before the press').toHaveCount(1);
      expect(((await page.locator('[data-fleet-dock-result] [data-forecast-vfx]').textContent()) ?? '').replace(/\s+/g, ' '), 'the Greens\' 2 M€').toMatch(/\+\s*2/);
      await expect(page.locator('[data-fleet-dock-note]'), 'the reward raises nothing after the confirm — no line').toHaveCount(0);
      expect(posts, 'nothing reached the server before A').toEqual([]);
      const trIcon = await settledRect(page, '.con-fleetdock [data-fleet-dock-hero] .pcard-ic', 'tr.');
      const ratingCell = await settledRect(page, '.con-res .con-score__cell--tr .con-score__valwrap');
      const barTop = (await settledRect(page, '.con-cmdbar'))?.t;
      expect(trIcon, 'the printed TR icon of the hero face is measurable').toBeDefined();
      expect(ratingCell, 'the rail\'s rating cell is measurable').toBeDefined();
      await shoot(page, preset.id, '02-liner-stage');

      // ── 3–5. A → one POST, the flight, the card's answer, the token, the rail, the workspace leaves.
      await armProbe(page, LINER);
      const stopLinerStory = await storyboard(page, preset.id, 'liner');
      await press(page, 'Enter', 200);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.terraformRating, {timeout: 30_000, message: 'the server paid the TR'}).toBe(N + 1);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 45_000, message: 'the workspace left'}).toBe(0);
      await settle(page, {timeoutMs: 30_000});
      await stopLinerStory();
      const probe = await readProbe(page);
      const samples = probe.samples;
      console.log(`[${preset.id}] N=${N} trIcon=${JSON.stringify(trIcon)} rating=${JSON.stringify(ratingCell)}\n${trail(samples)}`);
      expect(probe.ticks, 'the probe was alive').toBeGreaterThan(10);
      expect(posts.length, 'A sent EXACTLY ONE request').toBe(1);
      expect(posts[0].body, 'the destination is the card').toContain(`"fleetDock":"${LINER}"`);
      expect(posts[0].body, 'no colony is named').not.toContain('colonyName');

      const firstMark = samples.findIndex((s) => s.mark);
      const firstAnswer = samples.findIndex((s) => s.scene === 'answer');
      const firstChip = samples.findIndex((s) => s.chip !== undefined);
      const firstUp = samples.findIndex((s) => s.rating === String(N + 1));
      const mc0 = samples[0].mc;
      const firstMc = samples.findIndex((s) => s.mc !== mc0);
      const energy0 = samples[0].energy;
      const firstEnergy = samples.findIndex((s) => s.energy !== energy0);
      expect(samples.every((s) => s.degraded === ''), 'no degradation was ever named').toBe(true);
      expect(firstMark, 'the fleet stands on the card\'s ▲').toBeGreaterThanOrEqual(0);
      expect(firstEnergy, 'the fee ticked on the rail').toBeGreaterThanOrEqual(0);
      expect(firstAnswer, 'the card answered').toBeGreaterThanOrEqual(firstMark);
      expect(firstChip, 'a token left the card').toBeGreaterThan(firstAnswer);
      expect(inside(samples[firstChip].chip!, trIcon!, 2), `the token is BORN inside the printed TR icon — ${JSON.stringify(samples[firstChip].chip)} vs ${JSON.stringify(trIcon)}`).toBe(true);
      expect(firstUp, 'the rail\'s rating ticked').toBeGreaterThan(firstChip);
      expect(samples.slice(0, firstUp).every((s) => s.rating === String(N)), 'every sample before the touchdown reads N — the number never moves without its cause').toBe(true);
      expect(samples.slice(firstUp).every((s) => s.rating === String(N + 1)), 'and N + 1 ever after').toBe(true);
      // The touchdown: the last place the token was seen before the tick is the rating's own cell.
      const lastFlown = [...samples.slice(0, firstUp + 1)].reverse().find((s) => s.chip !== undefined)!.chip!;
      expect(inside(lastFlown, ratingCell!, Math.max(lastFlown.w, lastFlown.h)), `the tick is the token's TOUCHDOWN on the rating's cell — ${JSON.stringify(lastFlown)} vs ${JSON.stringify(ratingCell)}`).toBe(true);
      expect(Math.hypot(lastFlown.x - samples[firstChip].chip!.x, lastFlown.y - samples[firstChip].chip!.y), 'it travelled').toBeGreaterThan(80);
      expect(firstMc, 'the Greens paid').toBeGreaterThanOrEqual(0);
      expect(firstMc, 'the table\'s answer never ticks before its cause').toBeGreaterThanOrEqual(firstUp);
      expect(samples.every((s) => s.chips <= 1), 'never two tokens in one frame').toBe(true);
      if (barTop !== undefined) {
        expect(samples.filter((s) => s.chip !== undefined).every((s) => s.chip!.y + s.chip!.h / 2 <= barTop), 'the token never flies over the command bar').toBe(true);
      }
      const highest = Math.min(...samples.filter((s) => s.chip !== undefined).map((s) => s.chip!.y - s.chip!.h / 2));
      expect.soft(highest, `the token stays ON SCREEN for its whole flight — its top edge reached y = ${highest}`).toBeGreaterThanOrEqual(0);
      const scenes = [...new Set(samples.map((s) => s.scene).filter((s) => s !== ''))];
      expect(scenes, 'the card answered, the reward flew, the result was read').toEqual(expect.arrayContaining(['answer', 'reward', 'read']));
      expect(scenes, 'a reward on the rail leaves nothing to make room for: the card has no departure of its own').not.toContain('leave');
      expect(samples.some((s) => s.leaving), 'the card went WITH the workspace').toBe(false);
      const crumbMisses = samples.filter((s) => s.stage && !(s.crumb.includes('КОЛОНИИ') && s.crumb.includes(LINER_RU)));
      expect(crumbMisses.length, 'the crumb held its root and the card on every stage sample').toBe(0);
      const lastStage = samples.map((s) => s.stage).lastIndexOf(true);
      expect(lastStage, 'the stage stood through the token\'s whole flight').toBeGreaterThanOrEqual(firstUp);
      expect(samples.some((s) => s.placing), 'no board placement was ever raised').toBe(false);

      await waitForBoardHome(page);
      await shoot(page, preset.id, '03-board');
      const after = await wireOf(request, playerId);
      const redFeed = await (async () => {
        await expect.poll(() => red.evaluate(() => (window as unknown as {__redFeed: Array<string>}).__redFeed.length), {timeout: 30_000, message: 'red was told'}).toBeGreaterThan(0);
        return red.evaluate(() => (window as unknown as {__redFeed: Array<string>}).__redFeed);
      })();
      expect(after.thisPlayer.terraformRating, '+1 TR').toBe(N + 1);
      expect(after.thisPlayer.megacredits, 'the Greens\' 2 M€').toBe(22);
      expect(after.thisPlayer.energy, 'the energy path\'s fee').toBe(6);
      expect(after.thisPlayer.tradesThisGeneration, 'it was a trade').toBe(1);
      expect(after.thisPlayer.tableau.find((c) => c.name === LINER)?.fleetDocked, 'the fleet stands on the liner').toBe(blue);
      expect(after.thisPlayer.tableau.find((c) => c.name === HAULING)?.fleetDocked, 'the other dock is untouched').toBeUndefined();
      expect(after.game.colonies.filter((c) => c.visitor === blue), 'no colony was visited').toEqual([]);
      expect(await page.locator('.con-ws').count(), 'no workspace').toBe(0);
      expect(samples.some((s) => s.stranded), 'nothing stranded on the way').toBe(false);

      // ── 6. The colonies again: the liner holds its fleet, «Перевозка воды» is free — and plays TR06's scene.
      await openColonies(page);
      await expect(page.locator(`.con-colonies__docks [data-fleet-dock="${LINER}"][data-fleet-dock-status="docked"]`), 'the liner reads «флот на карте»').toHaveCount(1);
      await expect(page.locator(`.con-colonies__docks [data-fleet-dock="${LINER}"] .pcard-fleet .colony-fleet-icon`), 'the ship stands on the liner\'s ▲').toHaveCount(1);
      await expect(page.locator(`.con-colonies__docks [data-fleet-dock="${HAULING}"][data-fleet-dock-status="free"]`), 'the other dock is still free').toHaveCount(1);
      await expect(page.locator(`.con-colonies__docks [data-fleet-dock="${HAULING}"] .pcard-fleet .colony-fleet-icon`), 'no ship on it').toHaveCount(0);
      expect(await statusLines(page), 'the taken dock says so in ITS OWN width — the column cuts nothing').toEqual([
        {text: 'Флот на карте', insideColumn: true, whole: true},
        {text: 'Причал свободен', insideColumn: true, whole: true},
      ]);
      // The cursor came back on a destination the open trade offers — never on the dock that is taken.
      expect(await focusedDock(page), 'the cursor does not stand on the taken dock').not.toBe(LINER);
      await shoot(page, preset.id, '04-overview-one-taken');
      await focusDock(page, HAULING);
      await press(page, 'Enter', 900);
      await expect(page.locator(`.con-fleetdock[data-fleet-dock-stage="${HAULING}"]`), 'the other dock\'s stage').toHaveCount(1, {timeout: 10_000});
      await settle(page, {timeoutMs: 15_000});
      await expect.poll(() => page.locator('.con-fleetdock').getAttribute('data-fleet-dock-category'), {message: 'its reward is AHEAD — a placement', timeout: 10_000}).toBe('placement');
      await expect(page.locator('[data-fleet-dock-note]'), 'the reward\'s next step is named').toHaveCount(1);
      await armProbe(page, HAULING);
      const stopHaulingStory = await storyboard(page, preset.id, 'hauling');
      await press(page, 'Enter', 200);
      await expect.poll(() => page.locator('.con-board--placing').count(), {timeout: 45_000, message: 'the ocean\'s placement is up'}).toBe(1);
      await stopHaulingStory();
      const second = (await readProbe(page)).samples;
      const firstPlacing = second.findIndex((s) => s.placing);
      expect(firstPlacing, 'the placement came up while sampled').toBeGreaterThanOrEqual(0);
      expect(second[firstPlacing].ws, 'the workspace was gone before the placement — a CLEAN board').toBe(0);
      expect([...new Set(second.map((s) => s.scene).filter((s) => s !== ''))], 'the card answered, read and LEFT (the reward is ahead)').toEqual(expect.arrayContaining(['answer', 'read', 'leave']));
      expect(second.some((s) => s.chip !== undefined), 'nothing flies off a card whose reward is a placement').toBe(false);
      expect(second.slice(0, firstPlacing + 1).every((s) => s.rating === String(N + 1)), 'the ocean\'s TR is the tile\'s — the rating stands until it is placed').toBe(true);
      expect(await placeTile(page), 'the driver placed the ocean').toBe(true);
      await waitForBoardHome(page);
      const done = await wireOf(request, playerId);
      expect(done.game.oceans, 'one more ocean').toBe(before.game.oceans + 1);
      expect(done.thisPlayer.terraformRating, 'two TR in one generation — two docks, two trades').toBe(N + 2);
      expect(done.thisPlayer.tradesThisGeneration).toBe(2);
      expect(done.thisPlayer.tableau.filter((c) => c.fleetDocked === blue).map((c) => c.name).sort(), 'both docks hold a fleet').toEqual([LINER, HAULING].sort());

      // ── 5 (the whole journey). The board, quiet.
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset.id, '05-board-after-both');
      expect(await page.locator('.con-ws').count(), 'no workspace').toBe(0);
      expect(await strandedReports(page), 'no prompt was stranded').toEqual([]);
      expect(overflow, `no [console-overflow] — ${overflow.join(' | ')}`).toEqual([]);
      expect(errors, `no page error — ${errors.join(' | ')}`).toEqual([]);

      // ── 7. The watcher: red, never reloaded. The trade was NAMED to it while it happened (the feed's card says
      //    where the fleet went), and blue's two docks carry their fleets in blue's «РАЗЫГРАНО» as red reads it.
      expect(redFeed.some((line) => line.includes('Лайнер UNMI')), `red's feed named the liner — it read: ${redFeed.join(' ¦ ')}`).toBe(true);
      await red.bringToFront();
      const redOnBoard = () => red.evaluate(() => {
        const start = document.querySelector<HTMLElement>('.con-start__frame');
        const board = document.querySelector<HTMLElement>('.con-board');
        return (start === null || start.offsetParent === null) && board !== null && board.offsetParent !== null;
      });
      expect(await pressUntil(red, 'Escape', redOnBoard, {tries: 4, settleMs: 1200}), 'red stands on its board').toBe(true);
      await settle(red, {timeoutMs: 30_000, notifications: true});
      // Information → blue's seat → «РАЗЫГРАНО» → the ACTIVE pile, opened (a pile's covered card shows its header only).
      await press(red, 'KeyY', 1200);
      await expect(red.locator('.con-info'), 'red opened the Information workspace').toBeVisible();
      const onBlue = async () => ((await red.locator('.con-info .con-wshead').textContent()) ?? '').includes('player1');
      for (let i = 0; i < 4 && !await onBlue(); i++) {
        await press(red, 'KeyE', 900);
      }
      expect(await onBlue(), 'blue\'s seat is on stage').toBe(true);
      await openInfoPlayedTable(red);
      // (The families are a ring that clamps: the shared walk turns around at a wall and re-reads the cursor itself.)
      const focusedFamily = () => red.evaluate(() => document.querySelector('.con-played__family--focused')?.className ?? '');
      const onActive = async () => (await focusedFamily()).includes('con-played__family--active');
      expect(await walkFocusUntil(red, onActive, focusedFamily, 10, 500), `red's cursor stands on blue's ACTIVE pile — it stands on «${await focusedFamily()}»`).toBe(true);
      await pressUntilVisible(red, 'Enter', '.con-played-cat', {tries: 3, settleMs: 900});
      await settle(red, {timeoutMs: 20_000});
      await expect.poll(() => red.evaluate((cards) => cards.map((name) =>
        document.querySelector(`.con-played-cat [data-fleet-berth="card:${name}"] .colony-fleet-icon`) !== null).join('|'), [LINER, HAULING]),
      {timeout: 20_000, message: 'both of blue\'s docks carry their fleet on the ▲ in the watcher\'s reading of «РАЗЫГРАНО»'}).toBe('true|true');
      await shoot(red, preset.id, '06-watcher-played');
      expect(redErrors, `no page error on the watcher — ${redErrors.join(' | ')}`).toEqual([]);
    });
  });
}
