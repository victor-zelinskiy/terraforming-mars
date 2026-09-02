import {test, expect} from '@playwright/test';
import {
  pickCards, payStartPurchase, placeTile, playQueueCard, press, queueCards, submitSummary,
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

    // THE TILE PRELUDE MUST BE PLAYED WITH THE DEPLOYMENT STILL RUNNING —
    // this is the whole scenario, not a detail. `playQueueUntil` plays the
    // target LAST, which empties the queue: `deploymentSettled` then fires,
    // `releaseStartScene()` drops the workspace's lifetime hold, and the
    // ownership bug this spec exists for cannot happen at all (the spec was
    // green against a deliberately reverted fix — that is how it was found).
    // So: play the CORPORATION (the rules gate the preludes behind it), stop
    // while the OTHER prelude is still queued, and play the tile one there.
    const PRELUDES = ['Great Aquifer', 'Donation'];
    for (let i = 0; i < 4; i++) {
      await waitQueueIdle(page);
      const ahead = (await queueCards(page)).find((n) => !PRELUDES.includes(n));
      if (ahead === undefined) {
        break;
      }
      expect(await playQueueCard(page, ahead), `the deployment must play ${ahead}`).toBeTruthy();
    }
    await payStartPurchase(page);
    await waitQueueIdle(page);
    expect(await queueCards(page), 'the OTHER prelude must still be queued — the hold rides on it')
      .toContain('Donation');
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

    // 2 · THE BAR FOLLOWS THE SURFACE THE PLAYER SEES. The workspace keeps
    // its LIFETIME HOLD through the whole deployment, so a gate keyed on
    // «the scene serves» (rather than «the scene owns the pad») kept the
    // deployment's «A Разыграть · X Осмотреть · B Свернуть» advertised over a
    // live board. The d-pad glyph (shape `cross`) exists ONLY in the
    // placement run — a locale-independent signature of the right contract.
    await expect.poll(() => page.locator('.con-cmdbar__cmd .gp-glyph--cross').count(),
      {timeout: 10_000, message: 'the bar must carry the PLACEMENT contract, not the deployment\'s'})
      .toBeGreaterThan(0);

    // 3 · THE PAD REACHES THE BOARD. The yield was paint-only once: the
    // scene hid but kept the input claim, its own press guard swallowed
    // every A, and the unguarded `onNav` walked the INVISIBLE queue — the
    // cursor never moved over the hexes. Assert the movement itself.
    const cursor = () => page.evaluate(() =>
      document.querySelector('.con-cell-sel')?.getAttribute('data_space_id') ?? '');
    const seeded = await cursor();
    expect(seeded, 'the placement seeds a cursor on a legal cell').not.toBe('');
    await press(page, 'ArrowRight', 800);
    await expect.poll(cursor, {timeout: 8_000, message: 'the d-pad must walk the board cells'})
      .not.toBe(seeded);

    // 4 · Place both oceans — and verify THE SERVER TOOK THEM. The previous
    // «the workspace is back OR the queue is empty» poll passed vacuously:
    // the driver plays every other prelude first, so the queue is empty by
    // construction once this one is played, and a completely dead pad still
    // read as success. Server truth is the only honest witness.
    for (let ocean = 0; ocean < 2; ocean++) {
      // placeTile drives the DEFAULT two-phase confirm (lock → confirm) and
      // walks off an illegal seed on its own.
      await placeTile(page);
      await page.waitForTimeout(1500);
    }
    await expect.poll(async () => {
      const v = await (await request.get(`/api/player?id=${id}`)).json() as {game: {oceans: number}};
      return v.game.oceans;
    }, {timeout: 30_000, message: 'both oceans must actually reach the board'}).toBe(2);

    // 5 · …and the workspace comes BACK on its own (never a dead end).
    await expect.poll(async () => (await startUp()) || (await queueCards(page)).length === 0,
      {timeout: 30_000}).toBeTruthy();
    console.log('[after placement]', JSON.stringify(await visibleSurfaces(page)));
  });
});
