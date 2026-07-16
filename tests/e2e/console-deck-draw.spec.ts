import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The DECK-DRAW hero scene: cards physically come off the top-bar project
 * deck, are judged against the server's own search record, and route to the
 * discard tray / the hold zone before the reveal assembles around them.
 *
 * Driven through a REAL conditional search: the «Acquired Space Agency»
 * prelude ("reveal cards until you find two with a space tag; take them,
 * discard the rest"). The prelude plays as the game starts, so the scene
 * fires right after the start wizard is submitted.
 *
 * What is asserted is the semantics that must never regress:
 *  1. the cards come off the deck and the modal does NOT exist meanwhile;
 *  2. a search that discarded something shows the tray, and its count is the
 *     server's discard count — not a client guess;
 *  3. the reveal ends up holding exactly the matched cards;
 *  4. the tray survives into the modal and is inspectable on demand (X).
 */

const OUT_DIR = path.resolve('screenshots', 'deck-draw');

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
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    // The prelude pool is pinned so the wizard always offers the search card
    // alongside three harmless resource preludes.
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
    // Plain solo: MarsBot rejects custom card lists, and the pinned prelude
    // pool is the whole point of this test.
    automa: undefined,
  };
}

async function key(page: Page, code: string, settleMs = 900): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/**
 * Walk the start wizard, making sure «Космическое агенство» is one of the two
 * chosen preludes. The prelude step is a multi-pick: A toggles the focused
 * card, RT continues. Corp / project steps take their own presses.
 */
async function walkWizardPickingSearchPrelude(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  const summary = page.locator('.con-start__summary');
  const activeStep = page.locator('.con-start__step--active');

  for (let i = 0; i < 10 && await summary.count() === 0; i++) {
    await page.waitForSelector('.con-cards__verdictbar', {timeout: 25_000});
    await page.waitForTimeout(400);
    const step = (await activeStep.innerText()).toLowerCase();

    if (/пролог/.test(step)) {
      // Find the search prelude in the strip and toggle it, then one more.
      for (let n = 0; n < 6; n++) {
        const focused = page.locator('.con-cards__slot--focused');
        const text = (await focused.innerText()).toLowerCase();
        if (/агенств/.test(text)) {
          break;
        }
        await key(page, 'ArrowRight', 400);
      }
      await key(page, 'Enter', 500); // pick the search prelude
      await key(page, 'ArrowRight', 400);
      await key(page, 'Enter', 500); // pick any second prelude
      await key(page, 'Period', 1200); // continue
      continue;
    }
    await key(page, /корпорац|директор/.test(step) ? 'Enter' : 'Period', 1200);
  }

  await expect(summary).toHaveCount(1);
  await page.waitForTimeout(500);
  await key(page, 'Enter', 700); // arms the zero-projects warning
  await key(page, 'Enter', 1800); // submits → the PRELUDE PHASE opens
}

/**
 * The prelude phase («Выберите карту Прологов, чтобы разыграть её»): each
 * prelude is played explicitly with A. Walk focus onto the search prelude and
 * play it — that press is what fires the deck-draw scene.
 */
async function playSearchPrelude(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 30_000});
  const focused = page.locator('.con-start__prelude--focused');
  await expect(focused).toHaveCount(1, {timeout: 20_000});
  for (let n = 0; n < 6; n++) {
    if (/агенств/i.test(await focused.innerText())) {
      break;
    }
    await key(page, 'ArrowRight', 450);
  }
  expect(await focused.innerText(), 'the search prelude should be focusable').toMatch(/агенств/i);
  await page.keyboard.press('Enter'); // no settle — the scene starts at once
}

test.describe('console · deck-draw hero scene', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('a conditional search plays off the deck, trays its discards, then assembles the reveal', async ({page, request}) => {
    test.setTimeout(240_000);

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    const playerId = model.players[0].id;

    await page.goto(`/player?id=${playerId}&console=1`);
    await walkWizardPickingSearchPrelude(page);
    await playSearchPrelude(page);

    // 1 · The scene stage exists and the modal is WITHHELD while it plays.
    const stage = page.locator('.con-deckdraw');
    await expect(stage).toHaveCount(1, {timeout: 30_000});
    // At least one card is airborne off the deck.
    await expect(page.locator('.con-deckdraw-proxy')).not.toHaveCount(0);
    expect(await page.locator('.con-reveal__card').count()).toBe(0);
    await shoot(page, '01-search-in-flight');

    // The tray appears for a search that really discarded something. (If the
    // seed's first two cards both carried a space tag there are no discards —
    // that is the honest plain-draw fallback, and the tray must NOT appear.)
    const trayOnStage = page.locator('.con-deckdraw__tray');
    const hadDiscards = await trayOnStage.count() > 0;
    if (hadDiscards) {
      await shoot(page, '02-tray');
    }

    // 2 · The scene resolves into the reveal modal, holding the found cards.
    const revealCard = page.locator('.con-reveal__card');
    await expect(revealCard).toHaveCount(1, {timeout: 45_000});
    await expect(stage).toHaveCount(0, {timeout: 20_000}); // the stage tore down
    await shoot(page, '03-reveal');

    // The server's own truth for this batch — the client must not disagree.
    const view = await (await request.get(`/api/player?id=${playerId}`)).json() as {
      cardDrawReveals: Array<{cards: Array<{name: string}>, sequence?: Array<{card: {name: string}, matched: boolean}>}>,
    };
    const batch = view.cardDrawReveals[0];
    expect(batch, 'the prelude should have queued a reveal').toBeTruthy();
    // Exactly the matched cards are on offer.
    await expect(page.locator('.con-reveal__strip .con-cards__slot')).toHaveCount(batch.cards.length);

    const discards = (batch.sequence ?? []).filter((s) => !s.matched);
    const trayInModal = page.locator('.con-reveal__discard');
    if (discards.length === 0) {
      // Nothing was discarded → no tray anywhere. The plain-draw fallback.
      await expect(trayInModal).toHaveCount(0);
      return;
    }

    // 3 · The tray survived into the modal, and its count is the SERVER's.
    await expect(trayInModal).toHaveCount(1);
    await expect(trayInModal.locator('.con-reveal__discard-count')).toHaveText(String(discards.length));

    // 4 · Inspecting it is the player's own move: walk focus onto the tray
    // (it sits after the last card) and open it with X.
    for (const _card of batch.cards) {
      await key(page, 'ArrowRight', 350);
    }
    await expect(trayInModal).toHaveClass(/con-reveal__discard--focused/);
    await shoot(page, '04-tray-focused');
    await key(page, 'KeyX', 900);
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await shoot(page, '05-tray-inspect');
    // B returns to the modal with the reveal intact.
    await key(page, 'Escape', 800);
    await expect(revealCard).toHaveCount(1);
  });
});
