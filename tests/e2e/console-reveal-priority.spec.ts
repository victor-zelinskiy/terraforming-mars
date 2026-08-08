import {test, expect, APIRequestContext, Page} from '@playwright/test';
import {
  createGameWithCards,
  openConsole,
  pickCards,
  playQueueCard,
  playQueueUntil,
  submitSummary,
  walkToSummary,
} from './consoleStart';

/**
 * Regression: a reveal overlay is a TOP-PRIORITY modal — it cannot be
 * minimized and must be finished before anything under it comes alive.
 *
 * The bug: a prelude that DREW cards opens the "cards received" reveal, and at
 * the same time the server raises the corporation's first mandatory action (a
 * start-scene task). The start scene mounted UNDER the reveal and stole the
 * focus. This drives that exact shape (a drawing prelude + a corp with a first
 * action) and asserts the start scene is suppressed while the reveal is up.
 */

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Victor', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
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
    startingCorporations: 1,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    // ONE corp, deterministically. Tharsis's first action places a CITY (not a
    // draw) — so its own start action never opens a single-card reveal ahead
    // of the preludes; the reveal under test comes from the drawing prelude,
    // and a start-scene task (the next prelude / the corp city) waits under it.
    customCorporationsList: ['Tharsis Republic'],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: ['Acquired Space Agency', 'Donation', 'Loan', 'Martian Industries'],
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
    automa: undefined,
  };
}

async function key(page: Page, code: string, settleMs = 900): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function prepareDrawingPrelude(page: Page, request: APIRequestContext): Promise<string> {
  const corporation = 'Tharsis Republic';
  const preludes = ['Acquired Space Agency', 'Donation'];
  const playerId = await createGameWithCards(request, [], {config: newGameConfig()});
  await openConsole(page, playerId);
  await walkToSummary(page, {
    onStep: async (stepPage, kind) => {
      const wanted = kind === 'corporation' ? [corporation] : kind === 'prelude' ? preludes : [];
      if (wanted.length === 0) {
        return;
      }
      const picked = await pickCards(stepPage, wanted);
      expect(picked, `the start deal must offer ${wanted.join(' + ')}`)
        .toEqual(expect.arrayContaining(wanted));
    },
  });
  await submitSummary(page);

  // Resolve the corporation and harmless prelude, but leave the drawing
  // prelude standing: its reveal/mandatory-action collision is the subject.
  expect(await playQueueUntil(page, 'Acquired Space Agency'),
    'Acquired Space Agency must remain queued for the priority assertion').toBeTruthy();
  return playerId;
}

test.describe('console · reveal is a top-priority modal', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('a drawing prelude keeps focus on its reveal; the corp first action stays suppressed under it', async ({page, request}) => {
    test.setTimeout(240_000);

    const playerId = await prepareDrawingPrelude(page, request);

    // Prelude phase: play precisely the drawing prelude — it opens the reveal.
    expect(await playQueueCard(page, 'Acquired Space Agency'),
      'Acquired Space Agency never left the deployment queue').toBeTruthy();

    // The reveal assembles (the deck-draw scene hands off to it). Wait for it
    // to be FULLY open — not the veiled/held staging frame the deck-draw scene
    // mounts to measure its slots (that phase is a legitimate transitional
    // window; the priority rule is about the OPEN reveal).
    const reveal = page.locator('.con-reveal__card');
    await expect(reveal).toHaveCount(1, {timeout: 45_000});
    await page.waitForSelector('.con-reveal:not(.con-reveal--bonus-veiled):not(.con-reveal--bonus-held) .con-reveal__card', {timeout: 20_000});
    await page.waitForTimeout(600); // let the handoff + any start-scene leave settle

    // THE ASSERTION: the start workspace deliberately remains mounted for the
    // whole deployment, but it must not become a competing foreground. Neither
    // the mandatory announcement nor its corporation modal may paint over the
    // reveal, whose card cursor owns the pad.
    const mandatory = page.locator('.con-mandatory');
    const corpFirst = page.locator('.con-composer--corpfirst');
    const revealFocus = page.locator('.con-reveal__strip .con-cards__slot--focused');
    await expect(mandatory).toHaveCount(0);
    await expect(corpFirst).toHaveCount(0);
    await expect(revealFocus).toHaveCount(1);

    // Navigating (d-pad) walks the RECEIVED cards, never a surface beneath.
    const view = await (await request.get(`/api/player?id=${playerId}`)).json() as
      {cardDrawReveals: Array<{cards: Array<{name: string}>}>};
    if ((view.cardDrawReveals[0]?.cards.length ?? 0) > 1) {
      const revealFocusBefore = await revealFocus.getAttribute('data-zoom-slot');
      const startFocus = page.locator('.con-start__qcard--focused').first();
      const startFocusBefore = await startFocus.count() > 0 ?
        await startFocus.getAttribute('data-queue-slot') : undefined;
      await key(page, 'ArrowRight', 500);
      await expect(revealFocus).toHaveCount(1);
      expect(await revealFocus.getAttribute('data-zoom-slot'),
        'd-pad must move the reveal cursor').not.toBe(revealFocusBefore);
      if (startFocusBefore !== undefined && startFocusBefore !== null) {
        await expect(startFocus).toHaveAttribute('data-queue-slot', startFocusBefore);
      }
      await expect(mandatory).toHaveCount(0);
      await expect(corpFirst).toHaveCount(0);
    }

    // Finish the reveal (take all) — NOW the start scene / next task comes
    // back to life (the corp first action or the next prelude).
    await key(page, 'Escape', 2500); // B = take all cards
    await expect(reveal).toHaveCount(0, {timeout: 20_000});
    await expect(page.locator('.con-mandatory, .con-composer--corpfirst'))
      .toHaveCount(1, {timeout: 30_000});
  });
});
