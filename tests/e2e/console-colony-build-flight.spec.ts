import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, openQuickWheel, press, pressUntil, settle} from './consoleStart';
import {armWitness} from './witness';

/**
 * THE COLONY BUILD'S CARD BONUS FLIES — the same premium language the trade's
 * payout speaks.
 *
 * Pluto's BUILD bonus is «возьмите 2 карты», so the build ends in a
 * `CardDrawReveal` exactly as its trade does. The contract: those cards are
 * PHYSICAL OBJECTS that leave the build slot's own printed card glyph and
 * travel into the reveal's real slots (the cover-lift scene — the same one a
 * board cell's card bonus rides), and the reveal is HELD until they land. «The
 * cards simply appear» is the bug this spec exists to keep out.
 *
 * It also fences the physicality rule the payout must obey wherever the cards
 * come from: no card is painted in a slot while its own cover is still
 * airborne (one object, never two — the bonus zone's own back was the
 * offender).
 */

const OUT = path.resolve('screenshots', 'colony-build-flight');

function newGameConfig() {
  return {
    players: [{name: 'BuildFlight', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
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
    customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
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
  return model.players[0].id;
}

/**
 * ONE HOP OF A WALK — the press, and the cursor's move as its witness: the WHOLE window before «no move» is believed
 * (a rail / a tile lands a beat after the press), and never a second press here — a wall is a legitimate no-move.
 */
async function hop(page: Page, key: string, where: () => Promise<string>, settleMs: number): Promise<void> {
  const at = await where();
  await pressUntil(page, key, async () => (await where()) !== at, {tries: 1, settleMs});
}

/** The focused colony tile — the colony walk's witness. */
function focusedTile(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('.con-coltile--focused')?.getAttribute('data-test') ?? '');
}

async function openColoniesAndFocus(page: Page, target: string): Promise<void> {
  const colonies = page.locator('.con-colonies');
  if (await colonies.count() === 0) {
    // RT opens the quick wheel; its RIGHT slot is the colonies — on a quick wheel the direction press IS the
    // activation, so the wheel leaving (or the colonies standing) is the press's effect.
    await openQuickWheel(page);
    await pressUntil(page, 'ArrowRight',
      async () => await colonies.count() > 0 || await page.locator('.con-quick').count() === 0, {settleMs: 1300});
  }
  await expect.poll(() => colonies.count(), {message: 'colonies section did not open'}).toBeGreaterThan(0);
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  const where = () => focusedTile(page);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await hop(page, 'ArrowRight', where, 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await hop(page, 'ArrowDown', where, 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await hop(page, 'ArrowLeft', where, 320);
    }
  }
  await expect.poll(() => focused.count(), {message: `could not focus ${target}`}).toBeGreaterThan(0);
}

type FlightWatch = {
  /** A cover proxy was POSED (a real box, visible) — the flight happened. */
  proxySeen: boolean;
  /** …and how many distinct proxies carried a card. */
  proxyMax: number;
  /** The lifting hero cover (the separation off the slot glyph) was posed. */
  coverSeen: boolean;
  /** The cover-lift scene's phase ladder, in order (the diagnosis on failure). */
  phases: Array<string>;
  /** A REAL card was painted in a slot while a proxy was still airborne —
   *  the «two objects for one card» break. */
  doubleImage: boolean;
  /** A card back was on screen INSIDE the reveal while proxies still flew
   *  (the bonus zone's own back — physicality broken). */
  zoneBackWhileFlying: boolean;
  /** The colony stage's working area was already faded before the first cover
   *  even left its fan (the abrupt disappearance). */
  earlyDissolve: boolean;
  /** Sampled opacity of the colony working area when the first proxy appeared. */
  stageOpacityAtLaunch: number;
  /** The SOURCE glyph was still lit while its own cover was rising off it —
   *  the card visibly duplicating out of the slot (one-object rule). */
  sourceTwin: boolean;
};

/** One recorded state of the payout: the scene's phase, what flies, what is painted under it. */
type FlightSeen = {
  /** The cover-lift scene's `source:phase` while it is active (null — no scene). */
  phase: string | null,
  /** The lifting hero cover stands visible. */
  cover: boolean,
  /** …and the source glyph it took over is still lit under it. */
  lifted: boolean,
  /** Visible card proxies in flight (both families). */
  proxies: number,
  /** The handoff beat (the real card revealed UNDER its proxy, by design). */
  handingOff: boolean,
  /** Real cards painted in the reveal's slots. */
  painted: number,
  /** Card backs painted inside the reveal. */
  backs: number,
  /** The colony stage's working-area opacity (-1 — none). */
  stage: number,
};

/**
 * Watch the whole payout from inside the page (a runner-side poll would miss
 * the frames that matter) and record the flight's own evidence.
 *
 * RECORDED (FLAKE ZERO — `armWitness`, armed before the press, replace-proof): every state the product writes, sampled
 * once the writing task's microtasks have run (`settled` — «a card painted while its cover still flies», «a lit twin
 * under a rising cover» are COEXISTENCE claims: a state a frame can paint) and once per frame (the flights are tweens).
 * The reader returns the state; the questions — ever, the most at once, the first launch — are folded here.
 */
async function armFlightWatch(page: Page) {
  return armWitness<FlightSeen>(page, 'pluto-build-flight', () => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 8 && r.height > 8 && getComputedStyle(el).visibility !== 'hidden' &&
        Number(getComputedStyle(el).opacity || '1') > 0.05;
    };
    const diagFn = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
    const d = diagFn !== undefined ? diagFn() : {};
    const scene = d.bonusScene as {active: boolean, phase: string, source: string} | undefined;
    const cover = document.querySelector('.con-bonusfly-cover');
    const coverUp = cover !== null && visible(cover);
    const main = document.querySelector('.con-colfocus__main');
    return {
      phase: scene !== undefined && scene.active ? `${scene.source}:${scene.phase}` : null,
      cover: coverUp,
      // ONE OBJECT: the icon the cover took over must be dark while it
      // rises. A lit twin under a rising cover is the card «multiplying»
      // out of the slot the cube is about to take.
      lifted: coverUp && Array.from(document.querySelectorAll('.con-bonus-source-lifted')).some(visible),
      // Every flight family that can carry these cards — the cover-lift scene
      // (build) and the trade's own covers — so the probe is about «did a
      // physical card travel», not about which module did it.
      proxies: Array.from(document.querySelectorAll('.con-bonusfly-proxy, .con-coltrade-proxy')).filter(visible).length,
      handingOff: (scene !== undefined && scene.phase === 'handoff') || d.cardScene === 'handoff',
      painted: Array.from(document.querySelectorAll('.con-reveal .con-cards__slot :is(.card-container, .pcard)')).filter(visible).length,
      backs: Array.from(document.querySelectorAll(
        '.con-reveal .con-reveal__flip-back, .con-reveal .con-reveal__bonus-slot .con-card-back')).filter(visible).length,
      stage: main === null ? -1 : Number(getComputedStyle(main).opacity || '1'),
    };
  }, {settled: true, max: 20_000});
}

/** The flight's own evidence, folded over the record. */
function foldFlight(values: ReadonlyArray<FlightSeen>): FlightWatch {
  const flying = values.filter((v) => v.proxies > 0);
  // PHYSICALITY: nothing may be painted in the reveal while a cover for
  // it is still TRAVELLING — neither a face nor a back.
  //
  // The HANDOFF is deliberately excluded: that beat exists precisely to
  // reveal the real card UNDER its proxy and dissolve the proxy above it
  // («never a swap»), so the two identical copies overlap by design for
  // its duration. Reading the scene's own phase is what keeps this a
  // rule about physicality rather than about frame counts.
  const stageOpacityAtLaunch = flying.length === 0 ? -1 : flying[0].stage;
  const phases: Array<string> = [];
  for (const v of values) {
    if (v.phase !== null && phases[phases.length - 1] !== v.phase && phases.length < 24) {
      phases.push(v.phase);
    }
  }
  return {
    proxySeen: flying.length > 0,
    proxyMax: Math.max(0, ...flying.map((v) => v.proxies)),
    coverSeen: values.some((v) => v.cover),
    phases,
    doubleImage: flying.some((v) => !v.handingOff && v.painted > 0),
    zoneBackWhileFlying: flying.some((v) => !v.handingOff && v.backs > 0),
    earlyDissolve: stageOpacityAtLaunch >= 0 && stageOpacityAtLaunch < 0.5,
    stageOpacityAtLaunch,
    sourceTwin: values.some((v) => v.cover && v.lifted),
  };
}

test('Pluto BUILD: the bonus cards physically leave the slot and fly into the reveal', async ({page, request}) => {
  test.setTimeout(420_000);
  await bootSeededGame(page, request, await createGame(request), {buy: 2, keepColony: 'Pluto'});
  await settle(page);

  // The Build Colony standard project → the colony pick → the focus stage.
  // LT opens the basic-actions wheel; its centre (A) is the standard projects — the wheel leaving is that press's effect.
  expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {settleMs: 1200}),
    'the basic-actions wheel opens').toBe(true);
  await pressUntil(page, 'Enter',
    async () => await page.locator('.con-stdp').count() > 0 || await page.locator('.con-quick').count() === 0, {settleMs: 1400});
  await expect.poll(() => page.locator('.con-stdp').count(), {message: 'standard projects did not open'}).toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await hop(page, walk[i % walk.length], focusedName, 300);
  }
  await expect.poll(async () => /колони/i.test(await focusedName()), {message: 'could not focus the colony standard project'})
    .toBe(true);
  await press(page, 'Enter', 1800);
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000); // descend — build intent
  await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the build stage did not open'}).toBeGreaterThan(0);
  await shoot(page, '01-build-stage');

  const watch = await armFlightWatch(page);
  await press(page, 'Enter'); // A = build confirm
  // The mid-flight frame: the moment the first card is in the air (the record says when), not a guessed beat.
  await watch.waitFor((v) => v.proxies > 0, {timeoutMs: 15_000, message: 'no card ever left the slot'}).catch(() => undefined);
  await shoot(page, '02-build-flight');
  // The payout is OVER when the reveal holds its cards: painted in its slots with nothing in the air and no cover left
  // standing (the record's LAST state), and the covers released them (`--bonus-held` gone) — the END state, never its
  // first sign.
  await expect.poll(async () => {
    const now = await watch.last();
    return now !== undefined && now.proxies === 0 && !now.cover && now.painted > 0;
  }, {message: 'the build payout never landed in the reveal', timeout: 30_000}).toBe(true);
  await expect(page.locator('.con-reveal--bonus-held')).toHaveCount(0, {timeout: 30_000});
  await shoot(page, '03-build-landed');
  const seen = foldFlight(await watch.stop().then((s) => s.map((x) => x.v)));
  console.log('── Pluto build flight ──', JSON.stringify(seen));

  expect(seen.coverSeen, 'the build bonus never separated from its slot glyph').toBeTruthy();
  expect(seen.sourceTwin,
    'the source glyph stayed lit under its own rising cover (the card duplicated out of the slot)').toBeFalsy();
  expect(seen.proxySeen, 'no card ever physically flew — the cards just appeared').toBeTruthy();
  expect(seen.proxyMax, 'both bonus cards fly as their own objects').toBeGreaterThanOrEqual(2);
  expect(seen.doubleImage, 'a real card was painted while its cover was still airborne').toBeFalsy();
  expect(seen.zoneBackWhileFlying, 'a card back stood in the reveal while covers were still flying').toBeFalsy();
  expect(seen.earlyDissolve,
    `the colony stage was already gone when the cards launched (opacity ${seen.stageOpacityAtLaunch})`).toBeFalsy();
});
