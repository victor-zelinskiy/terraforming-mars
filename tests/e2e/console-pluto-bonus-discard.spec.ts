import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * PLUTO'S PAYOUT CLOSES INSIDE THE REVEAL MODAL.
 *
 * The colony bonus pays "draw N, then discard N". The server batches it per
 * recipient (one merged draw + ONE discard-N prompt, marked structurally with
 * `colonyBonusDiscard`) and the reveal modal hosts that discard as its final,
 * MANDATORY step. Guarded here against the real CSS/DOM:
 *
 *  1. the merged batch shows ONE bonus zone holding ALL bonus cards, on the same
 *     line as the trade income (a padded zone used to sink them);
 *  2. the closing step renders LOCKED, with an honest reason, while any card is
 *     still untaken;
 *  3. B does NOT dismiss an owed payout — there is no exit but the step;
 *  4. taking everything unlocks it and the command bar's A becomes the step
 *     (plural for several cubes);
 *  5. pressing it leaves the modal (handing over to the hand pick).
 *
 * Driven through the route-interception harness (the same one the reveal modal's
 * TV matrix uses) so an arbitrary cube count can be exercised without walking a
 * real game to two colonies on Pluto.
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


async function key(page: Page, k: string, wait = 600): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(wait);
}

async function removalPickLive(page: Page): Promise<boolean> {
  if (await page.locator('.con-colonies').count() === 0) {
    return false;
  }
  const text = (await page.locator('.con-colonies__summary').textContent().catch(() => '')) ?? '';
  return text.includes('УБРАТЬ КОЛОНИЮ');
}

/**
 * Walk the whole game opening until the action phase is live. The payout is
 * injected only AFTERWARDS: during the start wizard the hand dock has no real
 * pack slots, so the take cinematic never commits and nothing could unlock.
 */
async function walkUntilActionReady(page: Page): Promise<void> {
  const startBadge = page.getByText('СТАРТОВЫЙ ВЫБОР').first();
  const basicsChip = page.getByText('БАЗОВЫЕ').first();
  const placement = page.getByText(/Выберите клетку/i).first();
  const wiggle = ['Enter', 'ArrowRight', 'Enter', 'ArrowUp', 'Enter', 'ArrowLeft', 'Enter', 'ArrowDown'];
  const advance = ['Enter', 'Enter', 'Period', 'Enter', 'KeyE', 'Period'];
  for (let i = 0; i < 70; i++) {
    const ready = await basicsChip.isVisible().catch(() => false) &&
      !(await startBadge.isVisible().catch(() => false)) &&
      await page.locator('.con-mandatory').count() === 0 &&
      !(await placement.isVisible().catch(() => false)) &&
      !(await removalPickLive(page));
    if (ready) {
      await page.waitForTimeout(1500);
      return;
    }
    if (await removalPickLive(page)) {
      await key(page, 'Enter', 2200);
      continue;
    }
    if (await page.locator('.con-mandatory').count() > 0) {
      await key(page, 'Enter', 1100);
      continue;
    }
    if (await placement.isVisible().catch(() => false)) {
      await key(page, wiggle[i % wiggle.length], 700);
      continue;
    }
    await key(page, advance[i % advance.length], 1100);
  }
  await shoot(page, 'walk-stuck');
  expect(false, 'never reached the action phase').toBeTruthy();
}

/** Inject a merged Pluto payout: 2 income + 2 bonus cards, discard 2 owed. */
async function injectPayout(page: Page, bonusCubes: number): Promise<void> {
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.cardDrawReveals = [{
      id: 990,
      source: {type: 'colony', colonyName: 'Pluto', trade: {tradeId: 'probe:g1:a1', role: 'income'}},
      cards: [
        {name: 'Micro-Mills'}, {name: 'Insulation'},
        {name: 'Windmills'}, {name: 'Bushes'},
      ].slice(0, 2 + bonusCubes),
      tradeSegments: [{role: 'income', count: 2}, {role: 'bonus', count: bonusCubes}],
    }];
    // The discard half of the same payout — marked, never sniffed from the title.
    body.waitingFor = {
      type: 'card',
      title: 'Pluto colony bonus. Select 2 cards to discard',
      buttonLabel: 'Discard',
      cards: (body.cardsInHand ?? []).slice(0, 6),
      min: bonusCubes,
      max: bonusCubes,
      showOnlyInLearnerMode: false,
      colonyBonusDiscard: {colonyName: 'Pluto', count: bonusCubes},
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
  await injectPayout(page, 2);
  await page.reload();
  await page.waitForSelector('.con-reveal__closer', {state: 'visible', timeout: 40_000});
  await page.waitForTimeout(2500); // the entrance settles
  await shoot(page, 'locked');

  // 1 · ONE bonus zone holding ALL the bonus cards, and the whole row on one line.
  const zone = page.locator('.con-reveal__bonus-zone');
  expect(await zone.count(), 'the bonus cards must share ONE zone').toBe(1);
  expect(await zone.locator('.con-cards__slot').count()).toBe(2);
  await expect(page.locator('.con-reveal__bonus-zone-label')).toContainText('×2');
  const tops = await page.locator('.con-reveal__strip .con-cards__slot').evaluateAll(
    (els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  const unfocused = tops.slice(1); // the focused slot legitimately rides higher
  expect(Math.max(...unfocused) - Math.min(...unfocused),
    `bonus and income cards must sit on ONE line (tops: ${tops.join(',')})`).toBeLessThanOrEqual(2);

  // 2 · LOCKED with an honest reason while cards are untaken.
  await expect(page.locator('.con-reveal__closer-cta--locked')).toHaveCount(1);
  await expect(page.locator('.con-reveal__closer-lock')).toContainText(/Сначала заберите/i);
  await expect(page.locator('.con-reveal__closer-cta')).toContainText(/Выбрать карты для сброса/i);

  // 3 · B is the take-all shortcut, never an exit — the modal survives it and,
  //     with everything taken, stays put instead of dismissing.
  await page.keyboard.press('Escape');
  // The stack intake gathers, flies to the dock and lands card by card — the
  // takes commit on the touchdowns, so give the whole cinematic time.
  await page.waitForSelector('.con-reveal__closer--ready', {state: 'visible', timeout: 20_000});
  await shoot(page, 'ready');
  expect(await page.locator('.con-reveal').count(), 'the modal must NOT be dismissable').toBe(1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  expect(await page.locator('.con-reveal').count(), 'a second B must not close it either').toBe(1);

  // 4 · unlocked, and the command bar's A now IS the step.
  await expect(page.locator('.con-reveal__closer--ready')).toHaveCount(1);
  await expect(page.locator('.con-reveal__closer-cta--locked')).toHaveCount(0);
  await expect(page.locator('.con-cmdbar')).toContainText(/Выбрать карты для сброса/i);

  // 5 · pressing it hands over (the modal releases; the hand pick takes it from here).
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await shoot(page, 'handed-over');
  expect(await page.locator('.con-reveal').count(), 'the step must release the modal').toBe(0);
});
