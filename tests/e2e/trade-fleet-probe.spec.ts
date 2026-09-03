import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame} from './consoleStart';

/**
 * TRADE FLEET VISUAL PROBE — drives a real solo colonies game to a trade and
 * records the launch cinematic (run with --trace on and read the screencast
 * frames): the fleet dock header, the colony tiles' berths, the focus stage,
 * and the whole launch → transit → dock flight. Evidence for the premium
 * motion/visual rework of the trade fleet.
 */

const OUT = path.resolve('screenshots', 'trade-fleet-probe');

function newGameConfig() {
  return {
    players: [{name: 'FleetProbe', color: 'red', beginner: false, handicap: 0, first: true}],
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
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [],
    customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function removalPickLive(page: Page): Promise<boolean> {
  if (await page.locator('.con-colonies').count() === 0) {
    return false;
  }
  const text = (await page.locator('.con-colonies__rail').textContent().catch(() => '')) ?? '';
  return text.toUpperCase().includes('УБРАТЬ КОЛОНИЮ');
}

test.describe('trade fleet probe', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('launch cinematic evidence', async ({page, request}) => {
    test.setTimeout(300_000);
    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    const playerId = model.players[0].id;

    await bootSeededGame(page, request, playerId, {buy: 2, keepColony: 'Pluto', query: '&consoleProfile=tv'});
    await page.waitForTimeout(1500);

    // Open the colonies section (RT wheel → right slot).
    const colonies = page.locator('.con-colonies');
    for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
      await key(page, 'Period', 1100);
      await key(page, 'ArrowRight', 1300);
    }
    expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    await shoot(page, '01-colonies-overview');

    // Focus Pluto.
    const focused = page.locator('.con-coltile--focused[data-test="con-colony-Pluto"]');
    for (let i = 0; i < 10 && await focused.count() === 0; i++) {
      await key(page, 'ArrowRight', 450);
    }
    for (let i = 0; i < 4 && await focused.count() === 0; i++) {
      await key(page, 'ArrowDown', 450);
      for (let j = 0; j < 5 && await focused.count() === 0; j++) {
        await key(page, 'ArrowLeft', 400);
      }
    }
    expect(await focused.count(), 'could not focus Pluto').toBeGreaterThan(0);
    expect(await removalPickLive(page), 'setup removal pick still live').toBe(false);

    await key(page, 'Enter', 1400); // A — the focus stage
    expect(await page.locator('.con-colfocus').count(), 'focus stage did not open').toBeGreaterThan(0);
    await shoot(page, '02-focus-stage');

    // Confirm — the fleet lifts off. Burst-shoot the flight.
    await page.keyboard.press('KeyX');
    for (let i = 0; i < 16; i++) {
      await shoot(page, `flight-${String(i).padStart(2, '0')}`);
      await page.waitForTimeout(180);
    }
    await page.waitForTimeout(3000);
    await shoot(page, '03-after-dock');

    // The trade landed (server truth).
    const resp = await request.get(`/api/player?id=${playerId}`);
    const view = await resp.json() as {game: {colonies: Array<{name: string, visitor?: string}>}};
    const pluto = view.game.colonies.find((c) => c.name === 'Pluto');
    console.log('[probe] pluto after trade:', JSON.stringify(pluto));
  });
});
