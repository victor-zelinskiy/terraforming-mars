import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * MANUTECH (C29) — its SETUP box puts a black cube «above the #5 and #12
 * columns». That is the first reminder in the set that marks a COLUMN rather
 * than a track: on a mat whose tracks are the rows of one grid, the reminder
 * is a vertical band crossing every track at once. This probe drives a real
 * game to the bot board detail and asserts the mat draws both bands across
 * every row, the physical cube once per column, and the legend that says what
 * they remind of.
 *
 * Venus Next is on so the Venus track is there too — the printed effect calls
 * it out by name, and its #12 is that track's LAST cell.
 */

const MANUTECH_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C29'},
  expansions: {venus: true},
  // The human's own deal must NOT contain Manutech: the collision rule (RB-B
  // Setup 1) would legitimately hand the bot a different corporation.
  // `customCorporationsList` is one of the few create-game fields the server
  // genuinely forces (`seed` is ignored).
  customCorporationsList: ['Tharsis Republic', 'Inventrix'],
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: MarsBot corporation marked columns', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the bot board bands the #5 and #12 columns across every track, with a legend', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: MANUTECH_CONFIG});
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
    // Case-insensitive: the nameplate is uppercased by CSS, which lands in innerText.
    await expect(corpLine).toContainText(/manutech/i);

    // The printed BOARD detail (R3 — the bot seat's own reader).
    await key(page, 'KeyV', 1400);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();

    // Two bands × however many tracks this board has (7 Tharsis + Venus).
    const rows = await tracks.locator('.mb-track').count();
    expect(rows, 'Venus Next adds its own track to the seven').toBe(8);
    await expect(tracks.locator('.mb-cell--reminder')).toHaveCount(2 * rows);

    // The physical cube stands ABOVE the column — one per column, on the top row.
    await expect(tracks.locator('.mb-cell__colcube')).toHaveCount(2);
    await expect(tracks.locator('.mb-track').first().locator('.mb-cell__colcube')).toHaveCount(2);
    // …and it is actually PAINTED. The hosting surface clips at the strip's
    // edge, so the mat has to own the headroom — the first build had all the
    // DOM in place and the cube cut clean away, which only a screenshot
    // showed. Assert the cube's box sits INSIDE the strip's own box.
    await expect(tracks).toHaveClass(/mb-tracks--reminders/);
    const strip = await tracks.boundingBox();
    const cube = await tracks.locator('.mb-cell__colcube').first().boundingBox();
    expect(strip && cube, 'both boxes are laid out').toBeTruthy();
    expect(cube!.height, 'the cube has a real box').toBeGreaterThan(0);
    expect(cube!.y, 'and it is not hanging off the top of the mat').toBeGreaterThanOrEqual(strip!.y);
    // A reminder is not a cube on a space: this corporation seeds none.
    await expect(tracks.locator('.mb-track .mb-cell__cube')).toHaveCount(0);

    // The legend states what the marked columns remind of, in RU.
    const legend = page.locator('.mb-cubelegend');
    await expect(legend).toBeVisible();
    const legendText = (await legend.innerText()).replace(/\s+/g, ' ');
    expect(legendText).toMatch(/дойдя до этой колонки/i);

    await page.screenshot({path: 'screenshots/bot-corp-columns.png', fullPage: false});
  });
});
