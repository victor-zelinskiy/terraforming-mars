import {expect, test} from '@playwright/test';
import {closeZoomViewer, openConsole, openZoomViewer, press, waitStepDealSettled} from './consoleStart';
import {createCampaign, devCommit, launchMission} from './campaignFixtures';

/**
 * CAMPAIGN: THE LEGACY OVERVIEW in the start wizard (mission 2+).
 *
 * What this pins, in one mission-2 boot (the regression class):
 *  · the Selection Dock shows the legacy blocks for a SINGLE-corporation
 *    lineage (the old merge-chapter gate hid exactly this case) AND the
 *    carried projects as their own block;
 *  · R3 descends into «НАСЛЕДИЕ › ОБЗОР» inside the same workspace: the
 *    page releases, the cards physically fly UP from the shelf tiles into
 *    two zones (the tiles are HELD — one visual owner; the shelf's geometry
 *    never changes), X inspects fullscreen over the stage;
 *  · B is ONE level back: the overview folds, the tiles are restored, and
 *    the page returns with its PICKS INTACT (the whole point of the read —
 *    it informs a decision that is still being made).
 */
test.describe('campaign legacy overview', () => {
  test('mission 2: shelf blocks → R3 overview → X inspect → B lossless return', async ({page, request}) => {
    test.setTimeout(180_000);
    const {id} = await createCampaign(request);
    // Mission 1 committed by fixture: a ONE-corp lineage (the exact shape the
    // old gate hid) + two carried projects for Alice's seat.
    await devCommit(request, id, [0, 1], {
      lineages: {0: ['Tharsis Republic'], 1: ['Helion']},
      carryover: {0: ['Ants', 'Algae'], 1: []},
    });
    const {yourPlayerId} = await launchMission(request, id);
    expect(yourPlayerId).toBeTruthy();

    await openConsole(page, yourPlayerId!);
    await page.waitForSelector('.con-start__frame', {timeout: 60_000});
    await waitStepDealSettled(page);

    // ── The shelf: 1 lineage corporation + 2 carried projects, ON THE CORP
    // STEP (mission 2 — the single-corp lineage must render). ─────────────
    await expect(page.locator('[data-legacy-dock]')).toHaveCount(3);
    await expect(page.locator('.con-startdock__legacy--projects [data-legacy-dock]')).toHaveCount(2);

    // A pick made BEFORE the descent — it must survive the round trip.
    await press(page, 'Enter', 500);
    const picked = await page.locator('.con-cards__slot--picked').count();
    expect(picked).toBe(1);

    // ── R3 → the overview. ────────────────────────────────────────────────
    await press(page, 'KeyV', 400);
    await page.waitForSelector('.con-legview--live', {timeout: 10_000});
    // Every card LANDS (its seat un-holds on its own touchdown).
    await page.waitForFunction(() => {
      const seats = Array.from(document.querySelectorAll('[data-legview-slot]'));
      return seats.length === 3 && seats.every((s) => !s.classList.contains('con-deal-hold'));
    }, undefined, {timeout: 12_000});
    // Two zones (corporations · carried projects), all three cards up.
    await expect(page.locator('.con-legview__zone')).toHaveCount(2);
    // ONE VISUAL OWNER: the shelf tiles are held while their cards are up —
    // and the shelf itself is still standing (the bar never changes).
    await expect(page.locator('.con-startdock__legacy-card--held')).toHaveCount(3);
    await expect(page.locator('.con-startdock')).toBeVisible();
    // The workspace header reads the sub-section (never a self-titled modal).
    const head = (await page.locator('.con-wshead').innerText()).toLowerCase();
    expect(/наследие|legacy/.test(head), `crumb: ${head}`).toBeTruthy();

    // ── d-pad walks the flat set freely across both zones. ───────────────
    const focusedSeat = () => page.evaluate(() =>
      document.querySelector('.con-legview__slot--focused')?.getAttribute('data-legview-slot') ?? '');
    const first = await focusedSeat();
    await press(page, 'ArrowRight', 250);
    await press(page, 'ArrowRight', 250);
    const third = await focusedSeat();
    expect(third).not.toBe(first);
    // The projects zone is reachable (the third card is a carried project).
    expect(await page.evaluate((name) =>
      document.querySelector(`.con-legview__zone--projects [data-legview-slot="${name}"]`) !== null, third)).toBeTruthy();

    // ── X: fullscreen read over the stage; closing keeps the overview. ────
    await openZoomViewer(page);
    await closeZoomViewer(page);
    await expect(page.locator('.con-legview--live')).toBeVisible();

    // ── B: one level back — cards fly home, tiles restore, the page and its
    // pick are exactly as left. ───────────────────────────────────────────
    await press(page, 'Escape', 400);
    await page.waitForFunction(() =>
      document.querySelectorAll('.con-startdock__legacy-card--held').length === 0 &&
      document.querySelector('.con-legview--live') === null, undefined, {timeout: 12_000});
    await expect(page.locator('[data-legacy-dock]')).toHaveCount(3);
    await expect(page.locator('.con-cards__slot--picked')).toHaveCount(1);
    // The step surface is live again (the corp step's cards are back).
    await expect(page.locator('.con-start__steppane .con-cards__slot').first()).toBeVisible();
  });
});
