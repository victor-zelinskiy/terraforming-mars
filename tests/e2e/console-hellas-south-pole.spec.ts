import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, createGameWithCards, settle, soloGameConfig} from './consoleStart';

/**
 * HELLAS — the South Pole wears its premium marker (the map's one special cell: a tile there pays 6 M€ and places an
 * ocean). The board shows exactly that marker on the surface, it is calm while nobody inspects the board, and the
 * hover popover names the cell and its toll. Evidence → screenshots/hellas/.
 */

const OUT = path.resolve('screenshots', 'hellas');
const SOUTH_POLE = '61';
const PROFILES = [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'}] as const;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

for (const profile of PROFILES) {
  test.describe(`Hellas · the South Pole marker · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1, screen: profile.viewport});

    test('the South Pole is the map\'s one marker, calm at rest, and its popover names the cell and the toll', async ({page, request}) => {
      test.setTimeout(240_000);
      const playerId = await createGameWithCards(request, [], {config: soloGameConfig({board: 'hellas', customCorporationsList: ['Teractor']})});
      await bootSeededGame(page, request, playerId, {buy: 0, corporation: 'Teractor', query: profile.query});
      await settle(page);
      await shoot(page, '00-board');

      const markers = await page.evaluate(() => Array.from(document.querySelectorAll('.special-cell-marker')).map((m) =>
        Array.from(m.classList).find((c) => /^board-space-\d+$/.test(c)) ?? '?').filter((c) => !/^board-space-0[12]$/.test(c)).sort());
      expect(markers, 'exactly the South Pole carries a marker on the surface').toEqual([`board-space-${SOUTH_POLE}`]);
      expect(await page.locator('.special-cell-marker--active').count(), 'no marker lights up for an invisible cursor').toBe(0);

      await page.locator(`[data_space_id="${SOUTH_POLE}"]`).hover();
      await expect.poll(async () => (await page.locator('.board-cell-popover').innerText().catch(() => '')).replace(/\s+/g, ' '),
        {timeout: 15_000, message: 'the popover names the South Pole and its toll'}).toMatch(/Южный полюс.*6 M€/);
      await settle(page);
      await shoot(page, '01-south-pole-hover');
    });
  });
}
