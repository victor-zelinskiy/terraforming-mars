import {expect, test} from '@playwright/test';
import {openBotBoardDetail, bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * PALLADIN SHIPPING (C43) — twelve cubes on TWO tracks: six white on space,
 * six black on event, and a step of temperature costs one of each. Two things
 * have to be legible: the MAT (both colours, on their own tracks, sharing ONE
 * legend row because what a cube does on arrival does not depend on its
 * colour), and the CARD (two starting tags, and the pairing rule in the
 * fullscreen inspect).
 *
 * Palladin Shipping is a Prelude 2 corporation and this config runs without
 * that module, so the collision rule cannot hand the bot a different one.
 */

const PALLADIN_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C43'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation that needs both halves of a shipment', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the mat carries both colours on their own tracks, and the card states the pairing', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: PALLADIN_CONFIG});
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
    await expect(corpLine).toContainText(/palladin/i);

    // The bot's printed MAT (R3): twelve cubes over TWO tracks.
    await openBotBoardDetail(page);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();
    const cubes = tracks.locator('.mb-track .mb-cell__cube');
    await expect(cubes, 'six of each colour').toHaveCount(12);
    await expect(tracks.locator('.mb-track .mb-cell__cube--white')).toHaveCount(6);
    await expect(tracks.locator('.mb-track .mb-cell__cube--black')).toHaveCount(6);
    const rowsWithCubes = await tracks.locator('.mb-track', {has: page.locator('.mb-cell__cube')}).count();
    expect(rowsWithCubes, 'space and event — two tracks, never one').toBe(2);
    // ONE legend row for both colours: the arrival rule is colour-blind.
    await expect(tracks.locator('.mb-cubelegend__row'), 'one shared legend row').toHaveCount(1);
    const matText = (await tracks.innerText()).replace(/\s+/g, ' ');
    expect(matText, 'what a cube does on arrival').toMatch(/карту корпорации/i);
    expect(matText, 'and what a pair buys').toMatch(/температур/i);
    await page.screenshot({path: 'screenshots/bot-corp-two-halves-cube-mat.png', fullPage: false});

    // Back to the seat, then its «РАЗЫГРАНО»: the corporation slot.
    await key(page, 'KeyB', 900);
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/palladin/i);
    await expect(slot.locator('.pcard__tags .pcard-tag'), 'space and event').toHaveCount(2);
    await page.screenshot({path: 'screenshots/bot-corp-two-halves-cube.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed boxes live.
    await key(page, 'Enter', 1600);
    await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    expect(rulesText, 'the setup payment').toContain('5');
    expect(rulesText, 'the six spaces, the same on both tracks').toContain('#3, #4, #6, #8, #10, #11');
    expect(rulesText, 'where the white cubes sit').toMatch(/трека космоса/i);
    expect(rulesText, 'and the black ones').toMatch(/трека событий/i);
    expect(rulesText, 'what a pair buys').toMatch(/температур/i);
    expect(rulesText, 'no human Palladin rule may leak (its 36 M€ start)').not.toContain('36');
    expect(rulesText, 'and no titanium of its').not.toMatch(/титан/i);
    await page.screenshot({path: 'screenshots/bot-corp-two-halves-cube-rules.png', fullPage: false});
  });
});
