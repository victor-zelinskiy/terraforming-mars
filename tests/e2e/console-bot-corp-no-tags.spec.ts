import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * TYCHO MAGNETICS (C46) — the emptiest face in the set: no starting tags, no
 * cubes, no markers, no effect box. The whole corporation is ONE bonus card
 * (B30 Interface Hyperlink) waiting at the BOTTOM of the bonus deck, so the
 * mechanics zone carries two symbolic rows and everything else it has to say
 * is printed text in the inspect panel beside the card.
 *
 * A face this sparse is where a template built around a full card can fall
 * apart — a collapsed mechanics zone, a nameplate sliding into the box, a
 * rules panel with a kicker and no body. This probe reads the PAINTED card in
 * the bot's tableau and then its fullscreen inspect.
 *
 * Tycho Magnetics is not in the probe corporation pool (base + corpera only),
 * so the collision rule cannot hand the bot a different corporation here.
 */

const TYCHO_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C46'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation whose whole rule is a bonus card', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face paints without a tag rail, and the inspect panel prints where the card waits', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: TYCHO_CONFIG});
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
    await expect(corpLine).toContainText(/tycho/i);

    // The bot's «РАЗЫГРАНО» — the corporation slot is a real `.pcard`.
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .pcard');
    await expect(slot, 'the corporation slot stands in the bot tableau').toBeVisible();
    expect((await slot.innerText()).replace(/\s+/g, ' '), 'the title is the original corporation').toMatch(/tycho/i);

    // No rail at all — the card prints no starting tag, so the strip is
    // OMITTED rather than painted empty (CrediCor's face reads the same way).
    expect(await slot.locator('.pcard__tags').count(), 'no tag rail is painted').toBe(0);

    // The mechanics zone is the only printed content, and it must hold height.
    const mech = slot.locator('.pcard__mech');
    await expect(mech).toBeVisible();
    const cardRect = await slot.boundingBox();
    const mechRect = await mech.boundingBox();
    expect(cardRect, 'the face is laid out').not.toBeNull();
    expect(mechRect, 'the mechanics zone is laid out').not.toBeNull();
    expect(mechRect!.height, `the mechanics zone must hold real height, saw ${mechRect!.height}`).toBeGreaterThan(24);
    expect(mechRect!.y + mechRect!.height,
      `it must stay inside the card: zone bottom ${mechRect!.y + mechRect!.height}, card bottom ${cardRect!.y + cardRect!.height}`)
      .toBeLessThanOrEqual(cardRect!.y + cardRect!.height + 1);
    await page.screenshot({path: 'screenshots/bot-corp-no-tags.png', fullPage: false});

    // A on the slot → the fullscreen inspect, where the printed boxes live.
    await key(page, 'Enter', 1600);
    const zoomFace = page.locator('.con-zoom .card-zoom-stage .pcard');
    await expect(zoomFace, 'the fullscreen premium corporation face').toBeVisible();
    const rules = page.locator('.con-zoom-rules');
    await expect(rules).toBeVisible();
    const rulesText = (await rules.innerText()).replace(/\s+/g, ' ');
    // Kickers render uppercase (text-transform) — match case-insensitively.
    expect(rulesText, 'the printed draft priority').toMatch(/приоритет драфта/i);
    expect(rulesText, 'where the card waits').toMatch(/дно бонусной колоды/i);
    expect(rulesText, 'what it does when it finally comes up').toMatch(/трека энергии/i);
    expect(rulesText, 'no human Tycho Magnetics rule may leak (its floater action)').not.toMatch(/аэростат/i);
    await page.screenshot({path: 'screenshots/bot-corp-bottom-of-deck.png', fullPage: false});
  });
});
