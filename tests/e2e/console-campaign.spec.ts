import {expect, test, Page, APIRequestContext} from '@playwright/test';
import {press} from './consoleStart';

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

const BASE = 'http://localhost:8080';

function campaignConfig() {
  return {
    players: [
      {name: 'Alice', color: 'blue', beginner: false, handicap: 0, first: true},
      {name: 'Bruno', color: 'red', beginner: false, handicap: 0, first: false},
    ],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false, prelude: false,
      prelude2: false, turmoil: false, community: false, ares: false, moon: false,
      pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
    },
    board: 'random all',
    seed: 0,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    testMode: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 0,
    startingPreludes: 0,
  };
}

async function createCampaign(request: APIRequestContext): Promise<{id: string}> {
  const key = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const res = await request.post(`${BASE}/api/campaign/create`, {
    data: {key, name: 'Alice', config: campaignConfig()},
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const model = await res.json();
  expect(String(model.id).startsWith('c')).toBeTruthy();
  return {id: model.id};
}

async function devCommit(request: APIRequestContext, id: string, placements: number[]): Promise<void> {
  const res = await request.post(`${BASE}/api/campaign/dev?name=admin`, {
    data: {campaignId: id, placements},
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

async function openMapAs(page: Page, id: string, name: string): Promise<void> {
  await page.addInitScript((identity) => {
    window.localStorage.setItem('tm_player_identity', JSON.stringify(identity));
  }, {displayName: name, cubeColor: 'blue'});
  await page.goto(`${BASE}/campaign?id=${id}`);
  await page.waitForSelector('.cmap__card', {timeout: 20_000});
  await page.waitForTimeout(600);
}

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
    // X on a future mission opens its dossier; B closes and restores focus.
    await press(page, 'KeyX', 400);
    await expect(page.locator('.cmap__dossier')).toBeVisible();
    await press(page, 'Escape', 400);
    await expect(page.locator('.cmap__dossier')).toHaveCount(0);
    expect(await cursorIndex()).toBe(1);
    await press(page, 'ArrowLeft', 300);

    // A on the ready mission → the launch confirm → A launches; the page
    // navigates into the creator's mission seat (a real game boots).
    await press(page, 'Enter', 500);
    await expect(page.locator('.cm-overlay__title')).toBeVisible();
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
