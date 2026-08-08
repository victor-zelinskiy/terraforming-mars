import {test, expect, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootIntoGame,
  createGameWithCards,
  openConsole,
  pickCalmCorporation,
  pickCards,
  playQueueCard,
  playQueueUntil,
  soloGameConfig,
  submitSummary,
  walkToSummary,
} from './consoleStart';

/**
 * Console-native PROMPT ADMISSION · one response, one demand on the player.
 *
 * Experimental Forest (prelude) draws 2 plant-tag cards AND places a greenery.
 * The executor draws SYNCHRONOUSLY and only DEFERS the placement, so a single
 * server response carries `cardDrawReveals` and `waitingFor = SelectSpace`
 * together.
 *
 * The regression this guards: the console played both at once — the drawn-cards
 * reveal assembled over a board that had ALREADY gone live for the greenery,
 * force-switching the section and closing every layer underneath. Two demands in
 * one frame from one play.
 *
 * The contract (consolePromptAdmission.ts): while the reveal owns the
 * foreground the board stays DARK, and the placement comes alive only once the
 * draw beat has fully finished.
 */

const OUT_DIR = path.resolve('screenshots', 'console-prompt-admission');

/** A deterministic solo game whose FIRST dealt prelude is the one we want. */
function newGameConfig(customPreludes: Array<string>, prelude = true) {
  return {
    players: [{name: 'AdmissionTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
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
    // Deck.shuffle(cardsOnTop) pushes [...rest, ...top] and draw() pops from the
    // END — so these are dealt FIRST, landing on the wizard's focused slot.
    customPreludes,
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function prepareExperimentalForest(
  page: Page,
  request: APIRequestContext,
  preludes: Array<string>,
): Promise<void> {
  const playerId = await createGameWithCards(request, [], {config: newGameConfig(preludes)});
  await openConsole(page, playerId);
  await walkToSummary(page, {
    onStep: async (stepPage, kind) => {
      if (kind === 'corporation') {
        await pickCalmCorporation(stepPage);
      } else if (kind === 'prelude') {
        const picked = await pickCards(stepPage, preludes);
        expect(picked, `the prelude deal must offer ${preludes.join(' + ')}`)
          .toEqual(expect.arrayContaining(preludes));
      }
    },
  });
  await submitSummary(page);

  // Leave the subject card standing. The shared queue driver resolves the
  // corporation and the harmless second prelude, but Experimental Forest's
  // own response (draw + placement) remains entirely owned by this spec.
  expect(await playQueueUntil(page, 'Experimental Forest'),
    'Experimental Forest must still be queued for the admission assertion').toBeTruthy();
}

test.describe('console prompt admission · a draw and a placement in ONE response', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the board stays dark while the drawn-cards reveal owns the foreground', async ({page, request}) => {
    test.setTimeout(300_000);

    // Both custom preludes are guaranteed in the deal. The shared walk picks
    // them by name and leaves Experimental Forest queued for this assertion;
    // Metals Company is pure production, so resolving it first is harmless.
    const preludes = ['Experimental Forest', 'Metals Company'];
    await prepareExperimentalForest(page, request, preludes);

    const reveal = page.locator('.con-reveal');
    const boardLive = page.locator('.con-board--live');

    // The preludes resolve as the game starts — Experimental Forest's response
    // carries the reveal AND the greenery SelectSpace together. The shared
    // verified press fires precisely that queued card, then the spec waits for
    // the response surface without accidentally accepting either drawn card.
    expect(await playQueueCard(page, 'Experimental Forest'),
      'Experimental Forest never left the deployment queue').toBeTruthy();
    await expect(reveal, 'the drawn-cards reveal never appeared — was Experimental Forest played?')
      .toHaveCount(1, {timeout: 30_000});

    await shoot(page, '01-reveal-up');

    // ── THE ASSERTION ──────────────────────────────────────────────────────
    // The greenery SelectSpace is already pending in the same payload. The board
    // must NOT be live: no placement cursor, no available-cell highlight, no
    // forced section switch. Before the fix this was 1 and the hexes glowed.
    expect(await boardLive.count(), 'the board went LIVE for the greenery while the reveal was up').toBe(0);
    expect(await page.locator('.board-space--available').count(),
      'the hex highlight was painted under the reveal modal').toBe(0);

    // Answer the reveal (A takes each card; it closes when the batch is done)
    // and let the intake flights land in the dock.
    for (let i = 0; i < 8 && await reveal.count() > 0; i++) {
      await key(page, 'Enter', 900);
    }
    await page.waitForTimeout(4000);
    await shoot(page, '02-after-reveal');

    // ── AND THEN the placement gets its turn, on its own. ──────────────────
    expect(await reveal.count(), 'the reveal never closed').toBe(0);
    await expect(page.locator('.con-board--live')).toHaveCount(1, {timeout: 20_000});
    expect(await page.locator('.con-context').innerText()).toContain('РАЗМЕЩЕНИЕ ТАЙЛА');
    await shoot(page, '03-placement-live');
  });

  test('a plain placement with no draw still comes alive immediately', async ({page, request}) => {
    test.setTimeout(300_000);

    // NO preludes — the short corp → buy → start wizard, then the standard
    // Greenery project. Nothing draws, so the placement must come alive at once.
    //
    // The pregame is the shared driver's (`consoleStart.ts`): this test's claim
    // is the placement coming alive, and the walk above is the OTHER test's
    // apparatus (it needs its two named preludes played off the rail). The
    // local walk also decided the wizard was over by COUNTING
    // `.con-start__frame` nodes — a question the DOM cannot answer, since the
    // scene stays MOUNTED through its yield (`ConsoleShell.vue:2395`) and its
    // panes are `v-show` (`ConsoleStartScene.vue:26`).
    await bootIntoGame(page, request, {
      config: soloGameConfig({
        players: [{name: 'AdmissionTester', color: 'red', beginner: false, handicap: 0, first: true}],
        seed: 0.42,
      }),
    });

    // LT wheel → Standard Projects → «Озеленение» (2 rows down) → placement.
    await key(page, 'Comma', 1200);
    await key(page, 'Enter', 1500);
    await key(page, 'ArrowDown', 500);
    await key(page, 'ArrowDown', 500);
    await key(page, 'Enter', 2500);
    await shoot(page, '10-plain-placement');

    await expect(page.locator('.con-board--live')).toHaveCount(1, {timeout: 20_000});
    expect(await page.locator('.con-context').innerText()).toContain('РАЗМЕЩЕНИЕ ТАЙЛА');
    expect(await page.locator('.board-space--available').count(),
      'no cells were offered for a plain greenery placement').toBeGreaterThan(0);
  });
});
