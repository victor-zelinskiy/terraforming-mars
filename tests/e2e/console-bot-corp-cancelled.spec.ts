import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * PRISTAR (C36) — the corporation that makes the bot NOT do something. Its
 * face has to say that in one look, and the premium renderer's way of saying
 * «this does not happen» is the STRUCK-THROUGH icon the human Pristar uses on
 * its own cancelled TR.
 *
 * So this probe reads the painted face: four cancelled global parameters, the
 * TR + 6 M€ that replace them, and the white cube in the resource capsule
 * that the Before-Action-Phase box has already placed by the first action
 * phase (which is why the card prints no SETUP box at all).
 *
 * Pristar is a Turmoil corporation and Turmoil is off in this config, so the
 * collision rule cannot hand the bot a different corporation.
 */

const PRISTAR_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C36'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation that cancels the bot\'s own terraforming', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face paints four struck-through parameters and the cube that pays for them', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: PRISTAR_CONFIG});
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
    await expect(corpLine).toContainText(/pristar/i);

    // The bot's «РАЗЫГРАНО» — the corporation slot is a real `.pcard`.
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/pristar/i);

    // The four parameters, each struck through.
    await expect(slot.locator('.pcard-mi--cancelled'),
      'temperature, oxygen, ocean and Venus are all painted as NOT happening').toHaveCount(4);

    // …and the cube the Before-Action-Phase box already placed: no SETUP box
    // exists on this card, so a capsule reading 1 is the proof that box ran.
    const capsule = slot.locator('.pcard__res');
    await expect(capsule, 'the on-card resource capsule').toBeVisible();
    await expect(capsule).toHaveText(/1/);
    await page.screenshot({path: 'screenshots/bot-corp-cancelled.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed boxes live.
    await key(page, 'Enter', 1600);
    await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    expect(rulesText, 'what it replaces').toMatch(/температур/i);
    expect(rulesText, 'what it pays').toMatch(/6 M€/);
    expect(rulesText, 'and what does not happen').toMatch(/глобальный параметр/i);
    expect(rulesText, 'the box that re-arms it').toMatch(/белый куб/i);
    expect(rulesText, 'no human Pristar rule may leak (its 53 M€ start)').not.toMatch(/53/);
    expect(rulesText, 'nor its preservation VP').not.toMatch(/ПО\b/);
    await page.screenshot({path: 'screenshots/bot-corp-cancelled-rules.png', fullPage: false});
  });
});
