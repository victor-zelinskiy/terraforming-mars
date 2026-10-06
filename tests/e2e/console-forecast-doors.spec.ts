import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, press, pressUntil, settle} from './consoleStart';

/**
 * THE TABLE'S ANSWER HAS A DOOR ON EVERY STAGE (PL-066, 2026-10-06) — the «⚡ сработает» group a composer draws is the
 * DOOR of the R3 «Эффекты» layer there, and the stages that reused the group had left it a dead end (the dock's, PL-060;
 * the colony's, this spec). One journey per stage, two profiles:
 *
 *   · the COLONY TRADE stage: Miranda pays an animal, Meat Industry answers with 2 M€ — the door stands on the «ВАШ ИТОГ»
 *     rail with its R3 key, the bar offers «R3 Эффекты», R3 opens the layer INSIDE the stage (the configuration column
 *     parks, the track instrument stays), the crumb reads «КОЛОНИИ › МИРАНДА › ТОРГОВЛЯ · ЭФФЕКТЫ», the reactor stands
 *     as a tile of «Вы получите», B gives the stage back whole and nothing was sent.
 *
 * Fixture `unmi-liner` (the Greens rule, six colonies, 20 M€, three fleets) ARRANGED with Meat Industry and Birds in the
 * viewer's tableau — the income needs a card to land on, or the preview itself says it is lost and nothing reacts — and
 * Miranda made ACTIVE (the fixture's is not: an inactive tile's A opens the dossier, never a trade).
 */
const OUT = path.resolve('screenshots', 'forecast-doors');
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  await expect(colonies, 'the colonies workspace opened').toHaveCount(1, {timeout: 10_000});
  await settle(page, {timeoutMs: 15_000});
}

/**
 * Stand the cursor on ONE colony tile — the overview's own ring, verified by the focused tile itself. The ring has
 * a SECOND zone (the «ПРИЧАЛЫ» column: ▶ from a row's last tile enters it, ◀ returns), so the walk snakes the grid
 * row by row and steps back out of the column whenever no planet tile is focused.
 */
async function focusTile(page: Page, target: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  const anyTile = page.locator('.con-coltile--focused');
  const snake = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft'];
  for (let i = 0; i < snake.length * 2 && await focused.count() === 0; i++) {
    if (await anyTile.count() === 0) {
      await press(page, 'ArrowLeft', 320);
      continue;
    }
    await press(page, snake[i % snake.length], 320);
  }
  await expect(focused, `the cursor stands on ${target}`).toHaveCount(1);
}

const crumb = async (page: Page) => ((await page.locator('.con-colonies .con-wshead').textContent()) ?? '').replace(/\s+/g, ' ').toUpperCase();

for (const preset of PRESETS) {
  test.describe(`the forecast's door on the colony stage · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('Miranda → Meat Industry: the door on the rail, R3 → the layer inside the stage, B → the stage whole, nothing sent', async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'unmi-liner', {
        query: preset.query,
        arrange: (s) => {
          const blue = (s.players as Array<{playedCards: Array<Record<string, unknown>>}>)[0];
          blue.playedCards.push({name: 'Meat Industry', resourceCount: 0}, {name: 'Birds', resourceCount: 0});
          // The fixture's Miranda is not yet active (no settlement) — an inactive tile's A is the dossier, never a trade.
          const miranda = (s.colonies as Array<{name: string, isActive: boolean}>).find((c) => c.name === 'Miranda')!;
          miranda.isActive = true;
        },
      });
      const posts: Array<string> = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
          posts.push(req.url());
        }
      });
      await openColonies(page);
      await focusTile(page, 'Miranda');
      await press(page, 'Enter', 900);
      await expect(page.locator('.con-colfocus'), 'A opened the trade stage').toHaveCount(1, {timeout: 10_000});
      await settle(page, {timeoutMs: 15_000});
      expect(await crumb(page)).toMatch(/КОЛОНИИ.*МИРАНДА.*ТОРГОВЛЯ/);

      // ── 1. The door: the table's answer on the «ВАШ ИТОГ» rail, the key on it, the verb on the bar.
      const door = page.locator('.con-colfocus [data-forecast-row]');
      await expect(door, 'the «⚡ сработает» group stands on the result rail').toHaveCount(1);
      expect(((await door.textContent()) ?? '').replace(/\s+/g, ' '), 'Meat Industry\'s 2 M€ per animal').toMatch(/\+\s*2/);
      await expect(door.locator('.gp-glyph'), 'the group carries the R3 key').toHaveCount(1);
      await expect(page.locator('.con-cmdbar'), 'the bar offers the layer').toContainText(/ЭФФЕКТЫ/i);
      await page.screenshot({path: path.join(OUT, `${preset.id}-01-colony-door.png`)});

      // ── 2. R3 → the layer INSIDE the stage: the configuration parks (never unmounts), the track stays, the crumb's
      //       tail grows, the reactor is a tile of «Вы получите», the bar is the explorer's.
      expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-colfocus [data-forecast-layer]').count() > 0, {tries: 3, settleMs: 1100}),
        'R3 opens the «Эффекты» layer inside the colony stage').toBeTruthy();
      // The colony stage ROOT is the forecast host (the layer parks the whole configuration column under it).
      await expect(page.locator('.con-colfocus[data-forecast-host] [data-forecast-layer] .con-efx--forecast')).toHaveCount(1);
      expect(await crumb(page), 'the crumb gains «· ЭФФЕКТЫ»').toMatch(/ТОРГОВЛЯ\s*·\s*ЭФФЕКТЫ/);
      await expect(page.locator('.con-colfocus [data-forecast-layer] [data-forecast-group="receive"]'), 'Meat Industry stands in «Вы получите»').toHaveCount(1);
      expect(await page.locator('.con-colfocus [data-forecast-browse]').count(), 'the configuration is PARKED, not gone').toBe(1);
      await expect(page.locator('.con-colfocus .con-colfocus__trackzone'), 'the track instrument stays in view').toBeVisible();
      await settle(page, {timeoutMs: 15_000});
      await page.screenshot({path: path.join(OUT, `${preset.id}-02-colony-layer.png`)});

      // ── 3. B → the stage back, whole; nothing reached the server.
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-colfocus [data-forecast-layer]').count() === 0, {tries: 3, settleMs: 1100}),
        'B folds the layer, never the stage').toBeTruthy();
      await expect(page.locator('.con-colfocus'), 'the stage is still up').toHaveCount(1);
      // The head's text carries its trailing block too (the berths / the players), so the tail is judged by its words.
      const afterFold = await crumb(page);
      expect(afterFold, 'the stage keeps its own tail').toMatch(/ТОРГОВЛЯ/);
      expect(afterFold, 'the tail gave «ЭФФЕКТЫ» back').not.toMatch(/ЭФФЕКТЫ/);
      await expect(door, 'the door is back on the rail').toHaveCount(1);
      expect(posts, 'nothing was sent').toEqual([]);
      await press(page, 'Escape', 900);
      await expect(page.locator('.con-colfocus'), 'the second B folds the stage to the grid').toHaveCount(0, {timeout: 10_000});
    });
  });

  /**
   * THE STANDARD PROJECTS: an asteroid's degree is a TR step, and under the ruling Greens that is 2 M€ — the engine
   * counts a scale step as a TR step now (it did not: «the honest limit of iteration 0»), the foot's context line
   * carries the door, R3 opens the layer over the parked grid, the crumb gains «ЭФФЕКТЫ», a focus move to another
   * project folds it, B gives the grid back with the cursor where it stood.
   */
  test.describe(`the forecast's door on the standard projects · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    const focusedRow = async (page: Page) => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
    /** Home to the top-left corner, then snake through the 2-column grid (the stdp workspace's own walk). */
    async function focusRow(page: Page, re: RegExp): Promise<void> {
      const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
      for (let i = 0; i < 6 && !re.test(await focusedRow(page)); i++) {
        await press(page, 'ArrowUp', 200);
      }
      if (!re.test(await focusedRow(page))) {
        await press(page, 'ArrowLeft', 200);
      }
      for (let i = 0; i < snake.length && !re.test(await focusedRow(page)); i++) {
        await press(page, snake[i], 240);
      }
      expect(re.test(await focusedRow(page)), `could not focus ${re}`).toBeTruthy();
    }

    test('the asteroid under the ruling Greens: the door on the foot, R3 → the layer over the grid, a focus move folds it, B keeps the cursor', async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'unmi-liner', {query: preset.query});
      const posts: Array<string> = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
          posts.push(req.url());
        }
      });
      await press(page, 'Comma', 1100);
      await press(page, 'Enter', 1400);
      await expect(page.locator('.con-stdp'), 'the standard projects opened').toHaveCount(1, {timeout: 15_000});
      await settle(page, {timeoutMs: 15_000});
      await focusRow(page, /астероид/i);

      // ── 1. The door on the foot's context line: the Greens' 2 M€ for the degree's TR step, the key, the bar's verb.
      const door = page.locator('.con-stdp [data-forecast-row]');
      await expect(door, 'the «⚡ сработает» group stands on the context line').toHaveCount(1);
      expect(((await door.textContent()) ?? '').replace(/\s+/g, ' '), 'the Greens\' 2 M€ for the TR step').toMatch(/\+\s*2/);
      await expect(door.locator('.gp-glyph'), 'the group carries the R3 key').toHaveCount(1);
      await expect(page.locator('.con-cmdbar'), 'the bar offers the layer').toContainText(/ЭФФЕКТЫ/i);
      await page.screenshot({path: path.join(OUT, `${preset.id}-03-stdp-door.png`)});

      // ── 2. R3 → the layer over the parked grid; the crumb's tail; the Greens' tile.
      expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-stdp [data-forecast-layer]').count() > 0, {tries: 3, settleMs: 1100}),
        'R3 opens the «Эффекты» layer inside the workspace').toBeTruthy();
      await expect(page.locator('.con-stdp [data-forecast-host] [data-forecast-layer] .con-efx--forecast')).toHaveCount(1);
      await expect(page.locator('.con-stdp .con-wshead'), 'the crumb gains «ЭФФЕКТЫ»').toContainText(/ЭФФЕКТЫ/i);
      await expect(page.locator('.con-stdp [data-forecast-layer] [data-forecast-group="receive"]'), 'the Greens stand in «Вы получите»').toHaveCount(1);
      expect(await page.locator('.con-stdp [data-forecast-browse] .con-stdp__card').count(), 'the grid is PARKED under the layer, not gone').toBeGreaterThan(0);
      await settle(page, {timeoutMs: 15_000});
      await page.screenshot({path: path.join(OUT, `${preset.id}-04-stdp-layer.png`)});

      // ── 3. B → the grid back, the cursor where it stood; nothing sent. Then a focus move with the layer open folds it.
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-stdp [data-forecast-layer]').count() === 0, {tries: 3, settleMs: 1100}),
        'B folds the layer, never the workspace').toBeTruthy();
      await expect(page.locator('.con-stdp'), 'the workspace is still up').toHaveCount(1);
      expect(await focusedRow(page), 'the cursor stands where it stood').toMatch(/астероид/i);
      await expect(page.locator('.con-stdp .con-wshead')).not.toContainText(/ЭФФЕКТЫ/i);
      expect(posts, 'nothing was sent').toEqual([]);
    });
  });
}
