import {expect, test} from '@playwright/test';
import {bootToBoard, corporationsExcluding, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * ARIDOR (C30) — the first corporation whose cube COLOUR carries no rule: «a
 * black OR white cube» is one printed sentence with one outcome, and it uses
 * two colours only because nine cubes of one colour are not in the box. The
 * mat owes the player that reading: nine cubes across six tracks, and ONE
 * legend row carrying BOTH swatches. Two identical rows would assert a
 * difference the card does not print.
 *
 * It also seeds by TAG where the mat has fewer tracks than the card has names
 * (power + Jovian are one row, Earth + city another) — so the probe counts
 * cubes per row, not per name.
 */

const ARIDOR_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C30'},
  expansions: {colonies: true},
  // The human's own deal must NOT contain Aridor: the collision rule (RB-B
  // Setup 1) would legitimately hand the bot a different corporation — and it
  // did, until this list was long enough to fill ALL EIGHT dealt slots
  // (`customCorporationsList` is cards-on-top, not a restriction).
  customCorporationsList: corporationsExcluding('Aridor'),
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: a MarsBot corporation whose colours share one meaning', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the bot board draws all nine cubes and ONE legend row with both swatches', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: ARIDOR_CONFIG});
    expect(created.ok(), 'the server accepted the automa config').toBeTruthy();
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);
    await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});

    await bootToBoard(page);

    // Information workspace → the BOT seat.
    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/aridor/i);

    // The printed BOARD detail (R3 — the bot seat's own reader).
    await key(page, 'KeyV', 1400);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();

    // 5 white + 4 black cubes ON THE CELLS, exactly as the SETUP box seeds
    // them (scoped to `.mb-track` — the legend below draws its own swatches).
    await expect(tracks.locator('.mb-track .mb-cell__cube--white')).toHaveCount(5);
    await expect(tracks.locator('.mb-track .mb-cell__cube--black')).toHaveCount(4);

    // Six ROWS carry them, not nine — the card names tracks the mat merges.
    const rowsWithCubes = await tracks.locator('.mb-track').evaluateAll(
      (rows) => rows.filter((row) => row.querySelector('.mb-cell__cube') !== null).length);
    expect(rowsWithCubes, 'power+Jovian are one row, Earth+city another').toBe(6);

    // ONE legend row, both swatches, the card's own words in RU.
    const legend = page.locator('.mb-cubelegend');
    await expect(legend).toBeVisible();
    await expect(legend.locator('.mb-cubelegend__row'), 'one meaning, one row').toHaveCount(1);
    await expect(legend.locator('.mb-cubelegend__row .mb-cell__cube--white')).toHaveCount(1);
    await expect(legend.locator('.mb-cubelegend__row .mb-cell__cube--black')).toHaveCount(1);
    const legendText = (await legend.innerText()).replace(/\s+/g, ' ');
    expect(legendText).toMatch(/продвигает свой трек событий/i);

    await page.screenshot({path: 'screenshots/bot-corp-shared-legend.png', fullPage: false});
  });
});
