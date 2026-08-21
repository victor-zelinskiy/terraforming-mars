import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * KUIPER COOPERATIVE (C41) — six cubes, all on the space track: three white
 * (heat) and three black (water). The whole card is that one mined track, so
 * the thing that has to be legible is the MAT: both colours painted on their
 * printed spaces, and a legend that tells them apart.
 *
 * Kuiper Cooperative is a promo corporation, and the human deal here comes
 * from the base/corpera pool, so the collision rule cannot hand the bot a
 * different corporation.
 */

const KUIPER_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C41'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation whose whole game is one mined track', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the mat paints both cube colours with their own legends, and the face states them', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: KUIPER_CONFIG});
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
    await expect(corpLine).toContainText(/kuiper/i);

    // The bot's printed MAT (R3): six cubes on ONE track, three of each colour.
    await key(page, 'KeyV', 1400);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();
    // The legend paints its own swatches, so count only the ones ON the grid.
    const cubes = tracks.locator('.mb-track .mb-cell__cube');
    await expect(cubes, 'three white and three black').toHaveCount(6);
    await expect(tracks.locator('.mb-track .mb-cell__cube--white'), 'the heat cubes').toHaveCount(3);
    await expect(tracks.locator('.mb-track .mb-cell__cube--black'), 'the water cubes').toHaveCount(3);
    const rowsWithCubes = await tracks.locator('.mb-track', {has: page.locator('.mb-cell__cube')}).count();
    expect(rowsWithCubes, 'all six sit on the SPACE track alone').toBe(1);
    const matText = (await tracks.innerText()).replace(/\s+/g, ' ');
    expect(matText, 'the white legend').toMatch(/температур/i);
    expect(matText, 'the black legend').toMatch(/океан/i);
    await page.screenshot({path: 'screenshots/bot-corp-mined-track-mat.png', fullPage: false});

    // Back to the seat, then its «РАЗЫГРАНО»: the corporation slot.
    await key(page, 'KeyB', 900);
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/kuiper/i);
    await expect(slot.locator('.pcard__tags .pcard-tag'), 'the printed space starting tag').toHaveCount(1);
    await page.screenshot({path: 'screenshots/bot-corp-mined-track.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed boxes live.
    await key(page, 'Enter', 1600);
    await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    expect(rulesText, 'where the white cubes sit').toContain('#4, #8, #12');
    expect(rulesText, 'and the black ones').toContain('#7, #10, #14');
    expect(rulesText, 'what white does').toMatch(/температур/i);
    expect(rulesText, 'what black does').toMatch(/океан/i);
    expect(rulesText, 'no human Kuiper rule may leak (its 33 M€ start)').not.toMatch(/33/);
    await page.screenshot({path: 'screenshots/bot-corp-mined-track-rules.png', fullPage: false});
  });
});
