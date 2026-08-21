import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * SAGITTA FRONTIER SERVICES (C44) — the corporation that earns from the thin
 * end of the deck: a card with NO tags pays 10 M€ instead of the usual Failed
 * Action compensation, a card with exactly one pays 1. Nothing of it lands on
 * the mat, so what has to be legible is the CARD: two starting tags, and both
 * clauses in the fullscreen inspect.
 *
 * Sagitta Frontier Services is a Prelude 2 corporation and this config runs
 * without that module, so the collision rule cannot hand the bot a different
 * one.
 */

const SAGITTA_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C44'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation that lives on the thin end of the deck', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the seat names it, the face carries two tags, and the rules state both clauses', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: SAGITTA_CONFIG});
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
    await expect(corpLine).toContainText(/sagitta/i);

    // The seat's «РАЗЫГРАНО»: the corporation slot.
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/sagitta/i);
    await expect(slot.locator('.pcard__tags .pcard-tag'), 'power and event').toHaveCount(2);
    await page.screenshot({path: 'screenshots/bot-corp-thin-freight.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed boxes live.
    await key(page, 'Enter', 1600);
    await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    expect(rulesText, 'the setup payment').toContain('8');
    expect(rulesText, 'what a card with no tags pays').toContain('10');
    expect(rulesText, 'and that it replaces the failure compensation').toMatch(/неудачн/i);
    expect(rulesText, 'the single-tag clause').toMatch(/одной меткой|1 меткой/i);
    expect(rulesText, 'no human Sagitta rule may leak (its 31 M€ start)').not.toContain('31');
    expect(rulesText, 'and no production of its').not.toMatch(/производств/i);
    await page.screenshot({path: 'screenshots/bot-corp-thin-freight-rules.png', fullPage: false});
  });
});
