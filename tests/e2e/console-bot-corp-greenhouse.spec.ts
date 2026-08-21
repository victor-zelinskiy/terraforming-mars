import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * ECOTEC (C40) — a greenhouse on the corporation card: every plant, microbe or
 * animal tag stores a plant there, and five of them buy a step of the plant
 * track. Two things must be legible on the bot's seat from turn one:
 *
 *  · the STORE, in the face's resource capsule — and it must already read 3,
 *    because the setup box places 2 and the printed starting tag adds the
 *    third (the box resolves BEFORE the starting tags);
 *  · the white cube the setup box puts on the plant track's marker, on the
 *    bot's own mat — the reminder that this track feeds the card.
 *
 * EcoTec is a Prelude 2 corporation and that module is off in this config, so
 * the collision rule cannot hand the bot a different corporation.
 */

const ECOTEC_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C40'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation that grows plants on its own card', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face shows the store the setup filled, and the mat shows the reminder cube', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: ECOTEC_CONFIG});
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
    await expect(corpLine).toContainText(/ecotec/i);

    // The bot's printed MAT (R3) — the white marker the setup box installed.
    await key(page, 'KeyV', 1400);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();
    await expect(tracks.locator('.mb-track--whitemarker'),
      'exactly one track wears the reminder — the plant one').toHaveCount(1);
    await expect(tracks.locator('.mb-cell__marker:not(.mb-cell__marker--legend)'),
      'and the cube is painted on its current space').toHaveCount(1);
    await page.screenshot({path: 'screenshots/bot-corp-greenhouse-mat.png', fullPage: false});

    // Back to the seat, then its «РАЗЫГРАНО»: the corporation slot.
    await key(page, 'KeyB', 900);
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/ecotec/i);
    await expect(slot.locator('.pcard__tags .pcard-tag'), 'the printed plant starting tag').toHaveCount(1);

    // THE STORE: 2 from the setup box + 1 from the starting tag it resolves
    // afterwards. A face fed a card-less model would paint a permanent 0.
    const capsule = slot.locator('.pcard__res');
    await expect(capsule, 'the on-card resource capsule').toBeVisible();
    await expect(capsule).toHaveText(/3/);
    await page.screenshot({path: 'screenshots/bot-corp-greenhouse.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed boxes live.
    await key(page, 'Enter', 1600);
    await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    expect(rulesText, 'the three feeding tags').toMatch(/животного/i);
    expect(rulesText, 'the printed threshold').toMatch(/5/);
    expect(rulesText, 'and what it buys').toMatch(/трек растений/i);
    expect(rulesText, 'no human EcoTec rule may leak (its 42 M€ start)').not.toMatch(/42/);
    expect(rulesText, 'nor its production step').not.toMatch(/производств/i);
    await page.screenshot({path: 'screenshots/bot-corp-greenhouse-rules.png', fullPage: false});
  });
});
