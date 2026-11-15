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
 *      the deployment settles (recorded continuously — a single absent frame
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
import {expect, test, Page, APIRequestContext} from './consoleTest';
import {openHandPlayComposer, pickCards, press, pressUntil, settle, waitStepDealSettled} from './consoleStart';
import type {ObservedSample} from './observeCore';
import {readSettled} from './settledRead';
import {readTransient, recordTransient} from './transientRecorder';
import {armWitness, Witness} from './witness';
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
  await press(page, code, settleMs);
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

/** One observation of the start scene — what a frame of it paints (`armStartWitness`). */
type StartSeen = {
  start: boolean, ceremony: boolean, hudprev: boolean, dockProxy: boolean,
  playedZone: boolean, playedSlots: number, queueCards: number, stol: boolean, centralStage: boolean,
  embedReveal: boolean, standalone: boolean, handDock: boolean, flowReady: boolean,
};
/** The start scene's witness key — one game per page. */
const START_SCENE = 'play-landing-start';

/**
 * THE START IS RECORDED FROM THE FIRST FRAME (`armWitness`, FLAKE ZERO): every fact the start contract asserts — the
 * root's continuous life, the dock proxy of an RT collect, the played zone, the queue, the never-rendered «СТОЛ», the
 * standalone overlay — is observed in the task that wrote it, so a frame the drive below was busy pressing through is
 * still a frame of the record. `settled`: «the root never absent», «no overlay» are claims about what a frame paints.
 * The two TEXT reads (a whole subtree's `textContent`) run at most every 100 ms — the witness may not be the load.
 */
async function armStartWitness(page: Page): Promise<Witness<StartSeen>> {
  return armWitness<StartSeen>(page, START_SCENE, () => {
    const startEl = document.querySelector('.con-start');
    const start = startEl !== null;
    const w = window as unknown as {__plStartText?: {at: number, stol: boolean, playedZone: boolean}};
    const now = performance.now();
    if (w.__plStartText === undefined || now - w.__plStartText.at >= 100) {
      const played = document.querySelector('.con-start__played');
      w.__plStartText = {
        at: now,
        stol: /СТОЛ(?![А-ЯЁ])/.test(startEl?.textContent ?? ''),
        playedZone: (played?.textContent ?? '').toUpperCase().includes('РАЗЫГРАНО'),
      };
    }
    return {
      start,
      ceremony: document.querySelector('.con-start--ceremony') !== null,
      hudprev: document.querySelector('.con-start__hudprev') !== null,
      dockProxy: document.querySelector('.con-startdock-proxy') !== null,
      playedZone: start && w.__plStartText.playedZone,
      playedSlots: document.querySelectorAll('.con-start__played [data-played-key]').length,
      queueCards: document.querySelectorAll('.con-start [data-queue-slot]').length,
      stol: start && w.__plStartText.stol,
      centralStage: document.querySelector('.con-start .con-recv') !== null,
      embedReveal: document.querySelector('.con-start__embed *') !== null,
      standalone: document.querySelector('.con-played:not(.con-played--embedded)') !== null,
      handDock: document.querySelector('.con-handdock') !== null,
      flowReady: start && document.querySelector('.con-jrail')?.getAttribute('data-presentation') === 'complete',
    };
  }, {settled: true, rafTick: false, max: 20_000});
}

/**
 * The start contract's facts, read off the record. The DEPLOYMENT window opens with the ceremony; the gap claim («the
 * root never absent between the commit and the first play») is every sample of that window, before the first played
 * card, in which the root was gone — a count of zero is «never», whatever the frame rate.
 */
function startFacts(samples: ReadonlyArray<ObservedSample<StartSeen>>, log: StartLog): void {
  const values = samples.map((s) => s.v);
  const from = values.findIndex((v) => v.ceremony);
  const deployment = from < 0 ? [] : values.slice(from);
  const firstPlay = deployment.findIndex((v) => v.playedSlots > 0);
  const beforeFirstPlay = firstPlay < 0 ? deployment : deployment.slice(0, firstPlay);
  const inStart = deployment.filter((v) => v.start);
  log.sawDockProxy = log.sawDockProxy || values.some((v) => v.dockProxy);
  log.sawHudPreview = log.sawHudPreview || values.some((v) => v.hudprev);
  log.sawCeremony = log.sawCeremony || from >= 0;
  log.goneFramesDuringDeployment = beforeFirstPlay.filter((v) => !v.start).length;
  log.standaloneFrames = deployment.filter((v) => v.standalone).length;
  log.stolFrames = inStart.filter((v) => v.stol).length;
  log.centralStageFrames = inStart.filter((v) => v.centralStage).length;
  log.sawPlayedZone = inStart.some((v) => v.playedZone);
  log.sawEmbeddedReveal = inStart.some((v) => v.embedReveal);
  log.sawHandDock = inStart.some((v) => v.handDock);
  log.sawReady = log.sawReady || inStart.some((v) => v.flowReady);
  log.maxPlayedSlots = Math.max(0, ...inStart.map((v) => v.playedSlots));
  log.maxQueueCards = Math.max(0, ...inStart.map((v) => v.queueCards));
  log.trace.push(`[startrec] samples=${samples.length} deployment=${deployment.length} gone-before-first-play=` +
    `${log.goneFramesDuringDeployment} played-max=${log.maxPlayedSlots} queue-max=${log.maxQueueCards}`);
}

/** The flow rail's terminal pose — the rendered boxes (TV scale is applied through an ancestor zoom, so computed rem
 *  and the painted rail live in different coordinate spaces; the ratio is scale-invariant). */
async function readyPose(page: Page): Promise<{posed: boolean, railW: number, terminalW: number}> {
  return page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.con-jrail--presentation-complete');
    const terminal = rail?.querySelector<HTMLElement>('.con-jrail__view--terminal') ?? null;
    if (rail === null || terminal === null) {
      return {posed: false, railW: 0, terminalW: 0};
    }
    const railW = Math.round(rail.getBoundingClientRect().width);
    const terminalW = Math.round(terminal.getBoundingClientRect().width);
    return {posed: Number(getComputedStyle(terminal).opacity) > 0.98 && terminalW > 0 && railW <= terminalW * 6, railW, terminalW};
  });
}

/** The start wizard's live step chip, upper-cased ('' between steps). */
async function activeStep(page: Page): Promise<string> {
  return page.evaluate(() => (document.querySelector('.con-jrail__item--current')?.textContent ?? '').toUpperCase());
}

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
  // THE TERMINAL «READY» IS A TRANSIENT — recorded off the product's own writes, never sampled between presses (tests.md
  // ②). It stands ~2 s while the scene releases, and the release swallows presses on purpose (`start-flow-motion`, a
  // global gate on the input-absorb ledger): a loop that presses A on a standing embed zone waited that gate out and
  // slept through the whole READY pose (CI 2026-11-09 — 3/3 red, the box 9/9, the scene's own release beat shown).
  await recordTransient(page, 'start-ready', () => document.querySelector('.con-start') !== null &&
    document.querySelector('.con-jrail')?.getAttribute('data-presentation') === 'complete');
  // …and so is EVERY fact of the start contract: the drive below only PRESSES, the record OBSERVES.
  const startRec = await armStartWitness(page);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  // The ASSET WARM-UP veil (.boot-loader) sits over the scene long on a cold
  // bundle — pressing through it works (input bridges), but every screenshot
  // would show the curtain instead of the workspace. Wait it out.
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
  await waitStepDealSettled(page); // the deal cinematic has landed on the first step

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

  // ── the start wizard: STATE-DRIVEN by the active step chip; each step's picks go through the shared `pickCards`
  //    (the deal settled first, the focus walked by the wall-turning walk, every pick verified) — a hand-rolled walk
  //    drifted (the 4K deal cinematic swallowed its first press) and rewound with a blind key series. ──
  const frame = page.locator('.con-start__frame');
  const targets = [GREEN, BLUE, EVENT, TILE_EVENT];
  /** RT — advance with the physical collect (its dock proxy is RECORDED by the start witness); the walk reads the step
   *  again only once it CHANGED (a second RT on an unchanged step would advance twice). */
  const advance = async () => {
    const before = await activeStep(page);
    await key(page, 'Period', 400);
    await expect.poll(async () => await activeStep(page) !== before ||
      await page.locator('.con-start--ceremony').count() > 0, {timeout: 10_000}).toBe(true).catch(() => undefined);
  };
  for (let i = 0; i < 60 && await frame.count() > 0; i++) {
    const active = await activeStep(page);
    // The wizard flows STRAIGHT into the deployment inside the same frame
    // (no unmount gap — the whole point): hand over to the ceremony loop.
    if (await page.locator('.con-start--ceremony').count() > 0) {
      log.sawCeremony = true;
      break;
    }
    if (active.includes('КОРПОРАЦ')) {
      if ((await pickCards(page, ['CrediCor'])).includes('CrediCor')) {
        await shoot(page, `${shotPrefix}-1-corp-picked`);
        await advance();
      }
      continue;
    }
    if (active.includes('ПРОЛОГ')) {
      // BIOLAB (the draw prelude) MUST be in the set, beside Allied Bank and
      // nothing else: a random second prelude can own a board-placement child
      // workspace, which belongs to the dedicated placement probe rather than
      // this landing / terminal-flow harness.
      if ((await pickCards(page, [DRAW_PRELUDE, SAFE_PRELUDE], 34, {exclusive: true})).length >= 2) {
        await advance();
      }
      continue;
    }
    if (active.includes('ПРОЕКТ')) {
      if ((await pickCards(page, targets)).length >= targets.length) {
        await advance();
      }
      continue;
    }
    // The summary: the Expanded Startup Status Preview must stand (recorded); A commits.
    if (active.includes('СВОДКА') || active.includes('SUMMARY')) {
      await shoot(page, `${shotPrefix}-2-summary`);
    }
    await key(page, 'Enter', 1300);
  }

  // ── the DEPLOYMENT: the root `.con-start` must exist CONTINUOUSLY from the
  //    commit to the settle (the lifetime hold — the RECORD judges it). Press
  //    A whenever a CTA stands (queue plays, the purchase, the embedded
  //    reveal's takes); between two answers wait for the next one to stand.
  //    The release (the scene gone, and still gone once the screen settled)
  //    ends the drive. ──
  const deployState = () => page.evaluate(() => {
    const start = document.querySelector('.con-start') !== null;
    return {
      start,
      cta: start && document.querySelector('.con-start__slot-a') !== null,
      embedReveal: document.querySelector('.con-start__embed *') !== null,
      playedSlots: document.querySelectorAll('.con-start__played [data-played-key]').length,
      queueCards: document.querySelectorAll('.con-start [data-queue-slot]').length,
      handDock: document.querySelector('.con-handdock') !== null,
      mandatory: document.querySelector('.con-mandatory') !== null,
      flowReady: document.querySelector('.con-jrail')?.getAttribute('data-presentation') === 'complete',
    };
  });
  let shotDeploy = false;
  let shotPlayed = false;
  let shotReveal = false;
  let shotReady = false;
  for (let i = 0, deadline = Date.now() + 170_000; Date.now() < deadline; i++) {
    const s = await deployState();
    log.trace.push(`d${i} start:${s.start ? 1 : 0} cta:${s.cta ? 1 : 0} q:${s.queueCards} p:${s.playedSlots} emb:${s.embedReveal ? 1 : 0} hd:${s.handDock ? 1 : 0}`);
    if (s.start) {
      if (s.embedReveal && !shotReveal) {
        shotReveal = true;
        await shoot(page, `${shotPrefix}-5-embedded-reveal`);
      }
      if (s.flowReady && captureReady && !shotReady) {
        shotReady = true;
        // `data-presentation="complete"` flips at the START of the physical
        // consolidation. Wait for the real computed pose at rest, not a
        // guessed delay, so Calm/Standard/Swift all capture the terminal pose.
        //
        // A POSE GATE FOR A PHOTOGRAPH IS NOT AN ASSERTION: the fact this
        // block exists for (`sawReady`) is RECORDED, and all the wait buys is
        // a shot of the SETTLED rail rather than one taken mid-consolidation.
        // On a loaded 4K frame that consolidation runs long, and the old bare
        // 2 s budget failed the whole start probe over a screenshot — so the
        // budget is generous AND the miss is caught.
        await readSettled(page, () => readyPose(page), {settle: false, timeoutMs: 8_000, message: 'the flow rail terminal pose'})
          .catch(() => undefined);
        await shoot(page, `${shotPrefix}-6-flow-ready`);
      }
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
        // Nothing to answer yet — wait (bounded) for the next thing the drive answers, or for the scene to go.
        await expect.poll(async () => {
          const n = await deployState();
          return !n.start || n.cta || n.embedReveal || (n.flowReady && captureReady && !shotReady);
        }, {timeout: 3_000, intervals: [180]}).toBe(true).catch(() => undefined);
      }
      continue;
    }
    if (s.mandatory) {
      break; // post-release first-action announce — the start flow is over
    }
    // The scene is gone. A release STAYS gone: it is believed once the screen has settled without it (a scene that
    // comes back is driven on — and its gap is the record's to judge, never this loop's).
    await settle(page);
    if (await page.locator('.con-start').count() === 0) {
      break;
    }
  }
  await expect(page.locator('.con-start')).toHaveCount(0, {timeout: 30_000});
  startFacts(await startRec.stop(), log);
  const ready = await readTransient<boolean>(page, 'start-ready');
  if (ready.some((x) => x.v)) {
    log.sawReady = true;
  }
  log.trace.push(`[ready] ${ready.map((x) => `${x.v ? 'READY' : '-'}@${Math.round(x.t)}`).join(' ')}`);
  await settle(page); // the hand intake lands (slower at 4K)
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


/**
 * The hand → `card` focused → the workspace DESCENDS into the play level (the embedded composer) — the shared driver
 * (`openHandPlayComposer`: the hand through the RT wheel's centre slot — never a blind B first, B on a pending start
 * prompt DEFERS it —, the hand's own «input released» signal before the walk, the focus walked by the wall-turning
 * walk, A verified by the composer standing, the sheet LOADED). The hand-rolled walk this probe kept knocked
 * ArrowRight / ArrowDown for 60 rounds.
 */
async function descendIntoPlay(page: Page, card: string): Promise<void> {
  await openHandPlayComposer(page, card);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 10_000});
  // The descent phrase + preview settle, and the CTA arms.
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 10_000});
  await settle(page);
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

/** One observation of the landing episode — what a frame of the scene shows (`runLandingScene`'s witness). */
type SceneSeen = {
  standalone: boolean, fullOverlay: boolean, proxy: boolean, stageUp: boolean, hand: boolean, step: string,
  composer: boolean, cardColHidden: boolean, reserved: boolean, docked: boolean, minis: number, destCount: number,
};
/** The episode's witness key — one landing at a time (the FHD test plays four cards on one page; re-arming starts a
 *  fresh record). */
const LANDING_SCENE = 'play-landing-scene';

/** The first sample after the stage where the workspace folded — the episode's end (undefined while it stands). */
function foldOf(samples: ReadonlyArray<ObservedSample<SceneSeen>>): ObservedSample<SceneSeen> | undefined {
  const at = samples.findIndex((s) => s.v.stageUp);
  return at < 0 ? undefined : samples.slice(at + 1).find((s) => !s.v.composer && !s.v.stageUp);
}

/** Wait (bounded, NEVER a verdict — the verdicts are `assertScene`'s) until the episode's record holds `reached`. */
async function sceneReaches(scene: Witness<SceneSeen>, reached: (samples: ReadonlyArray<ObservedSample<SceneSeen>>) => boolean,
  deadline: number): Promise<boolean> {
  return expect.poll(async () => reached(await scene.samples()), {timeout: Math.max(1, deadline - Date.now()), intervals: [70]})
    .toBe(true).then(() => true, () => false);
}

/** Confirm the play and observe the whole landing episode frame-by-frame. */
async function runLandingScene(page: Page, card: string, isEvent: boolean, shotPrefix: string, shots = true): Promise<SceneLog> {
  const log: SceneLog = {
    standaloneFrames: 0, fullOverlayFrames: 0, sawStage: false, sawReserved: false, sawProxy: false,
    sawStepPlayed: false, sawDocked: false, sawCardColHidden: false, maxMinis: 0, maxEvents: 0,
    handSurvivedUntilStage: false, trace: [],
  };
  // THE WHOLE EPISODE IS RECORDED, NEVER POLLED (TEST_CONTOUR §5; FLAKE ZERO — `armWitness`).
  //
  // On a loaded 4K frame a Playwright-side poll undersamples brutally: a
  // healthy local run measured THREE samples across the 16 s window, with a
  // 6.7 s hole — an `evaluate` round-trip plus one 4K `screenshot()` costs
  // seconds, and the landing's whole dock beat fits inside such a hole. The
  // product docked the card, the sampler slept through it, and the spec
  // reported «the card never took the front» about a front it never looked at
  // (the crumb tail lost the same way first; the fix belongs to EVERY fact the
  // scene asserts, not just that one).
  //
  // The witness observes the product's own writes in the task that makes them
  // (+ a frame tick for what only a computed style moves), whatever the
  // round-trip latency is. `attributes` are observed: the front anchor
  // announces the dock by rewriting `data-played-key`.
  //
  // The Playwright side owns only the SCREENSHOTS and the episode's end — a
  // slow frame can cost a photograph, never a fact.
  const scene = await armWitness<SceneSeen, string>(page, LANDING_SCENE, (c) => {
    const recv = document.querySelector('.con-composer__playstage .con-recv');
    const front = recv?.querySelector('[data-recv-front]') ?? null;
    const key = front?.getAttribute('data-played-key') ?? '';
    const count = recv?.querySelector('.con-recv__caption-count')?.textContent ?? '';
    const playCard = document.querySelector('.con-composer__playcard');
    return {
      standalone: document.querySelector('.con-played:not(.con-played--embedded)') !== null,
      fullOverlay: document.querySelector('.con-composer__playstage .con-played') !== null,
      proxy: document.querySelector('.con-played-hero__proxy') !== null,
      stageUp: document.querySelector('.con-composer__playstage--up') !== null,
      hand: document.querySelector('.con-hand') !== null,
      step: (document.querySelector('.con-wshead__step')?.textContent ?? '').trim().toUpperCase(),
      composer: document.querySelector('.con-composer--play') !== null,
      cardColHidden: playCard !== null && getComputedStyle(playCard).visibility === 'hidden',
      reserved: front !== null && key === '',
      docked: key === c,
      minis: recv === null ? 0 : recv.querySelectorAll('.con-recv__mini').length,
      destCount: count === '' ? -1 : Number(count),
    };
  }, {args: card, max: 20_000});
  await key(page, 'Enter', 60); // A · Разыграть карту
  const deadline = Date.now() + 16_000;
  if (shots && await sceneReaches(scene, (ss) => ss.some((s) => s.v.proxy && s.v.stageUp), deadline)) {
    await shoot(page, `${shotPrefix}-1-flight`);
  }
  if (shots && await sceneReaches(scene, (ss) => ss.some((s) => s.v.docked), deadline)) {
    await shoot(page, `${shotPrefix}-2-docked`);
  }
  // The workspace folded — the episode is over (bounded: the facts below judge an episode that never ended).
  await sceneReaches(scene, (ss) => foldOf(ss) !== undefined, deadline);
  const samples = await scene.stop();
  const values = samples.map((s) => s.v);
  const t0 = samples[0]?.t ?? 0;
  log.trace.push(`[scene] ${card} ${isEvent ? 'event (face-down pile)' : 'card (front anchor)'} — ${samples.length} recorded states`);
  for (const s of samples) {
    const v = s.v;
    log.trace.push(
      `t${Math.round(s.t - t0)} comp:${v.composer ? 1 : 0} stage:${v.stageUp ? 1 : 0} res:${v.reserved ? 1 : 0} ` +
      `dock:${v.docked ? 1 : 0} prx:${v.proxy ? 1 : 0} minis:${v.minis} n:${v.destCount} col:${v.cardColHidden ? 1 : 0} step:${v.step}`);
  }
  // The facts, read off the record: the two NEGATIVE ones are counts of recorded states (zero = «never», whatever the
  // frame rate); every positive one is «did it ever happen»; the stage-scoped ones count only while the stage stood.
  const staged = values.filter((v) => v.stageUp);
  log.standaloneFrames = values.filter((v) => v.standalone).length;
  log.fullOverlayFrames = values.filter((v) => v.fullOverlay).length;
  log.sawStage = staged.length > 0;
  log.sawReserved = values.some((v) => v.reserved);
  log.sawProxy = values.some((v) => v.proxy);
  log.sawDocked = values.some((v) => v.docked);
  log.sawStepPlayed = values.some((v) => v.step === 'РАЗЫГРАНО');
  log.sawCardColHidden = staged.some((v) => v.cardColHidden);
  log.handSurvivedUntilStage = staged.some((v) => v.hand);
  log.maxMinis = Math.max(0, ...staged.map((v) => v.minis));
  log.maxEvents = Math.max(0, ...staged.map((v) => v.destCount));
  // A DEAD witness must fail here, not silently pass every negative fact. Only a dead one records nothing — a count
  // of samples is a count of frames, i.e. of the machine's speed (the shortest episode is the reduced-motion one).
  expect(samples.length, 'the landing scene witness recorded').toBeGreaterThan(0);
  await settle(page);
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
  /*
   * NOT `serial`. Every test below boots its OWN game and drives its OWN page,
   * so they share nothing — while `serial` costs twice over: a failure in the
   * first marks the other three «did not run» (they vanish from the report
   * entirely), and the file can never use more than one worker.
   */

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

    // ── same game: the TILE event — STAGED PLAY (docs/TILE_PLAY_STAGED_COMMIT.md)
    //    changed this flow's grammar: «Разыграть» no longer runs a landing
    //    scene; the composer hands the screen STRAIGHT to the board's cell
    //    pick, and only the cell confirm commits the play (the landing story
    //    then belongs to the tile hero, covered by the placement specs).
    //    So here the assertions are the staged boundary: the workspace yields,
    //    the placement is served, and no landing scene ever armed.
    await descendIntoPlay(page, TILE_EVENT);
    // «Разыграть на поле» — no submit yet. Act → verify → retry, with a whole window before a second A (on the board a
    // second A would LOCK a cell).
    await pressUntil(page, 'Enter', async () =>
      await page.locator('.con-context').filter({hasText: /размещение тайла/i}).count() > 0, {tries: 3, settleMs: 3000});
    await expect(page.locator('.con-context'), 'the staged placement never took the board')
      .toContainText(/размещение тайла/i, {timeout: 30_000});
    await expect(page.locator('.con-hand')).toHaveCount(0);
    await expect(page.locator('.con-composer--play')).toHaveCount(0);
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
