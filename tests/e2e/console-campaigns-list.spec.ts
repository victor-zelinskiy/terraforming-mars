import {expect, test, Page} from '@playwright/test';
import {press} from './consoleStart';
import {createCampaign, devCommit, launchMission, seedIdentity, CAMPAIGN_BASE as BASE} from './campaignFixtures';

/**
 * «МОИ КАМПАНИИ» — the main-menu campaign list (one row per campaign).
 *
 * Campaigns are created/driven over the API (the deal-independent surfaces
 * under test are the LIST and its wiring to the existing Campaign Map):
 *   · a freshly created campaign is listed BEFORE any mission game exists;
 *   · A opens the Campaign Map; B returns to the list on the same tab + row;
 *   · a finished campaign leaves the active slice and lands behind L3;
 *   · the creator cascade-deletes (confirm → campaign AND mission games gone);
 *   · a non-creator cannot delete (UI inert + the server refuses);
 *   · a campaign mission cannot be deleted alone through the local-delete API.
 *
 * The e2e server is long-lived, so every assertion is scoped to the campaign
 * created by the test (by its generated NAME), never to list counts.
 */

async function openCampaignsList(page: Page, name: string): Promise<void> {
  await seedIdentity(page, name);
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.cm-menu__items', {timeout: 20_000});
  await page.click('.cm-item:has-text("Мои кампании")');
  await page.waitForSelector('.cm-gametabs', {timeout: 10_000});
  // The FIRST list answer after a server start reconciles every stored
  // campaign (cold cache) — wait the load out, not a fixed beat. Every test
  // creates its campaign up front, so a row always arrives.
  await page.waitForSelector('.cm-camp', {timeout: 60_000});
  await page.waitForTimeout(400);
}

test.describe('my campaigns list', () => {
  test('a fresh campaign is listed before any mission exists; A opens the map; B returns to the same row', async ({page, request}) => {
    const {name} = await createCampaign(request);
    await openCampaignsList(page, 'Alice');

    const row = page.locator('.cm-camp', {hasText: name});
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Миссия 1 из 4');
    // The creator's launch-ready state names itself.
    await expect(row).toContainText('Миссия готова к запуску');

    // A (click = the sanctioned mouse fallback of enter) → the EXISTING map.
    await row.click();
    await page.waitForSelector('.cmap__card', {timeout: 20_000});
    await expect(page.locator('.cmap__card')).toHaveCount(4);

    // B → back into «Мои кампании»: same tab, the SAME campaign focused.
    await press(page, 'Escape', 900);
    await page.waitForSelector('.cm-camp', {timeout: 10_000});
    const cursored = page.locator('.cm-camp.cm-game--cursor');
    await expect(cursored).toContainText(name);
    // The active tab is still the one shown.
    await expect(page.locator('.cm-gametab--on')).toContainText('Активные');
  });

  test('a launched mission updates the row, and «Мои партии» still opens the mission directly', async ({page, request}) => {
    const {id, name} = await createCampaign(request);
    await launchMission(request, id);

    await openCampaignsList(page, 'Alice');
    const row = page.locator('.cm-camp', {hasText: name});
    await expect(row).toHaveCount(1);
    // The active mission leads the row: the viewer's move or the calm state.
    await expect(row).toContainText(/Ваш ход|Миссия идёт/);

    // «Мои партии» keeps the fast door into the concrete mission.
    await press(page, 'Escape', 500);
    await page.click('.cm-item:has-text("Мои партии")');
    const gameRow = page.locator('.cm-game', {hasText: name});
    await expect(gameRow.first()).toBeVisible();
    await expect(gameRow.first().locator('.cm-game__campaign')).toContainText('Миссия 1 из 4');
  });

  test('a campaign mission can NEVER be deleted alone through the local-delete API', async ({request}) => {
    const {id, name} = await createCampaign(request);
    const {gameId} = await launchMission(request, id);
    const res = await request.post(`${BASE}/api/local-game-delete?id=${gameId}`);
    expect(res.status()).toBe(422);
    expect(await res.text()).toContain('part of a campaign');
    // The campaign still opens, its mission intact.
    const model = await request.get(`${BASE}/api/campaign?id=${id}&name=Alice`);
    expect(model.ok()).toBeTruthy();
    const body = await model.json();
    expect(body.name).toBe(name);
    expect(body.missions[0].gameId).toBe(gameId);
  });

  test('a finished campaign leaves the active slice; L3 finds it; the creator cascade-deletes it', async ({page, request}) => {
    const {id, name} = await createCampaign(request);
    const {gameId} = await launchMission(request, id);
    for (const placements of [[0, 1], [0, 1], [0, 1], [1, 0]]) {
      await devCommit(request, id, placements);
    }

    await openCampaignsList(page, 'Alice');
    // Gone from the active slice…
    await expect(page.locator('.cm-camp', {hasText: name})).toHaveCount(0);
    // …and found behind L3 (KeyC is the stickL keyboard parity binding).
    await press(page, 'KeyC', 600);
    await expect(page.locator('.cm-gametab--on')).toContainText('Завершённые');
    const row = page.locator('.cm-camp', {hasText: name});
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Кампания завершена');

    // X on the row (cursor follows the pointer) → the cascade confirm.
    await row.hover();
    await press(page, 'KeyX', 500);
    const confirm = page.locator('.cm-overlay--nested');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText(name);
    await expect(confirm).toContainText('Будет удалено партий миссий: 1');
    await expect(confirm).toContainText('удалены безвозвратно');

    // A commits; the row leaves both the list and the server.
    await press(page, 'Enter', 1200);
    await expect(page.locator('.cm-overlay--nested')).toHaveCount(0);
    await expect(page.locator('.cm-camp', {hasText: name})).toHaveCount(0);
    // The campaign document is gone…
    const afterDelete = await request.get(`${BASE}/api/campaign?id=${id}&name=Alice`);
    expect(afterDelete.status()).toBe(404);
    // …and so is its mission game (no ghost row in «Мои партии» either).
    const game = await request.get(`${BASE}/api/game?id=${gameId}`);
    expect(game.ok()).toBeFalsy();
    for (const status of ['active', 'finished']) {
      const joinable = await request.get(`${BASE}/api/games/joinable?name=Alice&status=${status}`);
      const rows = await joinable.json() as Array<{campaign?: {id: string}}>;
      expect(rows.some((r) => r.campaign?.id === id)).toBeFalsy();
    }
  });

  test('the creator may cascade-delete an ACTIVE campaign — with the louder warning', async ({page, request}) => {
    const {id, name} = await createCampaign(request);
    const {gameId} = await launchMission(request, id);

    await openCampaignsList(page, 'Alice');
    const row = page.locator('.cm-camp', {hasText: name});
    await row.hover();
    await press(page, 'KeyX', 500);
    const confirm = page.locator('.cm-overlay--nested');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Эта кампания ещё не завершена.');
    await press(page, 'Enter', 1200);
    await expect(page.locator('.cm-camp', {hasText: name})).toHaveCount(0);
    const game = await request.get(`${BASE}/api/game?id=${gameId}`);
    expect(game.ok()).toBeFalsy();
    const gone = await request.get(`${BASE}/api/campaign?id=${id}&name=Alice`);
    expect(gone.status()).toBe(404);
  });

  // Fit sweep: FHD / TV 4K / Steam Deck — the list stays inside its card and
  // the document never grows a horizontal overflow (a geometry claim asserted
  // at ONE resolution is a claim about one resolution).
  for (const vp of [
    {label: 'fhd', width: 1920, height: 1080},
    {label: 'tv4k', width: 3840, height: 2160},
    {label: 'deck', width: 1280, height: 800},
  ]) {
    test(`fit: the list renders without overflow @ ${vp.label}`, async ({page, request}) => {
      await page.setViewportSize({width: vp.width, height: vp.height});
      const {name} = await createCampaign(request);
      await openCampaignsList(page, 'Alice');
      const row = page.locator('.cm-camp', {hasText: name});
      await expect(row).toHaveCount(1);
      const overflowX = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflowX, `horizontal overflow at ${vp.label}`).toBeLessThanOrEqual(1);
      const rowBox = (await row.boundingBox())!;
      const cardBox = (await page.locator('.cm-overlay__card').first().boundingBox())!;
      expect(rowBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
      expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    });
  }

  test('a non-creator cannot delete the shared campaign (UI inert, server refuses)', async ({page, request}) => {
    const {id, name} = await createCampaign(request);

    await openCampaignsList(page, 'Bruno');
    const row = page.locator('.cm-camp', {hasText: name});
    await expect(row).toHaveCount(1);
    // Bruno's row waits for the creator — and X opens nothing.
    await expect(row).toContainText('Ожидание запуска миссии создателем кампании');
    await row.hover();
    await press(page, 'KeyX', 500);
    await expect(page.locator('.cm-overlay--nested')).toHaveCount(0);

    // The server is the guard that matters.
    const res = await request.post(`${BASE}/api/campaign/delete?id=${id}&name=Bruno`);
    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('creator');
    const still = await request.get(`${BASE}/api/campaign?id=${id}&name=Alice`);
    expect(still.ok()).toBeTruthy();
  });
});
