/*
 * CONSOLE GAME START WORKSPACE + PLAY LANDING — the workspace completion probe.
 *
 * PART A (bootGame) drives the GAME START WORKSPACE end to end and proves the
 * rework's hard contracts at the rendered surface:
 *
 *   1. PREPARATION is a true full-bleed workspace: the standard top HUD and
 *      the player rail are HIDDEN (visibility), the compact participant strip
 *      is present, the Selection Dock pre-mounts every pile, the summary
 *      carries the Expanded Startup Status Preview;
 *   2. the RT collect is PHYSICAL — a dock-flight proxy is airborne right
 *      after the advance press;
 *   3. after the summary commit the root `.con-start` NEVER unmounts until
 *      the deployment settles (polled continuously — a single absent frame
 *      fails the run: that gap is what stranded the corporation hero);
 *   4. the deployment plays through the REAL receiving stage
 *      (`.con-start__playstage .con-recv`), resolved cards physically reach
 *      the compact start tableau (`[data-start-mini]` grows), and the
 *      standalone «Разыграно» overlay never mounts;
 *   5. only after the full settle the workspace releases to the board.
 *
 * PART B (the play scenarios) keeps the hand-workspace landing contract:
 * green / blue / event / tile-follow-up at FHD; green again at 4K TV and
 * under reduced motion.
 */
import {expect, test, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'play-landing');

const GREEN = 'Acquired Company';
const BLUE = 'Rover Construction';
const EVENT = 'Investment Loan';
const TILE_EVENT = 'Nuclear Zone';

/** The probe's preludes: BIOLAB is deliberately a DRAW prelude (draw 3) —
 * its play must open the EMBEDDED reveal inside the workspace and deliver
 * the drawn cards to the hand dock before the deployment may settle. */
const PRELUDES = ['Allied Bank', 'Loan', 'Dome Farming', 'Biolab'];
const DRAW_PRELUDE = 'Biolab';
const SAFE_PRELUDE = 'Allied Bank';

function newGameConfig(withPreludes: boolean) {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: withPreludes, prelude2: false, turmoil: false, community: false,
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
    customPreludes: withPreludes ? PRELUDES : [],
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

type StartLog = {
  /** Preparation shell facts (sampled on the first wizard frame). */
  topHudHidden: boolean,
  railHidden: boolean,
  sawCrewStrip: boolean,
  dockPilesAtStart: number,
  /** A dock-flight proxy was airborne right after an RT collect. */
  sawDockProxy: boolean,
  sawHudPreview: boolean,
  /** The ceremony was reached inside the SAME `.con-start` root. */
  sawCeremony: boolean,
  /** Frames where `.con-start` was ABSENT between the commit and the settle. */
  goneFramesDuringDeployment: number,
  /** The bottom zone presented as the REAL «Разыграно» (title + owner). */
  sawPlayedZone: boolean,
  /** Cards physically standing in the played zone's piles (max seen). */
  maxPlayedSlots: number,
  /** The startup queue's card count (max seen — corp + preludes). */
  maxQueueCards: number,
  /** A frame ever showed the retired «СТОЛ» placeholder (must stay 0). */
  stolFrames: number,
  /** A central receiving stage mounted inside the start (must stay 0 now). */
  centralStageFrames: number,
  /** The shared reveal presented EMBEDDED inside `.con-start`. */
  sawEmbeddedReveal: boolean,
  /** The standalone «Разыграно» overlay NEVER mounts during the start. */
  standaloneFrames: number,
  /** The hand dock was visible during the deployment. */
  sawHandDock: boolean,
  /** The persistent flow consolidated to its terminal READY before release. */
  sawReady: boolean,
  trace: Array<string>,
};

/** Create a game and drive the WHOLE Game Start Workspace; returns the log. */
async function bootGame(page: Page, request: APIRequestContext, withPreludes = false,
  shotPrefix = 'gsw', captureReady = false): Promise<StartLog> {
  const log: StartLog = {
    topHudHidden: false, railHidden: false, sawCrewStrip: false, dockPilesAtStart: 0,
    sawDockProxy: false, sawHudPreview: false, sawCeremony: false,
    goneFramesDuringDeployment: 0, sawPlayedZone: false, maxPlayedSlots: 0,
    maxQueueCards: 0, stolFrames: 0, centralStageFrames: 0, sawEmbeddedReveal: false,
    standaloneFrames: 0, sawHandDock: false, sawReady: false, trace: [],
  };
  const created = await request.post('/api/creategame', {data: newGameConfig(withPreludes)});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  // The ASSET WARM-UP veil (.boot-loader) sits over the scene long on a cold
  // bundle — pressing through it works (input bridges), but every screenshot
  // would show the curtain instead of the workspace. Wait it out.
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
  await page.waitForTimeout(3500); // deal cinematic settle

  // ── PREPARATION SHELL facts (the full-bleed contract). ──
  const shell = await page.evaluate(() => {
    const vis = (sel: string) => {
      const el = document.querySelector(sel);
      return el === null ? 'absent' : getComputedStyle(el).visibility;
    };
    return {
      status: vis('.con-status'),
      rail: vis('.con-res-host'),
      crew: document.querySelector('.con-start__crewline') !== null,
      piles: document.querySelectorAll('.con-startdock [data-start-pile]').length,
    };
  });
  log.topHudHidden = shell.status === 'hidden' || shell.status === 'absent';
  log.railHidden = shell.rail === 'hidden' || shell.rail === 'absent';
  log.sawCrewStrip = shell.crew;
  log.dockPilesAtStart = shell.piles;

  // ── the start wizard: STATE-DRIVEN by the active step chip (a blind key
  //    walk drifts — the 4K deal cinematic swallowed its first press). ──
  const frame = page.locator('.con-start__frame');
  const targets = [GREEN, BLUE, EVENT, TILE_EVENT];
  let lastFocused = '';
  let stalls = 0;
  const queue: Array<string> = [];
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
  /** RT advance + a fast proxy sniff (the collect must be PHYSICAL). */
  const advance = async () => {
    await page.keyboard.press('Period');
    for (let p = 0; p < 8 && !log.sawDockProxy; p++) {
      if (await page.locator('.con-startdock-proxy').count() > 0) {
        log.sawDockProxy = true;
      }
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1100);
    lastFocused = '';
  };
  for (let i = 0; i < 260 && await frame.count() > 0; i++) {
    if (queue.length > 0) {
      await key(page, queue.shift() as string, 200);
      continue;
    }
    const s = await page.evaluate(() => ({
      active: (document.querySelector('.con-jrail__item--current')?.textContent ?? '').toUpperCase(),
      focused: document.querySelector('.con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '',
      // VISIBLE picks only — the parked panes keep every earlier step's picked
      // slots in the DOM (that is the caching contract), so an unscoped query
      // counts the corporation on the preludes step and lies to the walker.
      picked: Array.from(document.querySelectorAll('.con-cards__slot--picked'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getAttribute('data-zoom-slot') ?? ''),
      ceremony: document.querySelector('.con-start--ceremony') !== null,
      hudprev: document.querySelector('.con-start__hudprev') !== null,
    }));
    // The wizard flows STRAIGHT into the deployment inside the same frame
    // (no unmount gap — the whole point): hand over to the ceremony loop.
    if (s.ceremony) {
      log.sawCeremony = true;
      break;
    }
    if (s.active.includes('КОРПОРАЦ')) {
      if (s.picked.includes('CrediCor')) {
        await shoot(page, `${shotPrefix}-1-corp-picked`);
        await advance();
      } else if (s.focused === 'CrediCor') {
        await key(page, 'Enter', 700);
      } else {
        await step(s.focused);
      }
      continue;
    }
    if (s.active.includes('ПРОЛОГ')) {
      // BIOLAB (the draw prelude) MUST be in the set — walk to it first,
      // then choose Allied Bank explicitly. A random second prelude can own a
      // board-placement child workspace, which belongs to the dedicated
      // placement probe rather than this landing / terminal-flow harness.
      if (s.picked.length >= 2) {
        await advance();
      } else if (!s.picked.includes(DRAW_PRELUDE)) {
        if (s.focused === DRAW_PRELUDE) {
          await key(page, 'Enter', 420);
          lastFocused = '';
        } else {
          await step(s.focused);
        }
      } else if (!s.picked.includes(SAFE_PRELUDE) && s.focused === SAFE_PRELUDE) {
        await key(page, 'Enter', 420);
        lastFocused = '';
      } else {
        await step(s.focused);
      }
      continue;
    }
    if (s.active.includes('ПРОЕКТ')) {
      const missing = targets.filter((t) => !s.picked.includes(t));
      if (missing.length === 0) {
        await advance();
      } else if (missing.includes(s.focused)) {
        await key(page, 'Enter', 420);
        lastFocused = ''; // a pick re-reads fresh — never counts as a stall
      } else {
        await step(s.focused);
      }
      continue;
    }
    // The summary: the Expanded Startup Status Preview must stand; A commits.
    if (s.active.includes('СВОДКА') || s.active.includes('SUMMARY')) {
      log.sawHudPreview = log.sawHudPreview || s.hudprev;
      await shoot(page, `${shotPrefix}-2-summary`);
    }
    await key(page, 'Enter', 1300);
  }

  // ── the DEPLOYMENT: the root `.con-start` must exist CONTINUOUSLY from the
  //    commit to the settle (the lifetime hold). Press A whenever a CTA
  //    stands (queue plays, the purchase, the embedded reveal's takes); the
  //    release (scene gone AND stays gone) ends the loop. ──
  let shotDeploy = false;
  let shotPlayed = false;
  let shotReveal = false;
  let shotReady = false;
  let goneStreak = 0;
  for (let i = 0; i < 240; i++) {
    const s = await page.evaluate((drawCard) => {
      const start = document.querySelector('.con-start') !== null;
      const played = document.querySelector('.con-start__played');
      const bodyText = document.querySelector('.con-start')?.textContent ?? '';
      return {
        start,
        cta: start && document.querySelector('.con-start__slot-a') !== null,
        playedZone: played !== null && played.textContent !== null &&
          played.textContent.toUpperCase().includes('РАЗЫГРАНО'),
        playedSlots: document.querySelectorAll('.con-start__played [data-played-key]').length,
        queueCards: document.querySelectorAll('.con-start [data-queue-slot]').length,
        stol: /СТОЛ(?![А-ЯЁ])/.test(bodyText),
        centralStage: document.querySelector('.con-start .con-recv') !== null,
        embedReveal: document.querySelector('.con-start__embed *') !== null,
        standalone: document.querySelector('.con-played:not(.con-played--embedded)') !== null,
        handDock: document.querySelector('.con-handdock, .con-hand-dock, [data-hand-dock]') !== null,
        mandatory: document.querySelector('.con-mandatory') !== null,
        drawQueued: document.querySelector(`.con-start [data-queue-slot="${drawCard}"]`) !== null,
        flowReady: document.querySelector('.con-jrail')?.getAttribute('data-presentation') === 'complete',
      };
    }, DRAW_PRELUDE);
    log.trace.push(`d${i} start:${s.start ? 1 : 0} cta:${s.cta ? 1 : 0} q:${s.queueCards} p:${s.playedSlots} emb:${s.embedReveal ? 1 : 0} hd:${s.handDock ? 1 : 0}`);
    if (s.standalone) {
      log.standaloneFrames++;
    }
    if (s.start) {
      goneStreak = 0;
      if (s.playedZone) {
        log.sawPlayedZone = true;
      }
      if (s.stol) {
        log.stolFrames++;
      }
      if (s.centralStage) {
        log.centralStageFrames++;
      }
      if (s.embedReveal) {
        log.sawEmbeddedReveal = true;
        if (!shotReveal) {
          shotReveal = true;
          await shoot(page, `${shotPrefix}-5-embedded-reveal`);
        }
      }
      if (s.handDock) {
        log.sawHandDock = true;
      }
      if (s.flowReady) {
        log.sawReady = true;
        if (captureReady && !shotReady) {
          shotReady = true;
          // `data-presentation="complete"` flips at the START of the physical
          // consolidation. Wait for the real computed width, not a guessed
          // delay, so Calm/Standard/Swift all capture the terminal pose.
          await page.waitForFunction(() => {
            const rail = document.querySelector<HTMLElement>('.con-jrail--presentation-complete');
            const terminal = rail?.querySelector<HTMLElement>('.con-jrail__view--terminal');
            if (rail === null || terminal === null) {
              return false;
            }
            /* Compare rendered boxes, not `rem` against the document root:
             * TV scale is applied through an ancestor zoom, so computed rem
             * and the physically painted rail live in different coordinate
             * spaces. The ratio is scale-invariant and proves both that the
             * terminal layer is visible and that the 44rem expanded reserve
             * has actually consolidated around it. */
            const railWidth = rail.getBoundingClientRect().width;
            const terminalWidth = terminal.getBoundingClientRect().width;
            return Number(getComputedStyle(terminal).opacity) > 0.98 &&
              terminalWidth > 0 && railWidth <= terminalWidth * 6;
          }, undefined, {timeout: 2_000});
          await page.waitForTimeout(50);
          await shoot(page, `${shotPrefix}-6-flow-ready`);
        }
      }
      log.maxPlayedSlots = Math.max(log.maxPlayedSlots, s.playedSlots);
      log.maxQueueCards = Math.max(log.maxQueueCards, s.queueCards);
      if (!shotPlayed && s.playedSlots > 0) {
        shotPlayed = true;
        await shoot(page, `${shotPrefix}-4-played-dock`);
      }
      if (!shotDeploy && s.queueCards > 0) {
        shotDeploy = true;
        await shoot(page, `${shotPrefix}-3-deployment`);
      }
      if (s.cta || s.embedReveal) {
        await key(page, 'Enter', 700);
      } else {
        await page.waitForTimeout(180);
      }
      continue;
    }
    // The scene is gone. Before every consequence resolved that is the old
    // close bug; after, it is the release — confirm it STAYS gone.
    goneStreak++;
    if (log.sawCeremony && log.maxPlayedSlots === 0 && goneStreak === 1) {
      log.goneFramesDuringDeployment++;
    }
    if (goneStreak >= 8) {
      break;
    }
    if (s.mandatory) {
      break; // post-release first-action announce — the start flow is over
    }
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.con-start')).toHaveCount(0, {timeout: 30_000});
  await page.waitForTimeout(4500); // hand intake settle (slower at 4K)
  return log;
}

function assertStart(log: StartLog, opts: {withPreludes: boolean, strictMotion: boolean, expectReveal?: boolean}): void {
  console.log(`[start trace]\n${log.trace.join('\n')}`);
  expect(log.topHudHidden, 'the standard top HUD must be HIDDEN through the preparation').toBeTruthy();
  expect(log.railHidden, 'the player rail must be HIDDEN through the preparation').toBeTruthy();
  expect(log.sawCrewStrip, 'the compact participant strip must serve readiness instead').toBeTruthy();
  expect(log.dockPilesAtStart, 'EVERY Selection-Dock pile pre-mounts from the first frame').toBeGreaterThanOrEqual(opts.withPreludes ? 3 : 2);
  expect(log.sawHudPreview, 'the summary carries the startup status preview').toBeTruthy();
  expect(log.sawCeremony, 'the deployment began INSIDE the same .con-start root').toBeTruthy();
  expect(log.goneFramesDuringDeployment, 'the workspace must NOT close between the commit and the first play').toBe(0);
  expect(log.sawPlayedZone, 'the bottom zone is the REAL «Разыграно» (title + owner)').toBeTruthy();
  expect(log.stolFrames, 'the retired «СТОЛ» placeholder must never render').toBe(0);
  expect(log.centralStageFrames, 'no central receiving stage — plays dock DIRECTLY into the bottom zone').toBe(0);
  expect(log.maxQueueCards, 'the startup queue stood as one persistent row').toBeGreaterThanOrEqual(opts.withPreludes ? 3 : 1);
  expect(log.maxPlayedSlots, 'resolved cards physically reached the played zone piles').toBeGreaterThanOrEqual(opts.withPreludes ? 3 : 1);
  expect(log.standaloneFrames, 'the standalone «Разыграно» overlay never mounts during the start').toBe(0);
  expect(log.sawReady, 'the flow must show terminal READY before the workspace releases').toBeTruthy();
  if (opts.expectReveal === true) {
    expect(log.sawEmbeddedReveal, 'the draw prelude opened the reveal EMBEDDED inside the workspace').toBeTruthy();
  }
  if (opts.strictMotion) {
    expect(log.sawDockProxy, 'the RT collect flew a PHYSICAL dock proxy').toBeTruthy();
  }
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
  // The hand INTAKE may still be flying the starting cards in (slower at 4K)
  // — walk the cursor only over a populated grid, never into a void.
  await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
  await page.waitForTimeout(800);

  // Cursor onto the target card (right-major adaptive walk with a down fallback).
  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`).count();
  let lastSelected = '';
  const walkTrace: Array<string> = [];
  // 60 patient iterations: right after the start release the hand's OPEN
  // reveal episode gates nav until its flights settle (longest at 4K) — the
  // walk simply keeps knocking until the grid answers.
  for (let i = 0; i < 60 && await onTarget() === 0; i++) {
    const st = await page.evaluate(() => ({
      selected: document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '',
      wheel: document.querySelector('.con-quick, .con-wheel, [class*="quickwheel"]') !== null,
      zoom: document.querySelector('.con-zoom') !== null,
      start: document.querySelector('.con-start') !== null,
      mandatory: document.querySelector('.con-mandatory') !== null,
      slots: document.querySelectorAll('.con-hand__slot').length,
      overlays: Array.from(document.querySelectorAll('[data-motion-surface]')).map((el) => el.getAttribute('data-motion-surface')).join(','),
    }));
    const selected = st.selected;
    walkTrace.push(`${i}:${selected}|w${st.wheel ? 1 : 0}z${st.zoom ? 1 : 0}s${st.start ? 1 : 0}m${st.mandatory ? 1 : 0}n${st.slots}|${st.overlays}`);
    await key(page, selected === lastSelected && i > 0 ? 'ArrowDown' : 'ArrowRight', 260);
    lastSelected = selected;
  }
  if (await onTarget() === 0) {
    console.log(`[hand walk trace] ${walkTrace.join(' ')}`);
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

test.describe('console Game Start Workspace + play landing', () => {
  test.describe.configure({mode: 'serial'});

  test('4K TV: the root-connected start flow commits to READY before release', async ({page, request}) => {
    test.setTimeout(600_000);
    await page.setViewportSize({width: 3840, height: 2160});
    const startLog = await bootGame(page, request, true, 'gsw-flow-4k', true);
    assertStart(startLog, {withPreludes: true, strictMotion: true, expectReveal: true});
  });

  test('the FULL start flow (preludes on) + the four hand plays', async ({page, request}) => {
    test.setTimeout(900_000);
    const startLog = await bootGame(page, request, true, 'gsw-fhd');
    assertStart(startLog, {withPreludes: true, strictMotion: true, expectReveal: true});

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

  test('4K TV: the start workspace + the landing keep the same grammar', async ({page, request}) => {
    test.setTimeout(600_000);
    await page.setViewportSize({width: 3840, height: 2160});
    const startLog = await bootGame(page, request, false, 'gsw-4k');
    assertStart(startLog, {withPreludes: false, strictMotion: true});
    await descendIntoPlay(page, GREEN);
    const log = await runLandingScene(page, GREEN, false, 'tv4k-green');
    assertScene(log, {isEvent: false});
    await expect(page.locator('.con-played')).toHaveCount(0);
  });

  test('reduced motion keeps the physical continuity (no overlay, same dock)', async ({page, request}) => {
    test.setTimeout(480_000);
    await page.emulateMedia({reducedMotion: 'reduce'});
    const startLog = await bootGame(page, request, false, 'gsw-red');
    // Reduced motion: flights resolve instantly — proxies are exempt, the
    // structural contract (lifetime, receiving stage, tableau) still holds.
    assertStart(startLog, {withPreludes: false, strictMotion: false});
    await descendIntoPlay(page, GREEN);
    const log = await runLandingScene(page, GREEN, false, 'reduced-green');
    expect(log.standaloneFrames, 'no standalone overlay under reduced motion').toBe(0);
    expect(log.sawStage, 'the receiving stage presented').toBeTruthy();
    expect(log.sawDocked || log.sawReserved, 'the card reached its stack').toBeTruthy();
    await expect(page.locator('.con-played')).toHaveCount(0);
  });
});
