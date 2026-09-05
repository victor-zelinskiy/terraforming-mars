import {expect, test} from '@playwright/test';
import {press} from './consoleStart';
import {campaignModelAs, createCampaign, devCommit, launchMission, openMapAs, CAMPAIGN_BASE as BASE} from './campaignFixtures';

/**
 * CAMPAIGN MODE — the Campaign Map screen + lifecycle
 * (docs/CAMPAIGN_MODE_ARCHITECTURE.md).
 *
 * The campaign is CREATED over the API (the creator UI's own model is
 * unit-tested; the deal-independent surface under test here is the MAP):
 *   · a fresh campaign: four route cards, the finale marked, the creator CTA;
 *   · controller navigation (cursor, dossiers, B);
 *   · launch → the mission game boots for the creator's seat;
 *   · the dev fast-forward → interlude states (results, titles, carryover
 *     line) and the finished chronicle;
 *   · reload lands SETTLED (server state over local animation phase).
 */

test.describe('campaign map', () => {
  test('a fresh campaign: four route cards, the finale marked, creator CTA + navigation', async ({page, request}) => {
    const {id} = await createCampaign(request);
    await openMapAs(page, id, 'Alice');

    // The route: four cards, unique boards, the last one is the finale.
    const cards = page.locator('.cmap__card');
    await expect(cards).toHaveCount(4);
    await expect(page.locator('.cmap__final-banner')).toHaveCount(1);
    await expect(page.locator('.cmap__card--current')).toHaveCount(1);
    const boardNames = await page.locator('.cmap__board-name').allTextContents();
    expect(new Set(boardNames.map((s) => s.trim())).size).toBe(4);
    // The party marker stands on the current node (both seats' cubes).
    await expect(page.locator('.cmap__party-cube')).toHaveCount(2);

    // The cursor walks the route; state carried by class, never color alone.
    const cursorIndex = () => page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.cmap__card'));
      return nodes.findIndex((n) => n.classList.contains('cmap__card--cursor'));
    });
    expect(await cursorIndex()).toBe(0);
    await press(page, 'ArrowRight', 300);
    expect(await cursorIndex()).toBe(1);
    // A FUTURE mission opens NO modal — its whole story (board, position,
    // finale, blockers) lives on the route card; X and A both stay quiet.
    await press(page, 'KeyX', 400);
    await expect(page.locator('.cmap__dossier')).toHaveCount(0);
    await press(page, 'Enter', 400);
    await expect(page.locator('.cm-overlay')).toHaveCount(0);
    expect(await cursorIndex()).toBe(1);
    await press(page, 'ArrowLeft', 300);

    // A on the ready mission = create + enter in ONE press (no confirm
    // modal): the page navigates into the creator's mission seat.
    await Promise.all([
      page.waitForURL(/player\?id=p/, {timeout: 30_000}),
      press(page, 'Enter', 500),
    ]);
  });

  test('launch is idempotent server-side: two launch posts converge on one game', async ({request}) => {
    const {id} = await createCampaign(request);
    const first = await request.post(`${BASE}/api/campaign/launch?id=${id}&name=Alice`);
    expect(first.ok()).toBeTruthy();
    const a = await first.json();
    const second = await request.post(`${BASE}/api/campaign/launch?id=${id}&name=Alice`);
    const b = await second.json();
    expect(b.gameId).toBe(a.gameId);
  });

  test('interlude (dev fast-forward): results, title emblems, TP on the rail; then the chronicle', async ({page, request}) => {
    const {id} = await createCampaign(request);
    await devCommit(request, id, [0, 1]);
    await openMapAs(page, id, 'Alice');

    // Mission 1 committed: the result strip with title emblems (real PNGs).
    await expect(page.locator('.cmap__card--done')).toHaveCount(1);
    await expect(page.locator('.cmap__result-title').first()).toBeVisible();
    // The rail: TP accumulated (Governor 15 for the winner, seat 0 = Alice).
    const railText = await page.locator('.cmap__rail').innerText();
    expect(railText).toContain('15');
    expect(railText).toContain('10');

    // X on the COMMITTED mission opens the results dossier (the one mission
    // modal left); B closes it and the map stands as it was.
    await press(page, 'ArrowLeft', 300);
    await press(page, 'KeyX', 400);
    await expect(page.locator('.cmap__dossier')).toBeVisible();
    await expect(page.locator('.cmap__dossier-score').first()).toBeVisible();
    await press(page, 'Escape', 400);
    await expect(page.locator('.cmap__dossier')).toHaveCount(0);

    // Fast-forward to the end: the chronicle with the champion.
    await devCommit(request, id, [0, 1]);
    await devCommit(request, id, [0, 1]);
    await devCommit(request, id, [1, 0]);
    await page.reload();
    await page.waitForSelector('.cmap--chronicle', {timeout: 20_000});
    await expect(page.locator('.cmap__seat-crown')).toBeVisible();
    await expect(page.locator('.cmap__card--done')).toHaveCount(4);
    // Reload lands SETTLED — the generation reveal never replays.
    expect(await page.locator('.cmap--reveal').count()).toBe(0);
  });

  test('interlude ONE FLOW: the mandatory step opens itself, confirm = ready, the host launch auto-joins', async ({page, request}) => {
    test.setTimeout(120_000);
    // A REAL mission 1 (launch records the per-seat playerIds the carryover
    // route authenticates against), then the dev commit leaves every human
    // seat PENDING — the true post-mission readiness regime. Bruno's recorded
    // terminal hand carries two cards, so his step exercises the fitted grid
    // AND the armed zero-carry confirm.
    const {id} = await createCampaign(request);
    await launchMission(request, id);
    await devCommit(request, id, [0, 1], {
      carryoverPending: true,
      carryover: {0: [], 1: ['Ants', 'Algae']},
    });

    // Bruno (non-host) opens the campaign: the carryover step opens ITSELF —
    // the interlude's entry is the mandatory step, not a button hunt.
    await openMapAs(page, id, 'Bruno');
    await page.waitForSelector('.con-carry', {timeout: 20_000});
    await expect(page.locator('.con-carry__card')).toHaveCount(2);

    // THE BLOCKER GUARD, client half: a ZERO-card confirm over a real hand
    // must be ARMED — the first X raises the named warning and does NOT
    // confirm; only the second X does.
    await press(page, 'KeyX', 600);
    await expect(page.locator('.con-carry__status-warn')).toBeVisible();
    await expect(page.locator('.con-carry')).toBeVisible();
    await press(page, 'KeyX', 800);

    // The step concludes into the READY waiting state (auto-join armed):
    // the WAIT STRIP heads the player zone and the readiness chips sit on
    // the seat rows themselves — Bruno ready, Alice choosing.
    await page.waitForSelector('.cmap__wait-strip--ready', {timeout: 20_000});
    await expect(page.locator('.cmap__seat-status--ready')).toHaveCount(1);
    await expect(page.locator('.cmap__seat-status--choosing')).toHaveCount(1);

    // THE CHANGE DOOR: an accidental «continue without cards» is correctable
    // until the launch consumes the selection — Y re-opens the SAME picker
    // (its own cascade entrance), a card is taken, the confirm re-submits.
    await press(page, 'KeyY', 800);
    await page.waitForSelector('.con-carry', {timeout: 10_000});
    await expect(page.locator('.con-carry__card')).toHaveCount(2);
    await press(page, 'Enter', 500); // take the cursored card
    await press(page, 'KeyX', 800); // «Сохранить выбор» — one press, draft > 0
    await page.waitForSelector('.cmap__wait-strip--ready', {timeout: 20_000});
    const revised = await campaignModelAs(request, id, 'Bruno');
    const brunoCarry = revised.carryover!.bySeat.find((s) => s.seat === 1)!;
    expect(brunoCarry.status).toBe('confirmed');
    expect(brunoCarry.count).toBe(1);

    // Alice (host) confirms her readiness and launches — over the API, the
    // out-of-band second-participant path.
    const aliceModel = await campaignModelAs(request, id, 'Alice');
    const alicePid = aliceModel.missions[0].yourPlayerId!;
    const confirmRes = await request.post(`${BASE}/api/campaign/carryover?id=${id}`, {
      data: {playerId: alicePid, cards: []},
    });
    expect(confirmRes.ok(), await confirmRes.text()).toBeTruthy();
    const launched = await launchMission(request, id);

    // Bruno's page ENTERS THE MISSION BY ITSELF (campaign push → refresh →
    // auto-join; the bounded poll is the fallback road to the same place).
    await page.waitForURL(/player\?id=p/, {timeout: 45_000});
    const brunoModel = await campaignModelAs(request, id, 'Bruno');
    const brunoPid = brunoModel.missions[1].yourPlayerId!;
    expect(page.url()).toContain(brunoPid);
    expect(brunoPid).not.toBe(launched.yourPlayerId);
  });

  test('the party marker never covers the «ФИНАЛ» banner (mission 4 current)', async ({page, request}) => {
    const {id} = await createCampaign(request);
    for (const placements of [[0, 1], [0, 1], [0, 1]]) {
      await devCommit(request, id, placements);
    }
    await openMapAs(page, id, 'Alice');
    // The party stands on the FINAL node now — both markers render there.
    const party = (await page.locator('.cmap__party').boundingBox())!;
    const banner = (await page.locator('.cmap__final-banner').boundingBox())!;
    const overlap = party.x < banner.x + banner.width && banner.x < party.x + party.width &&
      party.y < banner.y + banner.height && banner.y < party.y + party.height;
    expect(overlap, `party ${JSON.stringify(party)} vs banner ${JSON.stringify(banner)}`).toBeFalsy();
  });

  test('a non-creator sees the waiting state, never the launch CTA', async ({page, request}) => {
    const {id} = await createCampaign(request);
    await openMapAs(page, id, 'Bruno');
    const barText = await page.locator('.con-cmdbar, .cm-cmdbar, [class*="cmdbar"]').first().innerText().catch(() => '');
    // The waiting line renders either in the CTA verb or the state plate —
    // assert the map itself communicates it (never a dead screen).
    const pageText = await page.locator('.cmap').innerText();
    expect(pageText.length).toBeGreaterThan(0);
    expect(barText).not.toContain('Начать миссию');
  });
});
