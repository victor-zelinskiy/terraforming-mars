import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  cinematicBeat, createGameWithCards, openConsole, placeTile, press, seedGameOverApi, soloGameConfig,
  takeRevealCards,
} from './consoleStart';

/**
 * THE FIRST-ACTION STAGE — lifecycle witness.
 *
 * The console opens straight onto the live `corporationInitialAction` prompt
 * (the RESTORE shape: a reload / a re-entry produces exactly this), the probe
 * is armed BEFORE the page's first script runs, and the whole stage is then
 * driven to the deployment's release: the corporation rises into its seat,
 * A performs the action, its follow-ups (a city placement on the board, a
 * draw's embedded reveal) are answered, a SECOND owed corporation (Merger)
 * takes the seat, and the workspace finally releases to the board.
 *
 * Recorded at ~50 ms from the first script: the scene's own diagnostic
 * (`__conStartDiag` — the stage machine, the seat, the entry predicate broken
 * into its terms) beside the DOM facts a player can see (the briefing panel,
 * the seated card, the flying start proxies, the shelf faces, the crumb). The
 * timeline (runs of identical states collapsed) is printed, and these are
 * measured:
 *   · how many times EACH corporation rose into the seat (one per activation
 *     is the contract — a second rise with no new input is the reported loop);
 *   · frames with TWO start proxies in the air (a duplicate settle/emerge);
 *   · frames where the briefing stands over an EMPTY seat;
 *   · runs where the stage STANDS but paints no briefing (the reported hang);
 *   · the tempo: A press → next actionable state / release.
 */

/** Recordings + timelines; `PROBE_OUT=<suffix>` files a BEFORE/AFTER run apart. */
const OUT_DIR = path.resolve('screenshots', `firstact-lifecycle${process.env.PROBE_OUT !== undefined ? `-${process.env.PROBE_OUT}` : ''}`);

/** Tharsis Republic alone — a placement first action (the board excursion). */
const SINGLE = soloGameConfig({
  players: [{name: 'FirstActLifecycle', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  startingCorporations: 1,
  customCorporationsList: ['Tharsis Republic'],
  expansions: {corpera: true, prelude: true},
  customPreludes: ['Donation', 'Loan', 'Martian Industries', 'Metals Company'],
  startingPreludes: 4,
});

/**
 * TWO owed corporations through the MERGER prelude (promo): the wizard deals
 * the first name, Merger draws the next four off the top and the API seed
 * takes the first offered — so `order[0]` is the base corporation and
 * `order[1]` the merged one. Tharsis = a city placement (board excursion),
 * Inventrix = draw 3 (an embedded reveal inside the stage).
 */
function twoCorpConfig(order: [string, string]): Record<string, unknown> {
  return soloGameConfig({
    players: [{name: 'FirstActMerger', color: 'red', beginner: false, handicap: 0, first: true}],
    seed: 0.42,
    startingCorporations: 1,
    // `customCorporationsList` puts these ON TOP of the deck. NOT test mode:
    // test mode deals nine corporations to the wizard, which eats the whole
    // list before Merger draws — a plain game deals ONE (the base corp) and
    // Merger then draws the next four, led by the merged corp, which the API
    // seed picks by name (`first`). Money is the real economy (Tharsis 40 /
    // Inventrix 45 M€ → the 42 M€ merger fee and a 2-card buy are affordable).
    testMode: false,
    customCorporationsList: [order[0], order[1], 'CrediCor', 'Helion', 'Ecoline'],
    expansions: {corpera: true, prelude: true, promo: true},
    customPreludes: ['Merger', 'Loan', 'Donation', 'Metals Company'],
    startingPreludes: 4,
  });
}

type Sample = {
  t: number,
  diag: unknown,
  ready: unknown,
  panel: boolean,
  panelReady: boolean,
  seatUp: boolean,
  seatHeld: boolean,
  proxies: number,
  heroPr: number,
  shelf: string,
  startPainted: boolean,
  startMounted: boolean,
  crumb: string,
  placing: boolean,
  reveal: boolean,
  queueOp: string,
};

type Diag = {
  mode?: string,
  firstAct?: {stage: string, corp: string | null, submitting: boolean, panelShown: boolean, seatMissing: boolean,
    entryDue: boolean, owedNow: boolean, corpNow: string | null, actionableNow: boolean},
  seat?: {shown: string | null, incoming: string | null, presenting: boolean, active: boolean},
  blockers?: Record<string, unknown>,
};

type Ready = {holds: Array<string>, transport?: {waitingForType?: string, requestInProgress: boolean, holding: boolean, gameAge: number}};

const PROBE_SCRIPT = `(() => {
  const w = window;
  const samples = [];
  // IN-PAGE MARKS for a \`--trace on\` run (the trace keeps page console
  // messages with timestamps beside its screencast frames).
  let lastMark = '';
  const mark = (what) => {
    if (what !== lastMark) {
      lastMark = what;
      console.log('[probe-mark] ' + what + ' t=' + Math.round(performance.now()));
    }
  };
  const sample = () => {
    const seat = document.querySelector('.con-start__embedsource-card');
    const diagNow = typeof w.__conStartDiag === 'function' ? w.__conStartDiag() : undefined;
    const fa = diagNow && diagNow.firstAct ? diagNow.firstAct : undefined;
    mark('stage=' + (fa ? fa.stage : '?') + ' corp=' + (fa && fa.corp ? fa.corp : '-') +
      ' seat=' + (seat !== null ? (seat.classList.contains('con-deal-hold') ? 'held' : 'up') : '-') +
      ' proxies=' + document.querySelectorAll('.con-startdock-proxy').length);
    const start = document.querySelector('.con-start');
    const queue = document.querySelector('.con-start__queue');
    const panel = document.querySelector('.con-start__firstact');
    samples.push({
      t: Math.round(performance.now()),
      diag: typeof w.__conStartDiag === 'function' ? w.__conStartDiag() : undefined,
      ready: typeof w.__conReady === 'function' ? w.__conReady() : undefined,
      panel: panel !== null,
      panelReady: panel !== null && panel.classList.contains('con-start__firstact--ready'),
      seatUp: seat !== null,
      seatHeld: seat !== null && seat.classList.contains('con-deal-hold'),
      proxies: document.querySelectorAll('.con-startdock-proxy').length,
      heroPr: document.querySelectorAll('.con-played-hero__proxy').length,
      shelf: Array.from(document.querySelectorAll('.con-start__played [data-played-key]'))
        .map((el) => (el.getAttribute('data-played-key') || '') + (el.querySelector('.con-splayed__face') !== null ? '' : '(-)')).join(','),
      startPainted: start !== null && start.checkVisibility({opacityProperty: true, visibilityProperty: true}),
      startMounted: start !== null,
      crumb: ((document.querySelector('.con-wshead') || {}).textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
      placing: document.querySelector('.con-context__task-kicker') !== null,
      reveal: document.querySelector('.con-reveal') !== null,
      queueOp: queue === null ? '-' : Number(getComputedStyle(queue).opacity).toFixed(2),
    });
  };
  const start = () => {
    sample();
    setInterval(sample, 50);
    new MutationObserver(sample).observe(document.documentElement, {subtree: true, childList: true, attributes: true});
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  w.__fl = {samples};
})();`;

async function takeSamples(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => {
    const w = window as unknown as {__fl?: {samples: Array<Sample>}};
    return w.__fl?.samples ?? [];
  });
}

function stateKey(s: Sample): string {
  const d = s.diag as Diag | undefined;
  const r = s.ready as Ready | undefined;
  const fa = d?.firstAct;
  const blockers = d?.blockers === undefined ? '' :
    Object.entries(d.blockers).filter(([, v]) => v === true || (Array.isArray(v) && v.length > 0) || (typeof v === 'number' && v > 0))
      .map(([k, v]) => (Array.isArray(v) ? `${k}=${v.join('+')}` : (typeof v === 'number' ? `${k}=${v}` : k))).join(',');
  return `stage=${fa?.stage ?? '?'} corp=${fa?.corp ?? '-'} sub=${fa?.submitting ? 1 : 0} panel=${s.panel ? (s.panelReady ? 'R' : 1) : 0}/${fa?.panelShown ? 1 : 0} ` +
    `seat=${s.seatUp ? (s.seatHeld ? 'held' : 'up') : '-'}(${d?.seat?.shown ?? '-'}/${d?.seat?.incoming ?? '-'}) act=${d?.seat?.active ? 1 : 0}/${d?.seat?.presenting ? 1 : 0} missing=${fa?.seatMissing ? 1 : 0} ` +
    `owed=${fa?.owedNow ? 1 : 0} now=${fa?.corpNow ?? '-'} prx=${s.proxies}/${s.heroPr} shelf=[${s.shelf}] painted=${s.startPainted ? 1 : 0}/${s.startMounted ? 1 : 0} ` +
    `queueOp=${s.queueOp} placing=${s.placing ? 1 : 0} reveal=${s.reveal ? 1 : 0} wf=${r?.transport?.waitingForType ?? ''} holds=${(r?.holds ?? []).join('|')} ` +
    `blockers=[${blockers}] crumb=${s.crumb}`;
}

function printTimeline(tag: string, samples: ReadonlyArray<Sample>): void {
  const t0 = samples[0]?.t ?? 0;
  let prev = '';
  let runStart = 0;
  for (const s of samples) {
    const key = stateKey(s);
    if (key !== prev) {
      if (prev !== '') {
        console.log(`[${tag}] ${String(runStart).padStart(6)}–${String(s.t - t0).padStart(6)} ${prev}`);
      }
      prev = key;
      runStart = s.t - t0;
    }
  }
  if (prev !== '') {
    console.log(`[${tag}] ${String(runStart).padStart(6)}–${String((samples[samples.length - 1]?.t ?? t0) - t0).padStart(6)} ${prev}`);
  }
}

type Metrics = {
  seatEpisodes: Array<{corp: string, from: number, to: number, flew: boolean}>,
  risesPerCorp: Record<string, number>,
  doubleProxyFrames: number,
  panelOverEmptySeat: number,
  standingNoPanelRuns: Array<{from: number, to: number}>,
  queueVisibleWhileStageOwnsRoom: number,
  /** A seat that was CLEARED (shown → nothing) while the stage stood (not leaving). */
  seatClearedWhileStanding: Array<{t: number, corp: string}>,
};

function analyse(samples: ReadonlyArray<Sample>): Metrics {
  const t0 = samples[0]?.t ?? 0;
  const episodes: Metrics['seatEpisodes'] = [];
  let cur: {corp: string, from: number, flew: boolean} | undefined;
  const risesPerCorp: Record<string, number> = {};
  let doubleProxyFrames = 0;
  let panelOverEmptySeat = 0;
  let queueVisibleWhileStageOwnsRoom = 0;
  const seatClearedWhileStanding: Metrics['seatClearedWhileStanding'] = [];
  const standingNoPanelRuns: Metrics['standingNoPanelRuns'] = [];
  let noPanelSince: number | undefined;
  let prevSeat: string | undefined;
  for (const s of samples) {
    const d = s.diag as Diag | undefined;
    const t = s.t - t0;
    const seatCard = d?.seat?.shown ?? d?.seat?.incoming ?? undefined;
    if (seatCard !== undefined && (cur === undefined || cur.corp !== seatCard)) {
      if (cur !== undefined) {
        episodes.push({...cur, to: t});
      }
      cur = {corp: seatCard, from: t, flew: false};
      risesPerCorp[seatCard] = (risesPerCorp[seatCard] ?? 0) + 1;
    }
    if (seatCard === undefined && cur !== undefined) {
      episodes.push({...cur, to: t});
      if (d?.firstAct?.stage === 'standing' && prevSeat !== undefined) {
        seatClearedWhileStanding.push({t, corp: prevSeat});
      }
      cur = undefined;
    }
    if (cur !== undefined && s.proxies > 0 && s.seatHeld) {
      cur.flew = true;
    }
    if (s.proxies >= 2) {
      doubleProxyFrames++;
    }
    if (s.panel && !s.seatUp) {
      panelOverEmptySeat++;
    }
    const stage = d?.firstAct?.stage;
    if ((stage === 'standing') && !s.panel && s.startPainted) {
      if (noPanelSince === undefined) {
        noPanelSince = t;
      }
    } else if (noPanelSince !== undefined) {
      if (t - noPanelSince > 400) {
        standingNoPanelRuns.push({from: noPanelSince, to: t});
      }
      noPanelSince = undefined;
    }
    if ((stage === 'staging' || stage === 'standing') && !d?.seat?.presenting && s.queueOp !== '-' && Number(s.queueOp) > 0.5 && s.panel) {
      queueVisibleWhileStageOwnsRoom++;
    }
    prevSeat = seatCard ?? prevSeat;
  }
  if (cur !== undefined) {
    episodes.push({...cur, to: (samples[samples.length - 1]?.t ?? t0) - t0});
  }
  return {seatEpisodes: episodes, risesPerCorp, doubleProxyFrames, panelOverEmptySeat, standingNoPanelRuns, queueVisibleWhileStageOwnsRoom, seatClearedWhileStanding};
}

/**
 * Drive whatever the stage asks for, until the start workspace releases:
 * A on a READY briefing, the two-phase placement on a board excursion, the
 * takes of an embedded reveal. Every wait is a short named beat — the recorder
 * (in-page) sees every frame regardless of this loop's cadence.
 */
async function driveToRelease(page: Page, tag: string, maxMs: number): Promise<Array<{t: number, what: string}>> {
  const log: Array<{t: number, what: string}> = [];
  const started = Date.now();
  let idle = 0;
  while (Date.now() - started < maxMs) {
    // GONE = unmounted. A scene that YIELDED to a board placement is merely
    // hidden (`startSceneGone` reads visibility and would end the drive at the
    // very moment the placement asks for the board).
    if (await page.locator('.con-start').count() === 0) {
      log.push({t: Date.now() - started, what: 'start gone'});
      break;
    }
    if (await page.locator('.con-context__task-kicker').count() > 0) {
      log.push({t: Date.now() - started, what: 'placement → placeTile'});
      await placeTile(page);
      idle = 0;
      continue;
    }
    if (await page.locator('.con-reveal').count() > 0) {
      log.push({t: Date.now() - started, what: 'reveal → take'});
      await takeRevealCards(page, 6);
      idle = 0;
      continue;
    }
    if (await page.locator('.con-start__firstact--ready').count() > 0) {
      const corp = await page.evaluate(() => {
        const w = window as unknown as {__conStartDiag?: () => Diag};
        return w.__conStartDiag?.()?.firstAct?.corp ?? '?';
      });
      log.push({t: Date.now() - started, what: `A → perform (${corp})`});
      await press(page, 'Enter', 400);
      idle = 0;
      continue;
    }
    idle++;
    await cinematicBeat(page, 250, `${tag}: waiting for the stage to ask for something (the recorder samples through it)`);
    if (idle > 200) {
      break;
    }
  }
  return log;
}

async function bootOntoFirstAction(page: Page, request: APIRequestContext, config: Record<string, unknown>, corporation: string, preludes: ReadonlyArray<string>, first?: string): Promise<string> {
  // The custom list is shuffled AMONG ITSELF, so a one-corp deal offers a
  // random member of it: re-create (seed-stepping) until the wizard offers the
  // base corporation the scenario names — the rest of the list is then what
  // Merger draws.
  const playerId = await createGameWithCards(request, [corporation], {config});
  await seedGameOverApi(request, playerId, {corporation, preludes, buy: 2, until: 'startRelease', first});
  await page.addInitScript(PROBE_SCRIPT);
  await openConsole(page, playerId);
  return playerId;
}

async function finishAndReport(page: Page, tag: string, drive: ReadonlyArray<{t: number, what: string}>): Promise<Metrics> {
  await cinematicBeat(page, 1500, 'the release tail — the recorder samples through it');
  const samples = await takeSamples(page);
  printTimeline(tag, samples);
  for (const d of drive) {
    console.log(`[${tag}] drive ${String(d.t).padStart(6)} ${d.what}`);
  }
  const m = analyse(samples);
  console.log(`[${tag}] rises=${JSON.stringify(m.risesPerCorp)} episodes=${m.seatEpisodes.map((e) => `${e.corp}:${e.from}–${e.to}${e.flew ? '✈' : '⚡'}`).join(' ')} ` +
    `doubleProxy=${m.doubleProxyFrames} panelOverEmptySeat=${m.panelOverEmptySeat} standingNoPanel=${JSON.stringify(m.standingNoPanelRuns)} ` +
    `queueVisibleUnderStage=${m.queueVisibleWhileStageOwnsRoom} seatCleared=${JSON.stringify(m.seatClearedWhileStanding)}`);
  fs.mkdirSync(OUT_DIR, {recursive: true});
  fs.writeFileSync(path.join(OUT_DIR, `${tag}.json`), JSON.stringify({metrics: m, drive, samples}, null, 1));
  await page.screenshot({path: path.join(OUT_DIR, `${tag}-final.png`)});
  const video = page.video();
  await page.close();
  if (video !== null) {
    await video.saveAs(path.join(OUT_DIR, `${tag}.webm`));
  }
  return m;
}

test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, video: {mode: 'on', size: {width: 1920, height: 1080}}});

test.describe('first-action stage · lifecycle probe', () => {
  test('single corp (Tharsis): restore entry → A → placement excursion → return → release', async ({page, request}) => {
    test.setTimeout(300_000);
    page.on('console', (m) => {
      const text = m.text();
      if (text.includes('[start-') || text.includes('[console-leak-detector]') || text.includes('[workspace') || text.includes('[presentation')) {
        console.log(`PAGE: ${text}`);
      }
    });
    await bootOntoFirstAction(page, request, SINGLE, 'Tharsis Republic', ['Donation', 'Loan']);
    const drive = await driveToRelease(page, 'fa-single', 90_000);
    const m = await finishAndReport(page, 'fa-single', drive);
    expect(m.standingNoPanelRuns, 'the stage never stood without its briefing').toEqual([]);
    expect(m.risesPerCorp['Tharsis Republic'] ?? 0, 'the corporation rose into its seat exactly once').toBe(1);
    expect(drive.some((d) => d.what === 'start gone'), 'the deployment released to the board').toBeTruthy();
  });

  for (const order of [['Tharsis Republic', 'Inventrix'], ['Inventrix', 'Tharsis Republic']] as const) {
    const tag = `fa-merger-${order[0].split(' ')[0]}-${order[1].split(' ')[0]}`;
    test(`two corps via Merger (${order[0]} → ${order[1]}): one rise per activation, no duplicate, no hang`, async ({page, request}) => {
      test.setTimeout(360_000);
      page.on('console', (m) => {
        const text = m.text();
        if (text.includes('[start-') || text.includes('[console-leak-detector]') || text.includes('[workspace') || text.includes('[presentation')) {
          console.log(`PAGE: ${text}`);
        }
      });
      await bootOntoFirstAction(page, request, twoCorpConfig([order[0], order[1]]), order[0], ['Merger', 'Loan'], order[1]);
      const drive = await driveToRelease(page, tag, 150_000);
      const m = await finishAndReport(page, tag, drive);
      expect(m.standingNoPanelRuns, 'the stage never stood without its briefing').toEqual([]);
      expect(m.doubleProxyFrames, 'never two start proxies in the air at once').toBe(0);
      expect(m.seatClearedWhileStanding, 'a standing stage never lost its seated card').toEqual([]);
      for (const corp of order) {
        expect(m.risesPerCorp[corp] ?? 0, `${corp} rose into its seat exactly once`).toBe(1);
      }
      expect(drive.some((d) => d.what === 'start gone'), 'the deployment released to the board').toBeTruthy();
    });
  }
});
