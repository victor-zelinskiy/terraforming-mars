import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootToBoard, fillPicks, openMandatoryAnnounce, press} from './consoleStart';

/**
 * PLUTO'S PAYOUT CLOSES INSIDE THE REVEAL MODAL — ONE COLONY AT A TIME.
 *
 * The colony bonus pays "draw 1, then discard 1", and by the rules each colony
 * resolves separately and in FULL before the next is revealed. The modal lays
 * the sequence out as one ZONE per colony (exactly one live) and hosts each
 * discard under the card it belongs to. Guarded here against the real CSS/DOM:
 *
 *  1. three cubes render THREE zones — one active with the drawn card, the rest
 *     face-down placeholders (their cards are not drawn yet);
 *  2. the active colony's card is dealt FACE DOWN and opens by itself, and only
 *     then becomes takeable;
 *  3. the step is LOCKED, with an honest reason, while any card is untaken;
 *  4. B does NOT dismiss an owed payout — there is no exit but the step;
 *  5. taking a card RE-CENTRES the row without resizing it, and the taken bonus
 *     card leaves an EMPTY SOCKET (never its back);
 *  6. taking everything unlocks THIS colony's own button (always singular —
 *     never a merged multi-discard) and the command bar's A becomes it;
 *  7. pressing it leaves the modal (handing over to the single-select hand pick).
 *
 * Driven through the route-interception harness (the same one the reveal modal's
 * TV matrix uses) so an arbitrary cube count can be exercised without walking a
 * real game to three colonies on Pluto.
 */

const OUT = path.resolve('screenshots', 'pluto-bonus-discard');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: true,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'PlutoBonus', color: 'red', beginner: false, handicap: 0, first: true}],
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
  return (model.players.find((p) => p.name === 'PlutoBonus') ?? model.players[0]).id;
}


/**
 * Walk the whole game opening until the action phase is live. The payout is
 * injected only AFTERWARDS: during the start wizard the hand dock has no real
 * pack slots, so the take cinematic never commits and nothing could unlock.
 */
async function walkUntilActionReady(page: Page): Promise<void> {
  // THE SHARED DRIVER, never a bespoke walk. The hand-rolled loop this
  // replaced could only reach the action phase by out-waiting every surface
  // it did not understand — including the start workspace's embedded
  // «убрать колонию» pick, which now DESCENDS into the colony focus stage
  // and needs its own confirm there. `waitForBoardHome` knows that flow (and
  // every other one on the way home), so the spec fails on ITS OWN claim
  // instead of on the road to it.
  await bootToBoard(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
      } else if (kind === 'project') {
        await fillPicks(p, 2);
      }
    },
  });
  await page.waitForTimeout(1500);
}

/**
 * Inject the trade's FIRST payout: the trade income plus colony 1's single
 * bonus card, with colony 1 of `cubes` owing its discard. Colonies 2..N have
 * not drawn yet — exactly what the server does.
 */
async function injectPayout(page: Page, cubes: number): Promise<void> {
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.cardDrawReveals = [{
      id: 990,
      source: {type: 'colony', colonyName: 'Pluto', trade: {tradeId: 'probe:g1:a1', role: 'income'}},
      cards: [{name: 'Micro-Mills'}, {name: 'Insulation'}, {name: 'Windmills'}],
      tradeSegments: [{role: 'income', count: 2}, {role: 'bonus', count: 1}],
    }];
    // The discard half of THIS colony's payout — marked, never sniffed from the
    // title; the ordinal is what lays the sequence out.
    body.waitingFor = {
      type: 'card',
      title: 'Pluto colony bonus. Select a card to discard',
      buttonLabel: 'Discard',
      cards: (body.cardsInHand ?? []).slice(0, 6),
      min: 1,
      max: 1,
      showOnlyInLearnerMode: false,
      discardPrompt: {min: 1, max: 1, source: {kind: 'colony'}, colonyBonus: {colonyName: 'Pluto', index: 1, total: cubes}},
    };
    await route.fulfill({response, json: body});
  });
}

test('the merged payout closes with its MANDATORY discard step', async ({page, request}) => {
  test.setTimeout(150_000);
  const playerId = await createGame(request);
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-root, .con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(3500);
  await walkUntilActionReady(page);

  // NOW the payout can arrive: a real hand, a real dock, no wizard in the way.
  await injectPayout(page, 3);
  await page.reload();
  // A `colonyBonus` collect is an INTERRUPTIVE prompt, and those are ANNOUNCED,
  // not auto-opened (`consoleMandatoryGate.ts`): the board home shows «БОНУС
  // КОЛОНИИ · Ⓐ Открыть» and the payout mounts on the press. Waiting for the
  // reveal directly waits forever with a perfectly healthy board underneath.
  expect(await openMandatoryAnnounce(page), 'the colony-bonus collect was announced').toBeTruthy();
  // ⚠️ THE PAYOUT IS EMBEDDED IN THE COLONY WORKSPACE («КОЛОНИИ › ПЛУТОН › ДОБОР
  // КАРТ»), which is what owns a colony resolution end to end. So the closing
  // step lives in the ONE bottom status bar (`.con-reveal__namebar`), and the
  // per-zone `.con-reveal__closer` button is explicitly STANDALONE-ONLY
  // (`v-if="… && !embedded"`) — an in-zone button pushed the zone past the
  // stage's vertical budget. The ZONES are the payout's own layout either way,
  // so they are what says «the stage is up».
  await page.waitForSelector('.con-reveal__bonus-zone', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(3000); // the entrance + the card's own turn settle
  await shoot(page, 'locked');
  /** The payout's closing step, wherever it is hosted (one bar when embedded). */
  const closer = page.locator('.con-reveal__namebar .con-cards__verdict, .con-reveal__closer-cta');

  // 1 · THREE zones — one live, the rest waiting face-down.
  const zones = page.locator('.con-reveal__bonus-zone');
  expect(await zones.count(), 'one zone per colony').toBe(3);
  expect(await page.locator('.con-reveal__bonus-zone--active').count()).toBe(1);
  expect(await page.locator('.con-reveal__bonus-zone--future').count()).toBe(2);
  await expect(page.locator('.con-reveal__bonus-zone--active .con-reveal__bonus-zone-label')).toContainText('1/3');
  // A waiting colony offers nothing and says why.
  expect(await page.locator('.con-reveal__bonus-zone--future .con-reveal__closer').count()).toBe(0);
  await expect(page.locator('.con-reveal__bonus-wait').first()).toContainText(/Ожидает/i);

  // 2 · the live colony's card is OPEN with no input given.
  //     The zone no longer owns a face-down flip chassis of its own: the card
  //     turns IN THE AIR on the cover that carried it here, so the zone mounts
  //     it already face-up («one object, one turn, one grammar» — the old
  //     `.con-reveal__flip--up` is gone, and its presence used to mean the zone
  //     was painting a SECOND back for a card already in flight).
  await expect(page.locator('.con-reveal__bonus-zone--active .con-reveal__bonus-slot :is(.pcard, .card-container)'))
    .toHaveCount(1);
  await expect(page.locator('.con-reveal__bonus-zone--active .con-reveal__bonus-cover')).toHaveCount(0);

  // 3 · THE PAYOUT CANNOT BE CLOSED BEFORE ITS CARDS ARE TAKEN.
  //     Embedded, the ONE status bar states the FOCUSED CARD (name + factual
  //     availability — the shared card-status register); the TAKE verb lives in
  //     the one bottom command bar («A Взять»), never as a second local chip.
  //     With cards still untaken the discard step is not offered at all yet,
  //     so there is nothing to lock and «сброса» must not read anywhere here.
  //     (The standalone band states the same thing the other way round, with a
  //     locked CTA + «Сначала заберите…» — one host, one voice, never both.)
  await expect(page.locator('.con-reveal__namebar .con-cards__verdict-name')).toBeVisible();
  await expect(page.locator('.con-cmdbar')).toContainText(/Взять/i);
  expect(await closer.count(), 'no closing verb while the take is owed').toBe(0);

  // 4 · THE ZONE'S FOOTPRINT IS FIXED across the take — the card leaves an EMPTY
  //     SOCKET of exactly its size, «so nothing resizes or shifts»
  //     (ConsoleRevealOverlay's own contract for this slot).
  //     ⚠️ Measure THE ZONE, not `.con-reveal__strip .con-cards__slot` first:
  //     that selector silently RE-POINTS once the income cards are taken (its
  //     first match becomes the bonus slot), so it compared two different
  //     elements and reported the difference as a resize.
  const zoneSlotBox = () => page.locator('.con-reveal__bonus-zone--active .con-reveal__bonus-slot')
    .evaluate((el) => {
      const b = el.getBoundingClientRect(); return {w: Math.round(b.width), h: Math.round(b.height)};
    });
  const before = await zoneSlotBox();

  // 5 · B is the take-all shortcut, never an exit.
  await page.keyboard.press('Escape');
  // …and once every card is taken the SAME bar becomes the closing step.
  await expect(closer).toContainText(/Выбрать карту для сброса/i, {timeout: 20_000});
  await expect(page.locator('.con-reveal__closer-cta--locked')).toHaveCount(0);
  await page.waitForTimeout(900); // the re-centring glide settles
  await shoot(page, 'ready');

  // …and the taken bonus card left an EMPTY SOCKET at the same size — never its
  // back, which would read as a card still lying on the table.
  expect(await page.locator('.con-reveal__bonus-socket').count(), 'the taken card leaves its socket').toBe(1);
  expect(await page.locator('.con-reveal__bonus-zone--active .con-reveal__bonus-cover').count(),
    'the resolved colony must NOT show a card back').toBe(0);
  const after = await zoneSlotBox();
  expect(after, `the socket keeps the card's footprint (${JSON.stringify(before)} → ${JSON.stringify(after)})`)
    .toEqual(before);
  expect(await page.locator('.con-reveal').count(), 'the modal must NOT be dismissable').toBe(1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  expect(await page.locator('.con-reveal').count(), 'a second B must not close it either').toBe(1);

  // 6 · unlocked, and the command bar's A now IS this colony's step (singular).
  await expect(page.locator('.con-reveal__closer-cta--locked')).toHaveCount(0);
  await expect(page.locator('.con-cmdbar')).toContainText(/Выбрать карту для сброса/i);

  // 7 · pressing it hands over to the single-select hand pick.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await shoot(page, 'handed-over');
  expect(await page.locator('.con-reveal').count(), 'the step must release the modal').toBe(0);
});
