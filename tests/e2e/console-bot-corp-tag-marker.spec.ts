import {expect, test} from '@playwright/test';
import {bootToBoard, corporationsExcluding, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * ARKLIGHT (C31) — a white tracker that reminds of a TAG rule, not a track
 * rule. C09 Teractor paints the same reminder and pays for advancing its
 * track; this one pays for a plant or animal TAG, and the track it marks
 * carries THREE tags — the third pays nothing, which is what the printed
 * «(not microbe!)» is about.
 *
 * So the mat owes the player more than the marker: the LEGEND has to name the
 * exclusion, or a white tracker on a row whose identity shows leaf + paw +
 * microbe promises money it will not pay.
 */

const ARKLIGHT_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C31'},
  // The human's own deal must NOT contain Arklight: the collision rule (RB-B
  // Setup 1) would legitimately hand the bot a different corporation. The list
  // has to fill ALL EIGHT dealt slots — it is cards-on-top, not a restriction.
  customCorporationsList: corporationsExcluding('Arklight'),
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: a MarsBot tracker that reminds of a TAG rule', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the plant track wears the white tracker, and the legend names the exclusion', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: ARKLIGHT_CONFIG});
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
    await expect(corpLine).toContainText(/arklight/i);

    // The printed BOARD detail (R3 — the bot seat's own reader).
    await key(page, 'KeyV', 1400);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();

    // ONE marked row, ONE tracker on it — and no seeded cubes at all.
    await expect(tracks.locator('.mb-track--whitemarker')).toHaveCount(1);
    await expect(tracks.locator('.mb-track .mb-cell__marker')).toHaveCount(1);
    await expect(tracks.locator('.mb-track .mb-cell__cube')).toHaveCount(0);

    // …and it is the row those tags ride: its identity carries three tags.
    const markedTags = await tracks.locator('.mb-track--whitemarker .mb-track__id .tag-count').count();
    expect(markedTags, 'plant + animal + microbe share this row').toBe(3);

    // The legend states BOTH halves in RU: what pays, and what does not.
    const legend = page.locator('.mb-cubelegend');
    await expect(legend).toBeVisible();
    const legendText = (await legend.innerText()).replace(/\s+/g, ' ');
    expect(legendText).toMatch(/метка растения или животного/i);
    expect(legendText, 'the exclusion the card exists for').toMatch(/микроба не приносит ничего/i);

    await page.screenshot({path: 'screenshots/bot-corp-tag-marker.png', fullPage: false});
  });
});
