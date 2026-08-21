import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * LAKEFRONT RESORTS (C35) — the corporation whose whole rule is the white cube
 * sitting ON its card. The cube is a one-bit memory (an ocean either spends it
 * for a building-track step or puts it back), so the face's resource capsule
 * is not decoration here: it is the only place a player can read what the next
 * ocean will do.
 *
 * That capsule is exactly what a face built from a card-less view-model paints
 * as a permanent 0 — the count has to travel from the server model through the
 * live `CardModel` handed to the face. This probe reads the PAINTED number in
 * the bot's tableau: one cube after setup.
 *
 * Lakefront Resorts is a Turmoil corporation and Turmoil is off in this
 * config, so the collision rule cannot hand the bot a different corporation.
 */

const LAKEFRONT_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C35'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation that keeps a cube on its card', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face paints the white cube it starts with, and the rules panel prints both halves', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: LAKEFRONT_CONFIG});
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
    await expect(corpLine).toContainText(/lakefront/i);

    // The bot's «РАЗЫГРАНО» — the corporation slot is a real `.pcard`.
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/lakefront/i);

    // THE CUBE. The setup box placed exactly one, and the capsule must say so
    // — a face fed a card-less model paints a permanent 0 here.
    const capsule = slot.locator('.pcard__res');
    await expect(capsule, 'the on-card resource capsule').toBeVisible();
    await expect(capsule).toHaveText(/1/);
    await page.screenshot({path: 'screenshots/bot-corp-card-cube.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed boxes live.
    await key(page, 'Enter', 1600);
    await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    // Kickers render uppercase (text-transform) — match case-insensitively.
    expect(rulesText, 'the cube the setup places').toMatch(/белый куб/i);
    expect(rulesText, 'what an ocean does to it').toMatch(/трек[а]? строительства/i);
    expect(rulesText, 'and the standing shoreline rate').toMatch(/3 M€/);
    expect(rulesText, 'no human Lakefront Resorts rule may leak (its 54 M€ start)').not.toMatch(/54/);
    expect(rulesText, 'nor its M€ PRODUCTION gain').not.toMatch(/производств/i);
    await page.screenshot({path: 'screenshots/bot-corp-card-cube-rules.png', fullPage: false});
  });
});
