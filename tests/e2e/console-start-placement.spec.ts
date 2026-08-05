import {test, expect} from '@playwright/test';
import {
  focusCard, pickCards, playQueueCard, playQueueUntil, press, queueCards, submitSummary,
  visibleSurfaces, waitQueueIdle, walkToSummary,
} from './consoleStart';

/**
 * THE START DEPLOYMENT YIELDS TO A BOARD PLACEMENT.
 *
 * A start prelude that must place a tile (Great Aquifer — two oceans) puts
 * the server on «Select space», and the board is the ONLY surface that can
 * serve it. The workspace used to stay on top with its own status honestly
 * saying «ожидаем других игроков» while the highlighted board sat behind it
 * — the player's only way out was to guess that B («свернуть») was needed.
 *
 * Contract: the workspace steps aside for the placement (collapse, not
 * close — the lifetime hold is untouched) and comes back by itself when the
 * placement resolves, with the deployment exactly where it was.
 */

function newGameConfig() {
  return {
    players: [{name: 'PlaceProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: false, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: ['Great Aquifer', 'Donation', 'Loan', 'Martian Industries'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
    automa: undefined,
  };
}

test.describe('start deployment · a tile-placing prelude', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('hands the board over for the placement and returns after it', async ({page, request}) => {
    test.setTimeout(240_000);
    const created = await request.post('/api/creategame', {data: newGameConfig()});
    const model = await created.json() as {players: Array<{id: string}>};
    const id = model.players[0].id;
    await page.goto(`/player?id=${id}&console=1`);
    await page.waitForSelector('.con-start__frame', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});

    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await press(p, 'Enter', 600);
        } else if (kind === 'prelude') {
          await pickCards(p, ['Great Aquifer', 'Donation']);
        }
      },
    });
    await submitSummary(page);
    await waitQueueIdle(page);

    // The corporation goes first; then THIS prelude is played by us (the
    // press is verified — the queue absorbs presses while it commits).
    const reached = await playQueueUntil(page, 'Great Aquifer');
    expect(reached, `the prelude must reach the queue (queue: ${(await queueCards(page)).join(', ')})`).toBeTruthy();
    expect(await playQueueCard(page, 'Great Aquifer'), 'the prelude must play').toBeTruthy();
    await page.waitForTimeout(2500); // it owes two oceans — the server asks

    // 1 · The BOARD serves: the workspace is off screen, the cells are live.
    const startUp = () => page.locator('.con-start').isVisible().catch(() => false);
    await expect.poll(startUp, {timeout: 15_000}).toBeFalsy();
    const kicker = page.locator('.con-context__task-kicker');
    await expect(kicker).toHaveCount(1);
    const highlighted = await page.evaluate(() =>
      document.querySelectorAll('.board-space--available, .con-board__space--available').length);
    expect(highlighted, 'the board offers its legal cells').toBeGreaterThan(0);
    const view = await (await request.get(`/api/player?id=${id}`)).json() as {waitingFor?: {type?: string}};
    expect(view.waitingFor?.type, 'the server really is waiting for a space').toBe('space');

    // 2 · Place both oceans (the cursor is seeded on a legal cell).
    for (let ocean = 0; ocean < 2; ocean++) {
      await press(page, 'Enter', 2500);
      if (await page.locator('.con-context__task-kicker').count() > 0) {
        await press(page, 'ArrowRight', 600);
        await press(page, 'Enter', 2500);
      }
    }

    // 3 · …and the workspace comes BACK on its own (never a dead end).
    await expect.poll(async () => (await startUp()) || (await queueCards(page)).length === 0,
      {timeout: 30_000}).toBeTruthy();
    console.log('[after placement]', JSON.stringify(await visibleSurfaces(page)));
  });
});
