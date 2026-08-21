import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * NIRGAL ENTERPRISES (C42) — the corporation that is a SCHEDULE: a free
 * milestone claim in the early generations, a free award funding through the
 * middle, milestones again at the end, and +2 on every award throughout. It
 * puts nothing on the mat, so what has to be legible is the CARD: three
 * starting tags in the corner box (the only base shape with three), and the
 * printed boxes in the fullscreen inspect.
 *
 * Nirgal Enterprises is a Prelude 2 corporation and this config runs without
 * that module, so the collision rule cannot hand the bot a different one.
 */

const NIRGAL_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C42'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation that runs on a schedule', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the seat names it, the face carries three tags, and the rules state the whole schedule', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: NIRGAL_CONFIG});
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
    await expect(corpLine).toContainText(/nirgal/i);

    // The seat's «РАЗЫГРАНО»: the corporation slot.
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/nirgal/i);
    await expect(slot.locator('.pcard__tags .pcard-tag'), 'building, power and plant').toHaveCount(3);
    await page.screenshot({path: 'screenshots/bot-corp-award-office.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed boxes live.
    await key(page, 'Enter', 1600);
    await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    expect(rulesText, 'the card its setup removes').toContain('Сверхдостижение');
    expect(rulesText, 'the printed award modifier').toContain('2');
    expect(rulesText, 'and that it is about awards').toContain('наград');
    expect(rulesText, 'the early generations').toContain('2-5');
    expect(rulesText, 'the middle ones').toContain('6-9');
    expect(rulesText, 'and the late ones').toContain('10+');
    expect(rulesText, 'the milestone half').toContain('достижение');
    expect(rulesText, 'and that an empty box is no Failed Action').toContain('неудачное действие');
    expect(rulesText, 'no human Nirgal rule may leak (its 30 M€ start)').not.toContain('30');
    await page.screenshot({path: 'screenshots/bot-corp-award-office-rules.png', fullPage: false});
  });
});
