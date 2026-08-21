import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * TERRALABS (C38) — the corporation that buys tempo with rating. Two things
 * have to be legible the moment the player opens the bot's seat:
 *
 *  · the PRICE, painted on the face as the human card's own «minus TR» shape
 *    (8 steps where the human pays 1);
 *  · the fact that the bot really starts 8 TR down — the HUD is where a
 *    player reads that, and it is the one number this card changes on turn 1.
 *
 * So this probe reads the painted face AND the bot's live TR beside it. The
 * printed science tag rides the corner box, so the tag rail must carry one.
 *
 * TerraLabs Research is a Turmoil corporation and Turmoil is off in this
 * config, so the collision rule cannot hand the bot a different corporation.
 */

const TERRALABS_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C38'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation that pays for its deck in TR', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face prints the 8 TR price and the bot really starts that far down', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: TERRALABS_CONFIG});
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
    await expect(corpLine).toContainText(/terralabs/i);

    // The bot's live rating: 20 − 8. The bot seat's pane prints decks, played
    // cards and VP but no TR, so this half of the claim is read off the model
    // the console renders from — the face below is the painted half.
    const model = await (await request.get(`/api/player?id=${players[0].id}`)).json();
    const botSeat = model.players.find((seat: {isMarsBot?: boolean}) => seat.isMarsBot === true);
    expect(botSeat, 'the game has a MarsBot seat').toBeTruthy();
    expect(botSeat.terraformRating, 'the printed 8 TR came off the standard 20').toBe(12);

    // The bot's «РАЗЫГРАНО» — the corporation slot is a real `.pcard`.
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/terralabs/i);

    // The corner box carries a science tag — one, and only one.
    await expect(slot.locator('.pcard__tags .pcard-tag'), 'the printed science starting tag').toHaveCount(1);
    // …and the mechanics zone prints the price with the TR badge.
    await expect(slot.locator('.pcard__mech')).toContainText('8');
    await page.screenshot({path: 'screenshots/bot-corp-tr-price.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed boxes live.
    await key(page, 'Enter', 1600);
    await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    expect(rulesText, 'the printed price').toMatch(/8 РТ/);
    expect(rulesText, 'what it buys').toMatch(/колод[уы] действий/i);
    expect(rulesText, 'and the late doubling').toMatch(/9-го поколения/);
    expect(rulesText, 'no human TerraLabs rule may leak (its 14 M€ start)').not.toMatch(/14/);
    expect(rulesText, 'nor its cheap cards to hand').not.toMatch(/в руку/i);
    await page.screenshot({path: 'screenshots/bot-corp-tr-price-rules.png', fullPage: false});
  });
});
