import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * "WHY DID THIS PROMPT COME TO ME?" — over the real DOM.
 *
 * Philares is the fork's purest prompt-out-of-nowhere: its resource
 * distribution fires when ANY player, including an opponent, places a tile
 * next to one of yours. Before the `choiceContext` marker the player was
 * handed six resource lanes with no attribution at all — no card, no reason,
 * no way to look the corporation up.
 *
 * The SERVER half (the prompt really carries the marker, in both the own-tile
 * and the opponent-tile phrasing) is proven by `tests/cards/promo/Philares.spec.ts`.
 * THIS spec proves the CLIENT half — that the marker reaches the console's
 * three source surfaces: the compact card dock, the trigger line, and the L3
 * «ИСТОЧНИК» verb on the command bar. Route interception is the harness the
 * decision / discard / Pluto probes already use: walking a real game to a
 * Philares adjacency depends on the shuffle, and the subject under test is the
 * client layer.
 */

const OUT = path.resolve('screenshots', 'prompt-source');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    // promo OFF on purpose: the probe INJECTS the prompt, and the premium card
    // face resolves from the client's full card manifest regardless of which
    // expansions the game runs. Enabling promo only lengthens the start wizard
    // (more corps to walk past) and made the driver time out.
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Sourcer', color: 'red', beginner: false, handicap: 0, first: true}],
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

async function key(page: Page, k: string, wait = 600): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(wait);
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return (model.players.find((p) => p.name === 'Sourcer') ?? model.players[0]).id;
}

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

/** Serve a fixed prompt on every poll. */
async function injectPrompt(page: Page, waitingFor: unknown): Promise<void> {
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.waitingFor = waitingFor;
    await route.fulfill({response, json: body});
  });
}

/** Serve the Philares distribution prompt — exactly as the server builds it. */
async function injectPhilaresPrompt(page: Page): Promise<void> {
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.waitingFor = {
      type: 'resources',
      // The real title: `message('Gain ${0} standard resources', b => b.number(2))`.
      title: {message: 'Gain ${0} standard resources', data: [{type: 1, value: '2'}]},
      buttonLabel: 'Select',
      count: 2,
      choiceContext: {
        source: {kind: 'corporation', card: 'Philares'},
        // The OPPONENT phrasing — the case that has no other explanation on
        // screen at all (the player did not act; someone else did).
        trigger: {
          message: '${0}\'s tile landed next to yours. New adjacencies: ${1}',
          data: [{type: 2, value: 'Bot'}, {type: 1, value: '2'}],
        },
        mode: 'reward',
      },
    };
    await route.fulfill({response, json: body});
  });
}

test('a resource distribution names the card that caused it', async ({page, request}) => {
  test.setTimeout(180_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  const playerId = await createGame(request);
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-root, .con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(3500);
  await walkUntilActionReady(page);

  await injectPhilaresPrompt(page);
  await page.reload();
  await page.waitForSelector('.con-task', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1500);
  await shoot(page, '1-distribute-with-source');

  // 1 · the classification and the ask are unchanged…
  await expect(page.locator('.con-task__kicker')).toContainText(/РАСПРЕДЕЛЕНИЕ РЕСУРСОВ/i);
  await expect(page.locator('.con-task__title')).toContainText(/Распределите стандартные ресурсы/i);

  // 2 · …and the prompt now says WHO asked and WHY — through the SHARED dock
  //     (`.con-src`), the same component every decision surface uses.
  const source = page.locator('.con-src');
  await expect(source).toHaveCount(1);
  expect(await source.locator('.pcard, .card-container').count(),
    'the source renders with the REAL premium card face').toBeGreaterThan(0);
  await expect(page.locator('.con-task__trigger')).toContainText(/встал рядом с вашими/i);

  // 3 · it is COMPACT — context, never the subject. The six lanes the player is
  //     actually answering must outweigh the card that produced them.
  await expect(source).toHaveClass(/con-src--compact/);
  const card = await source.locator('.pcard, .card-container').first().boundingBox();
  const body = await page.locator('.con-task__body').boundingBox();
  expect(card).not.toBeNull();
  expect(body).not.toBeNull();
  expect(card!.width, 'the source card is narrower than the lanes it explains')
    .toBeLessThan(body!.width);

  // 4 · and it can be READ — L3 opens it fullscreen. The verb lives in the ONE
  //     command bar; the dock draws no badge of its own.
  await expect(page.locator('.con-cmdbar, .con-commands').first()).toContainText(/ИСТОЧНИК/i);

  await key(page, 'KeyC', 1800); // L3
  await shoot(page, '2-source-fullscreen');
  await expect(page.locator('.con-zoom')).toHaveCount(1);

  // 5 · the prompt survives the round trip — the viewer never unmounts it.
  await key(page, 'Escape', 1600);
  await shoot(page, '3-back-to-prompt');
  await expect(page.locator('.con-zoom')).toHaveCount(0);
  await expect(page.locator('.con-src')).toHaveCount(1);

  // 6 · and the DEFERRED band on the board home names it too — the same
  //     summary feeds the chip, the command bar and the host kicker, so the
  //     minimized decision can no longer read as an anonymous demand.
  await key(page, 'Escape', 1800);
  await shoot(page, '4-deferred-band');
  const band = page.locator('.con-mandatory');
  await expect(band).toHaveCount(1);
  await expect(band).toContainText(/РАСПРЕДЕЛЕНИЕ РЕСУРСОВ/i);
  await expect(band.locator('.con-mandatory__src')).toContainText(/Philares/i);
});

/**
 * The SAME dock on a different surface. Production loss used to answer "who
 * forced this?" with its own ◈-and-a-name text chip — the only source in the
 * console that named a card and gave no way to read it. It now renders the
 * shared dock, so both shapes of cause are one language:
 *   a CARD attack   → the real premium card face + L3
 *   an ARES hazard  → a named plate + the rule, in the board's hazard accent
 */
function productionLossPrompt(source: unknown) {
  return {
    type: 'productionToLose',
    title: 'Choose 2 unit(s) of production to lose',
    buttonLabel: 'Save',
    payProduction: {cost: 2, units: {megacredits: 4, steel: 2, titanium: 1, plants: 3, energy: 2, heat: 2}},
    source,
  };
}

test('a forced production loss names what forced it — card and hazard alike', async ({page, request}) => {
  test.setTimeout(240_000);
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  const playerId = await createGame(request);
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-root, .con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(3500);
  await walkUntilActionReady(page);

  // ── A CARD cause: the real card face, inspectable ────────────────────
  await injectPrompt(page, productionLossPrompt({type: 'card', card: 'Caesar'}));
  await page.reload();
  await page.waitForSelector('.con-prodloss', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1500);
  await shoot(page, '5-prodloss-card-source');

  const source = page.locator('.con-prodloss .con-src');
  await expect(source).toHaveCount(1);
  await expect(source).toHaveClass(/con-src--compact/);
  expect(await source.locator('.pcard, .card-container').count(),
    'a card cause renders the REAL premium card face, not a name in a chip').toBeGreaterThan(0);
  await expect(page.locator('.con-cmdbar, .con-commands').first()).toContainText(/ИСТОЧНИК/i);
  // …and the six rows are still the subject: they get the width.
  const cardBox = await source.locator('.pcard, .card-container').first().boundingBox();
  const rowsBox = await page.locator('.con-prodloss__rows').boundingBox();
  expect(cardBox !== null && rowsBox !== null && cardBox.width < rowsBox.width,
    'the source must not out-weigh the rows the player is answering').toBeTruthy();

  await key(page, 'KeyC', 1800); // L3
  await shoot(page, '6-prodloss-source-fullscreen');
  await expect(page.locator('.con-zoom')).toHaveCount(1);
  await key(page, 'Escape', 1600);
  await expect(page.locator('.con-prodloss')).toHaveCount(1);

  // ── An ARES HAZARD: no card exists, so the dock keeps its shape and
  //    names the rule instead of falling silent ──────────────────────────
  await injectPrompt(page, productionLossPrompt({type: 'hazard'}));
  await page.reload();
  await page.waitForSelector('.con-prodloss', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(1500);
  await shoot(page, '7-prodloss-hazard-source');

  const hazard = page.locator('.con-prodloss .con-src');
  await expect(hazard).toHaveClass(/con-src--hazard/);
  await expect(hazard.locator('.con-src__plate')).toContainText(/ОПАСНАЯ ЗОНА/i);
  await expect(hazard.locator('.con-src__rule')).toContainText(/опасной зоной/i);
  expect(await hazard.locator('.pcard, .card-container').count(), 'nothing to render as a card').toBe(0);
  // Nothing to open → the bar must not offer a source verb it cannot honour.
  await expect(page.locator('.con-cmdbar, .con-commands').first()).not.toContainText(/ИСТОЧНИК/i);
});
