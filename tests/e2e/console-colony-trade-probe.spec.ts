import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * COLONY-TRADE REWARD PROBE — drives a REAL game (colonies on, Pluto
 * guaranteed) through the console-native shell to a Pluto trade and records
 * which cinematic claims the drawn-cards reveal:
 *
 *   EXPECTED  the colony-trade transaction (`[colony-trade] armed/claimed`
 *             in the browser console, a `.con-coltrade-proxy` cover flight,
 *             the deck-draw stage NEVER mounting for this batch);
 *   BUG REPRO the deck-draw scene (`.con-deckdraw` visible) pulling the
 *             trade cards "off the top deck".
 *
 * TWO scenarios, because the commit paths differ:
 *   · solo (no bot)  — the gated WaitingFor path commits the trade response;
 *   · vs MarsBot     — the trade ENDS the turn, so the response carries the
 *     bot's turns and the STAGED bot pipeline commits it instead (the path
 *     the original field report broke on).
 *
 * Evidence lands in screenshots/colony-trade-probe/; the collected
 * `[colony-trade]` journal is printed to the test output.
 */

const OUT = path.resolve('screenshots', 'colony-trade-probe');

function newGameConfig(automa: boolean, seed = 0.42) {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: true,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'TradeProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed,
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
    // Solo (4 tiles dealt): pass exactly four so Pluto is guaranteed. The
    // Automa POC REJECTS custom colony lists — the bot game rides the seeded
    // random deal instead (the test reads the dealt set from the API).
    customColoniesList: automa ? [] : ['Pluto', 'Luna', 'Triton', 'Callisto'],
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
    ...(automa ? {automa: {difficulty: 'normal'}} : {}),
  };
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext, automa: boolean, seed?: number): Promise<{playerId: string, colonies: Array<string>}> {
  const created = await request.post('/api/creategame', {data: newGameConfig(automa, seed)});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  const human = model.players.find((p) => p.name === 'TradeProbe') ?? model.players[0];
  return {playerId: human.id, colonies: await dealtColonies(request, human.id)};
}

async function bootGame(page: Page, playerId: string): Promise<void> {
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(3500); // deal cinematic settles
}

/**
 * Drive the WHOLE start of the game adaptively until the action phase is
 * live: the start wizard, the corp/payment ceremony, the mandatory announce
 * card (A opens it), the corp first action (including a city placement —
 * the cursor wiggles until a legal cell takes the tile), and the solo
 * "remove a colony" setup pick (steering off `keep` so the probe's trade
 * target survives). One loop, condition-driven — fixed key sequences drift
 * the moment a step's focus differs.
 */
async function walkUntilActionReady(page: Page, keep: string): Promise<void> {
  const startBadge = page.getByText('СТАРТОВЫЙ ВЫБОР').first();
  const basicsChip = page.getByText('БАЗОВЫЕ').first();
  const placement = page.getByText(/Выберите клетку/i).first();
  const wiggle = ['Enter', 'ArrowRight', 'Enter', 'ArrowUp', 'Enter', 'ArrowLeft', 'Enter', 'ArrowDown'];
  for (let i = 0; i < 70; i++) {
    const ready = await basicsChip.isVisible().catch(() => false) &&
      !(await startBadge.isVisible().catch(() => false)) &&
      await page.locator('.con-mandatory').count() === 0 &&
      !(await placement.isVisible().catch(() => false)) &&
      !(await removalPickLive(page));
    if (ready) {
      await page.waitForTimeout(1500); // entry animations settle
      return;
    }
    if (await removalPickLive(page)) {
      const keepFocused = page.locator(`.con-coltile--focused[data-test="con-colony-${keep}"]`);
      for (let j = 0; j < 6 && await keepFocused.count() > 0; j++) {
        await key(page, 'ArrowRight', 500);
      }
      await key(page, 'Enter', 2200); // A = remove the focused colony
      continue;
    }
    if (await page.locator('.con-mandatory').count() > 0) {
      await key(page, 'Enter', 1100); // A = open the announced surface
      continue;
    }
    if (await placement.isVisible().catch(() => false)) {
      await key(page, wiggle[i % wiggle.length], 700); // hunt a legal cell
      continue;
    }
    // Wizard steps commit on A, multi-pick steps advance on RB; the
    // ceremony's pay/apply steps are all A. Alternate.
    await key(page, i % 3 === 2 ? 'KeyE' : 'Enter', 1100);
  }
  await shoot(page, 'walk-stuck');
  expect(false, 'never reached the action phase').toBeTruthy();
}

/** The colony names actually in play (the automa deal is seeded-random). */
async function dealtColonies(request: APIRequestContext, playerId: string): Promise<Array<string>> {
  const resp = await request.get(`/api/player?id=${playerId}`);
  expect(resp.ok()).toBeTruthy();
  const view = await resp.json() as {game: {colonies: Array<{name: string}>}};
  return view.game.colonies.map((c) => c.name);
}

/** The colonies section is showing the setup "remove a colony" pick. */
async function removalPickLive(page: Page): Promise<boolean> {
  if (await page.locator('.con-colonies').count() === 0) {
    return false;
  }
  const text = (await page.locator('.con-colonies__summary').textContent().catch(() => '')) ?? '';
  return text.includes('УБРАТЬ КОЛОНИЮ');
}

/**
 * Burn ONE action by sponsoring an award (always available, testMode-cheap,
 * no placement): the basic wheel → the AWARDS slot → A sponsor → confirm →
 * the MA ceremony plays out → back to board home. Makes the NEXT action the
 * turn's LAST one, which is what routes its response through the staged bot
 * pipeline.
 */
/**
 * Burn ONE action on the heat→temperature conversion (LT wheel, RIGHT slot —
 * a direct input, no placement, testMode heat affords it): the temperature
 * readout moving off −30°C is the proof the action resolved.
 */
async function burnActionOnHeatConversion(page: Page): Promise<void> {
  await key(page, 'Comma', 1100); // LT — basic actions wheel
  await key(page, 'ArrowRight', 1100); // the convert-heat slot (direct input)
  for (let i = 0; i < 3 && !(await page.getByText('-28°C').first().isVisible().catch(() => false)); i++) {
    await key(page, 'Enter', 1500); // its confirm surface, if any
  }
  for (let i = 0; i < 10 && !(await page.getByText('-28°C').first().isVisible().catch(() => false)); i++) {
    await page.waitForTimeout(800); // the WGT-style marker beat settles
  }
  await shoot(page, 'bot-after-action1');
  expect(await page.getByText('-28°C').first().isVisible().catch(() => false),
    'the heat conversion did not consume action 1').toBeTruthy();
}

async function openColoniesAndFocus(page: Page, tag: string, target: string): Promise<void> {
  // The colonies section is the RT quick wheel's RIGHT slot («Торговля» —
  // a direct input: RT, then one d-pad press).
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await key(page, 'Period', 1100); // RT — action categories wheel
    await key(page, 'ArrowRight', 1300); // trading
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
  await shoot(page, `${tag}-colonies`);

  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await key(page, 'ArrowRight', 450);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await key(page, 'ArrowDown', 450);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await key(page, 'ArrowLeft', 400);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
  // Never press A while the setup pick still owns the section — that press
  // would REMOVE the focused colony instead of opening the trade composer.
  expect(await removalPickLive(page), 'the setup removal pick is still live').toBe(false);
}

type Observation = {
  journal: Array<string>;
  deckDrawSightings: Array<string>;
  sawTradeProxy: boolean;
  sawMarker: boolean;
  sawBonusMode: boolean;
  sawReveal: boolean;
};

async function tradeAndObserve(page: Page, tag: string, journal: Array<string>, windowTicks: number): Promise<Observation> {
  await key(page, 'Enter', 1400); // A = Trade → composer
  const composer = page.locator('.con-trade');
  expect(await composer.count(), 'trade composer did not open').toBeGreaterThan(0);
  await shoot(page, `${tag}-composer`);
  await key(page, 'KeyX', 200); // X = confirm

  const obs: Observation = {journal, deckDrawSightings: [], sawTradeProxy: false, sawMarker: false, sawBonusMode: false, sawReveal: false};
  for (let tick = 0; tick < windowTicks; tick++) {
    await page.waitForTimeout(200);
    if (await page.locator('.con-deckdraw').count() > 0) {
      obs.deckDrawSightings.push(`t+${tick * 200}ms`);
    }
    obs.sawTradeProxy = obs.sawTradeProxy || await page.locator('.con-coltrade-proxy').count() > 0;
    obs.sawMarker = obs.sawMarker || await page.locator('.con-coltrade-marker').count() > 0;
    obs.sawBonusMode = obs.sawBonusMode || await page.locator('.con-reveal--bonus-mode').count() > 0;
    obs.sawReveal = obs.sawReveal || await page.locator('.con-reveal').count() > 0 || await page.locator('.con-zoom').count() > 0;
    if (tick === 12) {
      await shoot(page, `${tag}-t2.4s`);
    }
    if (tick === 30) {
      await shoot(page, `${tag}-t6s`);
    }
  }
  await shoot(page, `${tag}-end`);

  console.log(`── [colony-trade] journal (${tag}) ──`);
  journal.forEach((line) => console.log(line));
  console.log('deck-draw sightings:', obs.deckDrawSightings.length > 0 ? obs.deckDrawSightings.join(', ') : 'none');
  console.log('trade cover proxy seen:', obs.sawTradeProxy);
  console.log('track marker proxy seen:', obs.sawMarker);
  console.log('reveal bonus-mode seen:', obs.sawBonusMode);
  console.log('reveal/zoom surface seen:', obs.sawReveal);
  return obs;
}

function collectJournal(page: Page): Array<string> {
  const journal: Array<string> = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[colony-trade]')) {
      journal.push(text);
    }
  });
  return journal;
}

test.describe.configure({mode: 'serial'});

test('solo (gated path): the trade cinematic claims the Pluto reveal', async ({page, request}) => {
  test.setTimeout(300_000);
  const journal = collectJournal(page);
  const game = await createGame(request, false);
  await bootGame(page, game.playerId);
  await walkUntilActionReady(page, 'Pluto');
  await openColoniesAndFocus(page, 'solo', 'Pluto');
  const obs = await tradeAndObserve(page, 'solo', journal, 60);

  // The `[colony-trade]` journal is dev-only (stripped from the production
  // bundle) — the verdicts ride the OBSERVABLE stage facts instead.
  expect(obs.deckDrawSightings.length, 'deck-draw wrongly claimed the trade reveal').toBe(0);
  expect(obs.sawTradeProxy, 'no trade cover ever flew off the tile').toBeTruthy();
  expect(obs.sawBonusMode, 'the reveal never mounted staged (covers→slots)').toBeTruthy();
  expect(obs.sawMarker, 'the track-reset marker glide never played').toBeTruthy();
});

test('vs MarsBot (staged bot path): the trade that ENDS the turn still claims', async ({page, request}) => {
  test.setTimeout(300_000);
  const journal = collectJournal(page);
  // The automa POC rejects custom colony lists — scan seeds for a deal that
  // includes Pluto so the staged path also exercises the card covers.
  let game = await createGame(request, true);
  for (let i = 0; i < 8 && !game.colonies.includes('Pluto'); i++) {
    game = await createGame(request, true, 0.1 + i * 0.09);
  }
  console.log('dealt colonies:', game.colonies.join(', '));
  const target = game.colonies.includes('Pluto') ? 'Pluto' : game.colonies[0];

  await bootGame(page, game.playerId);
  await walkUntilActionReady(page, target);
  // Burn action 1 so the trade below ENDS the turn → the response carries
  // the bot's turns → the STAGED commit path (the field-report repro).
  await burnActionOnHeatConversion(page);

  await openColoniesAndFocus(page, 'bot', target);
  // Longer window: the bot's turn cards (TTL ~5 s each) deliver BEFORE the
  // buffered commit lands the reveal / track reset.
  const obs = await tradeAndObserve(page, 'bot', journal, 120);

  // Dev journal is stripped from the production bundle — assert the stage.
  expect(obs.deckDrawSightings.length, 'deck-draw wrongly claimed the trade reveal').toBe(0);
  expect(obs.sawMarker, 'the track-reset marker glide never played').toBeTruthy();
  if (target === 'Pluto') {
    expect(obs.sawTradeProxy, 'no trade cover ever flew (Pluto)').toBeTruthy();
    expect(obs.sawBonusMode, 'the reveal never mounted staged (Pluto)').toBeTruthy();
  }
});
