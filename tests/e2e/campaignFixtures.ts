import {expect, Page, APIRequestContext} from '@playwright/test';

/** Shared campaign e2e fixtures — the campaign is CREATED/DRIVEN over the API
 *  (create-idempotency, launch, dev fast-forward); the surfaces under test are
 *  the Campaign Map and the «Мои кампании» list. */

export const CAMPAIGN_BASE = 'http://localhost:8080';

export function campaignConfig(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

export async function createCampaign(request: APIRequestContext): Promise<{id: string, name: string}> {
  const key = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const res = await request.post(`${CAMPAIGN_BASE}/api/campaign/create`, {
    data: {key, name: 'Alice', config: campaignConfig()},
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const model = await res.json();
  expect(String(model.id).startsWith('c')).toBeTruthy();
  return {id: model.id, name: model.name};
}

export async function launchMission(request: APIRequestContext, id: string): Promise<{gameId: string}> {
  const res = await request.post(`${CAMPAIGN_BASE}/api/campaign/launch?id=${id}&name=Alice`);
  expect(res.ok(), await res.text()).toBeTruthy();
  return {gameId: (await res.json()).gameId};
}

export async function devCommit(request: APIRequestContext, id: string, placements: number[]): Promise<void> {
  const res = await request.post(`${CAMPAIGN_BASE}/api/campaign/dev?name=admin`, {
    data: {campaignId: id, placements},
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

/** Seed the local identity BEFORE the first navigation of this page. */
export async function seedIdentity(page: Page, name: string): Promise<void> {
  await page.addInitScript((identity) => {
    window.localStorage.setItem('tm_player_identity', JSON.stringify(identity));
  }, {displayName: name, cubeColor: 'blue'});
}

export async function openMapAs(page: Page, id: string, name: string): Promise<void> {
  await seedIdentity(page, name);
  await page.goto(`${CAMPAIGN_BASE}/campaign?id=${id}`);
  await page.waitForSelector('.cmap__card', {timeout: 20_000});
  await page.waitForTimeout(600);
}
