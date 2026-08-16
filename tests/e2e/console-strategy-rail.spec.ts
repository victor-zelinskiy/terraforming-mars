import {expect, test, Page} from '@playwright/test';
import {bootIntoGame, press, soloGameConfig} from './consoleStart';

/**
 * P30 — the right STRATEGY RAIL (Milestones/Awards premium HUD).
 *
 * The composition invariant this spec exists for: the right rail is the LEFT
 * resource rail's geometric twin (same seam token → same rendered width), the
 * old wide context panel is GONE from the idle board home (no hidden spacer —
 * the board section really owns the freed band), and the LB/RB doors still
 * open their workspaces. Geometry is asserted at BOTH 1080p and 4K TV — a fit
 * claim asserted at one resolution is a claim about one resolution.
 *
 * The game is a MarsBot duo (a TRUE solo disables milestones/awards by rule —
 * `Game.allAwardsFunded()` is true at one seat, and the rail would be a
 * legal-but-degenerate render).
 */

async function railBoxes(page: Page) {
  const left = await page.locator('.con-res').boundingBox();
  const right = await page.locator('.con-strat').boundingBox();
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  return {left: left!, right: right!};
}

async function bootHome(page: Page, request: Parameters<typeof bootIntoGame>[1], query = '') {
  await bootIntoGame(page, request, {
    config: soloGameConfig({automa: {difficulty: 'normal'}}),
    query,
  });
  await page.waitForSelector('.con-strat', {timeout: 30_000});
  await page.waitForTimeout(800);
}

test.describe('console strategy rail — FHD', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the right rail is the left rail\'s twin; the dossier overlay is gone from idle', async ({page, request}) => {
    await bootHome(page, request);

    const {left, right} = await railBoxes(page);
    // The SAME seam token → the same rendered width, to the pixel budget.
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1.5);
    // No hidden spacer: the old wide panel is unmounted on the idle home.
    expect(await page.locator('.con-inspector').count()).toBe(0);
    // The board section really spans between the two rails.
    const board = await page.locator('.con-board').boundingBox();
    expect(board).not.toBeNull();
    expect(board!.x).toBeGreaterThanOrEqual(left.x + left.width);
    expect(board!.x + board!.width).toBeLessThanOrEqual(right.x + 2);

    // Both zones stand with their medal stacks and door caps.
    expect(await page.locator('.con-strat__zone--milestones .con-strat__item').count()).toBeGreaterThan(0);
    expect(await page.locator('.con-strat__zone--awards .con-strat__item').count()).toBeGreaterThan(0);
    await expect(page.locator('.con-strat__head .gp-glyph').first()).toBeVisible();
    // ONE compact head line: the slot tray lives inside the door button;
    // the PRICE is deliberately absent from the standing HUD (it belongs to
    // the workspace where the claim/fund decision is made) — and the NAME
    // never ellipsizes to make room for the tray.
    expect(await page.locator('.con-strat__head .con-strat__pip').count()).toBe(6);
    expect(await page.locator('.con-strat__price').count()).toBe(0);
    const titleDeficits = await page.evaluate(() =>
      [...document.querySelectorAll('.con-strat__title')].map((t) => t.scrollWidth - t.clientWidth));
    for (const d of titleDeficits) {
      expect(d, 'zone title fully visible (no ellipsis)').toBeLessThanOrEqual(1);
    }

    await page.screenshot({path: 'screenshots/strategy-rail/fhd-home.png', fullPage: false});
  });

  test('LB / RB open the workspaces; closing restores the rail intact', async ({page, request}) => {
    await bootHome(page, request);

    await press(page, 'KeyQ', 1100); // LB → milestones workspace
    await expect(page.locator('.con-ma')).toBeVisible();
    await page.screenshot({path: 'screenshots/strategy-rail/fhd-ma-workspace.png'});
    await press(page, 'Escape', 1100);
    await expect(page.locator('.con-ma')).toHaveCount(0);

    await press(page, 'KeyE', 1100); // RB → awards workspace
    await expect(page.locator('.con-ma')).toBeVisible();
    await press(page, 'Escape', 1100);

    const {left, right} = await railBoxes(page);
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1.5);
  });

  test('a board task raises the dossier OVERLAY without reflowing the board', async ({page, request}) => {
    await bootHome(page, request);
    const boardBefore = await page.locator('.con-board').boundingBox();

    // Enter board inspection (L3 = KeyC in the console key bridge) — the cell
    // dossier must rise as an OVERLAY (any dossier mode serves the claim).
    await press(page, 'KeyC', 900);
    const overlayUp = async () => (await page.locator('.con-inspector').count()) > 0;
    if (!(await overlayUp())) {
      // Fallback: scale inspection (R3 = KeyV) is a dossier mode too.
      await press(page, 'KeyV', 900);
    }
    expect(await overlayUp(), 'a dossier mode must raise the overlay').toBe(true);

    const overlay = await page.locator('.con-inspector').boundingBox();
    const boardAfter = await page.locator('.con-board').boundingBox();
    expect(overlay).not.toBeNull();
    // The overlay is pinned to the right edge…
    expect(overlay!.x + overlay!.width).toBeGreaterThan(boardAfter!.x + boardAfter!.width - 4);
    // …and the board box did NOT reflow underneath it.
    expect(Math.abs(boardAfter!.x - boardBefore!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(boardAfter!.width - boardBefore!.width)).toBeLessThanOrEqual(1);
  });
});

test.describe('console strategy rail — Deck handheld', () => {
  test.use({viewport: {width: 1280, height: 800}});

  test('the twin-rail geometry holds on the handheld profile; nothing clips', async ({page, request}) => {
    await bootHome(page, request);
    const {left, right} = await railBoxes(page);
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1.5);
    const rail = await page.locator('.con-strat').boundingBox();
    const rows = await page.locator('.con-strat__item').all();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const box = await row.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(rail!.y - 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(rail!.y + rail!.height + 1);
    }
    await page.screenshot({path: 'screenshots/strategy-rail/deck-home.png'});
  });
});

test.describe('console strategy rail — 4K TV profile', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the twin-rail geometry holds on the TV profile', async ({page, request}) => {
    await bootHome(page, request, '&consoleProfile=tv');

    const {left, right} = await railBoxes(page);
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(2);
    expect(await page.locator('.con-inspector').count()).toBe(0);
    // Nothing overflows the rail: every medal row lies inside the rail box.
    const rows = await page.locator('.con-strat__item').all();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const box = await row.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(right.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(right.x + right.width + 1);
    }
    // The couch title never ellipsizes — a claim asserted at ONE resolution
    // is a claim about one resolution, and the TV rem is where «ДОСТИЖЕНИЯ»
    // actually ran out of line once.
    const titleDeficits = await page.evaluate(() =>
      [...document.querySelectorAll('.con-strat__title')].map((t) => t.scrollWidth - t.clientWidth));
    for (const d of titleDeficits) {
      expect(d, 'zone title fully visible at 4K (no ellipsis)').toBeLessThanOrEqual(1);
    }
    await page.screenshot({path: 'screenshots/strategy-rail/tv4k-home.png'});
  });
});
