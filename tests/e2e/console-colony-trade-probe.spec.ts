import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, openMandatoryAnnounce} from './consoleStart';

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

/**
 * The whole pregame through the SHARED console-start driver (the ONE way
 * console e2e boots a game — the pregame is ANSWERED over `player/input`, then
 * the console opens on the live board), steering the setup «remove a colony»
 * pick OFF the probe's trade target so it survives into the action phase.
 *
 * A REAL hand (`buy`): the board home's dock only goes live with cards in it,
 * and the probe's action phase should look like a game, not a stub.
 */
async function bootGame(page: Page, request: APIRequestContext, playerId: string, keep: string): Promise<void> {
  await bootSeededGame(page, request, playerId, {buy: 2, keepColony: keep});
  await page.waitForTimeout(1500); // entry animations settle
}

/**
 * THE TRACK RESET, ASSERTED ON THE GAME STATE.
 *
 * The trade's rules outcome is that the colony's track returns to its post-trade
 * position — that is what «the marker steps home» DEPICTS. The depiction itself
 * is conditional by design: `ConsoleColonyTradeLayer` glides a marker proxy only
 * while the track is measurable on screen, and during a payout it is not — the
 * colony workspace has descended into «КОЛОНИИ › <колония> › ДОБОР КАРТ», so the
 * overview with its track cells is not on stage and the layer takes its own
 * documented branch («track glide skipped — track not measurable»). Requiring
 * the proxy therefore asserted a screen the flow deliberately replaced; the
 * server's own number cannot be missed and cannot be raced.
 */
async function trackPosition(request: APIRequestContext, playerId: string, colony: string): Promise<number> {
  const resp = await request.get(`/api/player?id=${playerId}`);
  expect(resp.ok()).toBeTruthy();
  const view = await resp.json() as {game: {colonies: Array<{name: string, trackPosition: number}>}};
  const found = view.game.colonies.find((c) => c.name === colony);
  expect(found, `colony ${colony} is in play`).not.toBe(undefined);
  return found!.trackPosition;
}

/** The colony names actually in play (the automa deal is seeded-random). */
async function dealtColonies(request: APIRequestContext, playerId: string): Promise<Array<string>> {
  const resp = await request.get(`/api/player?id=${playerId}`);
  expect(resp.ok()).toBeTruthy();
  const view = await resp.json() as {game: {colonies: Array<{name: string}>}};
  return view.game.colonies.map((c) => c.name);
}

/** The colonies section is showing the setup "remove a colony" pick.
 *  (The compact status RAIL replaced the old summary band — the pick's verb
 *  chip lives there now.) */
async function removalPickLive(page: Page): Promise<boolean> {
  if (await page.locator('.con-colonies').count() === 0) {
    return false;
  }
  const text = (await page.locator('.con-colonies__rail').textContent().catch(() => '')) ?? '';
  return text.toUpperCase().includes('УБРАТЬ КОЛОНИЮ');
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
  /** How many times the in-page recorder actually looked (a dead probe = 0). */
  samples: number;
};

/**
 * ⚠️ THE SIGHTINGS ARE RECORDED IN THE PAGE, NEVER POLLED FROM NODE.
 *
 * Everything watched here is TRANSIENT by construction — a cover proxy, a track
 * marker that glides once and is gone, a `--bonus-mode` class that lives for the
 * length of one arrival. The old loop asked Playwright for five `count()`s
 * between 200 ms sleeps, so one pass cost ~0.5 s of round trips and the sampler
 * routinely blinked straight past the marker: «the track-reset marker glide
 * never played» was a statement about the PROBE, not about the product.
 *
 * A `MutationObserver` fires on the very mutation that inserts the node, and the
 * 50 ms interval covers a node that is only re-CLASSED. Deliberately not
 * `requestAnimationFrame`: headless Chromium drives rAF off the compositor, so a
 * rAF sampler stops sampling exactly when the screen goes quiet. `samples` is
 * returned and asserted so a probe that died cannot pass as «nothing happened».
 */
async function armSightings(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const state = {proxy: false, marker: false, bonusMode: false, reveal: false,
      deckDraw: [] as Array<number>, samples: 0, t0: performance.now()};
    w.__sight = state;
    const scan = () => {
      state.samples++;
      const at = Math.round(performance.now() - state.t0);
      if (document.querySelector('.con-coltrade-proxy') !== null) {
        state.proxy = true;
      }
      if (document.querySelector('.con-coltrade-marker') !== null) {
        state.marker = true;
      }
      if (document.querySelector('.con-reveal--bonus-mode') !== null) {
        state.bonusMode = true;
      }
      if (document.querySelector('.con-reveal') !== null || document.querySelector('.con-zoom') !== null) {
        state.reveal = true;
      }
      if (document.querySelector('.con-deckdraw') !== null && state.deckDraw.at(-1) !== at) {
        state.deckDraw.push(at);
      }
    };
    w.__sightObs = new MutationObserver(scan);
    w.__sightObs.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
    w.__sightTimer = window.setInterval(scan, 50);
    scan();
  });
}

async function tradeAndObserve(page: Page, tag: string, journal: Array<string>, windowMs: number): Promise<Observation> {
  await key(page, 'Enter', 1400); // A = Trade → the COLONY FOCUS STAGE (the workspace descend)
  const stage = page.locator('.con-colfocus');
  expect(await stage.count(), 'the colony focus stage did not open').toBeGreaterThan(0);
  await shoot(page, `${tag}-composer`);
  // Arm BEFORE the commit — the cover leaves the tile on the very next frames.
  await armSightings(page);
  await key(page, 'KeyX', 200); // X = confirm (folds back to the surface, the fleet lifts off)

  await page.waitForTimeout(2400);
  await shoot(page, `${tag}-t2.4s`);
  await page.waitForTimeout(3600);
  await shoot(page, `${tag}-t6s`);
  await page.waitForTimeout(Math.max(0, windowMs - 6000));
  await shoot(page, `${tag}-end`);

  const raw = await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__sightObs?.disconnect();
    window.clearInterval(w.__sightTimer);
    return w.__sight as {proxy: boolean, marker: boolean, bonusMode: boolean, reveal: boolean,
      deckDraw: Array<number>, samples: number};
  });
  const obs: Observation = {
    journal,
    deckDrawSightings: raw.deckDraw.map((ms) => `t+${ms}ms`),
    sawTradeProxy: raw.proxy,
    sawMarker: raw.marker,
    sawBonusMode: raw.bonusMode,
    sawReveal: raw.reveal,
    samples: raw.samples,
  };

  console.log(`── [colony-trade] journal (${tag}) ──`);
  journal.forEach((line) => console.log(line));
  console.log('recorder samples:', obs.samples);
  console.log('deck-draw sightings:', obs.deckDrawSightings.length > 0 ? obs.deckDrawSightings.join(', ') : 'none');
  console.log('trade cover proxy seen:', obs.sawTradeProxy);
  console.log('track marker proxy seen:', obs.sawMarker);
  console.log('reveal bonus-mode seen:', obs.sawBonusMode);
  console.log('reveal/zoom surface seen:', obs.sawReveal);
  // A silent probe must never read as «the product did nothing».
  expect(obs.samples, 'the in-page sighting recorder ran').toBeGreaterThan(10);
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

/*
 * NOT `serial`. Each test creates its OWN game and drives its OWN page, so a
 * failure in one says nothing about the others — while `serial` marks them «did
 * not run» and removes them from the report entirely.
 */
test('visual: a merged trade batch renders the labelled colony-bonus zone', async ({page, request}) => {
  test.setTimeout(180_000);
  const game = await createGame(request, false);

  // ⚠️ BOOT PAST THE PREGAME FIRST. The injection used to run against a browser
  // still sitting in the start wizard, where a payout is correctly SUPPRESSED
  // (the start workspace owns the screen, and the hand dock has no real pack
  // slots for the take to land in) — so the spec waited 30 s for a zone that
  // was never going to mount, on a perfectly healthy corporation-pick screen.
  // Its two sibling tests already boot; this one simply never did.
  await bootGame(page, request, game.playerId, 'Pluto');

  // Inject a merged Pluto trade batch (2 income + 1 bonus card of a 2-colony
  // sequence) into every /api/player response — the route-interception
  // harness the reveal modal's TV matrix already uses for arbitrary counts.
  // The BONUS ZONE renders off the server's structural discard marker
  // (`discardPrompt.colonyBonus` — one zone per owned colony, exactly one
  // active), so the marker is injected alongside the batch.
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.cardDrawReveals = [{
      id: 990,
      source: {type: 'colony', colonyName: 'Pluto', trade: {tradeId: 'probe:g1:a1', role: 'income'}},
      cards: [
        {name: 'Micro-Mills'}, {name: 'Insulation'},
        {name: 'Windmills'},
      ],
      tradeSegments: [{role: 'income', count: 2}, {role: 'bonus', count: 1}],
    }];
    // ⚠️ A WHOLE PROMPT, not a marker bolted onto whatever was already there.
    // The zones render off a colony-bonus DISCARD prompt, i.e. a `type: 'card'`
    // select carrying `discardPrompt.colonyBonus`. Spreading the board-home
    // action menu and only adding the marker left `type: 'or'`, so nothing
    // classified it as an interruptive colony-bonus collect: no announce, no
    // zone, and a 30 s wait on a perfectly ordinary board. Same shape as
    // console-pluto-bonus-discard, which is the flow this mirrors.
    body.waitingFor = {
      type: 'card',
      title: 'Pluto colony bonus. Select a card to discard',
      buttonLabel: 'Discard',
      cards: (body.cardsInHand ?? []).slice(0, 6),
      min: 1,
      max: 1,
      showOnlyInLearnerMode: false,
      discardPrompt: {
        min: 1, max: 1, source: {kind: 'colony'},
        colonyBonus: {colonyName: 'Pluto', index: 1, total: 2},
      },
    };
    await route.fulfill({response, json: body});
  });

  await page.reload();
  await page.waitForSelector('.con-root', {timeout: 45_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => {});
  // A `colonyBonus` collect is INTERRUPTIVE, and interruptive prompts are
  // ANNOUNCED rather than auto-opened (`consoleMandatoryGate.ts`): the board
  // shows «БОНУС КОЛОНИИ · Ⓐ Открыть» and the payout mounts on the press.
  await openMandatoryAnnounce(page);
  await page.waitForSelector('.con-reveal__bonus-zone', {state: 'visible', timeout: 30_000});
  await page.waitForTimeout(3000); // entrance settles
  await shoot(page, 'bonus-zone');

  // ONE zone per owned colony (index 1 of 2 → an ACTIVE zone + a FUTURE
  // placeholder), each labelled — the sequence reads as a table.
  const zone = page.locator('.con-reveal__bonus-zone');
  expect(await zone.count(), 'one zone per colony of the sequence').toBe(2);
  expect(await page.locator('.con-reveal__bonus-zone--active').count(), 'exactly one ACTIVE zone').toBe(1);
  await expect(page.locator('.con-reveal__bonus-zone-label').first()).toHaveText(/Бонус колонии/i);
  // The income cards stay OUTSIDE the zones, on the ordinary strip.
  const strip = page.locator('.con-reveal__strip');
  expect(await strip.locator('.con-cards__slot').count()).toBeGreaterThanOrEqual(2);
});

test('solo (gated path): the trade cinematic claims the Pluto reveal', async ({page, request}) => {
  test.setTimeout(300_000);
  const journal = collectJournal(page);
  const game = await createGame(request, false);
  await bootGame(page, request, game.playerId, 'Pluto');
  await openColoniesAndFocus(page, 'solo', 'Pluto');
  const before = await trackPosition(request, game.playerId, 'Pluto');
  const obs = await tradeAndObserve(page, 'solo', journal, 12_000);

  // The `[colony-trade]` journal is dev-only (stripped from the production
  // bundle) — the verdicts ride the OBSERVABLE stage facts instead.
  expect(obs.deckDrawSightings.length, 'deck-draw wrongly claimed the trade reveal').toBe(0);
  expect(obs.sawTradeProxy, 'no trade cover ever flew off the tile').toBeTruthy();
  expect(obs.sawBonusMode, 'the reveal never mounted staged (covers→slots)').toBeTruthy();
  // …and the trade actually happened (see `trackPosition`).
  expect(await trackPosition(request, game.playerId, 'Pluto'),
    'the trade did not reset the colony track').toBeLessThan(before);
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

  await bootGame(page, request, game.playerId, target);
  // Burn action 1 so the trade below ENDS the turn → the response carries
  // the bot's turns → the STAGED commit path (the field-report repro).
  await burnActionOnHeatConversion(page);

  await openColoniesAndFocus(page, 'bot', target);
  const before = await trackPosition(request, game.playerId, target);
  // Longer window: the bot's turn cards (TTL ~5 s each) deliver BEFORE the
  // buffered commit lands the reveal / track reset.
  const obs = await tradeAndObserve(page, 'bot', journal, 24_000);

  // Dev journal is stripped from the production bundle — assert the stage.
  expect(obs.deckDrawSightings.length, 'deck-draw wrongly claimed the trade reveal').toBe(0);
  // The STAGED bot path must still land the trade itself (see `trackPosition`).
  expect(await trackPosition(request, game.playerId, target),
    'the staged commit never applied the trade').toBeLessThan(before);
  if (target === 'Pluto') {
    expect(obs.sawTradeProxy, 'no trade cover ever flew (Pluto)').toBeTruthy();
    expect(obs.sawBonusMode, 'the reveal never mounted staged (Pluto)').toBeTruthy();
  }
});
