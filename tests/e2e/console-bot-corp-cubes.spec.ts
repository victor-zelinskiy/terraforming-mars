import {expect, test} from '@playwright/test';
import {openBotBoardDetail, bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * HELION (C03) — the first MarsBot corporation that seeds CUBES on the bot's
 * tracks (Rule Book B «Special Cubes on the MarsBot Player Mat»). The player
 * browses those tracks, so the cubes must be VISIBLE there: this probe drives
 * a real game to the bot board detail and asserts the mat actually draws the
 * 12 cubes plus the legend that explains what each colour does.
 */

const HELION_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C03'},
  // The human's own deal must NOT contain Helion: the corporation-collision
  // rule (RB-B Setup 1) would legitimately hand the bot a different corp and
  // this probe is about Helion's cubes. `customCorporationsList` is one of
  // the few create-game fields the server genuinely forces.
  customCorporationsList: ['Tharsis Republic', 'Inventrix'],
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: MarsBot corporation cubes on the tracks', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the bot board draws Helion\'s white/black cubes and their legend', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: HELION_CONFIG});
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
    await expect(corpLine).toContainText('Helion');

    // The printed BOARD detail (R3 — the bot seat's own reader) with the
    // corporation cubes on its tracks.
    await openBotBoardDetail(page);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();

    // 6 white + 6 black cubes ON THE CELLS, exactly as the SETUP box seeds
    // them (scoped to `.mb-track` — the legend below draws its own swatches).
    await expect(tracks.locator('.mb-track .mb-cell__cube--white')).toHaveCount(6);
    await expect(tracks.locator('.mb-track .mb-cell__cube--black')).toHaveCount(6);

    // The legend explains both colours in the card's own words.
    const legend = page.locator('.mb-cubelegend');
    await expect(legend).toBeVisible();
    const legendText = (await legend.innerText()).replace(/\s+/g, ' ');
    expect(legendText).toMatch(/вместо повышения температуры/i);
    expect(legendText).toMatch(/повышает температуру/i);

    await page.screenshot({path: 'screenshots/bot-corp-cubes.png', fullPage: false});
  });
});
