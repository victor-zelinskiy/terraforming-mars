import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, openActionFocus, openCardActions, placeTile, press, settle, walkFocusUntil,
} from './consoleStart';

/**
 * TR69 «ПАРЯЩИЕ БИОКУПОЛЫ» — a floater holder whose `or`-action's B pays a TILE, ONE declaration: the declared
 * greenery is STAGED from the composer by the declarative builder itself (D5 — no hook in the card). Against a real
 * server, on two profiles:
 *
 *   (A) variant A (`floating-biodomes`, 3 floaters, 1 plant, Dirigibles beside it): the composer's «КУДА» step over the
 *       two Venus floater holders — this card included — Dirigibles picked → ONE POST; the server: the plant spent,
 *       the floater on Dirigibles.
 *   (B) variant B (same fixture): A in the composer hands the screen to the BOARD while the game's age stands still;
 *       B on the board restores the composer; the cell's confirm is THE submit — ONE POST — the greenery lands, the
 *       oxygen rises one step, three floaters leave the card.
 *   (C) both refused (`floating-biodomes-dead`, 2 floaters, no plant): both tiles stand, each with its own reason —
 *       the plant, then «2 of 3 floaters».
 *   (D) the oxygen at its maximum (`floating-biodomes-maxo2`): B still places its greenery, the oxygen stays.
 */

const CARD = 'Floating Biodomes';
const OUT = path.resolve('screenshots', 'floating-biodomes', process.env.TM_E2E_SHOTS_TAG ?? '');
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {plants: number, tableau: Array<{name: string, resources?: number}>},
  game: {oxygenLevel: number, gameAge?: number, spaces: Array<{id: string, tileType?: number, color?: string}>},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
const greeneries = (wire: Wire) => wire.game.spaces.filter((s) => s.tileType === 0).length;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

function watchPosts(page: Page): {posts: Array<string>} {
  const out = {posts: [] as Array<string>};
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      out.posts.push(r.postData() ?? '');
    }
  });
  return out;
}

/** The focused «Действия карт» tile: its card and its printed variant («Вариант N», 0 when the card prints one). */
const tileAt = (page: Page) => page.evaluate(() => {
  const tile = document.querySelector('.con-cardactions__tile--focused');
  const variant = (tile?.querySelector('.con-cardactions__tile-variant')?.textContent ?? '').replace(/\D+/g, '');
  return {card: tile?.getAttribute('data-action-card') ?? '', variant: variant === '' ? 0 : Number(variant)};
});

/** «Действия карт» → this card's tile of printed variant `variant` (1 / 2) → its composer. */
async function openBiodomesVariant(page: Page, variant: number): Promise<void> {
  await openCardActions(page);
  const at = async () => {
    const f = await tileAt(page);
    return f.card === CARD && f.variant === variant;
  };
  expect(await walkFocusUntil(page, at, async () => JSON.stringify(await tileAt(page)), 10),
    `never focused «${CARD}» · variant ${variant} (at ${JSON.stringify(await tileAt(page))})`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  await expect(page.locator(ACTION_COMPOSER), 'the composer stands').toBeVisible();
}

const rowText = (page: Page) => page.evaluate((root) =>
  (document.querySelector(`${root} .con-composer__row--focused`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), ACTION_COMPOSER);

/** The played-target step's focused candidate: 'self' for the «Эта карта» proxy, else the card's name. */
const candidateAt = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector('.con-ptsel__cell[data-focused="1"]');
  if (cell === null) {
    return '';
  }
  return cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
});

for (const preset of PRESETS) {
  test.describe(`TR69 Floating Biodomes · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) variant A: «КУДА» over the two Venus holders, this card included — Dirigibles → ONE POST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPosts(page);
      const {playerId} = await bootFixtureSeats(page, request, 'floating-biodomes', {query: preset.query});
      await settle(page);
      const before = await wireOf(request, playerId);
      expect([resourcesOf(before, CARD), before.thisPlayer.plants, resourcesOf(before, 'Dirigibles')], 'the fixture: 3 floaters · 1 plant · Dirigibles 1').toEqual([3, 1, 1]);
      await openBiodomesVariant(page, 1);
      await shoot(page, preset.id, 'a-01-composer');
      // The target row «КУДА» → the step over the Venus floater holders.
      for (let i = 0; i < 8 && !/Куда/i.test(await rowText(page)); i++) {
        await press(page, 'ArrowDown', 220);
      }
      expect(await rowText(page), 'the target row').toMatch(/Куда/i);
      await press(page, 'Enter', 600);
      await expect(page.locator('.con-ptsel'), 'the target step opened').toBeVisible();
      await expect(page.locator('.con-ptsel__cell'), 'two Venus floater holders — this card and Dirigibles').toHaveCount(2);
      await shoot(page, preset.id, 'a-02-target');
      for (let i = 0; i < 4 && await candidateAt(page) !== 'Dirigibles'; i++) {
        await press(page, 'ArrowRight', 260);
      }
      expect(await candidateAt(page)).toBe('Dirigibles');
      await press(page, 'Enter', 600);
      await expect(page.locator('.con-ptsel'), 'the step answered').toHaveCount(0);
      for (let i = 0; i < 8 && await page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
        await press(page, 'ArrowDown', 250);
      }
      for (let attempt = 0; attempt < 4 && seen.posts.length === 0; attempt++) {
        await press(page, 'Enter', 400);
        await expect.poll(() => seen.posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(seen.posts.length, 'A sent exactly one request').toBe(1);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), 'Dirigibles'), {timeout: 30_000}).toBe(2);
      const after = await wireOf(request, playerId);
      expect([after.thisPlayer.plants, resourcesOf(after, CARD)], 'the plant spent; this card untouched').toEqual([0, 3]);
      await settle(page, {timeoutMs: 40_000});
      expect(seen.posts.length, 'nothing asked after the press').toBe(1);
    });

    test(`(B) variant B: the greenery STAGED — board at a standing age, B restores the composer, the cell is the ONE POST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPosts(page);
      const {playerId} = await bootFixtureSeats(page, request, 'floating-biodomes', {query: preset.query});
      await settle(page);
      const before = await wireOf(request, playerId);
      const oxygen = before.game.oxygenLevel;
      const forests = greeneries(before);
      await openBiodomesVariant(page, 2);
      await shoot(page, preset.id, 'b-01-composer');
      const panel = page.locator('.con-context');
      const workspace = page.locator('.con-cardactions');
      // A hands the screen to the BOARD — nothing is submitted.
      for (let i = 0; i < 3 && await workspace.count() > 0; i++) {
        await press(page, 'Enter', 1400);
      }
      await expect(panel, 'the staged greenery took the board').toContainText(/размещение тайла/i, {timeout: 30_000});
      expect(seen.posts.length, 'the action must not touch the server before the cell').toBe(0);
      await shoot(page, preset.id, 'b-02-board');
      // B on the board restores the composer.
      await press(page, 'Escape', 1600);
      await expect(page.locator(ACTION_COMPOSER), 'B on the board restores the composer').toHaveCount(1, {timeout: 10_000});
      expect(seen.posts.length, 'the cancel leaves no trace').toBe(0);
      // A again → the board → the cell is THE submit.
      for (let i = 0; i < 3 && await workspace.count() > 0; i++) {
        await press(page, 'Enter', 1400);
      }
      await expect(panel).toContainText(/размещение тайла/i, {timeout: 30_000});
      expect(await placeTile(page), 'the placement confirm resolved').toBeTruthy();
      await expect.poll(async () => greeneries(await wireOf(request, playerId)), {timeout: 30_000, message: 'the greenery landed'}).toBe(forests + 1);
      const after = await wireOf(request, playerId);
      expect(after.game.oxygenLevel, 'the tile raised the oxygen ONE step').toBe(oxygen + 1);
      expect(resourcesOf(after, CARD), 'three floaters left the card').toBe(0);
      expect(seen.posts.length, 'ONE POST — the action and its cell together').toBe(1);
      await settle(page, {timeoutMs: 40_000});
      await expect(workspace, 'the flow ends on the board').toHaveCount(0);
    });

    test(`(C) both refused: two tiles, each with its own reason — the plant, then «2 of 3 floaters» (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'floating-biodomes-dead', {query: preset.query});
      await settle(page);
      await openCardActions(page);
      const tiles = await page.evaluate((card) => Array.from(document.querySelectorAll(`.con-cardactions__tile[data-action-card="${card}"]`))
        .map((t) => (t.textContent ?? '').replace(/\s+/g, ' ').trim()), CARD);
      console.log(`[${preset.id} c tiles] ${JSON.stringify(tiles)}`);
      expect(tiles.length, 'both variants stand as tiles').toBe(2);
      expect(tiles.join(' | '), 'the plant reason').toMatch(/растени/i);
      expect(tiles.join(' | '), 'the floater count').toMatch(/2 из 3 аэростатов/i);
      await shoot(page, preset.id, 'c-01-refused');
    });

    test(`(D) the oxygen at its maximum: B still places its greenery, the oxygen stays (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'floating-biodomes-maxo2', {query: preset.query});
      await settle(page);
      const before = await wireOf(request, playerId);
      expect(before.game.oxygenLevel).toBe(14);
      const forests = greeneries(before);
      await openBiodomesVariant(page, 2);
      const workspace = page.locator('.con-cardactions');
      for (let i = 0; i < 3 && await workspace.count() > 0; i++) {
        await press(page, 'Enter', 1400);
      }
      await expect(page.locator('.con-context')).toContainText(/размещение тайла/i, {timeout: 30_000});
      expect(await placeTile(page)).toBeTruthy();
      await expect.poll(async () => greeneries(await wireOf(request, playerId)), {timeout: 30_000}).toBe(forests + 1);
      expect((await wireOf(request, playerId)).game.oxygenLevel, 'the oxygen stays at its maximum').toBe(14);
      await settle(page, {timeoutMs: 40_000});
    });
  });
}
