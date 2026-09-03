import {expect, test} from '@playwright/test';
import {openBotBoardDetail, bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * INTERPLANETARY CINEMATICS (C04) — its SETUP box replaces the TRACKERS of
 * the building and event tracks with white cubes «as a reminder». The digital
 * table owes the player that same cue: this probe drives a real game to the
 * bot board detail and asserts the two marked tracks wear a white tracker and
 * the legend says what it reminds of.
 */

const CINEMATICS_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C04'},
  // The human's own deal must NOT contain Interplanetary Cinematics: the
  // collision rule (RB-B Setup 1) would legitimately hand the bot a different
  // corporation. `customCorporationsList` is one of the few create-game
  // fields the server genuinely forces (`seed` is ignored).
  customCorporationsList: ['Tharsis Republic', 'Inventrix'],
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: MarsBot corporation white trackers', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the bot board paints the building and event trackers white, with a legend', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: CINEMATICS_CONFIG});
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
    await expect(corpLine).toContainText(/interplanetary cinematics/i);

    // The printed BOARD detail (R3 — the bot seat's own reader).
    await openBotBoardDetail(page);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();

    // Exactly the two tracks the SETUP box names — one tracker each, riding
    // the current position (scoped to `.mb-track`: the legend below draws its
    // own swatch with the same class).
    await expect(tracks.locator('.mb-track--whitemarker')).toHaveCount(2);
    await expect(tracks.locator('.mb-track .mb-cell__marker')).toHaveCount(2);
    // A reminder is not a cube: this corporation seeds none.
    await expect(tracks.locator('.mb-track .mb-cell__cube')).toHaveCount(0);

    // The legend states what the white trackers remind of, in RU.
    const legend = page.locator('.mb-cubelegend');
    await expect(legend).toBeVisible();
    const legendText = (await legend.innerText()).replace(/\s+/g, ' ');
    expect(legendText).toMatch(/продвижение этого трека/i);

    await page.screenshot({path: 'screenshots/bot-corp-markers.png', fullPage: false});
  });
});
