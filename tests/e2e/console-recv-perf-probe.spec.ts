/*
 * CONSOLE RECEIVING-STAGE PERFORMANCE PROBE — a MEASUREMENT harness, not a
 * regression gate. Env-gated (`RECV_PERF=1`), skipped in every ordinary run.
 *
 * WHAT IT IS FOR. The compact played-tableau scene of the Card Play Workspace
 * (`ConsolePlayedReceivingStage`, «… › РАЗЫГРАНО») is a hot 4K surface with a
 * hard performance budget. This probe drives the REAL flow (production build,
 * real server, real game) through representative tableau sizes and records:
 *
 *   - CDP Performance metrics (Nodes / JSHeap / LayoutCount+Duration /
 *     RecalcStyleCount+Duration / ScriptDuration) at three anchors: before the
 *     submit, at the docked stage, after the workspace folds;
 *   - an in-page long-task observer + the 16 ms tick jitter of a TIMING
 *     witness across the whole episode (rAF is compositor-starved headless —
 *     see [[e2e-raf-probe-dies-headless]] — so jank is judged by main-thread
 *     availability, which both of those measure);
 *   - a DOM census of the scene at its docked beat (nodes / faces / <img>);
 *   - idle-loop leftovers after the fold (interval tick rate + scene nodes).
 *
 * Results land in `screenshots/recv-perf/<RECV_PERF_LABEL>/…` as JSON +
 * screenshots; compare two labels (e.g. `baseline` vs `rework`) by hand or
 * with a diff — the probe itself asserts only structural sanity (the scene
 * presented, the card docked), never absolute numbers, so it can run on any
 * machine without flaking.
 *
 * The BIG-TABLEAU states are built through the RAW legacy input protocol
 * (`POST /player/input` — byte-identical to what the radio UI sends), because
 * playing 17 cards through the console UI would cost ~4 minutes per scenario
 * for no extra fidelity: only the LAST play (the measured one) needs the real
 * console flow, and it gets it.
 */
import {expect, test, Page, APIRequestContext, CDPSession} from './consoleTest';
import * as fs from 'fs';
import * as path from 'path';
import {cinematicBeat, NO_PAYMENT, openHandPlayComposer, press, settle} from './consoleStart';
import type {ObservedSample} from './observeCore';
import {armWitness, Witness, witnessOf} from './witness';

const RUN = process.env.RECV_PERF === '1';
const LABEL = process.env.RECV_PERF_LABEL ?? 'run';
const OUT = path.join(__dirname, '..', '..', 'screenshots', 'recv-perf', LABEL);

// ── the guaranteed deck (base + corpEra, no requirements, no on-play prompts,
//    no play-triggered handlers that would interrupt the raw API loop) ──────
const ACTIVES = [
  'Space Station', 'Earth Office', 'Rover Construction', 'Adaptation Technology',
  'Media Group', 'Standard Technology', 'Advanced Alloys', 'Security Fleet',
  'Water Import From Europa', 'Physics Complex',
  'Extreme-Cold Fungus', 'Tardigrades',
];
const AUTOMATED = ['Acquired Company', 'Cartel', 'Mine', 'Solar Wind Power', 'Giant Space Mirror'];
const EVENTS = ['Investment Loan', 'Bribed Committee'];

const EMPTY_PAYMENT = {...NO_PAYMENT};

function gameConfig(projects: ReadonlyArray<string>) {
  return {
    players: [{name: 'RecvPerf', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false, prelude: false,
      prelude2: false, turmoil: false, community: false, ares: false, moon: false,
      pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false, customCorporationsList: ['CrediCor'],
    bannedCards: [], includedCards: [], customColoniesList: [], customPreludes: [],
    customProjectCards: projects,
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

// ── raw protocol driving ────────────────────────────────────────────────────

// Raw legacy-protocol JSON: the probe walks server models structurally.
type AnyModel = Record<string, any>;

async function playerModel(request: APIRequestContext, playerId: string): Promise<AnyModel> {
  const res = await request.get(`/api/player?id=${playerId}`);
  expect(res.ok(), `GET /api/player failed: ${res.status()}`).toBeTruthy();
  return await res.json() as AnyModel;
}

async function postInput(request: APIRequestContext, playerId: string, response: unknown): Promise<boolean> {
  const res = await request.post(`/player/input?id=${playerId}`, {data: response});
  return res.ok();
}

/**
 * Answer the initial-cards selection, then DRAIN the fork's start
 * interstitials down to the action-phase `or` prompt: the deferred
 * corporation play (`type: 'card'`, «Play your corporation») and the solo
 * research-buy confirm (`type: 'option'`).
 */
async function bootstrapToAction(request: APIRequestContext, playerId: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const model = await playerModel(request, playerId);
    const wf = model.waitingFor;
    if (wf === undefined) {
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    if (wf.type === 'or') {
      return;
    }
    if (wf.type === 'initialCards') {
      const options = wf.options as Array<AnyModel>;
      const corpOption = options[0];
      const projectOption = options.find((o: AnyModel, j: number) => j > 0 && Array.isArray(o.cards));
      const corp = (corpOption.cards as Array<AnyModel>).find((c) => c.name === 'CrediCor')?.name ?? corpOption.cards[0].name;
      const projects = (projectOption?.cards as Array<AnyModel> ?? []).map((c) => c.name as string);
      expect(await postInput(request, playerId, {
        type: 'initialCards',
        responses: [{type: 'card', cards: [corp]}, {type: 'card', cards: projects}],
      }), 'initialCards submit accepted').toBeTruthy();
      continue;
    }
    if (wf.type === 'card') {
      // The deferred corporation play — confirm the (single) offered card.
      const first = (wf.cards as Array<AnyModel>)[0]?.name as string;
      expect(await postInput(request, playerId, {type: 'card', cards: [first]}),
        'corporation play accepted').toBeTruthy();
      continue;
    }
    if (wf.type === 'option') {
      expect(await postInput(request, playerId, {type: 'option'}),
        'interstitial option accepted').toBeTruthy();
      continue;
    }
    throw new Error(`bootstrap: unexpected prompt type ${wf.type}`);
  }
  throw new Error('bootstrap: never reached the action-phase or-prompt');
}

/** Play ONE project card through the raw protocol. Returns false when the
 *  card is not offered (skipped, never fatal — the probe logs the miss). */
async function apiPlay(request: APIRequestContext, playerId: string, card: string): Promise<boolean> {
  const model = await playerModel(request, playerId);
  const wf = model.waitingFor;
  if (wf === undefined || wf.type !== 'or') {
    return false;
  }
  // There can be more than one projectCard option (e.g. a prompt-discounted
  // play beside the ordinary one) — pick the one that OFFERS this card.
  let idx = -1;
  let offer: AnyModel | undefined;
  (wf.options as Array<AnyModel>).forEach((o, j) => {
    if (o.type !== 'projectCard' || offer !== undefined) {
      return;
    }
    const hit = (o.cards as Array<AnyModel>).find((c) => c.name === card);
    if (hit !== undefined) {
      idx = j;
      offer = hit;
    }
  });
  if (idx < 0 || offer === undefined) {
    return false;
  }
  const cost = typeof offer.calculatedCost === 'number' ? offer.calculatedCost : 0;
  return await postInput(request, playerId, {
    type: 'or',
    index: idx,
    response: {type: 'projectCard', card, payment: {...EMPTY_PAYMENT, megacredits: cost}},
  });
}

// ── in-page instrumentation ─────────────────────────────────────────────────

type LongTasks = {longTasks: number, longTaskMax: number, longTaskTotal: number};
type PerfWindow = LongTasks & {tickCount: number, tickJank50: number, tickJank120: number, tickMax: number};

/** The perf window's TIMING witness — one window at a time (re-arming starts a fresh record). */
const PERF_WINDOW = 'recv-perf-window';
/** The recorder's TIMER tick (the old jitter meter's period): a free main thread runs it every 16 ms, a stalled one
 *  runs nothing — so a gap in the stamped series IS a stall. */
const TICK_MS = 16;
/** One stamped call of the recorder — the page's `performance.now()`. */
type PerfTick = {t: number};

/**
 * Arm a perf window: the page's own LONG-TASK API (a `PerformanceObserver` — the browser's record of a busy main thread,
 * not a sampler) + the tick jitter as a TIMING witness (`armWitness` + `tickMs`, FLAKE ZERO recipe 9): the reader stamps
 * every call, the series is read as recorded and a gap over 50 / 120 ms is a stall (`tickJitter`).
 */
async function armPerfWindow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    w.__perfObs?.disconnect();
    w.__perfTick = undefined;
    const rec = {longTasks: 0, longTaskMax: 0, longTaskTotal: 0};
    w.__perfWin = rec;
    try {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          rec.longTasks++;
          rec.longTaskTotal += e.duration;
          rec.longTaskMax = Math.max(rec.longTaskMax, e.duration);
        }
      });
      obs.observe({entryTypes: ['longtask']});
      w.__perfObs = obs;
    } catch {
      /* longtask unsupported — the tick series still stands */
    }
  });
  await armWitness<PerfTick>(page, PERF_WINDOW, () => {
    // EVERY CALL IS STAMPED (so the recording keeps it — the series is the page's pace), at most one per 4 ms: the
    // observer and the timer tick may both call within one frame.
    const w = window as unknown as {__perfTick?: PerfTick};
    const now = performance.now();
    if (w.__perfTick !== undefined && now - w.__perfTick.t < 4) {
      return w.__perfTick;
    }
    w.__perfTick = {t: Math.round(now * 10) / 10};
    return w.__perfTick;
  }, {rafTick: false, tickMs: TICK_MS, max: 50_000});
}

/** The tick jitter of a recorded series — one document's stamps (a reload restarts `performance.now()`), never filled in. */
function tickJitter(samples: ReadonlyArray<ObservedSample<PerfTick>>): Omit<PerfWindow, keyof LongTasks> {
  const doc = samples.at(-1)?.doc;
  const stamps = samples.filter((s) => s.doc === doc).map((s) => s.v.t);
  const out = {tickCount: Math.max(0, stamps.length - 1), tickJank50: 0, tickJank120: 0, tickMax: 0};
  for (let i = 1; i < stamps.length; i++) {
    const dt = stamps[i] - stamps[i - 1];
    out.tickMax = Math.max(out.tickMax, dt);
    if (dt > 50) {
      out.tickJank50++;
    }
    if (dt > 120) {
      out.tickJank120++;
    }
  }
  return out;
}

async function readPerfWindow(page: Page): Promise<PerfWindow> {
  const ticks = await witnessOf<PerfTick>(page, PERF_WINDOW).stop();
  const long = await page.evaluate(() => {
    const w = window as any;
    w.__perfObs?.disconnect();
    return w.__perfWin;
  }) as LongTasks;
  return {...long, ...tickJitter(ticks)};
}

type CdpMetrics = Record<string, number>;

async function cdpMetrics(cdp: CDPSession): Promise<CdpMetrics> {
  const res = await cdp.send('Performance.getMetrics') as {metrics: Array<{name: string, value: number}>};
  const out: CdpMetrics = {};
  for (const m of res.metrics) {
    out[m.name] = m.value;
  }
  return out;
}

function metricsDelta(a: CdpMetrics, b: CdpMetrics): CdpMetrics {
  const keys = ['Nodes', 'JSEventListeners', 'LayoutCount', 'RecalcStyleCount',
    'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration', 'JSHeapUsedSize'];
  const out: CdpMetrics = {};
  for (const k of keys) {
    out[k] = Math.round(((b[k] ?? 0) - (a[k] ?? 0)) * 1000) / 1000;
  }
  return out;
}

/**
 * RECV_PERF_NOSHOT=1 — a PURE-VIDEO pass: every screenshot (including the
 * 8×8 BeginFrame pump) is suppressed. The Playwright recorder muxes GRAY
 * frames whenever captures interleave with it — the only way to a clean
 * flow recording is a headed run where the compositor is left alone.
 */
const NOSHOT = process.env.RECV_PERF_NOSHOT === '1';

async function shoot(page: Page, name: string): Promise<void> {
  if (NOSHOT) {
    return;
  }
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Headless Chromium starves rAF on a static frame — force a BeginFrame. */
async function forceFrame(page: Page): Promise<void> {
  if (NOSHOT) {
    return; // headed pure-video pass: the compositor runs free
  }
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
}

async function key(page: Page, code: string, settleMs = 400): Promise<void> {
  await press(page, code, settleMs);
}

// ── the console UI walk (descend into the play of `card`) ──────────────────

async function openConsoleOnPlayer(page: Page, playerId: string): Promise<void> {
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-root', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
  await settle(page);
}

/**
 * The hand → `card` focused → its play composer, LOADED — the shared driver (`openHandPlayComposer`: the hand through
 * the RT wheel, the focus walked by `walkFocusUntil` — turning around at a wall —, A verified by the composer standing);
 * the hand-rolled walk this probe kept pressed a fixed rewind sequence at every page edge.
 */
async function descendIntoPlay(page: Page, card: string): Promise<void> {
  await openHandPlayComposer(page, card);
  await expect(page.locator('.con-hand__stage .con-composer--play'), `the play of ${card} stands in the hand's stage`)
    .toBeVisible({timeout: 10_000});
}

/** Drive the composer to a READY CTA and submit — adaptive: a target-pick
 *  step (Imported Nitrogen) is walked and confirmed on the way. */
async function armAndSubmit(page: Page, shotPrefix: string): Promise<void> {
  let submitted = false;
  const trace: Array<string> = [];
  for (let i = 0; i < 40 && !submitted; i++) {
    const s = await page.evaluate(() => ({
      ctaReady: document.querySelector('.con-composer__cta--ready') !== null,
      ctaFocused: document.querySelector('.con-composer__cta--focused') !== null,
      pick: document.querySelector('.con-played-cat') !== null,
      composer: document.querySelector('.con-composer--play') !== null,
      landing: document.querySelector('.con-composer__playstage--up') !== null,
    }));
    trace.push(`${i}:r${s.ctaReady ? 1 : 0}f${s.ctaFocused ? 1 : 0}p${s.pick ? 1 : 0}c${s.composer ? 1 : 0}l${s.landing ? 1 : 0}`);
    if (s.landing || !s.composer) {
      submitted = true;
      break;
    }
    if (s.ctaReady && s.ctaFocused) {
      await page.keyboard.press('Enter');
      submitted = true;
      break;
    }
    if (s.ctaReady) {
      await key(page, 'ArrowDown', 240);
      continue;
    }
    // A step needs an answer (a target pick / a selection row): A on it.
    await shoot(page, `${shotPrefix}-step-${i}`);
    await key(page, 'Enter', 700);
  }
  if (!submitted) {
    console.log(`[armAndSubmit trace] ${trace.join(' ')}`);
  }
  expect(submitted, 'the composer submitted').toBeTruthy();
}

// ── the measured episode ────────────────────────────────────────────────────

type EpisodeResult = {
  sawStage: boolean,
  sawDocked: boolean,
  foldMs: number,
  /** In-page clock: submit → stage visible / card docked / workspace folded. */
  timingsMs: {stageAt: number, dockAt: number, foldAt: number},
  census: Record<string, number>,
  perf: PerfWindow,
  cdpBefore: CdpMetrics,
  cdpDocked: CdpMetrics,
  cdpAfter: CdpMetrics,
  deltaToDocked: CdpMetrics,
  deltaWhole: CdpMetrics,
  idleTicksAfter: Record<string, number>,
};

/** One observation of the episode — what the scene shows NOW (the census is taken ONCE, in the task the card docked). */
type EpisodeSeen = {stage: boolean, composer: boolean, docked: boolean, census: Record<string, number> | null};
type EpisodeArgs = {card: string, arm: number};
/** The episode's witness key — one episode at a time; `episodeArm` tells a re-arm's fresh state from the last one's. */
const EPISODE = 'recv-episode';
let episodeArm = 0;

/** The episode's facts, read off its record: the first STAGE, the first DOCKED, the first FOLD after the stage. */
type EpisodeFacts = {
  t0: number,
  stage: ObservedSample<EpisodeSeen> | undefined,
  docked: ObservedSample<EpisodeSeen> | undefined,
  fold: ObservedSample<EpisodeSeen> | undefined,
};

function episodeFacts(samples: ReadonlyArray<ObservedSample<EpisodeSeen>>): EpisodeFacts {
  const at = samples.findIndex((s) => s.v.stage);
  return {
    t0: samples[0]?.t ?? 0,
    stage: at < 0 ? undefined : samples[at],
    docked: samples.find((s) => s.v.docked),
    fold: at < 0 ? undefined : samples.slice(at + 1).find((s) => !s.v.stage && !s.v.composer),
  };
}

/**
 * Wait until the episode's record holds `fact` — a BOUNDED WAIT, never a verdict: `sawStage` / `sawDocked` are asserted
 * by the test once the result is on disk. Every poll forces a frame (headless Chromium starves GSAP's rAF on a static
 * frame — a tiny screenshot IS a BeginFrame, without paying for a full-viewport 4K capture).
 */
async function episodeReaches(page: Page, ep: Witness<EpisodeSeen>, fact: 'stage' | 'docked' | 'fold', deadline: number): Promise<boolean> {
  return expect.poll(async () => {
    await forceFrame(page);
    return episodeFacts(await ep.samples())[fact] !== undefined;
  }, {timeout: Math.max(1, deadline - Date.now()), intervals: [120]}).toBe(true).then(() => true, () => false);
}

async function runEpisode(page: Page, cdp: CDPSession, card: string, shotPrefix: string): Promise<EpisodeResult> {
  await armPerfWindow(page);
  // THE FACTS ARE RECORDED IN-PAGE — a witness (`armWitness`, FLAKE ZERO): the scene observed in the task that wrote it,
  // every change pushed to this side at once; the Playwright side only owns screenshots and the episode's end — on a
  // loaded 4K frame an `evaluate` + screenshot round trip costs seconds, and a whole docked beat fits inside such a hole
  // (the landing probe's TEST_CONTOUR §5 lesson; this probe re-learned it on its first stress run).
  episodeArm++;
  const ep = await armWitness<EpisodeSeen, EpisodeArgs>(page, EPISODE, ({card, arm}) => {
    const w = window as unknown as {__recvEpisode?: {arm: number, census: Record<string, number> | null}};
    if (w.__recvEpisode === undefined || w.__recvEpisode.arm !== arm) {
      w.__recvEpisode = {arm, census: null};
    }
    const state = w.__recvEpisode;
    const stage = document.querySelector('.con-composer__playstage--up') !== null;
    const composer = document.querySelector('.con-composer--play') !== null;
    const recv = document.querySelector('.con-composer__playstage .con-recv');
    const front = recv?.querySelector('[data-recv-front]');
    const docked = (front?.getAttribute('data-played-key') ?? '') === card;
    if (docked && state.census === null && recv !== null) {
      const q = (sel: string) => recv.querySelectorAll(sel).length;
      state.census = {
        totalNodes: recv.querySelectorAll('*').length,
        pcards: q('.pcard'),
        imgs: q('img'),
        minis: q('.con-recv__mini'),
        strips: q('[data-recv-strip]'),
        docNodes: document.querySelectorAll('*').length,
      };
    }
    return {stage, composer, docked, census: state.census};
  }, {args: {card, arm: episodeArm}, rafTick: false});
  const cdpBefore = await cdpMetrics(cdp);
  const t0 = Date.now();
  await armAndSubmit(page, shotPrefix);

  let cdpDocked: CdpMetrics = {};
  const deadline = Date.now() + 25_000;
  if (await episodeReaches(page, ep, 'stage', deadline)) {
    // Fired at the first STAGE observation: on a 4K frame the shot's own
    // round trip lands it mid-flight / at the dock — the one photographable
    // window of a scene whose docked beat is shorter than a 4K capture.
    await shoot(page, `${shotPrefix}-stage`);
  }
  if (await episodeReaches(page, ep, 'docked', deadline)) {
    cdpDocked = await cdpMetrics(cdp);
    await shoot(page, `${shotPrefix}-docked`);
    if (process.env.RECV_PERF_VIDEO === '1' && !NOSHOT) {
      // VISUAL mode: a clipped BURST of the shelf zone through the effect-
      // resolution window (emergence → chips → settle) — a full 4K frame
      // costs more than the docked beat lasts, the clipped half costs half.
      const vp = page.viewportSize() ?? {width: 1920, height: 1080};
      const clip = {x: 0, y: Math.round(vp.height * 0.30), width: vp.width, height: Math.round(vp.height * 0.70)};
      for (let b = 1; b <= 6; b++) {
        fs.mkdirSync(OUT, {recursive: true});
        await page.screenshot({path: path.join(OUT, `${shotPrefix}-beat${b}.png`), clip}).catch(() => {});
        await cinematicBeat(page, 160, 'the frame spacing of the burst — a storyboard of the docked beat');
      }
    }
  }
  const folded = await episodeReaches(page, ep, 'fold', deadline);
  const samples = await ep.stop();
  const facts = episodeFacts(samples);
  const ms = (s: ObservedSample<EpisodeSeen> | undefined) => s === undefined ? -1 : Math.round(s.t - facts.t0);
  const sawStage = facts.stage !== undefined;
  const sawDocked = facts.docked !== undefined;
  const census = facts.docked?.v.census ?? {};
  const foldMs = folded && facts.fold !== undefined ? ms(facts.fold) : Date.now() - t0;
  // The recorder's own liveness — only a DEAD witness records nothing (the real verdicts are the test's).
  expect(samples.length, 'the episode witness recorded').toBeGreaterThan(0);
  const perf = await readPerfWindow(page);
  const cdpAfter = await cdpMetrics(cdp);
  await shoot(page, `${shotPrefix}-after`);

  // Idle leftovers: scene nodes must be gone; the tick meter re-armed for 1.2 s
  // gives the post-fold main-thread profile (no busy timelines should remain).
  await armPerfWindow(page);
  await cinematicBeat(page, 1200, 'the post-fold idle window IS the measurement');
  const idle = await readPerfWindow(page);
  const leftovers = await page.evaluate(() => ({
    recvNodes: document.querySelectorAll('.con-recv, .con-recv__emerge').length,
    heroProxies: document.querySelectorAll('.con-played-hero__proxy').length,
    transferChips: document.querySelectorAll('.con-transfer__chip, [class*="con-transfer"]').length,
    docNodes: document.querySelectorAll('*').length,
    animations: typeof document.getAnimations === 'function' ? document.getAnimations().length : -1,
  }));
  return {
    sawStage, sawDocked, foldMs,
    timingsMs: {stageAt: ms(facts.stage), dockAt: ms(facts.docked), foldAt: ms(facts.fold)},
    census, perf,
    cdpBefore, cdpDocked, cdpAfter,
    deltaToDocked: metricsDelta(cdpBefore, cdpDocked),
    deltaWhole: metricsDelta(cdpBefore, cdpAfter),
    idleTicksAfter: {
      tickJank50: idle.tickJank50, tickMax: Math.round(idle.tickMax),
      ...leftovers,
    },
  };
}

function writeResult(name: string, data: unknown): void {
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
}

// ── scenarios ───────────────────────────────────────────────────────────────

type Scenario = {
  name: string,
  viewport: {width: number, height: number},
  deck: ReadonlyArray<string>,
  apiPlays: ReadonlyArray<string>,
  uiPlay: string,
  /** Play a SECOND card through the UI on the same page (leak / repeat check). */
  uiPlaySecond?: string,
};

const SCENARIOS: ReadonlyArray<Scenario> = [
  {
    name: 'small-fhd',
    viewport: {width: 1920, height: 1080},
    deck: [...ACTIVES.slice(0, 2), ...AUTOMATED.slice(0, 2), ...EVENTS],
    apiPlays: [],
    uiPlay: 'Acquired Company',
  },
  {
    name: 'medium-4k',
    viewport: {width: 3840, height: 2160},
    deck: [...ACTIVES, ...AUTOMATED, ...EVENTS],
    apiPlays: [...ACTIVES.slice(0, 7), 'Acquired Company', 'Cartel', 'Investment Loan'],
    uiPlay: 'Security Fleet',
    uiPlaySecond: 'Physics Complex',
  },
  {
    name: 'stress-4k',
    viewport: {width: 3840, height: 2160},
    deck: [...ACTIVES, ...AUTOMATED, ...EVENTS],
    apiPlays: [
      ...ACTIVES.filter((c) => c !== 'Advanced Alloys'),
      ...AUTOMATED.slice(0, 3), ...EVENTS,
    ],
    uiPlay: 'Advanced Alloys',
  },
  {
    name: 'targets-4k',
    viewport: {width: 3840, height: 2160},
    deck: ['Tardigrades', 'Imported Nitrogen', ...ACTIVES.slice(0, 4), ...AUTOMATED.slice(0, 2)],
    apiPlays: ['Tardigrades', ...ACTIVES.slice(0, 2)],
    uiPlay: 'Imported Nitrogen',
  },
  {
    name: 'medium-deck',
    viewport: {width: 1280, height: 800},
    deck: [...ACTIVES, ...AUTOMATED, ...EVENTS],
    apiPlays: [...ACTIVES.slice(0, 7), 'Acquired Company', 'Cartel', 'Investment Loan'],
    uiPlay: 'Security Fleet',
  },
  {
    // The VISUAL twin of targets-4k at FHD — the effect-resolution beats are
    // photographable there (a 4K capture outlasts the docked window).
    name: 'targets-fhd',
    viewport: {width: 1920, height: 1080},
    deck: ['Tardigrades', 'Imported Nitrogen', ...ACTIVES.slice(0, 4), ...AUTOMATED.slice(0, 2)],
    apiPlays: ['Tardigrades', ...ACTIVES.slice(0, 2)],
    uiPlay: 'Imported Nitrogen',
  },
];

// RECV_PERF_VIDEO=1 — a VISUAL pass: record the whole episode (the docked
// beat lives ~400 ms, which no 4K screenshot round-trip can catch; frames
// are extracted from the video afterwards). Never combined with the
// measurement pass — recording skews main-thread numbers. File-scope on
// purpose: a conditional `use` inside a describe is a Playwright error.
test.use({
  video: process.env.RECV_PERF_VIDEO === '1' ?
    {mode: 'on', size: {width: 1920, height: 1080}} : 'off',
});

test.describe('console receiving-stage performance probe', () => {
  test.skip(!RUN, 'measurement harness — enable with RECV_PERF=1');

  for (const sc of SCENARIOS) {
    test(`measure: ${sc.name}`, async ({page, request}) => {
      test.setTimeout(600_000);
      await page.setViewportSize(sc.viewport);

      const created = await request.post('/api/creategame', {data: gameConfig(sc.deck)});
      expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
      const model = await created.json() as {players: Array<{id: string}>};
      const playerId = model.players[0].id;

      await bootstrapToAction(request, playerId);
      const missed: Array<string> = [];
      for (const card of sc.apiPlays) {
        if (!await apiPlay(request, playerId, card)) {
          missed.push(card);
        }
      }

      await openConsoleOnPlayer(page, playerId);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');

      await descendIntoPlay(page, sc.uiPlay);
      await settle(page);
      await shoot(page, `${sc.name}-1-composer`);
      const episode = await runEpisode(page, cdp, sc.uiPlay, `${sc.name}-2`);

      let second: EpisodeResult | undefined;
      if (sc.uiPlaySecond !== undefined) {
        await settle(page);
        await descendIntoPlay(page, sc.uiPlaySecond);
        await settle(page);
        second = await runEpisode(page, cdp, sc.uiPlaySecond, `${sc.name}-3-second`);
      }

      writeResult(sc.name, {
        label: LABEL, scenario: sc.name, viewport: sc.viewport,
        apiPlaysMissed: missed, episode, second,
      });

      expect(episode.sawStage, 'the receiving stage presented').toBeTruthy();
      expect(episode.sawDocked, 'the played card docked').toBeTruthy();
    });
  }
});
