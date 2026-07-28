import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * ONE DISCARD FLOW, AND THE CARD VISIBLY LEAVES THE HAND.
 *
 * Every rule that throws cards away now marks its prompt structurally
 * (`discardPrompt`), and the console serves ALL of them the same way:
 *
 *  1. a discard nested in an OrOptions branch (Mars University's science-tag
 *     exchange) does NOT open a flat card grid inside the task host — it hands
 *     the pick to the REAL hand overlay, in DISCARD mode;
 *  2. that mode states the ask, NAMES the source card and shows the exchange
 *     («Сбросьте 1 карту» · Марсианский университет · −1 → +1);
 *  3. answering it plays the multi-beat cinematic over the real DOM: the card
 *     is seized out of its hand slot (the slot is held EMPTY under the proxy),
 *     the hand hands off, and the card is thrown onto the discard pile whose
 *     count ticks on contact;
 *  4. the scene ends clean — no proxy, no tray, nothing frozen on screen.
 *
 * Driven through route interception (the harness the Pluto payout probe uses):
 * walking a real game to "Mars University in play + a science card played"
 * depends on the shuffle, and the point under test is the CLIENT flow. The
 * submit's response is intercepted too, with the card really gone from the
 * hand — because the scene must refuse to animate a disposal the server did
 * not perform, so it has to SEE it performed.
 */

const OUT = path.resolve('screenshots', 'card-discard');

/** The last view the page received — the submit's answer is derived from it. */
let lastView: Record<string, any> | undefined;

/** A deterministic hand to discard from (real cards — the faces must render). */
const PROBE_HAND = [
  {name: 'Micro-Mills'}, {name: 'Insulation'}, {name: 'Windmills'}, {name: 'Deimos Down'},
];

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Discarder', color: 'red', beginner: false, handicap: 0, first: true}],
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
    customPreludes: [],
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

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return (model.players.find((p) => p.name === 'Discarder') ?? model.players[0]).id;
}

async function key(page: Page, k: string, wait = 600): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(wait);
}

/** Walk the opening until the action phase is live (a real hand + a real dock). */
async function walkUntilActionReady(page: Page): Promise<void> {
  const startBadge = page.getByText('СТАРТОВЫЙ ВЫБОР').first();
  const basicsChip = page.getByText('БАЗОВЫЕ').first();
  const advance = ['Enter', 'Enter', 'Period', 'Enter', 'KeyE', 'Period'];
  for (let i = 0; i < 70; i++) {
    const ready = await basicsChip.isVisible().catch(() => false) &&
      !(await startBadge.isVisible().catch(() => false)) &&
      await page.locator('.con-mandatory').count() === 0;
    if (ready) {
      await page.waitForTimeout(1500);
      return;
    }
    if (await page.locator('.con-mandatory').count() > 0) {
      await key(page, 'Enter', 1100);
      continue;
    }
    await key(page, advance[i % advance.length], 1100);
  }
  await shoot(page, 'walk-stuck');
  expect(false, 'never reached the action phase').toBeTruthy();
}

/**
 * Inject Mars University's exact prompt shape: an OrOptions with a contextual
 * marker whose FIRST branch is a marked discard SelectCard over the hand, and a
 * "do nothing" leaf. Also intercept the submit so its response really has the
 * chosen card gone — the scene's detect verifies the server's truth.
 */
async function injectMarsUniversityDiscard(page: Page): Promise<void> {
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    // testMode deals a short hand and the wizard spends it — give the probe a
    // real one to throw away from (the dock + the grid both read this list).
    const hand = [...(body.cardsInHand ?? []), ...PROBE_HAND
      .filter((c) => !((body.cardsInHand ?? []) as Array<{name: string}>).some((h) => h.name === c.name))];
    body.cardsInHand = hand;
    body.waitingFor = {
      type: 'or',
      title: 'Select an option',
      buttonLabel: 'Confirm',
      choiceContext: {
        source: {kind: 'card', card: 'Mars University'},
        trigger: 'You played a science tag.',
        mode: 'optional-effect',
      },
      options: [
        {
          type: 'card',
          title: 'Select a card to discard',
          buttonLabel: 'Discard',
          cards: hand,
          min: 1,
          max: 1,
          showOnlyInLearnerMode: false,
          selectBlueCardAction: false,
          showOwner: false,
          showSelectAll: false,
          discardPrompt: {
            min: 1, max: 1,
            source: {kind: 'card', card: 'Mars University'},
            exchange: {icon: 'cards', amount: 1, perCard: false},
          },
        },
        {type: 'option', title: 'Do nothing', buttonLabel: 'Confirm', metadata: {kind: 'skip'}},
      ],
    };
    lastView = body;
    await route.fulfill({response, json: body});
  });
}

/**
 * The submit's answer, built from the LAST view the page actually saw: the
 * discarded card is really gone and nothing is pending. Never re-issued to the
 * server (a POST replayed onto /api/player would mutate the real game).
 */
async function interceptSubmit(page: Page, discarded: () => string | undefined): Promise<void> {
  await page.route('**/player/input*', async (route) => {
    const view = lastView;
    if (view === undefined) {
      await route.fulfill({status: 200, json: {}});
      return;
    }
    const gone = discarded();
    const body = JSON.parse(JSON.stringify(view));
    body.cardsInHand = (body.cardsInHand ?? []).filter((c: {name: string}) => c.name !== gone);
    body.waitingFor = undefined;
    body.game.gameAge = (body.game?.gameAge ?? 0) + 1;
    await route.fulfill({status: 200, json: body});
  });
}

test('a nested discard rides the hand overlay and the card visibly leaves it', async ({page, request}) => {
  test.setTimeout(180_000);
  // Surface a browser-side error as test output — a silent exception in the
  // scene would otherwise look like a timeout.
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const playerId = await createGame(request);
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-root, .con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(3500);
  await walkUntilActionReady(page);

  await injectMarsUniversityDiscard(page);
  await page.reload();
  await page.waitForSelector('.con-task-host', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(2000);
  await shoot(page, '1-choice');

  // The choice itself stays a CHOICE (the discard is optional — no auto-select).
  await expect(page.locator('.con-task-host')).toContainText(/Марсианский университет/i);

  // 1 · taking the discard branch does NOT open a grid in the modal: the REAL
  //     hand overlay opens in discard mode.
  await key(page, 'Enter', 2600);
  await shoot(page, '2-hand-discard-mode');
  expect(await page.locator('.con-task-host').count(), 'the modal must hand over, not host a grid').toBe(0);
  const hand = page.locator('.con-hand--discard');
  await expect(hand).toHaveCount(1);

  // 2 · the mode states the ask, names the source and shows the exchange.
  const header = page.locator('.con-hand__discard');
  await expect(header).toContainText(/Сбросьте 1 карту/i);
  await expect(header).toContainText(/Марсианский университет/i);
  await expect(header).toContainText('−1');
  await expect(header).toContainText('+1');

  // The dock's TOTAL — the honest "cards you hold" figure; it must really drop.
  const handCount = async () => Number((await page.locator('.con-handdock__num--total').textContent()) ?? '0');
  const before = await handCount();
  expect(before, 'the probe needs a non-empty hand').toBeGreaterThan(0);

  const focused = await page.locator('.con-hand__slot--selected').getAttribute('data-zoom-slot');
  expect(focused, 'a hand card must be focused').toBeTruthy();
  await interceptSubmit(page, () => focused ?? undefined);

  // 3 · THE CINEMATIC. Each beat is awaited on its own DOM signal (never a
  //     fixed sleep): the card is seized out of the real slot, the hand hands
  //     off, the pile catches it and its count ticks ON CONTACT.
  await page.keyboard.press('Enter');

  // SEIZE — the proxy stands over the real card, which is held EMPTY under it
  // (never both at once: that is the "card flies while still in its slot" bug).
  await page.waitForSelector('.con-discard-proxy', {timeout: 15_000});
  const heldUnderProxy = await page.evaluate((name) => {
    const slot = document.querySelector(`.con-hand__slot[data-zoom-slot="${name}"]`);
    if (slot === null) {
      return 'gone'; // the hand already handed off — also honest
    }
    return slot.classList.contains('con-deal-hold') ||
      slot.querySelector('.con-deal-hold') !== null ? 'held' : 'visible';
  }, focused);
  expect(heldUnderProxy, 'the real card must not be visible under its own proxy').not.toBe('visible');
  await shoot(page, '3-seized');

  // HAND-OFF + PILE + LANDING. Asserted back-to-back with NO screenshot in
  // between: the pile withdraws once the count has settled, and a full-page
  // capture costs more than that beat lasts.
  await page.waitForSelector('.con-discard__tray', {timeout: 15_000});
  await expect(page.locator('.con-discard__count'), 'the count ticks on contact')
    .toHaveText('1', {timeout: 15_000});
  expect(await page.locator('.con-discard__back').count(), 'the pile physically thickened').toBe(1);
  await shoot(page, '4-landed');

  // 4 · the scene ends clean and the card really left the hand.
  await page.waitForSelector('.con-discard', {state: 'detached', timeout: 20_000});
  await page.waitForTimeout(600);
  await shoot(page, '6-settled');
  expect(await page.locator('.con-discard-proxy').count(), 'no proxy may survive the scene').toBe(0);
  expect(await page.locator('.con-hand--discard').count(), 'the discard mode is over').toBe(0);
  expect(await handCount(), `the hand must be one card shorter (was ${before})`).toBe(before - 1);
});
