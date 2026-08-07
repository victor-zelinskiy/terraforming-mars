import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {bootSeededGame} from './consoleStart';
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


/**
 * Inject Mars University's exact prompt shape: an OrOptions with a contextual
 * marker whose FIRST branch is a marked discard SelectCard over the hand, and a
 * "do nothing" leaf. Also intercept the submit so its response really has the
 * chosen card gone — the scene's detect verifies the server's truth.
 */
async function injectMarsUniversityDiscard(page: Page, count = 1): Promise<void> {
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
          min: count,
          max: count,
          showOnlyInLearnerMode: false,
          selectBlueCardAction: false,
          showOwner: false,
          showSelectAll: false,
          discardPrompt: {
            min: count, max: count,
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
async function interceptSubmit(
  page: Page,
  discarded: () => ReadonlyArray<string>,
  opts: {withDraw?: boolean} = {},
): Promise<void> {
  await page.route('**/player/input*', async (route) => {
    const view = lastView;
    if (view === undefined) {
      await route.fulfill({status: 200, json: {}});
      return;
    }
    const gone = new Set(discarded());
    const body = JSON.parse(JSON.stringify(view));
    body.cardsInHand = (body.cardsInHand ?? []).filter((c: {name: string}) => !gone.has(c.name));
    body.waitingFor = undefined;
    body.game.gameAge = (body.game?.gameAge ?? 0) + 1;
    if (opts.withDraw === true) {
      // THE REAL MARS UNIVERSITY SHAPE: the very same response that removes the
      // discarded card also DRAWS one, so the drawn-cards reveal (and the
      // deck-draw cinematic that owns it) lands on the same commit the discard
      // scene is holding. Field-reported bug: the draw played and the discard
      // was skipped entirely.
      body.cardsInHand = [...body.cardsInHand, {name: 'Ants'}];
      body.game.deckSize = Math.max(0, (body.game.deckSize ?? 40) - 1);
      body.cardDrawReveals = [{id: 4242, cards: [{name: 'Ants'}]}];
    }
    await route.fulfill({status: 200, json: body});
  });
}

/**
 * The whole flow, shared by both shapes. `withDraw` reproduces the REAL Mars
 * University response: the same commit that removes the discarded card also
 * hands the player a new one, so the drawn-cards reveal competes with the
 * discard cinematic for the screen.
 */
async function runDiscardFlow(
  page: Page,
  request: APIRequestContext,
  opts: {withDraw: boolean, tag: string, count?: number},
): Promise<void> {
  const count = opts.count ?? 1;
  // Surface a browser-side error as test output — a silent exception in the
  // scene would otherwise look like a timeout.
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  // The opening is SETUP — the subject is the discard flow, which needs only
  // «the action phase is live, with a real hand and a real dock». The shared
  // driver ANSWERS the pregame over `player/input` and opens the console on a
  // running game; the RU-text-guarded key rotation that used to stand here
  // could not reach the action phase at all on a loaded machine.
  await bootSeededGame(page, request, await createGame(request), {buy: 2});

  await injectMarsUniversityDiscard(page, count);
  await page.reload();
  // The optional decision is served by the EFFECT DECISION screen (this shape
  // is a marked `choiceContext` prompt) — the discard is one branch of it.
  await page.waitForSelector('.con-decision', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(2000);
  await shoot(page, opts.tag + '-1-choice');

  // The choice itself stays a CHOICE (the discard is optional — no auto-select).
  await expect(page.locator('.con-decision__source')).toBeVisible();
  await expect(page.locator('.con-decision__title')).toHaveText(/Использовать эффект\?/i);

  // 1 · taking the discard branch does NOT open a grid in the modal: the REAL
  //     hand overlay opens in discard mode.
  await key(page, 'Enter', 2600);
  await shoot(page, opts.tag + '-2-hand-discard-mode');
  expect(await page.locator('.con-decision').count(), 'the decision must hand over, not host a grid').toBe(0);
  expect(await page.locator('.con-task-host').count(), 'and never fall back to the generic host').toBe(0);
  const hand = page.locator('.con-hand--discard');
  await expect(hand).toHaveCount(1);

  // 2 · the mode states the ask, names the source and shows the exchange.
  const header = page.locator('.con-hand__discard');
  await expect(header).toContainText(count === 1 ? /Сбросьте 1 карту/i : /Сбросьте 2 карты/i);
  await expect(header).toContainText(/Марсианский университет/i);
  // The exchange chip is live: it counts what is picked right now.
  await expect(header).toContainText('+1');

  // The dock's TOTAL — the honest "cards you hold" figure; it must really drop.
  const handCount = async () => Number((await page.locator('.con-handdock__num--total').textContent()) ?? '0');
  const before = await handCount();
  expect(before, 'the probe needs a non-empty hand').toBeGreaterThan(0);

  const focused = await page.locator('.con-hand__slot--selected').getAttribute('data-zoom-slot');
  expect(focused, 'a hand card must be focused').toBeTruthy();
  const chosen: Array<string> = [focused ?? ''];
  await interceptSubmit(page, () => chosen, {withDraw: opts.withDraw});

  // 3 · THE CINEMATIC. Each beat is awaited on its own DOM signal (never a
  //     fixed sleep): the cards are lifted out of the real row, turned over,
  //     squared into a packet, the hand hands off through its ORDINARY close,
  //     and the pile catches the packet — its count ticking ON CONTACT.
  if (count > 1) {
    // A multi-card discard toggles with A and confirms with RT, so the packet
    // beat (gather) is genuinely exercised — it is skipped for a single card.
    await key(page, 'Enter', 300);
    for (let i = 1; i < count; i++) {
      await key(page, 'ArrowRight', 250);
      const next = await page.locator('.con-hand__slot--selected').getAttribute('data-zoom-slot');
      if (next !== null) {
        chosen.push(next);
      }
      await key(page, 'Enter', 300);
    }
    await page.keyboard.press('Period'); // RT — confirm the set
  } else {
    await page.keyboard.press('Enter');
  }

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
  }, chosen[0]);
  expect(heldUnderProxy, 'the real card must not be visible under its own proxy').not.toBe('visible');
  // One frame's grace: a screenshot fired the instant the proxy mounts captures
  // the browser's very first raster of a brand-new <img>, which is not what a
  // player ever sees at 60fps.
  await page.waitForTimeout(140);
  await shoot(page, opts.tag + '-3-seized');

  // HAND-OFF + PILE + LANDING. Asserted back-to-back with NO screenshot in
  // between: the pile withdraws once the count has settled, and a full-page
  // capture costs more than that beat lasts.
  await page.waitForSelector('.con-discard__tray', {timeout: 15_000});
  await expect(page.locator('.con-discard__count'), 'the count ticks on contact')
    .toHaveText(String(count), {timeout: 15_000});
  expect(await page.locator('.con-discard__back').count(), 'the pile physically thickened').toBe(count);
  await shoot(page, opts.tag + '-4-landed');

  // 4 · the scene ends clean and the card really left the hand.
  await page.waitForSelector('.con-discard', {state: 'detached', timeout: 20_000});
  await page.waitForTimeout(600);
  await shoot(page, opts.tag + '-6-settled');
  expect(await page.locator('.con-discard-proxy').count(), 'no proxy may survive the scene').toBe(0);
  expect(await page.locator('.con-hand--discard').count(), 'the discard mode is over').toBe(0);
  if (!opts.withDraw) {
    expect(await handCount(), `the hand must be ${count} card(s) shorter (was ${before})`).toBe(before - count);
  }
}

test('a nested discard rides the hand overlay and the card visibly leaves it', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await runDiscardFlow(page, request, {withDraw: false, tag: 'plain'});
});

/**
 * THE FIELD-REPORTED BUG: Mars University discards AND draws in one response.
 * The discard cinematic must still play in full — the draw is the NEXT beat,
 * never a replacement for it.
 */
test('a discard that also draws still plays the discard cinematic first', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await runDiscardFlow(page, request, {withDraw: true, tag: 'draw'});
});

/**
 * SEVERAL CARDS: the beat a single discard never reaches — the turned cards are
 * squared into ONE packet and travel together, and the pile takes all of them.
 */
test('several discarded cards are squared into one packet and land together', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await runDiscardFlow(page, request, {withDraw: false, tag: 'packet', count: 2});
});
