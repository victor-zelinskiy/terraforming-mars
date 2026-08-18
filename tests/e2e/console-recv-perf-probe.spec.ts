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
 *   - an in-page long-task observer + a 16 ms interval-jitter sampler across
 *     the whole episode (rAF is compositor-starved headless — see
 *     [[e2e-raf-probe-dies-headless]] — so jank is judged by main-thread
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
import {expect, test, Page, APIRequestContext, CDPSession} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

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

const EMPTY_PAYMENT = {
  heat: 0, megacredits: 0, steel: 0, titanium: 0, plants: 0, microbes: 0,
  floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0,
  auroraiData: 0, graphene: 0, kuiperAsteroids: 0,
};

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
type AnyModel = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

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

type PerfWindow = {
  longTasks: number,
  longTaskMax: number,
  longTaskTotal: number,
  tickCount: number,
  tickJank50: number,
  tickJank120: number,
  tickMax: number,
};

/** Arm the page-side samplers: long tasks + a 16 ms interval jitter meter. */
async function armPerfWindow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    w.__perfStop?.();
    const rec: PerfWindow & {samples: number} = {
      longTasks: 0, longTaskMax: 0, longTaskTotal: 0,
      tickCount: 0, tickJank50: 0, tickJank120: 0, tickMax: 0, samples: 0,
    };
    w.__perfWin = rec;
    let obs: PerformanceObserver | undefined;
    try {
      obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          rec.longTasks++;
          rec.longTaskTotal += e.duration;
          rec.longTaskMax = Math.max(rec.longTaskMax, e.duration);
        }
      });
      obs.observe({entryTypes: ['longtask']});
    } catch {
      /* longtask unsupported — the jitter meter still stands */
    }
    let last = performance.now();
    const iv = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      rec.tickCount++;
      rec.tickMax = Math.max(rec.tickMax, dt);
      if (dt > 50) {
        rec.tickJank50++;
      }
      if (dt > 120) {
        rec.tickJank120++;
      }
    }, 16);
    w.__perfStop = () => {
      obs?.disconnect();
      clearInterval(iv);
    };
  });
}

async function readPerfWindow(page: Page): Promise<PerfWindow> {
  return await page.evaluate(() => {
    const w = window as any;
    w.__perfStop?.();
    return w.__perfWin;
  }) as PerfWindow;
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

/** DOM census of the scene (docked beat). */
async function sceneCensus(page: Page): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    const recv = document.querySelector('.con-recv');
    const q = (sel: string) => recv === null ? 0 : recv.querySelectorAll(sel).length;
    return {
      totalNodes: recv === null ? 0 : recv.querySelectorAll('*').length,
      pcards: q('.pcard'),
      imgs: q('img'),
      minis: q('.con-recv__mini'),
      strips: q('[data-recv-strip]'),
      docNodes: document.querySelectorAll('*').length,
    };
  });
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Headless Chromium starves rAF on a static frame — force a BeginFrame. */
async function forceFrame(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
}

async function key(page: Page, code: string, settleMs = 400): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

// ── the console UI walk (descend into the play of `card`) ──────────────────

async function openConsole(page: Page, playerId: string): Promise<void> {
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-root', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
  await page.waitForTimeout(2500);
}

async function descendIntoPlay(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 8 && await page.locator('.con-hand__frame').count() === 0; i++) {
    await key(page, 'Period', 700);
    await key(page, 'Enter', 900);
  }
  await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 10_000});
  await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 25_000}).catch(() => {});
  await page.waitForTimeout(600);
  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`).count();
  let lastSelected = '';
  let stalls = 0;
  const queue: Array<string> = [];
  for (let i = 0; i < 110 && await onTarget() === 0; i++) {
    if (queue.length > 0) {
      await key(page, queue.shift() as string, 180);
      continue;
    }
    const selected = await page.evaluate(() =>
      document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
    stalls = selected === lastSelected && i > 0 ? stalls + 1 : 0;
    if (stalls >= 2) {
      // Page edge / dead corner — rewind to the album's first slot.
      queue.push(...Array(12).fill('ArrowLeft'), ...Array(3).fill('ArrowUp'));
      stalls = 0;
    } else {
      await key(page, stalls === 1 ? 'ArrowDown' : 'ArrowRight', 220);
    }
    lastSelected = selected;
  }
  expect(await onTarget(), `hand cursor reached ${card}`).toBeGreaterThan(0);
  await key(page, 'Enter', 600);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 10_000});
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
      pick: document.querySelector('.con-hand__stage .con-pick, .con-played-cat') !== null,
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

async function runEpisode(page: Page, cdp: CDPSession, card: string, shotPrefix: string): Promise<EpisodeResult> {
  await armPerfWindow(page);
  // THE FACTS ARE RECORDED IN-PAGE (MutationObserver + a 50 ms interval), the
  // Playwright loop only owns screenshots and the episode's end — on a loaded
  // 4K frame an `evaluate` + screenshot round trip costs seconds, and a whole
  // docked beat fits inside such a hole (the landing probe's TEST_CONTOUR §5
  // lesson; this probe re-learned it on its first stress run).
  await page.evaluate((c) => {
    const w = window as any;
    w.__epRecStop?.();
    const rec = {
      samples: 0, sawStage: false, sawDocked: false,
      stageAtMs: -1, dockAtMs: -1, foldAtMs: -1, t0: performance.now(),
      census: undefined as Record<string, number> | undefined,
    };
    w.__epRec = rec;
    let last = -1;
    const read = () => {
      const now = performance.now();
      if (now - last < 16) {
        return;
      }
      last = now;
      rec.samples++;
      const stage = document.querySelector('.con-composer__playstage--up') !== null;
      const composer = document.querySelector('.con-composer--play') !== null;
      const recv = document.querySelector('.con-composer__playstage .con-recv');
      const front = recv?.querySelector('[data-recv-front]');
      const docked = (front?.getAttribute('data-played-key') ?? '') === c;
      if (stage && !rec.sawStage) {
        rec.sawStage = true;
        rec.stageAtMs = Math.round(now - rec.t0);
      }
      if (docked && !rec.sawDocked) {
        rec.sawDocked = true;
        rec.dockAtMs = Math.round(now - rec.t0);
        if (recv !== null) {
          const q = (sel: string) => recv.querySelectorAll(sel).length;
          rec.census = {
            totalNodes: recv.querySelectorAll('*').length,
            pcards: q('.pcard'),
            imgs: q('img'),
            minis: q('.con-recv__mini'),
            strips: q('[data-recv-strip]'),
            docNodes: document.querySelectorAll('*').length,
          };
        }
      }
      if (rec.sawStage && !stage && !composer && rec.foldAtMs < 0) {
        rec.foldAtMs = Math.round(now - rec.t0);
      }
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    const iv = setInterval(read, 50);
    w.__epRecStop = () => {
      mo.disconnect();
      clearInterval(iv);
    };
    setTimeout(() => w.__epRecStop?.(), 40_000);
  }, card);
  const cdpBefore = await cdpMetrics(cdp);
  const t0 = Date.now();
  await armAndSubmit(page, shotPrefix);

  type EpRec = {
    samples: number, sawStage: boolean, sawDocked: boolean,
    stageAtMs: number, dockAtMs: number, foldAtMs: number,
    census?: Record<string, number>,
  };
  let cdpDocked: CdpMetrics = {};
  let shotStage = false;
  let shotDock = false;
  let folded = false;
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const r = await page.evaluate(() => (window as any).__epRec) as EpRec;
    if (r.sawStage && !shotStage) {
      // Fired at the first STAGE observation: on a 4K frame the shot's own
      // round trip lands it mid-flight / at the dock — the one photographable
      // window of a scene whose docked beat is shorter than a 4K capture.
      shotStage = true;
      await shoot(page, `${shotPrefix}-stage`);
    }
    if (r.sawDocked && !shotDock) {
      shotDock = true;
      cdpDocked = await cdpMetrics(cdp);
      await shoot(page, `${shotPrefix}-docked`);
      if (process.env.RECV_PERF_VIDEO === '1') {
        // VISUAL mode: a clipped BURST of the shelf zone through the effect-
        // resolution window (emergence → chips → settle) — a full 4K frame
        // costs more than the docked beat lasts, the clipped half costs half.
        const vp = page.viewportSize() ?? {width: 1920, height: 1080};
        const clip = {x: 0, y: Math.round(vp.height * 0.30), width: vp.width, height: Math.round(vp.height * 0.70)};
        for (let b = 1; b <= 6; b++) {
          fs.mkdirSync(OUT, {recursive: true});
          await page.screenshot({path: path.join(OUT, `${shotPrefix}-beat${b}.png`), clip}).catch(() => {});
          await page.waitForTimeout(160);
        }
      }
    }
    if (r.foldAtMs >= 0) {
      folded = true;
      break;
    }
    // A tiny screenshot IS a BeginFrame — keep GSAP's rAF fed between reads
    // (headless Chromium starves it on a static frame), without paying for a
    // full-viewport 4K capture.
    await forceFrame(page);
    await page.waitForTimeout(120);
  }
  const recFinal = await page.evaluate(() => {
    const w = window as any;
    w.__epRecStop?.();
    return w.__epRec;
  }) as EpRec;
  const sawStage = recFinal.sawStage;
  const sawDocked = recFinal.sawDocked;
  const census = recFinal.census ?? {};
  const foldMs = folded && recFinal.foldAtMs >= 0 ? recFinal.foldAtMs : Date.now() - t0;
  expect(recFinal.samples, 'the in-page episode recorder ran').toBeGreaterThan(3);
  const perf = await readPerfWindow(page);
  const cdpAfter = await cdpMetrics(cdp);
  await shoot(page, `${shotPrefix}-after`);

  // Idle leftovers: scene nodes must be gone; the tick meter re-armed for 1.2 s
  // gives the post-fold main-thread profile (no busy timelines should remain).
  await armPerfWindow(page);
  await page.waitForTimeout(1200);
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
    timingsMs: {stageAt: recFinal.stageAtMs, dockAt: recFinal.dockAtMs, foldAt: recFinal.foldAtMs},
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

      await openConsole(page, playerId);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');

      await descendIntoPlay(page, sc.uiPlay);
      await page.waitForTimeout(900);
      await shoot(page, `${sc.name}-1-composer`);
      const episode = await runEpisode(page, cdp, sc.uiPlay, `${sc.name}-2`);

      let second: EpisodeResult | undefined;
      if (sc.uiPlaySecond !== undefined) {
        await page.waitForTimeout(1500);
        await descendIntoPlay(page, sc.uiPlaySecond);
        await page.waitForTimeout(700);
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
