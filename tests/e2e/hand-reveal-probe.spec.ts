import {test, expect, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, waitForBoardHome} from './consoleStart';

/**
 * HAND REVEAL probe — the dock ↔ hand-overlay physical transition
 * (handRevealDirector.ts, single-owner BODIES architecture: every hand card
 * is ONE persistent element on the layer; an episode SEIZES bodies — marked
 * `data-reveal-card` — and releases them, never mounts/unmounts them).
 * Drives a real game and verifies the episode contracts live:
 *  - mid-open: seized bodies fly (one card — one visible representation);
 *  - settled open: the episode released every body (`data-reveal-card`
 *    gone), slots released, bodies live on the album (shelf/packet modes);
 *  - `B` mid-open: the same timeline reverses back to the dock;
 *  - reopen mid-close: the gather reverses back to the open hand;
 *  - reduced motion: no flights, instant connected states;
 *  - handheld + tv profiles boot the same choreography.
 * Screenshots to screenshots/hand-reveal/ for the motion review.
 */

const OUT = path.resolve('screenshots', 'hand-reveal');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    // NO PRELUDES: the subject is the dock ↔ hand transition, and a prelude
    // step only adds a slower pregame (plus the occasional tile-placing
    // prelude — a whole board interaction this spec never needed). A test
    // pays for exactly what it asserts.
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'RevealTester', color: 'red', beginner: false, handicap: 0, first: true}],
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
    // QUIET corporations, pinned — a randomly dealt triggered-draw corp
    // (Point Luna, Research Network) parks a received-cards reveal over
    // the board at boot and swallows the wheel (the deal is not
    // reproducible; the explicit list is the one forced knob).
    customCorporationsList: ['CrediCor', 'Helion'],
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
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/**
 * Boot a REAL game with `buyProjects` cards already in hand — the subject of
 * this probe is the dock ↔ hand transition, so the whole pregame is the
 * shared start driver's job (`consoleStart`), not a key script that a start
 * rework silently invalidates.
 */
async function bootGame(page: Page, request: APIRequestContext, buyProjects: number, profileQuery = ''): Promise<void> {
  // ⚠️ THE API PATH, not the wizard walk. The subject here is the dock ↔ hand
  // transition, so the pregame is pure SETUP — and `consoleStart`'s own contract
  // is that a spec whose subject is NOT the pregame answers it over
  // `player/input` instead of simulating a keyboard through it («seconds instead
  // of minutes, and none of the walk's load-sensitivity»). Six tests in this
  // file each walked a full wizard; that walk, not the episode under test, was
  // most of the file's 6.6-minute runtime.
  await bootIntoGame(page, request, {
    config: newGameConfig(),
    buy: buyProjects, // the cards this probe needs in hand
    query: profileQuery,
  });
  // DRAIN the road home — the deal is NOT reproducible (tests.md), so a
  // dealt corporation with a triggered draw (Point Luna) can park a
  // received-card reveal over the board at boot and swallow the wheel.
  await waitForBoardHome(page);
  // The hand must actually hold cards — otherwise the episode under test
  // has nothing to fly and every assertion below would be vacuous. The
  // bodies live on the LAYER (single-owner rework), not inside the dock.
  const count = await page.locator('.con-handreveal-layer [data-hand-dock-card]').count();
  expect(count, 'the probe needs a non-empty hand').toBeGreaterThan(0);
}

/** Wait for the first SEIZED body (episode ownership lands a couple frames
 *  after A — `data-reveal-card` is the «flight is live» contract mark). */
async function expectProxies(page: Page): Promise<void> {
  await expect(page.locator('.con-handreveal-layer [data-reveal-card]').first()).toBeVisible({timeout: 3500});
}

/**
 * Fire RT-wheel → A («КАРТЫ») WITHOUT the per-key settle — the reveal starts
 * on the A frame and we want to observe it mid-flight.
 *
 * ACT → VERIFY → RETRY: the entry is a two-key gesture on a live surface, so
 * a press can land a frame early (the wheel not up yet) and simply do
 * nothing. Polling for the effect — the hand section OR its proxies — keeps
 * the mid-flight observation intact (the first successful attempt is seen
 * immediately) while removing the "the episode never started" flake.
 */
async function openHandFast(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.press('Period');
    await page.waitForTimeout(350); // the wheel opens
    await page.keyboard.press('Enter');
    for (let i = 0; i < 12; i++) {
      const started = await page.evaluate(() =>
        document.querySelectorAll('.con-hand, .con-handreveal-layer [data-reveal-card]').length > 0);
      if (started) {
        return;
      }
      await page.waitForTimeout(100);
    }
  }
}

test.describe('hand reveal · standard 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('open: proxies fly while both ends are held; settle releases everything', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 3);
    const dockBacks = await page.locator('.con-handbody').count();
    expect(dockBacks).toBeGreaterThan(0);

    await openHandFast(page);
    await expectProxies(page); // mid-flight — the episode is airborne
    // ONE visible representation: bodies seized, slots held.
    await expect(page.locator('.con-hand--transit')).toHaveCount(1);
    await shoot(page, '01-mid-open');

    await page.waitForTimeout(2100); // settle (open ≈ lift 140 + flight 600 + spread + handoff)
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0);
    // Cards live on the ALBUM now — bodies off the pack (shelf / packet).
    await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).not.toHaveCount(0);
    const slots = await page.locator('.con-hand__slot').count();
    expect(slots).toBeGreaterThan(0);
    await shoot(page, '02-open-settled');

    // ── close: the gather back into the dock ────────────────────────
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100); // mid-gather
    await expectProxies(page);
    await shoot(page, '03-mid-close');
    await page.waitForTimeout(1700);
    await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0);
    await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).toHaveCount(0);
    await expect(page.locator('.con-board')).toBeVisible();
    // N cards = N bodies, before and after — the single-owner invariant.
    expect(await page.locator('.con-handbody').count()).toBe(dockBacks);
    await shoot(page, '04-docked-again');
  });

  test('B mid-open reverses the SAME flight back to the dock', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 2);

    for (const holdMs of [80, 400]) { // build-window cancel and ~50% of the open
      await openHandFast(page);
      await page.waitForTimeout(holdMs);
      await page.keyboard.press('Escape'); // reverse from current progress
      await page.waitForTimeout(120);
      if (holdMs === 400) {
        // Still ONE representation while reversing (the 80ms case cancels
        // from ~0 progress — its proxies may already be handing off).
        await expectProxies(page);
        await shoot(page, '05-mid-reverse');
      }
      await page.waitForTimeout(1900);
      // Back home: board + full dock pack, nothing stuck.
      await expect(page.locator('.con-board')).toBeVisible();
      await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).toHaveCount(0);
      await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0);
      expect(await page.locator('.con-handbody').count()).toBeGreaterThan(0);
    }
    await shoot(page, '06-after-reversals');
  });

  test('reopen mid-close reverses the gather back to the open hand', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 3);

    await openHandFast(page);
    await page.waitForTimeout(2200); // fully open
    // ARM THE FLIGHT WITNESS BEFORE THE PRESS (tests.md: an order claim
    // cannot be sampled late). Under single ownership `data-reveal-card`
    // lives only from seize to release — a short reverse (Escape +130ms,
    // reversed in as long again) can be over before a late poll looks.
    await page.evaluate(() => {
      const w = window as unknown as {__sawFly?: boolean, __sawFlyMo?: MutationObserver};
      w.__sawFly = false;
      const mo = new MutationObserver(() => {
        if (document.querySelector('.con-handreveal-layer [data-reveal-card]') !== null) {
          w.__sawFly = true;
          mo.disconnect();
        }
      });
      mo.observe(document.body, {childList: true, subtree: true, attributes: true});
      w.__sawFlyMo = mo;
    });
    await page.keyboard.press('Escape'); // gather begins
    await page.waitForTimeout(130);
    // Reopen mid-close: the dock click is the entry (RT needs the wheel).
    await page.mouse.click(960, 1035);
    await page.waitForTimeout(120);
    const sawFly = await page.evaluate(() => (window as unknown as {__sawFly?: boolean}).__sawFly === true);
    expect(sawFly, 'the close gather seized bodies (the flight was live)').toBe(true);
    await shoot(page, '07-mid-reopen');
    await page.waitForTimeout(2000);
    // Landed OPEN again: hand section up, slots visible, episode released.
    await expect(page.locator('.con-hand')).toHaveCount(1);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0);
    await shoot(page, '08-reopened');
  });
});

test.describe('hand reveal · reduced motion', () => {
  test.use({
    viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080}, reducedMotion: 'reduce',
  });

  test('no proxies — instant, connected states', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 2);
    await openHandFast(page);
    await page.waitForTimeout(250);
    await expect(page.locator('.con-hand')).toHaveCount(1);
    await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).not.toHaveCount(0);
    await shoot(page, '09-reduced-open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await expect(page.locator('.con-board')).toBeVisible();
    await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).toHaveCount(0);
  });
});

test.describe('hand reveal · deck handheld', () => {
  test.use({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, screen: {width: 1280, height: 800}});

  test('handheld: the same episode plays and settles', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 3);
    await openHandFast(page);
    await expectProxies(page);
    await shoot(page, '10-handheld-mid-open');
    await page.waitForTimeout(2000);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0);
    await shoot(page, '11-handheld-open');
  });
});

test.describe('hand reveal · tv 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('tv profile: the same episode plays and settles', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 2, '&consoleProfile=tv');
    await openHandFast(page);
    await expectProxies(page);
    await shoot(page, '12-tv-mid-open');
    await page.waitForTimeout(2000);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0);
    await shoot(page, '13-tv-open');
  });
});
