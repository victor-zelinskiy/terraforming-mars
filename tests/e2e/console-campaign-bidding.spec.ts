import {expect, test} from './consoleTest';
import {press, reloadConsole} from './consoleStart';
import {bidAs, campaignModelAs, createCampaign, launchMission, openMapAs} from './campaignFixtures';
import {journeyToEndgame, waitWithFrames, shoot} from './consoleEndgameHarness';

/*
 * CAMPAIGN «ТЕНДЕРЫ» — THE BIDDING on the endgame screen (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §6).
 *
 * A REAL mission 1 of a two-seat tenders campaign, played to Phase.END through the shared endgame harness. What is
 * pinned here:
 *  · the bidding scene opens ITSELF once the ceremony settles — the Register deals two lots (D2: two seats, two
 *    cards), the reveal plays and ENDS ON ITS OWN (its hold released; the pad absorbed only while it runs);
 *  · the pick order strip names both seats, the first picks — the viewer by A on an open lot, or the other seat
 *    over the API, whose pick the push PRESENTS on this table (the owner's stamp);
 *  · the last pick closes the bidding: the untaken lot is WITHDRAWN (said, never vanished), the holding is recorded;
 *  · B returns to the results, where the taker's row wears the tender PLAQUE on its crest anchor;
 *  · a reload lands SETTLED — no second deal, the stamp standing.
 */

const SHOT_DIR = 'screenshots/console-campaign-bidding';

test.describe('campaign «Тендеры» — the bidding', () => {
  test('mission 1 ends: the Register deals, the places pick in turn, the plaque lands on the podium', async ({page, request}) => {
    test.setTimeout(600_000);

    const {id} = await createCampaign(request, {testMode: true}, {rewardMode: 'tenders'});
    const {yourPlayerId: aliceId} = await launchMission(request, id);
    expect(aliceId, 'launch must hand the creator her mission seat').toBeTruthy();
    const brunoModel = await campaignModelAs(request, id, 'Bruno');
    const brunoId = brunoModel.missions[0]?.yourPlayerId;
    expect(brunoId, 'the second seat must be addressable').toBeTruthy();

    await journeyToEndgame(page, request, [aliceId!, brunoId!]);

    // ── the scene opens by itself after the ceremony ──────────────────────
    await waitWithFrames(page, async () =>
      (await page.locator('[data-eg-bidding-scene] [data-bidding-stage]').count()) > 0,
    150_000, 'the bidding scene after the ceremony');
    await waitWithFrames(page, async () =>
      (await page.locator('[data-bidding-stage].con-bidding--revealing').count()) === 0,
    30_000, 'the reveal to end on its own');
    await shoot(page, SHOT_DIR, 'table');

    const cards = page.locator('[data-bidding-card]');
    expect(await cards.count(), 'two seats, two lots (D2)').toBe(2);
    expect(await page.locator('[data-bidding-seat]').count(), 'both seats in the pick order').toBe(2);
    // Every lot is a CERTIFICATE: the Committee's head (seal + lot tag), the metal frame, the rule, the stub.
    expect(await page.locator('[data-bidding-card] .con-tender__head').count()).toBe(2);
    expect(await page.locator('[data-bidding-card] .con-tender__frame').count()).toBe(2);
    expect(await page.locator('[data-bidding-card] .con-tender__coupon').count()).toBe(2);

    // ── the first of the order picks ──────────────────────────────────────
    const live = await campaignModelAs(request, id, 'Alice');
    expect(live.bidding?.done).toBe(false);
    const turn = await page.locator('[data-bidding-stage]').getAttribute('data-bidding-turn');
    expect(String(live.bidding!.order[0])).toBe(turn);
    const instance = live.bidding!.offer[0].instance;
    if (turn === '0') {
      // Alice (the page) picks the first lot with A.
      // The bar paints its verbs in caps (`text-transform` — innerText carries it), so the read is case-blind.
      await expect.poll(() => page.locator('.con-cmdbar').innerText()).toMatch(/Взять тендер/i);
      await press(page, 'Enter', 900);
    } else {
      // Bruno picks over the API — the push presents his pick on Alice's table.
      await bidAs(request, id, brunoId!, instance);
    }
    await waitWithFrames(page, async () =>
      (await page.locator('[data-bidding-stage][data-bidding-done="yes"]').count()) > 0,
    30_000, 'the bidding to close');
    await expect.poll(() => page.locator('[data-bidding-card][data-bidding-taken]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-bidding-card][data-bidding-withdrawn="yes"]').count(), {message: 'the untaken lot is WITHDRAWN, never gone'}).toBe(1);
    await expect.poll(() => page.locator('[data-bidding-card][data-bidding-taken] .con-tender__stamp--owner').count(), {message: 'the taker\'s stamp lands'}).toBe(1);
    // …and is SEEN — painted inside its lot, never laid out of the clip (the 2026-11-07 frame: a body rule had turned
    // the stamp relative and pushed it under the stub).
    await expect(page.locator('[data-bidding-card][data-bidding-taken] .con-tender__stamp--owner')).toBeInViewport();
    await expect(page.locator('[data-bidding-card][data-bidding-withdrawn="yes"] .con-tender__stamp--withdrawn')).toBeInViewport();
    await shoot(page, SHOT_DIR, 'done');

    const after = await campaignModelAs(request, id, 'Alice');
    expect(after.bidding, 'the live bidding is over').toBeUndefined();
    expect(after.missions[0].bidding?.done).toBe(true);
    const winner = Number(turn);
    expect(after.progression?.tenders?.[winner]?.length, 'the holding is recorded').toBe(1);
    expect(after.progression?.tenders?.[winner]?.[0].status).toBe('held');

    // ── B returns to the results; the taker's row wears the plaque ────────
    await press(page, 'Escape', 900);
    await expect.poll(() => page.locator('[data-eg-bidding-scene]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-eg-tender]').count(), {message: 'the tender plaque on the winner\'s crest'}).toBe(1);
    // ONE object on the crest anchor: the «ПОБЕДИТЕЛЬ» ribbon has yielded to the plaque (its leave played under the
    // bidding scene) — it never peeks out from behind the plaque (the 2026-11-07 frame).
    await expect.poll(() => page.locator('.con-eg__row:has([data-eg-tender]) .con-eg__ribbon').count(),
      {message: 'the winner ribbon shares no anchor with the tender plaque'}).toBe(0);
    await shoot(page, SHOT_DIR, 'plaque');

    // ── a reload lands settled: no second deal, the stamp standing ────────
    await reloadConsole(page);
    await page.waitForSelector('.con-endgame', {timeout: 60_000});
    await expect.poll(() => page.locator('[data-eg-tender]').count()).toBe(1);
    expect(await page.locator('[data-bidding-stage].con-bidding--revealing').count()).toBe(0);

    // ── The campaign map speaks tenders: the winner's row wears the holding's chip, the rail's note is the tenders'. ──
    await openMapAs(page, id, winner === 0 ? 'Alice' : 'Bruno');
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 30_000}).catch(() => undefined);
    await expect(page.locator('[data-cmap-rail-note="tenders"]')).toHaveCount(1);
    await expect(page.locator('[data-cmap-seat-tenders]'), 'every human row shows the tenders zone').toHaveCount(2);
    // The holding stands in TWO places by design — the rail's seat row and the mission card's podium (the lot the
    // seat took there) — each its own zone, so the counts are read per zone.
    await expect(page.locator('[data-cmap-seat-tenders] [data-cmap-tender]'), 'one holding on the winner\'s row').toHaveCount(1);
    await expect(page.locator('[data-cmap-seat-tenders] [data-cmap-tender]')).toHaveAttribute('data-cmap-tender-status', 'held');
    await expect(page.locator('.ccard__result-tender'), 'the mission card\'s podium names the lot the winner took').toHaveCount(1);
    await shoot(page, SHOT_DIR, 'map-rail');
  });
});
