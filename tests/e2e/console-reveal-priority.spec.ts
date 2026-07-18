import {test, expect, Page} from '@playwright/test';

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

async function walkWizard(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  const summary = page.locator('.con-start__summary');
  const activeStep = page.locator('.con-start__step--active');

  for (let i = 0; i < 10 && await summary.count() === 0; i++) {
    await page.waitForSelector('.con-cards__verdictbar', {timeout: 25_000});
    await page.waitForTimeout(400);
    const step = (await activeStep.innerText()).toLowerCase();
    if (/пролог/.test(step)) {
      // Pick Acquired Space Agency + one more.
      for (let n = 0; n < 6; n++) {
        const f = page.locator('.con-cards__slot--focused');
        if (/агенств/i.test(await f.innerText())) {
          break;
        }
        await key(page, 'ArrowRight', 400);
      }
      await key(page, 'Enter', 500);
      await key(page, 'ArrowRight', 400);
      await key(page, 'Enter', 500);
      await key(page, 'KeyE', 1200);
      continue;
    }
    await key(page, /корпорац|директор/.test(step) ? 'Enter' : 'KeyE', 1200);
  }
  await expect(summary).toHaveCount(1);
  await page.waitForTimeout(500);
  await key(page, 'Enter', 700); // arms the zero-projects warning
  await key(page, 'Enter', 1800); // submits → prelude phase
}

test.describe('console · reveal is a top-priority modal', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('a drawing prelude keeps focus on its reveal; the corp first action stays suppressed under it', async ({page, request}) => {
    test.setTimeout(240_000);

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    await page.goto(`/player?id=${model.players[0].id}&console=1`);
    await walkWizard(page);

    // Prelude phase: play the drawing prelude — it opens the reveal.
    await page.waitForSelector('.con-start__frame', {timeout: 30_000});
    const focused = page.locator('.con-start__prelude--focused');
    await expect(focused).toHaveCount(1, {timeout: 20_000});
    for (let n = 0; n < 6; n++) {
      if (/агенств/i.test(await focused.innerText())) {
        break;
      }
      await key(page, 'ArrowRight', 450);
    }
    await page.keyboard.press('Enter');

    // The reveal assembles (the deck-draw scene hands off to it). Wait for it
    // to be FULLY open — not the veiled/held staging frame the deck-draw scene
    // mounts to measure its slots (that phase is a legitimate transitional
    // window; the priority rule is about the OPEN reveal).
    const reveal = page.locator('.con-reveal__card');
    await expect(reveal).toHaveCount(1, {timeout: 45_000});
    await page.waitForSelector('.con-reveal:not(.con-reveal--bonus-veiled):not(.con-reveal--bonus-held) .con-reveal__card', {timeout: 20_000});
    await page.waitForTimeout(600); // let the handoff + any start-scene leave settle

    // THE ASSERTION: while the reveal is up, the start scene is NOT mounted
    // under it — nothing steals the focus. The reveal's own card carries the
    // selection frame; the start frame is gone.
    await expect(page.locator('.con-start__frame')).toHaveCount(0);
    await expect(page.locator('.con-start__prelude--focused')).toHaveCount(0);
    // The reveal owns the pad: its focused card shows «A ВЗЯТЬ».
    await expect(page.locator('.con-reveal__strip .con-cards__slot--focused')).toHaveCount(1);

    // Navigating (d-pad) walks the RECEIVED cards, never a surface beneath.
    const view = await (await request.get(`/api/player?id=${model.players[0].id}`)).json() as
      {cardDrawReveals: Array<{cards: Array<{name: string}>}>};
    if ((view.cardDrawReveals[0]?.cards.length ?? 0) > 1) {
      await key(page, 'ArrowRight', 500);
      await expect(page.locator('.con-reveal__strip .con-cards__slot--focused')).toHaveCount(1);
      // Still no start scene under it after moving focus.
      await expect(page.locator('.con-start__frame')).toHaveCount(0);
    }

    // Finish the reveal (take all) — NOW the start scene / next task comes
    // back to life (the corp first action or the next prelude).
    await key(page, 'Escape', 2500); // B = take all cards
    await expect(reveal).toHaveCount(0, {timeout: 20_000});
  });
});
