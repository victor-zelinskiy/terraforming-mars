import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {bootSeededGame} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE OPTIONAL-DECISION SCREEN, over the real DOM.
 *
 * Two shapes must read as one pattern:
 *  A. Mars University — «Использовать эффект?» → the offer OPENS the real hand
 *     overlay (it must not host a card grid of its own), and B from there comes
 *     back to the decision with the same action focused.
 *  B. St. Joseph of Cupertino Mission — «Купить карту?» → the offer RESOLVES on
 *     the press, with the wallet and the card previewed before it is spent.
 *
 * In both, the decline must be a real, readable card — never «Ничего не делать»
 * styled like a disabled row.
 *
 * Route-interception harness (the one the discard/Pluto probes use): walking a
 * real game to these triggers depends on the shuffle, and the subject under
 * test is the CLIENT decision layer.
 */

const OUT = path.resolve('screenshots', 'effect-decision');

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
    players: [{name: 'Decider', color: 'red', beginner: false, handicap: 0, first: true}],
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
  return (model.players.find((p) => p.name === 'Decider') ?? model.players[0]).id;
}

async function key(page: Page, k: string, wait = 600): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(wait);
}

/** Serve a prompt of the given shape on every poll. */
async function injectPrompt(page: Page, makeWaitingFor: (hand: Array<{name: string}>) => unknown): Promise<void> {
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const hand = [...(body.cardsInHand ?? []), ...PROBE_HAND
      .filter((c) => !((body.cardsInHand ?? []) as Array<{name: string}>).some((h) => h.name === c.name))];
    body.cardsInHand = hand;
    body.waitingFor = makeWaitingFor(hand);
    await route.fulfill({response, json: body});
  });
}

/**
 * The opening is SETUP — the subject is the decision screen, which only needs
 * «the action phase is live, with a real hand». The shared driver ANSWERS the
 * pregame over `player/input` and opens the console on a running game; the
 * RU-text-guarded key rotation that used to stand here spent minutes doing it
 * and blamed the product when a press was swallowed.
 */
async function openGame(page: Page, request: APIRequestContext): Promise<void> {
  await bootSeededGame(page, request, await createGame(request), {buy: 2});
}

test('an effect that opens the hand: a real question, then the REAL overlay', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await openGame(page, request);

  await injectPrompt(page, (hand) => ({
    type: 'or',
    title: 'Select one option',
    buttonLabel: 'Confirm',
    choiceContext: {
      source: {kind: 'card', card: 'Mars University'},
      trigger: 'You played a science tag.',
      mode: 'optional-effect',
    },
    options: [
      {
        type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard',
        cards: hand, min: 1, max: 1,
        showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false,
        discardPrompt: {
          min: 1, max: 1,
          source: {kind: 'card', card: 'Mars University'},
          exchange: {icon: 'cards', amount: 1, perCard: false},
        },
      },
      {type: 'option', title: 'Do nothing', buttonLabel: 'Confirm', metadata: {kind: 'skip'}},
    ],
  }));
  await page.reload();
  await page.waitForSelector('.con-decision', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '1-decision-hand');

  // 1 · a REAL question, the source, and the reason — never «Выберите вариант».
  await expect(page.locator('.con-decision__title')).toHaveText(/Использовать эффект\?/i);
  await expect(page.locator('.con-decision__trigger')).toContainText(/научную метку/i);
  await expect(page.locator('.con-decision__kicker')).toContainText(/ЭФФЕКТ КАРТЫ/i);
  expect(await page.locator('.con-decision__source .pcard, .con-decision__source .card-container').count(),
    'the source renders with the real card face').toBeGreaterThan(0);

  // 2 · the offer says where it LEADS and what it trades; the decline is a real
  //     card with the decision's own words.
  const actions = page.locator('.con-decision__action');
  expect(await actions.count()).toBe(2);
  await expect(actions.nth(0).locator('.con-decision__action-lead')).toHaveText(/Открыть карты в руке/i);
  expect(await actions.nth(0).locator('.con-decision__action-chips .action-effect-chip, .con-decision__action-chips > *').count(),
    'the exchange is previewed').toBeGreaterThan(0);
  await expect(actions.nth(1)).toHaveClass(/con-decision__action--decline/);
  await expect(actions.nth(1).locator('.con-decision__action-title')).toHaveText(/Не использовать эффект/i);
  // The decline must be READABLE — not a dimmed row.
  const declineOpacity = await actions.nth(1).evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(declineOpacity), 'declining is a decision, not a disabled control').toBeGreaterThan(0.9);

  // 3 · A on the offer hands off to the REAL hand overlay (no grid in here).
  await key(page, 'Enter', 2600);
  await shoot(page, '2-hand-overlay');
  expect(await page.locator('.con-decision').count(), 'the decision hands over').toBe(0);
  await expect(page.locator('.con-hand--discard')).toHaveCount(1);
  // …carrying the context with it.
  await expect(page.locator('.con-hand__discard')).toContainText(/Марсианский университет/i);

  // 4 · B comes BACK to the decision — it is not a decline.
  await key(page, 'Escape', 2200);
  await shoot(page, '3-back');
  await expect(page.locator('.con-decision')).toHaveCount(1);
  await expect(page.locator('.con-decision__action').nth(0)).toHaveClass(/--focused/);
});

test('a paid effect: the price and the result are shown BEFORE it is spent', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await openGame(page, request);

  await injectPrompt(page, () => ({
    type: 'or',
    title: 'Select one option',
    buttonLabel: 'Confirm',
    choiceContext: {
      source: {kind: 'card', card: 'St. Joseph of Cupertino Mission'},
      trigger: 'A Cathedral was built in one of your cities.',
      mode: 'optional-effect',
    },
    options: [
      {
        type: 'option', title: 'Pay 2 M€ to draw a card', buttonLabel: 'Confirm',
        metadata: {
          kind: 'resourceGain',
          effects: [
            {direction: 'cost', icon: 'megacredits', amount: 2, current: 144, resulting: 142},
            {direction: 'gain', icon: 'cards', amount: 1},
          ],
        },
      },
      {type: 'option', title: 'Do not buy a card', buttonLabel: 'Confirm', metadata: {kind: 'skip'}},
    ],
  }));
  await page.reload();
  await page.waitForSelector('.con-decision', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '4-decision-buy');

  await expect(page.locator('.con-decision__title')).toHaveText(/Купить карту\?/i);
  await expect(page.locator('.con-decision__trigger')).toContainText(/собор/i);
  // The price is a preview, not a surprise.
  await expect(page.locator('.con-decision__action').nth(0)).toContainText('144');
  await expect(page.locator('.con-decision__action').nth(0)).toContainText('142');
  // An immediate action promises no second screen.
  expect(await page.locator('.con-decision__action').nth(0).locator('.con-decision__action-go').count()).toBe(0);
  // The decline speaks this decision's language.
  await expect(page.locator('.con-decision__action').nth(1).locator('.con-decision__action-title'))
    .toHaveText(/Не покупать карту/i);

  // The panel sizes to its content — no half-empty screen under two choices.
  const panel = await page.locator('.con-decision__panel').boundingBox();
  const viewport = page.viewportSize();
  expect(panel !== null && viewport !== null && panel.height < viewport.height * 0.75,
    `the panel must hug its content (was ${panel?.height} of ${viewport?.height})`).toBeTruthy();

  // …and it is CENTRED — within the WORKSPACE BAND (`.con-ws-band()`: the
  // frame box between the HUD strip and the command bar, docked RIGHT of the
  // always-visible player rail). The band supplies only the box — a surface
  // that forgets to centre itself lands pinned to its top-left corner (which
  // is exactly how this shipped the first time). The expected centre is the
  // BAND's centre, measured from the surface root itself, never a viewport
  // constant.
  expect(panel).not.toBeNull();
  expect(viewport).not.toBeNull();
  const band = await page.locator('.con-decision').boundingBox();
  expect(band).not.toBeNull();
  const panelCentreX = panel!.x + panel!.width / 2;
  const bandCentreX = band!.x + band!.width / 2;
  expect(band!.x, 'the band starts right of the player rail').toBeGreaterThan(60);
  expect(Math.abs(panelCentreX - bandCentreX),
    `horizontally centred in the workspace band (centre ${panelCentreX} of band centre ${bandCentreX})`).toBeLessThan(24);
  // Vertically it is centred in the BAND, so it must sit clear of both edges by
  // a comparable margin — never flush against the top.
  expect(panel!.y, 'not pinned to the top of the band').toBeGreaterThan(60);
});
