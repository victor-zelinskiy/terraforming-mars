import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootIntoGame, fetchPlayerModel, press, settle, soloGameConfig} from './consoleStart';

/**
 * THE COLONY ROSTER — an EXISTING change of the table on the framework's path
 * (docs/COLONY_ROSTER_CEREMONY.md): ARIDOR's first action («put an additional
 * Colony Tile of your choice into play»), driven through the start workspace.
 *
 * Before the framework the pick was `submit` + `closeColonyFocus()`: the new
 * tile «simply was there». Now it is the roster act with `kind: 'add'` — the
 * same section, the same stage, the same transport gate and the same landing
 * the replacement of TR10 uses (`console-fringe-colony.spec.ts`), with no
 * card-specific branch:
 *
 *   1. the first action opens the CATALOG of the reserve INSIDE the start
 *      workspace — the tiles in play are not on it (the rail once read the
 *      shell's task, which is gated under the start scene);
 *   2. every catalog tile says HOW IT WOULD ENTER — the server's projection
 *      (`rosterChange.incoming[].entersActive`), never the bare catalog
 *      model's flag (which reads «not active» for every tile);
 *   3. A descends to the tile's stage — the roster act `add`, the planet in
 *      its projection pose — and A there adds the tile: the server's table
 *      grows by exactly that tile;
 *   4. the colony step leaves and the start flow goes on to its end: no
 *      workspace left, nothing stranded, no hold standing, no page error, and
 *      the ceremony never confessed a degraded run.
 *
 * A real solo game (the deal is not the subject: `customCorporationsList`
 * forces the corporation, the catalog is whatever the reserve holds — the
 * assertions are about the CLASS of tile, never a remembered name).
 */

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'AridorTester', color: 'red', beginner: false, handicap: 0, first: true}],
  startingCorporations: 1,
  customCorporationsList: ['Aridor'],
  expansions: {corpera: true, colonies: true},
});

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}},
] as const;

type Wire = {game: {colonies: Array<{name: string}>}, waitingFor?: {type?: string}};

/** The server's own view. One retry on a dropped socket (a loaded per-worker server resets a connection now and then). */
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

const tableOf = async (request: APIRequestContext, playerId: string) => (await wireOf(request, playerId)).game.colonies.map((c) => c.name);

const railNames = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.con-colonies [data-test^="con-colony-"]')).map((el) => (el.getAttribute('data-test') ?? '').replace('con-colony-', '')));
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-colonies__slot--focused [data-test^="con-colony-"]')?.getAttribute('data-test')?.replace('con-colony-', '') ?? '');

for (const preset of PRESETS) {
  test.describe(`the colony roster · Aridor's first action · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the first action → the reserve catalog → the tile's stage → «Добавить плитку» → the start flow goes on (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const degraded: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));

      const playerId = await bootIntoGame(page, request, {config: GAME_CONFIG, corporation: 'Aridor', buy: 0, until: 'startRelease'});
      const tableBefore = await tableOf(request, playerId);

      await page.locator('.con-start__firstact').waitFor({state: 'visible', timeout: 60_000});
      await settle(page, {timeoutMs: 20_000});

      // A confessed degradation anywhere in the flow is caught as it happens (the attribute lives only while it is true).
      await page.exposeFunction('__rosterDegraded', (why: string) => {
        degraded.push(why);
      });
      await page.evaluate(() => {
        new MutationObserver(() => {
          const why = document.querySelector('[data-colony-roster-degraded]')?.getAttribute('data-colony-roster-degraded');
          if (why !== null && why !== undefined) {
            void (window as unknown as {__rosterDegraded: (why: string) => void}).__rosterDegraded(why);
          }
        }).observe(document.body, {subtree: true, attributes: true, childList: true});
      });

      // ── 1. A on the first action → the catalog of the RESERVE, inside the start workspace ──
      for (let attempt = 0; attempt < 3 && await page.locator('.con-colonies').count() === 0; attempt++) {
        await press(page, 'Enter', 500);
        await page.locator('.con-colonies').waitFor({timeout: 6_000}).catch(() => undefined);
      }
      await page.locator('.con-colonies').waitFor({timeout: 20_000});
      await settle(page, {timeoutMs: 20_000});
      const catalog = await railNames(page);
      expect(catalog.length, 'the catalog offers the reserve').toBeGreaterThan(0);
      expect(catalog.filter((name) => tableBefore.includes(name)), 'no tile in play stands on the catalog').toEqual([]);

      // ── 2. every catalog tile says how it would ENTER ──
      const statuses = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.con-colonies .con-coltile__status')).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()));
      expect(statuses.length, 'a status per catalog tile').toBe(catalog.length);
      // An inactive entry carries the tile's own «✕» mark — the same register a tile in play uses for «Не активна».
      expect(statuses.filter((text) => !/^(✕\s*)?Войдёт (не)?активной/.test(text)), 'every catalog tile states its entry').toEqual([]);

      // ── 3. A → the tile's stage (the roster act «add»), A → the tile is added ──
      const chosen = await focusedTile(page);
      expect(catalog, 'the cursor stands on a catalog tile').toContain(chosen);
      const stage = '.con-colfocus[data-colony-roster="add"]';
      for (let attempt = 0; attempt < 3 && await page.locator(stage).count() === 0; attempt++) {
        await press(page, 'Enter', 400);
        await page.locator(stage).waitFor({timeout: 4_000}).catch(() => undefined);
      }
      await page.locator(stage).waitFor({timeout: 15_000});
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator(stage), 'the entering planet stands in its projection pose').toHaveClass(/con-colfocus--roster-projected/);
      await expect(page.locator(`${stage} [data-roster-fact="arrives"]`), 'the stage states who arrives, and how').toContainText('Войдёт');
      await expect(page.locator(`${stage} [data-roster-outgoing-seat]`), 'an addition has nobody leaving').toHaveCount(0);
      expect(await tableOf(request, playerId), 'nothing was sent by the descent').toEqual(tableBefore);

      for (let attempt = 0; attempt < 3 && !(await tableOf(request, playerId)).includes(chosen); attempt++) {
        await press(page, 'Enter', 400);
        await expect.poll(async () => (await tableOf(request, playerId)).includes(chosen), {timeout: 6_000}).toBe(true).catch(() => undefined);
      }
      const tableAfter = await tableOf(request, playerId);
      expect(tableAfter, 'the chosen tile is in the game').toContain(chosen);
      expect(tableAfter.length, 'exactly one tile was added').toBe(tableBefore.length + 1);
      expect(tableAfter.filter((name) => name !== chosen), 'no other tile changed').toEqual(tableBefore);

      // ── 4. the colony step leaves and the start flow goes on to its end ──
      await expect.poll(() => page.locator('.con-colonies').count(), {timeout: 40_000, message: 'the colony step left'}).toBe(0);
      await expect.poll(() => page.evaluate(() => ({
        start: document.querySelectorAll('.con-start').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 60_000, message: 'the start flow ended on the board'}).toEqual({start: 0, ws: 0});
      await settle(page, {timeoutMs: 20_000});
      expect((await wireOf(request, playerId)).waitingFor?.type, 'the game went on to the action menu').toBe('or');
      expect(await page.locator('.con-stranded').count(), 'nothing stranded').toBe(0);
      expect(degraded, 'the ceremony never confessed a degraded run').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });
  });
}
