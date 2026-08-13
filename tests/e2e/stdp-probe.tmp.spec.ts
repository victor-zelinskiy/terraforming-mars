import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import {bootSeededGame, press} from './consoleStart';

function newGameConfig() {
  return {
    players: [{name: 'Probe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false, customCorporationsList: [], bannedCards: [],
    includedCards: [], customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok()).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  return model.players[0].id;
}

const focusedRow = async (page: Page) =>
  (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';

test('probe: dump the std-projects menu model + screen DOM', async ({page, request}) => {
  test.setTimeout(300_000);
  const playerId = await createGame(request);
  await bootSeededGame(page, request, playerId, {buy: 2, keepColony: 'Pluto'});
  await page.waitForTimeout(1500);

  const resp = await request.get(`/api/player?id=${playerId}`);
  const view = await resp.json();
  fs.writeFileSync('screenshots/stdp-probe-view.json', JSON.stringify(view.waitingFor, null, 1));

  await press(page, 'Comma', 1100);
  await press(page, 'Enter', 1400);
  await page.waitForSelector('.con-stdp', {timeout: 15_000});
  await press(page, 'ArrowDown', 400);
  console.log('focused:', await focusedRow(page));
  const dom = await page.evaluate(() => ({
    chips: document.querySelectorAll('.con-stdp .action-effect-chip').length,
    ghost: document.querySelectorAll('.con-status__param--ghost').length,
    context: document.querySelector('.con-stdp__context')?.textContent ?? '',
    foot: document.querySelector('.con-stdp__foot')?.outerHTML.slice(0, 600) ?? '',
    wshead: document.querySelector('.con-stdp .con-wshead') !== null,
    delta: document.querySelectorAll('.con-stdp__cost-delta').length,
  }));
  console.log('DOM:', JSON.stringify(dom, null, 1));
  await page.screenshot({path: 'screenshots/stdp-probe.png'});
});
