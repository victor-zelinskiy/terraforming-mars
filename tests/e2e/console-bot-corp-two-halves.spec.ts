import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * UTOPIA INVEST (C39) — a corporation whose whole game is ONE recurring bonus
 * card (B32 Investors) that does two completely different things depending on
 * the generation's parity. Both halves have to be readable BEFORE the card
 * comes up: the player plans against the bot's strongest track, and that track
 * is what gets pulled back every other generation.
 *
 * So this probe reads the painted card (two starting tags, the named plate)
 * AND the printed rules panel, where both halves must be stated.
 *
 * Utopia Invest is a Turmoil corporation and Turmoil is off in this config,
 * so the collision rule cannot hand the bot a different corporation.
 */

const UTOPIA_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C39'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation whose card has two halves', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face carries both starting tags, and the rules panel states both halves', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: UTOPIA_CONFIG});
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
    await expect(corpLine).toContainText(/utopia/i);

    // The bot's «РАЗЫГРАНО» — the corporation slot is a real `.pcard`.
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/utopia/i);
    await expect(slot.locator('.pcard__tags .pcard-tag'), 'building and space').toHaveCount(2);
    await page.screenshot({path: 'screenshots/bot-corp-two-halves.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed box lives.
    await key(page, 'Enter', 1600);
    await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    expect(rulesText, 'the card it owns').toMatch(/Инвестор/i);
    expect(rulesText, 'the even-generation half').toMatch(/[Чч]ётное поколение/);
    expect(rulesText, 'and the odd-generation half').toMatch(/[Нн]ечётное поколение/);
    expect(rulesText, 'no human Utopia Invest rule may leak (its 40 M€ start)').not.toMatch(/40/);
    expect(rulesText, 'nor its production trade').not.toMatch(/производств/i);
    await page.screenshot({path: 'screenshots/bot-corp-two-halves-rules.png', fullPage: false});
  });
});
