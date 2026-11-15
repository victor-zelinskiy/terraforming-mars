import {test, expect, APIRequestContext, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, cinematicBeat, openQuickWheel, settle, waitForBoardHome} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, Witness} from './witness';

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
  await expect(page.locator('.con-handreveal-layer [data-hand-dock-card]'), 'the probe needs a non-empty hand').not.toHaveCount(0);
}

/** One observation of the episode: the SEIZED bodies (`data-reveal-card` — the «flight is live» contract mark), whether
 *  the first of them is visible (Playwright's `toBeVisible`: a box, not `visibility: hidden`), the hand in transit. */
type RevealSeen = {seized: number, flying: boolean, transit: number};
/** The episode's witness key — one recording at a time (re-arming starts a fresh record). */
const REVEAL = 'hand-reveal-episode';

/**
 * RECORD the episode from before the press (`armWitness`, FLAKE ZERO): episode ownership lands a couple of frames after
 * the key and a short flight can be over before a late poll looks — the record sees every frame of it. `settled`: «the
 * bodies fly WHILE the hand holds its slots» is a claim about what a frame paints.
 */
async function armReveal(page: Page): Promise<Witness<RevealSeen>> {
  return armWitness<RevealSeen>(page, REVEAL, () => {
    const seized = document.querySelectorAll<HTMLElement>('.con-handreveal-layer [data-reveal-card]');
    let flying = false;
    if (seized.length > 0) {
      const r = seized[0].getBoundingClientRect();
      flying = r.width > 0 && r.height > 0 && getComputedStyle(seized[0]).visibility !== 'hidden';
    }
    return {seized: seized.length, flying, transit: document.querySelectorAll('.con-hand--transit').length};
  }, {settled: true});
}

/** The first SEIZED body was seen in flight (recorded — however short the flight on this machine). */
async function expectProxies(reveal: Witness<RevealSeen>, message: string): Promise<void> {
  await reveal.waitFor((v) => v.flying, {timeoutMs: 3500, message});
}

/**
 * Fire RT-wheel → A («КАРТЫ») WITHOUT the per-key settle on the A — the reveal
 * starts on the A frame and we want to observe it mid-flight.
 *
 * ACT → VERIFY → RETRY: the entry is a two-key gesture on a live surface. The
 * wheel is opened by the shared driver (verified: it stands), then A goes raw;
 * a swallowed A is pressed again only after a whole window without its effect
 * — the hand section OR its proxies. The first successful attempt is seen
 * immediately, so the mid-flight observation stays intact.
 */
async function openHandFast(page: Page): Promise<void> {
  const started = () => page.evaluate(() =>
    document.querySelectorAll('.con-hand, .con-handreveal-layer [data-reveal-card]').length > 0);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await page.locator('.con-quick').count() === 0) {
      await openQuickWheel(page);
    }
    await page.keyboard.press('Enter');
    if (await expect.poll(started, {timeout: 1500, intervals: [100]}).toBe(true).then(() => true, () => false)) {
      return;
    }
  }
}

test.describe('hand reveal · standard 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('open: proxies fly while both ends are held; settle releases everything', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 3);
    // The pack's population at rest — the reference the single-owner invariant compares against.
    const dockBacks = await readSettled(page, () => page.locator('.con-handbody').count(), {message: 'the docked bodies'});
    expect(dockBacks).toBeGreaterThan(0);

    const open = await armReveal(page);
    await openHandFast(page);
    await expectProxies(open, 'the open never flew a seized body'); // mid-flight — the episode is airborne
    // ONE visible representation: bodies seized, slots held — in one painted frame.
    expect(await open.ever((v) => v.flying && v.transit === 1),
      'the seized bodies flew while the hand held its slots (transit)').toBe(true);
    await shoot(page, '01-mid-open');

    await settle(page); // the open's end (lift 140 + flight 600 + spread + handoff)
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0);
    // Cards live on the ALBUM now — bodies off the pack (shelf / packet).
    await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).not.toHaveCount(0);
    await expect(page.locator('.con-hand__slot')).not.toHaveCount(0);
    await shoot(page, '02-open-settled');

    // ── close: the gather back into the dock ────────────────────────
    const close = await armReveal(page);
    await page.keyboard.press('Escape');
    await expectProxies(close, 'the close never gathered a seized body'); // mid-gather
    await shoot(page, '03-mid-close');
    // The gather's end is the episode RELEASING its bodies (the close names no hold `settle` could wait on) — the old
    // 1.7 s pause and its poll, as one wait on that state.
    await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0, {timeout: 6_700});
    await settle(page);
    await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).toHaveCount(0);
    await expect(page.locator('.con-board')).toBeVisible();
    // N cards = N bodies, before and after — the single-owner invariant.
    await expect.poll(() => page.locator('.con-handbody').count()).toBe(dockBacks);
    await shoot(page, '04-docked-again');
  });

  test('B mid-open reverses the SAME flight back to the dock', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 2);

    for (const holdMs of [80, 400]) { // build-window cancel and ~50% of the open
      await openHandFast(page);
      await cinematicBeat(page, holdMs, 'B lands this far into the open — the cancel point is the subject');
      await page.keyboard.press('Escape'); // reverse from current progress
      // Recorded from the B on — armed AFTER it: the open's own bodies were already flying before the B.
      const reverse = await armReveal(page);
      if (holdMs === 400) {
        // Still ONE representation while reversing (the 80ms case cancels
        // from ~0 progress — its proxies may already be handing off).
        await expectProxies(reverse, 'the reversal flew no seized body back');
        await shoot(page, '05-mid-reverse');
      }
      // The reversal's end is the episode RELEASING its bodies (a close names no hold `settle` could wait on) — the
      // old 1.9 s pause and its poll, as one wait on that state.
      await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0, {timeout: 7_000});
      await settle(page);
      // Back home: board + full dock pack, nothing stuck.
      await expect(page.locator('.con-board')).toBeVisible();
      await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).toHaveCount(0);
      await expect.poll(() => page.locator('.con-handbody').count()).toBeGreaterThan(0);
    }
    await shoot(page, '06-after-reversals');
  });

  test('reopen mid-close reverses the gather back to the open hand', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 3);

    await openHandFast(page);
    await settle(page); // fully open
    // ARM THE FLIGHT WITNESS BEFORE THE PRESS (tests.md: an order claim
    // cannot be sampled late). Under single ownership `data-reveal-card`
    // lives only from seize to release — a short reverse (Escape +130ms,
    // reversed in as long again) can be over before a late poll looks.
    const gather = await armReveal(page);
    await page.keyboard.press('Escape'); // gather begins
    await cinematicBeat(page, 130, 'the reopen lands this far into the close — mid-gather is the subject');
    // Reopen mid-close: the dock click is the entry (RT needs the wheel).
    await page.mouse.click(960, 1035);
    await expect.poll(() => gather.ever((v) => v.seized > 0),
      {message: 'the close gather seized bodies (the flight was live)'}).toBe(true);
    await shoot(page, '07-mid-reopen');
    await settle(page);
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
    // «No proxies» is a claim about the WHOLE episode — recorded from before the press, never one look after it.
    const open = await armReveal(page);
    await openHandFast(page);
    await settle(page);
    await expect(page.locator('.con-hand')).toHaveCount(1);
    expect(await open.ever((v) => v.seized > 0), 'reduced motion seized a body for a flight').toBe(false);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).not.toHaveCount(0);
    await shoot(page, '09-reduced-open');
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(page.locator('.con-board')).toBeVisible();
    await expect(page.locator('.con-handbody:not([data-hand-body-mode="docked"])')).toHaveCount(0);
  });
});

test.describe('hand reveal · deck handheld', () => {
  test.use({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, screen: {width: 1280, height: 800}});

  test('handheld: the same episode plays and settles', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootGame(page, request, 3);
    const open = await armReveal(page);
    await openHandFast(page);
    await expectProxies(open, 'the handheld open never flew a seized body');
    await shoot(page, '10-handheld-mid-open');
    await settle(page);
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
    const open = await armReveal(page);
    await openHandFast(page);
    await expectProxies(open, 'the tv open never flew a seized body');
    await shoot(page, '12-tv-mid-open');
    await settle(page);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0);
    await shoot(page, '13-tv-open');
  });
});
