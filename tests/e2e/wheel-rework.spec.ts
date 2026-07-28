import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Quick-wheel rework · press→release lifecycle + shared-element flights.
 *
 * Drives a real solo COLONIES game through the console-native shell and
 * verifies the reworked RT/LT wheel end to end:
 *  - the ARMED state seats a tile on the d-pad DOWN edge (neighbours mute),
 *  - the commit fires on the UP edge and the destination screen opens with
 *    its `data-wheel-anchor` emblem (the flight's landing point),
 *  - the trading screen is titled «Торговля» with the wheel's own emblem,
 *  - B mid-arm cancels without executing (and the stale release is inert),
 *  - a fast tap commits exactly like before,
 *  - a BLOCKED slot arms in resistance mode and refuses on release (wheel
 *    stays open, the honest reason surfaces),
 *  - LT↔RT switches swap the cross in place,
 *  - heat conversion really spends 8 heat; plant conversion really enters
 *    (and B-cancels out of) greenery placement,
 *  - standard projects / card actions / pass-confirm all open with their
 *    anchors.
 *
 * Screenshot gallery → `screenshots/wheel-rework/`.
 */

const OUT_DIR = path.resolve('screenshots', 'wheel-rework');

function newGameConfig() {
  return {
    players: [{name: 'WheelTester', color: 'red', beginner: false, handicap: 0, first: true}],
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
    testMode: true, // 500 of everything → conversions are available
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
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Open a wheel from the calm board home, retrying past lingering holds. */
async function openWheel(page: Page, code: 'Comma' | 'Period'): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await key(page, code, 900);
    if (await page.locator('.con-quick').count() > 0) {
      return;
    }
    await page.waitForTimeout(900);
  }
  expect(await page.locator('.con-quick').count(), `the ${code} wheel never opened`).toBeGreaterThan(0);
}

/** Boot a game, walk the start wizard, resolve the colony setup picks. */
async function bootToBoard(page: Page, request: APIRequestContext): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
  const startScene = page.locator('.con-start__frame');
  for (let i = 0; i < 14 && await startScene.count() > 0; i++) {
    await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
  }
  await page.waitForTimeout(5000);
  expect(await startScene.count(), 'start wizard never completed').toBe(0);
  // Solo Colonies setup: resolve the mandatory remove-colony picks until the
  // turn proper starts (the status chip flips to «ДЕЙСТВИЕ»).
  const statusStrip = page.locator('.con-status__pstatus');
  for (let i = 0; i < 14; i++) {
    const status = await statusStrip.first().innerText({timeout: 2500}).catch(() => '');
    if (/действ/i.test(status)) {
      break;
    }
    await key(page, 'Enter', 1900);
  }
  const finalStatus = await statusStrip.first().innerText({timeout: 2500}).catch(() => '');
  expect(/действ/i.test(finalStatus), `the turn never started (status: ${finalStatus})`).toBeTruthy();
  await page.waitForTimeout(1500);

  // The corporation's mandatory FIRST ACTION (Tharsis: place a city) is
  // ANNOUNCED on the board home — B opens it, A confirms, one more A places
  // the city on the seeded cell. Until it resolves the action menu is
  // honestly narrowed, so the wheel's std/conversion tiles would stay
  // disabled-with-reason.
  const announce = page.locator('.con-mandatory');
  if (await announce.count() > 0) {
    await key(page, 'Escape', 1800); // B — open the announced decision
    const corpModal = page.locator('.con-composer--corpfirst');
    await corpModal.waitFor({state: 'visible', timeout: 15_000});
    await key(page, 'Enter', 2500); // «Выполнить первое действие»
    await page.waitForSelector('.con-board--live', {timeout: 15_000});
    await key(page, 'Enter', 1500); // place on the seeded available cell
    await page.waitForTimeout(6500); // placement hero + server commit settle
    expect(await announce.count(), 'corp first action never resolved').toBe(0);
  }
}

test.describe('quick-wheel rework', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('press→release, flights, trading rename, conversions', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootToBoard(page, request);

    // ── 1 · RT wheel: static premium look ────────────────────────────
    await openWheel(page, 'Period');
    await expect(page.locator('.con-quick__slot')).toHaveCount(5);
    await expect(page.locator('.con-quick__slot-body')).toHaveCount(5);
    await shoot(page, '01-rt-wheel-static');

    // ── 2 · ARM on the down edge: the right tile seats, neighbours mute ──
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(350);
    await expect(page.locator('.con-quick__slot--right.con-quick__slot--armed')).toHaveCount(1);
    await expect(page.locator('.con-quick__slot--muted')).toHaveCount(4);
    await shoot(page, '02-rt-armed-right');

    // ── 3 · COMMIT on the up edge → the trading screen, retitled, with
    //        the wheel's emblem as the flight anchor ────────────────────
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(260);
    await shoot(page, '03-flight-midair');
    await page.waitForSelector('.con-colonies', {timeout: 8_000});
    await page.waitForTimeout(1200);
    const kicker = page.locator('.con-colonies__kicker');
    await expect(kicker).toContainText(/торговля/i);
    await expect(page.locator('.con-colonies [data-wheel-anchor="trading"]')).toHaveCount(1);
    await expect(page.locator('.con-colonies [data-wheel-anchor="trading"]')).toBeVisible();
    await shoot(page, '04-trading-screen');
    await key(page, 'Escape', 1400); // back to the board home
    expect(await page.locator('.con-colonies').count()).toBe(0);

    // ── 4 · B mid-arm cancels: nothing executes, the stale release is inert ──
    await openWheel(page, 'Period');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(250);
    await key(page, 'Escape', 500);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(700);
    expect(await page.locator('.con-quick').count(), 'B must close the wheel').toBe(0);
    expect(await page.locator('.con-colonies').count(), 'a cancelled arm must not execute').toBe(0);

    // ── 5 · A fast tap commits exactly like before ───────────────────
    await openWheel(page, 'Period');
    await key(page, 'ArrowRight', 400);
    await page.waitForSelector('.con-colonies', {timeout: 8_000});
    await key(page, 'Escape', 1400);

    // ── 6 · A BLOCKED slot resists and refuses (hydro is not in this game) ──
    await openWheel(page, 'Period');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(350);
    await expect(page.locator('.con-quick__slot--left.con-quick__slot--armed-blocked')).toHaveCount(1);
    await shoot(page, '05-armed-blocked');
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(500);
    expect(await page.locator('.con-quick').count(), 'a refused commit keeps the wheel open').toBeGreaterThan(0);
    await shoot(page, '06-blocked-refused-notice');

    // ── 7 · LT↔RT switch swaps the cross in place ────────────────────
    await key(page, 'Comma', 700); // RT wheel open + LT → switches to basics
    await expect(page.locator('.con-quick__kicker')).toContainText(/базовые/i);
    await shoot(page, '07-lt-wheel');
    await key(page, 'Period', 700); // and back to categories
    await expect(page.locator('.con-quick__kicker')).not.toContainText(/базовые/i);
    await expect(page.locator('.con-quick__kicker')).toContainText(/действия/i);
    await key(page, 'Escape', 600);

    // ── 8 · Standard projects (LT centre) — emblem anchor present ────
    await openWheel(page, 'Comma');
    await key(page, 'Enter', 1500);
    await page.waitForSelector('.con-stdp', {timeout: 8_000});
    await expect(page.locator('.con-stdp [data-wheel-anchor="std-projects"]')).toHaveCount(1);
    await shoot(page, '08-std-projects');
    await key(page, 'Escape', 1200);

    // ── 9 · Card actions (RT up) — emblem anchor present ─────────────
    await openWheel(page, 'Period');
    await key(page, 'ArrowUp', 1500);
    await page.waitForSelector('.con-cardactions', {timeout: 8_000});
    await expect(page.locator('.con-cardactions [data-wheel-anchor="card-actions"]')).toHaveCount(1);
    await shoot(page, '09-card-actions');
    await key(page, 'Escape', 1200);

    // ── 10 · Pass (LT down) → the confirm card with its emblem; input
    //         is accepted while the wheel is still assembling ──────────
    await key(page, 'Comma', 260); // deliberately short: mid-entrance
    await key(page, 'ArrowDown', 900);
    await page.waitForSelector('.con-confirm', {timeout: 8_000});
    await expect(page.locator('.con-confirm [data-wheel-anchor="confirm"]')).toHaveCount(1);
    await shoot(page, '10-pass-confirm');
    await key(page, 'Escape', 900); // cancel — nothing submitted
    expect(await page.locator('.con-confirm').count()).toBe(0);

    // ── 11 · Plant conversion continues into greenery placement; B cancels
    //         (a client-side cancel — no action is consumed) ────────────
    await openWheel(page, 'Comma');
    await key(page, 'ArrowLeft', 700);
    await page.waitForSelector('.con-board--live', {timeout: 8_000});
    await shoot(page, '13-plants-placement');
    await key(page, 'Escape', 900);
    expect(await page.locator('.con-board--live').count(), 'B must cancel the placement').toBe(0);

    // ── 12 · Heat conversion really spends 8 heat (ember flight) ─────
    const heatValue = page.locator('.con-res__row--heat .con-res__value');
    const heatBefore = parseInt((await heatValue.innerText()).trim(), 10);
    await openWheel(page, 'Comma');
    await key(page, 'ArrowRight', 500);
    await shoot(page, '11-heat-flight');
    await page.waitForTimeout(3000); // flight + server round trip + flip
    const heatAfter = parseInt((await heatValue.innerText()).trim(), 10);
    expect(heatAfter, `heat must drop by 8 (was ${heatBefore})`).toBe(heatBefore - 8);
    await shoot(page, '12-heat-after');

    // ── 13 · Cards (RT centre) → the hand rises out of the dock ──────
    await page.waitForTimeout(3000); // the turn rolls after the conversion
    await openWheel(page, 'Period');
    await key(page, 'Enter', 2600);
    await page.waitForSelector('.con-hand', {timeout: 10_000});
    await shoot(page, '14-hand-open');
    await key(page, 'Escape', 2200);
  });
});
