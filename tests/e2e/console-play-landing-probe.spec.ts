/*
 * CONSOLE PLAY → EMBEDDED «РАЗЫГРАНО» LANDING — the workspace completion probe.
 *
 * Drives a real solo game to a card play FROM the hand workspace and proves the
 * migrated completion path at the rendered surface:
 *
 *   1. the standalone «Разыграно» overlay NEVER mounts during the flow
 *      (`.con-played:not(.con-played--embedded)` stays absent);
 *   2. the workspace does not close at confirm — the landing stage
 *      (`.con-composer__playstage--up`) presents the EMBEDDED tableau inside
 *      the same frame, and the breadcrumb tail reads «РАЗЫГРАНО»;
 *   3. the card is physically laid ON TOP of its category pile: the reserved
 *      slot exists first (`--incoming`), the ONE proxy is visible while it
 *      travels, and after the reveal the card is the pile's LAST (top) slot
 *      with the previous cards still beneath it;
 *   4. the workspace folds to the board only after the episode — and a card
 *      with a follow-up (tile placement) hands over AFTER the docking.
 *
 * Scenarios: green (Acquired Company), blue (Rover Construction), red event
 * (Investment Loan), tile-follow-up event (Nuclear Zone) at FHD; the green
 * card again at 4K TV and under reduced motion.
 */
import {expect, test, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'play-landing');

const GREEN = 'Acquired Company';
const BLUE = 'Rover Construction';
const EVENT = 'Investment Loan';
const TILE_EVENT = 'Nuclear Zone';

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'LandingProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true, // 500 of everything → every probe card affordable
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
    // CrediCor: no first action, no on-pick choices — the post-start board is
    // idle and the hand play is immediately reachable.
    customCorporationsList: ['CrediCor'],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    // Guaranteed first-hand project cards (dealt off the top of the deck).
    customProjectCards: [GREEN, BLUE, EVENT, TILE_EVENT],
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

async function key(page: Page, code: string, settleMs = 500): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** Create a game and land on the console board home, wizard walked. */
async function bootGame(page: Page, request: APIRequestContext): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(3500); // deal cinematic settle

  // ── the start wizard: STATE-DRIVEN by the active step chip (a blind key
  //    walk drifts — the 4K deal cinematic swallowed its first press). ──
  const frame = page.locator('.con-start__frame');
  const targets = [GREEN, BLUE, EVENT, TILE_EVENT];
  let lastFocused = '';
  let stalls = 0;
  const queue: Array<string> = [];
  /** Walk one nav step toward an unvisited slot: right, then down at a right
   *  edge, and a serpentine escape back home from a dead corner. */
  const step = async (focused: string) => {
    if (focused === '') {
      await page.waitForTimeout(400); // the deal cinematic is still dealing
      return;
    }
    if (focused === lastFocused) {
      stalls++;
    } else {
      stalls = 0;
    }
    if (stalls === 1) {
      await key(page, 'ArrowDown', 260);
    } else if (stalls >= 2) {
      queue.push(...Array(10).fill('ArrowLeft'), ...Array(4).fill('ArrowUp'));
      stalls = 0;
    } else {
      await key(page, 'ArrowRight', 260);
    }
    lastFocused = focused;
  };
  for (let i = 0; i < 220 && await frame.count() > 0; i++) {
    if (queue.length > 0) {
      await key(page, queue.shift() as string, 200);
      continue;
    }
    const s = await page.evaluate(() => ({
      active: (document.querySelector('.con-jrail__item--current')?.textContent ?? '').toUpperCase(),
      focused: document.querySelector('.con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '',
      picked: Array.from(document.querySelectorAll('.con-cards__slot--picked')).map((el) => el.getAttribute('data-zoom-slot') ?? ''),
      ceremony: document.querySelector('.con-start--ceremony') !== null,
    }));
    // The wizard flows STRAIGHT into the deployment inside the same frame
    // now (no unmount gap — the whole point): hand over to the ceremony loop.
    if (s.ceremony) {
      break;
    }
    if (s.active.includes('КОРПОРАЦ')) {
      // CrediCor specifically: no first action, no on-pick choices — the
      // post-start board is idle. Walk to it, pick, RT advances.
      if (s.picked.includes('CrediCor')) {
        await shoot(page, 'gsw-1-corp-picked');
        await key(page, 'Period', 1800);
        lastFocused = '';
      } else if (s.focused === 'CrediCor') {
        await key(page, 'Enter', 700);
      } else {
        await step(s.focused);
      }
      continue;
    }
    if (s.active.includes('ПРОЕКТ')) {
      const missing = targets.filter((t) => !s.picked.includes(t));
      if (missing.length === 0) {
        await key(page, 'Period', 1600);
        lastFocused = '';
      } else if (missing.includes(s.focused)) {
        await key(page, 'Enter', 420);
        lastFocused = ''; // a pick re-reads fresh — never counts as a stall
      } else {
        await step(s.focused);
      }
      continue;
    }
    // The summary (or a transition beat): A launches the game.
    if (s.active.includes('СВОДКА') || s.active.includes('SUMMARY')) {
      await shoot(page, 'gsw-2-summary');
    }
    await key(page, 'Enter', 1300);
  }

  // ── the start CEREMONY: the scene RE-MOUNTS after a gap (longer at 4K —
  //    corp hero + deal render slower). Press A whenever the scene is up; a
  //    mandatory ANNOUNCE / deferred chip opens with B; call it done only
  //    after everything has stayed away for a while. ──
  let quietPolls = 0;
  let shotCeremony = false;
  for (let i = 0; i < 90 && quietPolls < 12; i++) {
    if (await page.locator('.con-start').count() > 0) {
      quietPolls = 0;
      if (!shotCeremony && await page.locator('.con-start__tableau').count() > 0) {
        shotCeremony = true;
        await shoot(page, 'gsw-3-deployment');
      }
      await key(page, 'Enter', 1100);
    } else if (await page.locator('.con-mandatory').count() > 0) {
      quietPolls = 0;
      await key(page, 'Escape', 900); // B opens the announced / restores the deferred prompt
    } else {
      quietPolls++;
      await page.waitForTimeout(800);
    }
  }
  await expect(page.locator('.con-start')).toHaveCount(0, {timeout: 30_000});
  await page.waitForTimeout(4000); // corp hero + hand intake settle
}

/** Walk the hand cursor onto `card` and open the workspace descent. */
async function descendIntoPlay(page: Page, card: string): Promise<void> {
  // Enter the hand workspace via the RT action-category quick selector
  // (A = Cards is its centre slot). Never a blind B first — B on a pending
  // start prompt DEFERS it and every hand card goes «завершите действие».
  for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
    await key(page, 'Period', 800);
    await key(page, 'Enter', 1100);
  }
  await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 10_000});
  await page.waitForTimeout(800);

  // Cursor onto the target card (right-major adaptive walk with a down fallback).
  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`).count();
  let lastSelected = '';
  for (let i = 0; i < 40 && await onTarget() === 0; i++) {
    const selected = await page.locator('.con-hand__slot--selected').getAttribute('data-zoom-slot') ?? '';
    await key(page, selected === lastSelected && i > 0 ? 'ArrowDown' : 'ArrowRight', 260);
    lastSelected = selected;
  }
  expect(await onTarget(), `hand cursor never reached ${card}`).toBeGreaterThan(0);

  // A → the workspace DESCENDS into the play level (embedded composer).
  await key(page, 'Enter', 600);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 10_000});
  // Let the descent phrase + preview settle, and the CTA arm.
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 10_000});
  await page.waitForTimeout(1400);
}

type SceneLog = {
  standaloneFrames: number,
  /** Frames where the FULL overview overlay leaked into the stage layer. */
  fullOverlayFrames: number,
  sawStage: boolean,
  /** The reserved front anchor existed BEFORE the dock (empty room). */
  sawReserved: boolean,
  sawProxy: boolean,
  sawStepPlayed: boolean,
  /** The front anchor carries the played card (it IS the top card). */
  sawDocked: boolean,
  /** The setup's card column released (no empty source column remains). */
  sawCardColHidden: boolean,
  /** Compact helper minis were on the periphery. */
  maxMinis: number,
  /** Highest destination caption count seen while the stage presented. */
  maxEvents: number,
  handSurvivedUntilStage: boolean,
  /** Compact per-poll trace — printed on assertion failures. */
  trace: Array<string>,
};

/** Confirm the play and observe the whole landing episode frame-by-frame. */
async function runLandingScene(page: Page, card: string, isEvent: boolean, shotPrefix: string, shots = true): Promise<SceneLog> {
  const log: SceneLog = {
    standaloneFrames: 0, fullOverlayFrames: 0, sawStage: false, sawReserved: false, sawProxy: false,
    sawStepPlayed: false, sawDocked: false, sawCardColHidden: false, maxMinis: 0, maxEvents: 0,
    handSurvivedUntilStage: false, trace: [],
  };
  await key(page, 'Enter', 60); // A · Разыграть карту
  const deadline = Date.now() + 16_000;
  let shotFlight = false;
  let shotDock = false;
  while (Date.now() < deadline) {
    const snap = await page.evaluate((args) => {
      const {card} = args as {card: string, isEvent: boolean};
      const standalone = document.querySelector('.con-played:not(.con-played--embedded)') !== null;
      const stageUp = document.querySelector('.con-composer__playstage--up') !== null;
      const recv = document.querySelector('.con-composer__playstage .con-recv');
      const fullOverlay = document.querySelector('.con-composer__playstage .con-played') !== null;
      const proxy = document.querySelector('.con-played-hero__proxy') !== null;
      const hand = document.querySelector('.con-hand') !== null;
      const step = (document.querySelector('.con-wshead__step')?.textContent ?? '').trim().toUpperCase();
      const composer = document.querySelector('.con-composer--play') !== null;
      const playCard = document.querySelector('.con-composer__playcard');
      const cardColHidden = playCard !== null && getComputedStyle(playCard).visibility === 'hidden';
      let reserved = false;
      let docked = false;
      let minis = 0;
      let destCount = -1;
      if (recv !== null) {
        const front = recv.querySelector('[data-recv-front]');
        const key = front?.getAttribute('data-played-key') ?? '';
        reserved = front !== null && key === '';
        docked = key === card;
        minis = recv.querySelectorAll('.con-recv__mini').length;
        const count = recv.querySelector('.con-recv__caption-count')?.textContent ?? '';
        destCount = count === '' ? -1 : Number(count);
      }
      return {standalone, stageUp, fullOverlay, proxy, hand, step, composer, cardColHidden, reserved, docked, minis, destCount};
    }, {card, isEvent});
    log.trace.push(
      `t${Date.now() % 100000} comp:${snap.composer ? 1 : 0} stage:${snap.stageUp ? 1 : 0} res:${snap.reserved ? 1 : 0} ` +
      `dock:${snap.docked ? 1 : 0} prx:${snap.proxy ? 1 : 0} minis:${snap.minis} n:${snap.destCount} col:${snap.cardColHidden ? 1 : 0} step:${snap.step}`);

    if (snap.standalone) {
      log.standaloneFrames++;
    }
    if (snap.fullOverlay) {
      log.fullOverlayFrames++;
    }
    if (snap.stageUp) {
      log.sawStage = true;
      log.maxMinis = Math.max(log.maxMinis, snap.minis);
      if (snap.hand) {
        log.handSurvivedUntilStage = true;
      }
      if (snap.cardColHidden) {
        log.sawCardColHidden = true;
      }
      if (snap.destCount > log.maxEvents) {
        log.maxEvents = snap.destCount;
      }
    }
    if (snap.reserved) {
      log.sawReserved = true;
    }
    if (snap.proxy) {
      log.sawProxy = true;
      if (shots && !shotFlight && snap.stageUp) {
        shotFlight = true;
        await shoot(page, `${shotPrefix}-1-flight`);
      }
    }
    if (snap.step === 'РАЗЫГРАНО') {
      log.sawStepPlayed = true;
    }
    if (snap.docked) {
      if (shots && !shotDock) {
        shotDock = true;
        await shoot(page, `${shotPrefix}-2-docked`);
      }
      log.sawDocked = true;
    }
    if (!snap.composer && !snap.stageUp && log.sawStage) {
      break; // the workspace folded — the episode is over
    }
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(900);
  await shoot(page, `${shotPrefix}-3-after`);
  return log;
}

function assertScene(log: SceneLog, opts: {isEvent: boolean, minEvents?: number}): void {
  // Surface the frame-by-frame trace on any failure (attached to the error).
  console.log(`[landing trace]\n${log.trace.join('\n')}`);
  expect(log.standaloneFrames, 'the standalone «Разыграно» overlay must NEVER mount').toBe(0);
  expect(log.fullOverlayFrames, 'the FULL overview must never leak into the receiving stage').toBe(0);
  expect(log.sawStage, 'the receiving stage presented').toBeTruthy();
  expect(log.handSurvivedUntilStage, 'the workspace stayed open into the stage').toBeTruthy();
  expect(log.sawProxy, 'ONE physical proxy was visible during the transfer').toBeTruthy();
  expect(log.sawStepPlayed, 'the breadcrumb tail read «РАЗЫГРАНО»').toBeTruthy();
  expect(log.sawCardColHidden, 'the setup card column released — no empty source column').toBeTruthy();
  if (opts.isEvent) {
    expect(log.maxEvents, 'the destination count ticked at the dock').toBeGreaterThanOrEqual(opts.minEvents ?? 1);
  } else {
    expect(log.sawReserved, 'the reserved front anchor existed before the dock').toBeTruthy();
    expect(log.sawDocked, 'the card took the front — the TOP of its stack').toBeTruthy();
  }
}

test.describe('console play → embedded «Разыграно» landing', () => {
  test.describe.configure({mode: 'serial'});

  test('green (Automated) card lands on its pile inside the workspace', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootGame(page, request);
    await descendIntoPlay(page, GREEN);
    const log = await runLandingScene(page, GREEN, false, 'fhd-green');
    assertScene(log, {isEvent: false});
    // The workspace folded to the board; no overlay anywhere.
    await expect(page.locator('.con-played')).toHaveCount(0);
    await expect(page.locator('.con-hand')).toHaveCount(0);

    // ── same game: the BLUE card next (the tableau now has a stack) ──
    await descendIntoPlay(page, BLUE);
    const blueLog = await runLandingScene(page, BLUE, false, 'fhd-blue');
    assertScene(blueLog, {isEvent: false});
    await expect(page.locator('.con-played')).toHaveCount(0);

    // ── same game: the EVENT (face-down pile; counter ticks at dock) ──
    await descendIntoPlay(page, EVENT);
    const eventLog = await runLandingScene(page, EVENT, true, 'fhd-event');
    assertScene(eventLog, {isEvent: true, minEvents: 1});
    await expect(page.locator('.con-played')).toHaveCount(0);

    // ── same game: the TILE follow-up event — the workspace hands over
    //    to board placement only AFTER the docking episode ──
    // Shots off: a follow-up play shortens the result beat to ~220 ms —
    // screenshots inside the poll loop would swallow the whole observation
    // window, and even bare polls can miss the post-dock counter frame. The
    // dock-tick proof lives on the FIRST event above (0 → 1 strictly at the
    // reveal); here the scene structure + the handover order are the point.
    await descendIntoPlay(page, TILE_EVENT);
    const tileLog = await runLandingScene(page, TILE_EVENT, true, 'fhd-tile', false);
    assertScene(tileLog, {isEvent: true, minEvents: 1});
    await expect(page.locator('.con-hand')).toHaveCount(0);
    // The placement prompt owns the board now (the follow-up survived).
    await expect(page.locator('.con-root')).toContainText(/Выберите|расположение|клетку|поле/i, {timeout: 15_000});
    await shoot(page, 'fhd-tile-4-placement');
  });

  test('4K TV: the landing stage keeps the same grammar', async ({page, request}) => {
    test.setTimeout(420_000);
    await page.setViewportSize({width: 3840, height: 2160});
    await bootGame(page, request);
    await descendIntoPlay(page, GREEN);
    const log = await runLandingScene(page, GREEN, false, 'tv4k-green');
    assertScene(log, {isEvent: false});
    await expect(page.locator('.con-played')).toHaveCount(0);
  });

  test('reduced motion keeps the physical continuity (no overlay, same dock)', async ({page, request}) => {
    test.setTimeout(240_000);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await bootGame(page, request);
    await descendIntoPlay(page, GREEN);
    const log = await runLandingScene(page, GREEN, false, 'reduced-green');
    // Reduced motion: the hop is short and may complete between polls — the
    // proxy sighting is not required; the structural contract still is.
    expect(log.standaloneFrames, 'no standalone overlay under reduced motion').toBe(0);
    expect(log.sawStage, 'the receiving stage presented').toBeTruthy();
    expect(log.sawDocked || log.sawReserved, 'the card reached its stack').toBeTruthy();
    await expect(page.locator('.con-played')).toHaveCount(0);
  });
});
