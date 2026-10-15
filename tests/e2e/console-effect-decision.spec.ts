import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootSeededGame, pressUntilVisible, reloadConsole, settle} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE OPTIONAL-DECISION SCREEN, over the real DOM.
 *
 * Two shapes must read as one pattern:
 *  A. Mars University — its one answer is a card from the hand, so the decision IS
 *     the real hand album (opened directly, never a card grid of its own and no
 *     screen before it); the decline is RT, and B is the minimize.
 *  B. St. Joseph of Cupertino Mission — «Купить карту?» → the offer RESOLVES on
 *     the press, with the wallet and the card previewed before it is spent.
 *
 * A YES / NO (St. Joseph) keeps its decline as a real, readable card — never «Ничего не делать» styled like a
 * disabled row; every other optional decision declines with a BUTTON (RT + the plate in its question line).
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

/** Capture the next answer the console POSTs (the injected prompt is not the server's — its refusal is irrelevant). */
function nextAnswer(page: Page): Promise<unknown> {
  return page.waitForRequest((r) => r.method() === 'POST' && /\/player\/input/.test(r.url()), {timeout: 20_000})
    .then((r) => r.postDataJSON() as unknown);
}

/** The injected Mars University question: the hand discard, and «Do nothing» carrying the server's SKIP marker. */
function marsUniversityPrompt(hand: Array<{name: string}>): unknown {
  return {
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
  };
}

/*
 * THE DECISION IS ITS PICK (the owner, 2026-10-13): Mars University's question has ONE answer — a card from the hand —
 * so there is nothing to decide on a screen before the album. The album opens DIRECTLY, its refusal a BUTTON (RT) that
 * the plate in the album's question line repeats («Не сбрасывать · без [+1 карта]»), and B there is the decision's own
 * minimize — never a decline.
 */
test('an effect whose one answer is the hand: the ALBUM opens directly, the decline is RT', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await openGame(page, request);

  await injectPrompt(page, (hand) => marsUniversityPrompt(hand));
  await reloadConsole(page);
  // The album in its pick mode, the decline named in its question line (`data-flow="picking"` is a DESCENT's — a
  // standalone album has no stage to pause).
  const album = page.locator('.con-hand__question [data-decline-plate]');
  await expect(album, 'the album IS the decision').toBeVisible({timeout: 40_000});
  await settle(page);
  await shoot(page, '1-album-direct');

  // 1 · no decision screen stood before it — there was nothing to decide on one.
  await expect(page.locator('.con-decision')).toHaveCount(0);
  await expect(page.locator('.con-hand--discard')).toHaveCount(1);
  await expect(page.locator('.con-hand__discard')).toContainText(/Марсианский университет/i);

  // 2 · the refusal is NAMED in the question line, with what it forgoes — and the bar names the same button.
  const plate = page.locator('.con-hand__question [data-decline-plate]');
  await expect(plate).toBeVisible();
  await expect(plate).toContainText(/Не сбрасывать/i);
  await expect(plate.locator('[data-decline-forgone]'), 'what the refusal forgoes rides beside it').toHaveCount(1);
  await expect(page.locator('.con-cmdbar')).toContainText(/Не сбрасывать/i);

  // 3 · B is the decision's own minimize — the album leaves, nothing is answered, no decision screen rises instead.
  let posted = false;
  const onPost = (r: {method(): string, url(): string}) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posted = true;
    }
  };
  page.on('request', onPost);
  await key(page, 'Escape', 2200);
  await shoot(page, '2-minimized');
  await expect(album).toHaveCount(0);
  await expect(page.locator('.con-hand__frame'), 'the hand the pick stood up gathered back into the dock').toHaveCount(0, {timeout: 10_000});
  await expect(page.locator('.con-decision')).toHaveCount(0);
  expect(posted, 'B never answers').toBe(false);
  page.off('request', onPost);

  // 4 · back from the board home — the SAME album, decline and all.
  const reopened = await pressUntilVisible(page, 'Enter', '.con-hand__question [data-decline-plate]', {tries: 4, settleMs: 1500});
  expect(reopened, 'the board-home card restores the album').toBe(true);
  await expect(plate).toBeVisible();

  // 5 · RT declines: the answer is the skip option itself, byte-identical to the old decline row.
  const answer = nextAnswer(page);
  await key(page, 'Period', 400);
  expect(await answer).toMatchObject({type: 'or', index: 1, response: {type: 'option'}});
});

/*
 * A LIST OF TARGETS keeps every target a card — the refusal is no card among them: «RT Не атаковать» in the question
 * line, and RT answers it.
 */
test('an attack: the targets stay cards, the decline is the button in the question line', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await openGame(page, request);

  await injectPrompt(page, () => ({
    type: 'or',
    title: 'Select one option',
    buttonLabel: 'Confirm',
    choiceContext: {
      source: {kind: 'card', card: 'Flooding'},
      trigger: 'Your ocean was placed next to an opponent.',
      mode: 'attack',
    },
    options: [
      {
        type: 'option', title: 'Remove 4 M€ from Blue', buttonLabel: 'Confirm',
        metadata: {kind: 'resourceRemoval', icon: 'megacredits', amount: 4, player: {color: 'blue', current: 12, resulting: 8}},
      },
      {type: 'option', title: 'Don\'t remove M€ from adjacent player', buttonLabel: 'Confirm', metadata: {kind: 'skip'}},
    ],
  }));
  await reloadConsole(page);
  await page.waitForSelector('.con-decision', {state: 'visible', timeout: 40_000});
  await settle(page);
  await shoot(page, '3-attack');

  await expect(page.locator('.con-decision .con-prompt-head__title')).toHaveText(/Атаковать соперника\?/i);
  const actions = page.locator('.con-decision [data-decision-action]');
  await expect(actions, 'the target is a card — the refusal is not').toHaveCount(1);
  await expect(page.locator('.con-decision [data-decision-action][data-decision-role="decline"]')).toHaveCount(0);
  const plate = page.locator('.con-decision .con-prompt-head__ask [data-decline-plate]');
  await expect(plate).toBeVisible();
  await expect(plate).toContainText(/Не атаковать/i);
  await expect(page.locator('.con-cmdbar')).toContainText(/Не атаковать/i);

  const answer = nextAnswer(page);
  await key(page, 'Period', 400);
  expect(await answer).toMatchObject({type: 'or', index: 1, response: {type: 'option'}});
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
  await reloadConsole(page);
  await page.waitForSelector('.con-decision', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1200);
  await shoot(page, '4-decision-buy');

  await expect(page.locator('.con-decision .con-prompt-head__title')).toHaveText(/Купить карту\?/i);
  await expect(page.locator('.con-decision .con-prompt-head__trigger')).toContainText(/собор/i);
  // The price is a preview, not a surprise.
  await expect(page.locator('.con-decision [data-decision-action]').nth(0)).toContainText('144');
  await expect(page.locator('.con-decision [data-decision-action]').nth(0)).toContainText('142');
  // An immediate action promises no second screen.
  expect(await page.locator('.con-decision [data-decision-action]').nth(0).locator('.con-vchoice__door').count()).toBe(0);
  // The decline speaks this decision's language.
  await expect(page.locator('.con-decision [data-decision-action]').nth(1).locator('.con-vchoice__title'))
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
