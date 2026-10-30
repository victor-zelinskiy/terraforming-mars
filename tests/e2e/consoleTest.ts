/**
 * THE E2E TEST OBJECT — every spec imports `test`/`expect` from HERE, never
 * from '@playwright/test' (guarded by e2eDriverGuard § ⑤).
 *
 * WHY (docs/E2E_ARCHITECTURE_REWORK.md phase 3 — isolation & parallelism):
 * the suite used to share ONE server and ONE ./db/game.db across every worker
 * and every run — concurrent runs contaminated each other (measured), the DB
 * grew to 895 MB and polluted list-shaped specs, and the whole suite was
 * pinned to workers=1. This fixture gives each Playwright worker its OWN
 * server process on its OWN port with its OWN throwaway SQLite folder:
 *
 *   · port  = TM_E2E_PORT_BASE (default 8100) + workerIndex
 *   · db    = a fresh temp dir per worker (TM_DB_FOLDER — SQLite.ts)
 *   · baseURL (page.goto AND the `request` fixture) points at that server
 *   · process.env.TM_E2E_BASE_URL carries it to non-fixture helpers
 *     (campaignFixtures etc.) — safe because each worker is its own process.
 *
 * Contamination is now structurally impossible: nothing is shared but the
 * build. Escape hatch: TM_E2E_SHARED_SERVER=1 reuses BASE_URL (default
 * http://localhost:8080) the old way — for debugging against a dev server.
 *
 * The server binary must be BUILT (`npm run build:server` at least) — the
 * spawn runs `node build/src/server/server.js` from the repo root, exactly
 * what `npm start` runs. Its output lands in <served root>/test-results/worker-servers/
 * so a boot failure is diagnosable, not a silent 60 s timeout.
 *
 * ⚠️ SEVERAL SESSIONS SHARE ONE CLONE — and «nothing is shared but the build»
 * was exactly the hole (2026-09-30: a neighbour rebuilt the build a parliament
 * run was serving, 03:38–03:43, and ~40 reds of that run could no longer be
 * told apart from real ones). Three rules close it:
 *   · THE PORT is asked from the OS (a free ephemeral port per worker) unless
 *     TM_E2E_PORT_BASE is set — two sessions' workers no longer race for 8100+N;
 *   · THE BUILD may be a private SNAPSHOT: `npm run e2e:snapshot <name>` copies
 *     build/ to `.e2e-<name>/` and `TM_E2E_ROOT=.e2e-<name>` serves it — a
 *     neighbour's `npm run build` can no longer rewrite the product mid-run;
 *   · EVERY TEST NAMES THE BUILD IT RAN AGAINST (the `build` annotation:
 *     commit, time, root) and a build OLDER than the sources on disk is called
 *     STALE out loud — a red against a stale or foreign build is not a verdict
 *     about the code in front of you (`tests.md` § «VERIFY THE BUILD»).
 */
import {Browser, Page, test as base} from '@playwright/test';
import {ChildProcess, execSync, spawn} from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import {currentTimingBucket, formatTiming, noteTiming, resetTiming, snapshotTiming} from './timing';

export * from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
/** The tree the worker server runs from: the repo (default) or a private snapshot (`npm run e2e:snapshot`). */
const SERVE_ROOT = path.resolve(REPO_ROOT, process.env.TM_E2E_ROOT ?? '.');
const SERVER_ENTRY = path.join(SERVE_ROOT, 'build', 'src', 'server', 'server.js');

/** A port nobody holds right now — asked from the OS, so two sessions' workers never collide. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

/** Newest mtime under a source dir (genfiles excluded — the build writes those itself). */
function newestSourceMtime(dir: string, ext: RegExp): number {
  let newest = 0;
  if (!fs.existsSync(dir)) {
    return newest;
  }
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'genfiles' || entry.name === 'node_modules') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestSourceMtime(full, ext));
    } else if (ext.test(entry.name)) {
      newest = Math.max(newest, fs.statSync(full).mtimeMs);
    }
  }
  return newest;
}

/** The three artifacts a run serves and the sources each one is built from. */
const BUILD_SIDES: ReadonlyArray<{side: string, artifact: ReadonlyArray<string>, sources: ReadonlyArray<string>, ext: RegExp}> = [
  // A DIRECTORY for the server: an incremental tsc rewrites only the outputs that changed, so no one file dates it.
  {side: 'server', artifact: ['build', 'src'], sources: ['src/server', 'src/common'], ext: /\.ts$/},
  {side: 'client', artifact: ['build', 'main.js'], sources: ['src/client', 'src/common'], ext: /\.(ts|vue)$/},
  {side: 'styles', artifact: ['build', 'styles.css'], sources: ['src/styles'], ext: /\.less$/},
];

/**
 * WHAT THIS RUN IS TESTING — computed once per worker: the build's commit and
 * time (its own `genfiles/settings.json`), the served root, and STALE when a
 * source file on disk is newer than the build's server or client bundle.
 */
function buildStamp(): string {
  let head = '?';
  let builtAt = '?';
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(SERVE_ROOT, 'build', 'src', 'genfiles', 'settings.json'), 'utf8')) as {head?: string, builtAt?: string};
    head = settings.head ?? '?';
    builtAt = settings.builtAt ?? '?';
  } catch {
    // no stamp — reported as «?», the boot will say the rest
  }
  const root = path.relative(REPO_ROOT, SERVE_ROOT) || '.';
  // A side is STALE only against its OWN sources: a client-only rebuild leaves `server.js` old by design, and a
  // `min()` over both artifacts called that a stale build.
  const stale: Array<string> = [];
  for (const {side, artifact, sources, ext} of BUILD_SIDES) {
    const file = path.join(SERVE_ROOT, ...artifact);
    if (!fs.existsSync(file)) {
      stale.push(`no ${side} build`);
      continue;
    }
    const built = fs.statSync(file).isDirectory() ? newestSourceMtime(file, /\.js$/) : fs.statSync(file).mtimeMs;
    const newest = Math.max(...sources.map((dir) => newestSourceMtime(path.join(REPO_ROOT, dir), ext)));
    if (newest > built) {
      stale.push(`${side} is ${Math.round((newest - built) / 60_000)} min older than its sources`);
    }
  }
  const staleNote = stale.length === 0 ? '' : ` · ⚠️ STALE (${stale.join('; ')}) — the run tests the product as it WAS`;
  let tree = '';
  try {
    tree = ` · HEAD ${execSync('git rev-parse --short HEAD', {cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore']}).toString().trim()}`;
  } catch {
    // not a git checkout (a packaged CI artifact, or the Steam Machine's mirror — `scripts/e2e-remote.mjs`
    // hands the laptop's HEAD over in the env); the build's own head is enough otherwise
    tree = process.env.TM_E2E_HEAD ? ` · HEAD ${process.env.TM_E2E_HEAD}` : '';
  }
  // WHERE it ran: a remote run (`npm run e2e:remote`) names its host and its SLOT — `exclusive` (the box
  // to itself: a timing / storyboard claim) or `slot i/K` (beside another session's run) — so a timing
  // read off the quiet Steam Machine is never confused with one taken on the loaded laptop or beside a
  // neighbour.
  const host = process.env.TM_E2E_HOST ? ` · host ${process.env.TM_E2E_HOST}${process.env.TM_E2E_SLOT ? ` (${process.env.TM_E2E_SLOT})` : ''}` : '';
  return `build ${head} (${builtAt}) from ${root}${tree}${host}${staleNote}`;
}

type WorkerServer = {baseURL: string};

function httpOk(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2_000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url: string, child: ChildProcess, logFile: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`worker server exited with ${child.exitCode} before answering — see ${logFile}`);
    }
    if (await httpOk(url)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`worker server never answered at ${url} in ${timeoutMs} ms — see ${logFile}`);
}

/**
 * THE RAW-TEMPLATE SCAN (PL-160, the polish remediation iteration № 1).
 *
 * A reading whose `${n}` params were dropped prints its template — «Потратьте
 * ${0} отсюда: +${1}» on the owner's TV (2026-10-10). No probe of any spec
 * asks about it, because every spec reads the one thing it is about. So the
 * harness asks, after EVERY test, on every page of the test's own context:
 * is there a `${n}` / `${name}` in the rendered text (text nodes, `aria-label`,
 * `data-hint`)? A hit fails the test with the element's path and the text.
 *
 * Rendered means rendered: a node with no client rect (a `v-show`-hidden
 * section, a `display: none` branch) is skipped — a template there is still a
 * defect, but not one the player sees, and the unit guard
 * (`tests/console/readingParamsGuard.spec.ts`) owns the static half.
 */
async function rawTemplatesOn(page: Page): Promise<Array<string>> {
  if (page.isClosed()) {
    return [];
  }
  return page.evaluate(() => {
    const RAW = /\$\{(?:\d+|[A-Za-z_][A-Za-z0-9_]*)\}/;
    const out: Array<string> = [];
    const pathOf = (el: Element): string => {
      const parts: Array<string> = [];
      for (let n: Element | null = el; n !== null && parts.length < 5; n = n.parentElement) {
        const cls = Array.from(n.classList).slice(0, 2).join('.');
        parts.unshift(n.tagName.toLowerCase() + (cls === '' ? '' : `.${cls}`));
      }
      return parts.join(' > ');
    };
    const rendered = (el: Element): boolean => el.getClientRects().length > 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      const parent = node.parentElement;
      if (parent === null || !RAW.test(text) || !rendered(parent) || parent.closest('script, style, noscript') !== null) {
        continue;
      }
      out.push(`${pathOf(parent)} :: «${text.replace(/\s+/g, ' ').trim().slice(0, 120)}»`);
    }
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('[aria-label], [data-hint]'))) {
      for (const attr of ['aria-label', 'data-hint']) {
        const value = el.getAttribute(attr);
        if (value !== null && RAW.test(value) && rendered(el)) {
          out.push(`${pathOf(el)} [${attr}] :: «${value.slice(0, 120)}»`);
        }
      }
    }
    return out;
  }).catch(() => []);
}

/**
 * The «re-asked» witness's marker (`src/client/console/preselectWitness.ts` — `REASKED_PRESELECT`, one spelling): the
 * console warns it when a question the last batch already answered stands again (the pre-select law,
 * `common/inputs/preselectAddress.ts`). Never a legal state on any route.
 */
const REASKED_PRESELECT = 'RE-ASKED PRE-SELECT';
/**
 * The «post-commit choice» witness's marker (`preselectWitness.ts` — `POST_COMMIT_CHOICE`, TR51 «strictly pre-select»):
 * after a composer's commit, a choice of the committed card or of a table card that asks is raised although the
 * composer neither collected it nor handed it on with its reason.
 */
const POST_COMMIT_CHOICE = 'POST-COMMIT CHOICE';
/**
 * The «covered prompt» witness's marker (`src/client/console/consoleLeakDetector.ts` check 3): a live question's
 * surface is MOUNTED but a full-bleed scene of the same layer is painted over it — pickable, owning the pad, invisible
 * (the «Корпоративные архивы» blocker of 2026-10-18). The stranded check calls that served; this one does not.
 */
const COVERED_PROMPT = 'COVERED PROMPT';
/**
 * The START WATCHDOG's marker (`src/client/console/startServing.ts` + `ConsoleShell.startStrandedNow`, the reliability
 * iteration of 2026-10-28): the game-start scene stood serving NOTHING — no press, no panel, no hosted step, nothing
 * moving — while the server asked the player something, past the watchdog's confirm. The field's «зависший экран
 * старта, лечится перезаходом»; every spec that walks the start is its tripwire.
 */
const START_STRANDED = '[start-stranded]';
/**
 * The START SHADOW's marker (`src/client/console/startDirector.ts`, phase 0 of «правда сервера → одно состояние → один
 * владелец экрана», 2026-10-29): who the server's one question says must serve the screen disagreed, for a while, with
 * what the start's latches put there. DATA, never red — the harness files every finding under
 * `test-results/start-shadow/` and annotates the test; the migration reads the whole suite's findings.
 */
const START_SHADOW = '[start-shadow]';
/**
 * The «flight end» sentinel's marker (`src/client/console/resourceTransfer/consoleResourceTransfer.ts` — T06 «ОБА КОНЦА
 * ПОЛЁТА — ЖИВЫЕ»): a resource token was born on, or touched down over, a point where NOTHING was painted (the page, the
 * console's bare root) — a token out of nothing / into nothing. An object end can never print it (it is measured through
 * the visible-end verdict and not flown when gone); a bare point that drifted off its object does.
 */
const TRANSFER_END_NOT_PAINTED = '[transfer] end not painted';
/**
 * …and the FOLD sentinel's (T09 «ПОВЕРХНОСТЬ НЕ СКЛАДЫВАЕТСЯ ПОД СВОИМ ЖЕТОНОМ», ledger BY): a token's end stood on a band
 * surface (`.con-ws` / `.con-recv`) that LEFT while the token was still in the air — the surface folded under its own
 * token, the class `surfaceClear` makes unexpressible. Not a degrade: a law broken.
 */
const TRANSFER_SURFACE_FOLDED = '[transfer] surface folded under its token';
/**
 * …and the PAINT sentinel's (T12 / CA «ЖЕТОН НИКОГДА НЕ КРАСИТСЯ ПОД ПОВЕРХНОСТЬЮ, НА КОТОРУЮ САДИТСЯ»): a token in the LIT
 * layer was not the topmost thing painted at its centre — at its birth, on its final approach or at its touchdown
 * (the owner's «ресурс летит ПОД панель»). A token under the shade by plan (born on a covered cell) is never asked.
 */
const TRANSFER_TOKEN_UNDER = '[transfer] token painted under';
/**
 * The REACTIVITY WITNESS's marker (`src/client/components/presentation/reactivityWitness.ts`, the class behind the dead
 * board of 2026-10-30): a declared predicate that caches read — every animation-hold supplier, the prompt admission's
 * module terms — changed without a reactive edge, so every cache of it had latched until the console's tick healed it.
 * A heal that had to run is a defect at the predicate's source.
 */
const REACTIVITY_LATCH = 'changed without a reactive edge';

/**
 * THE STALL HARVEST — every product warning a test's pages print, kept (2026-10-14, the field «залипания»).
 *
 * The console names its own recoveries — a ledger story degraded, a truth witness healing a lie, a workspace torn down
 * as a ghost, a bot turn that kept the player's prompt, a hold past its ceiling — and each one is a moment the player
 * sat in front of a screen that owed them something. A green spec that printed one was green over a stall. The harvest
 * makes them visible: a `stall` annotation per test (the first lines), and with `TM_E2E_STALL_LOG=<file>` one JSON
 * line per warning across the whole run, so a sweep over the representative suites names WHICH flows stall.
 */
const STALL_MARKERS: ReadonlyArray<string> = [
  '[presentation-ledger]', '[workspace-stall]', '[console-foreground-watchdog]', '[bot-turn]', '[notifications]',
  '[animation-hold]', '[console-leak-detector]', '[deferred-refresh]', '[reactivity]',
];

/**
 * THE TV RASTER EXPERIMENT (the e2e speed iteration, phase 4 — `TM_E2E_TV_RASTER=1080`): a spec that asks
 * for the 3840×2160 viewport gets 1920×1080 instead, with its `&consoleProfile=tv` query untouched —
 * `computeTvUiScale` then answers 1 instead of 2, the TV LAYOUT is the same composition in logical px and
 * the raster is a quarter. The owner's framing (2026-10-21): the main profile is a big screen and the right
 * layout for it, not necessarily 3840×2160. Measured, then decided; off by default.
 */
const TV_RASTER = Number(process.env.TM_E2E_TV_RASTER);
function rasterViewport<T extends {width: number, height: number} | null | undefined>(v: T): T {
  if (TV_RASTER === 1080 && v && v.width === 3840 && v.height === 2160) {
    return {...v, width: 1920, height: 1080} as T;
  }
  return v;
}

/**
 * THE PAGE HARNESS — installed in EVERY context a test opens: the test's own and every `browser.newContext()` a spec
 * makes for a second seat. A second seat's context used to get neither half: the box's physical pad reached it (a
 * phantom Y opened «Информация» on red's page and its R never reached the journal — console-supercomputer (C), 3 of 4
 * at one worker, the night run of 2026-10-22), and its presses had no DOM-quiet clock.
 */
function pageHarnessScript(): void {
  // NO GAMEPAD REACHES AN E2E PAGE. The driver speaks keyboard; a REAL pad plugged into the box (the
  // owner's DualSense on the Steam Machine, 2026-10-22 03:00) is visible to headless Chromium through
  // the container's /dev/input, so the console read it — PlayStation glyphs on the bar, a resting
  // trigger opening «Действия карт» at boot, a drifting stick walking the cursor — and 16 of 48 tests
  // went red while every one of them passed alone. The Gamepad API answers «none» here, always.
  try {
    // WRITABLE: a gamepad spec installs its own virtual pad by plain ASSIGNMENT (`navigator.getGamepads = …`);
    // a defineProperty without it is read-only, the assignment fails silently, and the spec's pad never
    // exists (gamepad-first-press / gamepad-reload-carryover, red in the first full baseline).
    Object.defineProperty(navigator, 'getGamepads', {configurable: true, writable: true, value: () => []});
  } catch {
    // a locked-down navigator — the console then sees whatever it sees
  }
  const w = window as unknown as {__tmLastMutation: number};
  w.__tmLastMutation = performance.now();
  const observe = () => {
    new MutationObserver((records) => {
      // The document <title> ticks once a second on an idle board (the census, 2026-10-21) — not a witness.
      if (records.some((r) => (r.target as Element).nodeName !== 'TITLE' && (r.target.parentNode as Element | null)?.nodeName !== 'TITLE')) {
        w.__tmLastMutation = performance.now();
      }
    }).observe(document.documentElement, {subtree: true, childList: true, attributes: true, characterData: true});
  };
  if (document.documentElement) {
    observe();
  } else {
    document.addEventListener('DOMContentLoaded', observe, {once: true});
  }
}

/** The caller of a bare sleep: the first stack frame outside this harness and the driver's pass-through pause. */
function sleepSiteOf(stack: string): string {
  for (const line of stack.split('\n').slice(1)) {
    const m = /at (?:async )?(?:(\S+) \()?(.*?):(\d+):\d+\)?$/.exec(line.trim());
    if (m === null || /consoleTest\.ts$|node:internal|node_modules/.test(m[2]) || m[1] === 'pollPause') {
      continue;
    }
    return `${m[1] ?? '<anon>'} ${path.basename(m[2])}:${m[3]}`;
  }
  return '<unknown>';
}

export const test = base.extend<{buildAnnotation: void, rawTemplateGuard: void, preselectGuard: void, postCommitGuard: void, coveredPromptGuard: void, startStrandGuard: void, startShadowHarvest: void, transferEndsGuard: void, reactivityLatchGuard: void, stallHarvest: void, timingLedger: void, cpuThrottle: void}, {workerServer: WorkerServer, workerBuild: string}>({
  /**
   * CI's STARVED RENDERER ON DEMAND (`TM_E2E_CPU_THROTTLE=<rate>`, e.g. 4): every page of the test's context runs under
   * CDP CPU throttling. CI's 4K software raster on a shared runner starves the main thread for hundreds of ms — the
   * class behind nearly every «green on the box, flaky on CI» red (a wave's wall-clock stagger collapsing into one
   * frame, a tick sampled a beat late, a press swallowed by a beat still running). On the quiet box those reds are luck;
   * with the throttle they are a RATE a fix can be measured against. Off (no env) by default; a spec that sets its own
   * throttle overrides it for its page. Named in the test's annotations so a red says what it ran under.
   */
  cpuThrottle: [async ({context}, use, testInfo) => {
    const rate = Number(process.env.TM_E2E_CPU_THROTTLE ?? '');
    if (!Number.isFinite(rate) || rate <= 1) {
      await use();
      return;
    }
    testInfo.annotations.push({type: 'cpu-throttle', description: `×${rate} (TM_E2E_CPU_THROTTLE)`});
    const throttle = async (page: Page) => {
      try {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', {rate});
      } catch {
        // a page closed before its session opened — nothing to throttle
      }
    };
    await Promise.all(context.pages().map(throttle));
    context.on('page', (page) => void throttle(page));
    await use();
  }, {auto: true}],

  // `viewport` is a self-referencing option fixture; `screen` is not one (Playwright refuses the override) —
  // the raster is the viewport, `window.screen` only reports.
  viewport: async ({viewport}, use) => {
    await use(rasterViewport(viewport));
  },
  /**
   * WHERE THE SECONDS GO (the e2e speed iteration, phase 0 — `tests/e2e/timing.ts`): the driver's waits book
   * themselves; this fixture resets the ledger per test, books the spec's own bare `page.waitForTimeout`
   * sleeps on every page of the context (a sleep inside a timed primitive is the primitive's), and writes a
   * `timing` annotation + one JSON line per test into `TM_E2E_TIMINGS` for `scripts/e2e-timings-report.mjs`.
   */
  timingLedger: [async ({context, browser}, use, testInfo) => {
    resetTiming();
    // THE DOM-QUIET CLOCK for the adaptive press (`consoleStart.quietAfterPress`): `window.__tmLastMutation`
    // = the time of the last DOM mutation on the page. «The console is quiet» (no hold, no request) is not
    // «the witness has landed» — the rail's card name lands a beat after the cursor moves, a GSAP flight
    // writes a style per frame — so the press also waits for the DOM to hold still for a short window.
    await context.addInitScript(pageHarnessScript);
    // …and every OTHER context the test opens (a second seat) gets the same page harness and the same sleep book.
    const originalNewContext = browser.newContext.bind(browser);
    browser.newContext = async (options?: Parameters<Browser['newContext']>[0]) => {
      const extra = await originalNewContext(options);
      await extra.addInitScript(pageHarnessScript);
      extra.on('page', (p) => book(p));
      return extra;
    };
    // WHERE THE SLEEPS ARE (the speed iteration's sleep pass): a bare sleep is booked against its CALL SITE — the first
    // frame outside this harness and the driver's pass-through pause — so the ledger ranks helpers by the seconds they
    // spend asleep instead of a guess. Only while a ledger is written; a stack per sleep is cheap at this volume.
    const sleepSites = new Map<string, {n: number, ms: number}>();
    const book = (page: Page) => {
      const original = page.waitForTimeout.bind(page);
      page.waitForTimeout = async (ms: number) => {
        if (currentTimingBucket() === undefined) {
          noteTiming('sleep', ms);
          if (process.env.TM_E2E_TIMINGS) {
            const site = sleepSiteOf(new Error().stack ?? '');
            const s = sleepSites.get(site) ?? {n: 0, ms: 0};
            sleepSites.set(site, {n: s.n + 1, ms: s.ms + ms});
          }
        }
        await original(ms);
      };
    };
    context.pages().forEach(book);
    context.on('page', book);
    try {
      await use();
    } finally {
      browser.newContext = originalNewContext;
    }
    const snap = snapshotTiming();
    testInfo.annotations.push({type: 'timing', description: formatTiming(snap)});
    const file = process.env.TM_E2E_TIMINGS;
    if (file) {
      try {
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.appendFileSync(file, JSON.stringify({
          file: path.relative(REPO_ROOT, testInfo.file).replace(/\\/g, '/'),
          title: testInfo.titlePath.slice(1).join(' › '),
          status: testInfo.status,
          host: process.env.TM_E2E_HOST ?? 'laptop',
          slot: process.env.TM_E2E_SLOT ?? '',
          workers: testInfo.config.workers,
          totalMs: snap.totalMs,
          restMs: snap.restMs,
          buckets: snap.buckets,
          sleepSites: [...sleepSites.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 8)
            .map(([site, s]) => ({site, n: s.n, ms: s.ms})),
        }) + '\n');
      } catch {
        // a ledger that cannot be written never fails a test
      }
    }
  }, {auto: true}],
  /**
   * EVERY TEST, EVERY PAGE OF ITS CONTEXT: both ends of every resource flight are painted (T06 — the owner's law «оба
   * конца полёта живые») and the token is painted ON TOP of what it lands on (T12 / CA). The console reports a token
   * born on / touched down over nothing, or painted under a surface; the harness turns it red, so every spec that flies
   * a token is a witness of the law.
   */
  transferEndsGuard: [async ({context}, use) => {
    const unpainted: Array<string> = [];
    const watch = (page: Page) => {
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes(TRANSFER_END_NOT_PAINTED) || text.includes(TRANSFER_SURFACE_FOLDED) || text.includes(TRANSFER_TOKEN_UNDER)) {
          unpainted.push(text.slice(0, 300));
        }
      });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use();
    if (unpainted.length > 0) {
      throw new Error(`${TRANSFER_END_NOT_PAINTED} / ${TRANSFER_SURFACE_FOLDED} / ${TRANSFER_TOKEN_UNDER} — a resource token was born on / landed over nothing, its surface folded under it, or it was painted under a surface (the laws of live flight ends, of the fold and of the paint):\n  ${unpainted.join('\n  ')}`);
    }
  }, {auto: true}],

  /**
   * EVERY TEST, EVERY PAGE: no declared predicate latched (`[reactivity] «label» changed without a reactive edge`). The
   * console heals the latch within a tick and names it; the harness turns the name red, because the heal hid a plain
   * `let` / array / Map term that left a placement grid, a prompt or a hold cached for up to a second — or, outside
   * the witness, for good.
   */
  reactivityLatchGuard: [async ({context}, use) => {
    const latches: Array<string> = [];
    const watch = (page: Page) => {
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes(REACTIVITY_LATCH)) {
          latches.push(text.slice(0, 400));
        }
      });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use();
    if (latches.length > 0) {
      throw new Error(`REACTIVITY LATCH — a predicate that caches read changed without a reactive edge (make its term reactive at the source):\n  ${latches.join('\n  ')}`);
    }
  }, {auto: true}],

  stallHarvest: [async ({context}, use, testInfo) => {
    const t0 = Date.now();
    const seen: Array<{at: number, text: string}> = [];
    const watch = (page: Page) => {
      page.on('console', (message) => {
        if (message.type() !== 'warning' && message.type() !== 'error') {
          return;
        }
        const text = message.text();
        if (STALL_MARKERS.some((marker) => text.includes(marker))) {
          seen.push({at: Date.now() - t0, text: text.slice(0, 600)});
        }
      });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use();
    if (seen.length === 0) {
      return;
    }
    testInfo.annotations.push({type: 'stall', description: seen.slice(0, 6).map((s) => `+${s.at}ms ${s.text.slice(0, 220)}`).join(' ‖ ')});
    const file = process.env.TM_E2E_STALL_LOG;
    if (file !== undefined && file !== '') {
      const title = `${path.basename(testInfo.file)} › ${testInfo.titlePath.slice(1).join(' › ')}`;
      fs.appendFileSync(file, seen.map((s) => JSON.stringify({test: title, at: s.at, text: s.text})).join('\n') + '\n');
    }
  }, {auto: true}],

  /**
   * EVERY TEST, EVERY PAGE OF ITS CONTEXT: no question the player already answered in a composer is asked again. The
   * stranded-prompt witness could never see this class — a re-asked prompt IS served (the hand screen serves a
   * discard) — so the console reports it itself and the harness turns the report red (Sponsored Academies' discard,
   * the owner's report of 2026-10-11).
   */
  preselectGuard: [async ({context}, use) => {
    const reasked: Array<string> = [];
    const watch = (page: Page) => {
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes(REASKED_PRESELECT)) {
          reasked.push(text.slice(0, 300));
        }
      });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use();
    if (reasked.length > 0) {
      throw new Error(`RE-ASKED PRE-SELECT — a question the batch already answered was asked again (the pre-select law):\n  ${reasked.join('\n  ')}`);
    }
  }, {auto: true}],

  /**
   * EVERY TEST, EVERY PAGE OF ITS CONTEXT: no choice whose answer was known before the press is asked after it (TR51 —
   * «strictly pre-select», the owner's decision 2026-10-12). The composer collects its card's questions AND its own
   * table's (Olympus Conference, Mars University, Pharmacy Union…); what it hands on, it names (a pick over hidden
   * cards, a question that depends on an answer above it). The console reports the rest itself.
   */
  postCommitGuard: [async ({context}, use) => {
    const late: Array<string> = [];
    const watch = (page: Page) => {
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes(POST_COMMIT_CHOICE)) {
          late.push(text.slice(0, 300));
        }
      });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use();
    if (late.length > 0) {
      throw new Error(`POST-COMMIT CHOICE — a choice whose answer was known before the press was asked after it (strictly pre-select):\n  ${late.join('\n  ')}`);
    }
  }, {auto: true}],

  /**
   * EVERY TEST, EVERY PAGE OF ITS CONTEXT: no live question stands UNDER a full-bleed scene. A covered surface is
   * mounted and owns the pad, so nothing else in the harness can see it — the console's leak detector reports it
   * (stacking order, debounced past a hand-off frame) and the harness turns the report red.
   */
  coveredPromptGuard: [async ({context}, use) => {
    const covered: Array<string> = [];
    const watch = (page: Page) => {
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes(COVERED_PROMPT)) {
          covered.push(text.slice(0, 300));
        }
      });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use();
    if (covered.length > 0) {
      throw new Error(`COVERED PROMPT — a live question's surface was mounted under a full-bleed scene (pickable, invisible):\n  ${covered.join('\n  ')}`);
    }
  }, {auto: true}],

  /**
   * EVERY TEST, EVERY PAGE OF ITS CONTEXT: the game-start scene never stood EMPTY over a live question. The console's
   * start watchdog names such a strand (`[start-stranded]` — with the prompt, the admission block and the scene's own
   * stage machine) and heals it; the harness turns the report red, because a heal that had to run is a defect upstream
   * of it.
   */
  startStrandGuard: [async ({context}, use) => {
    const strands: Array<string> = [];
    const watch = (page: Page) => {
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes(START_STRANDED)) {
          strands.push(text.slice(0, 1200));
        }
      });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use();
    if (strands.length > 0) {
      throw new Error(`START STRANDED — the game-start scene stood serving nothing while the server asked:\n  ${strands.join('\n  ')}`);
    }
  }, {auto: true}],

  /**
   * EVERY TEST: the START SHADOW's findings (`[start-shadow]`) are FILED, never failed — one JSON per test under
   * `<outputDir>/start-shadow/` (pulled back from the box with `test-results/`) and a `start-shadow` annotation.
   */
  startShadowHarvest: [async ({context}, use, testInfo) => {
    const lines: Array<string> = [];
    const watch = (page: Page) => {
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes(START_SHADOW)) {
          lines.push(text.slice(0, 4000));
        }
      });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use();
    if (lines.length === 0) {
      return;
    }
    testInfo.annotations.push({type: 'start-shadow', description: `${lines.length} finding(s): ${lines.map((l) => l.split(' — ')[1]?.split(' {')[0] ?? l).join(' · ').slice(0, 600)}`});
    const dir = path.join(testInfo.project.outputDir, 'start-shadow');
    fs.mkdirSync(dir, {recursive: true});
    const slug = `${path.basename(testInfo.file, '.spec.ts')}--${testInfo.title}`.replace(/[^w.-]+/g, '-').slice(0, 150);
    fs.writeFileSync(path.join(dir, `${slug}-r${testInfo.retry}.json`), JSON.stringify({file: path.basename(testInfo.file), title: testInfo.title, retry: testInfo.retry, findings: lines}, null, 1));
  }, {auto: true}],

  /**
   * After every test: no `${n}` in the rendered text of any page of the test's
   * context (a second client opened on its own context scans itself — a spec
   * that opens one may call `rawTemplatesOn` on it).
   */
  rawTemplateGuard: [async ({context}, use) => {
    await use();
    const hits: Array<string> = [];
    for (const page of context.pages()) {
      hits.push(...await rawTemplatesOn(page));
    }
    if (hits.length > 0) {
      throw new Error(`RAW TEMPLATE on screen (PL-160 — a reading printed without its params):\n  ${hits.join('\n  ')}`);
    }
  }, {auto: true}],

  // eslint-disable-next-line no-empty-pattern -- Playwright's fixture signature
  workerBuild: [async ({}, use) => {
    await use(process.env.TM_E2E_SHARED_SERVER === '1' ? `shared server ${process.env.BASE_URL ?? 'http://localhost:8080'} (build unknown)` : buildStamp());
  }, {scope: 'worker'}],

  /** Every test names the build it ran against — the first thing to read on a red (`tests.md` § VERIFY THE BUILD). */
  buildAnnotation: [async ({workerBuild}, use, testInfo) => {
    testInfo.annotations.push({type: 'build', description: workerBuild});
    await use();
  }, {auto: true}],

  // eslint-disable-next-line no-empty-pattern -- Playwright's fixture signature
  workerServer: [async ({}, use, workerInfo) => {
    if (process.env.TM_E2E_SHARED_SERVER === '1') {
      const baseURL = process.env.BASE_URL ?? 'http://localhost:8080';
      process.env.TM_E2E_BASE_URL = baseURL;
      await use({baseURL});
      return;
    }
    const port = process.env.TM_E2E_PORT_BASE !== undefined ?
      Number(process.env.TM_E2E_PORT_BASE) + workerInfo.workerIndex :
      await freePort();
    const baseURL = `http://localhost:${port}`;
    const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), `tm-e2e-w${workerInfo.workerIndex}-`));
    // Beside the SERVED build: two sessions on one clone each run a worker 0, and one shared folder had them
    // appending into the same worker-0.log (a private snapshot keeps its own; the default root is unchanged).
    const logDir = path.join(SERVE_ROOT, 'test-results', 'worker-servers');
    fs.mkdirSync(logDir, {recursive: true});
    const logFile = path.join(logDir, `worker-${workerInfo.workerIndex}.log`);
    const log = fs.openSync(logFile, 'a');
    if (!fs.existsSync(SERVER_ENTRY)) {
      throw new Error(`no built server at ${SERVER_ENTRY} — run \`npm run build\` (and \`npm run e2e:snapshot <name>\` for a private copy)`);
    }
    fs.appendFileSync(logFile, `\n[e2e worker ${workerInfo.workerIndex}] ${buildStamp()} · port ${port}\n`);
    const child = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: SERVE_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        TM_DB_FOLDER: dbDir,
        // The worker server is private to this run — never announce it on the
        // LAN or take part in discovery side-effects.
        TM_E2E_WORKER: String(workerInfo.workerIndex),
      },
      stdio: ['ignore', log, log],
    });
    try {
      await waitForServer(baseURL + '/', child, logFile, 90_000);
      process.env.TM_E2E_BASE_URL = baseURL;
      await use({baseURL});
    } finally {
      fs.closeSync(log);
      child.kill();
      // The DB dir is throwaway by design; removal is best-effort (Windows can
      // hold the file an instant past the kill).
      try {
        fs.rmSync(dbDir, {recursive: true, force: true, maxRetries: 3});
      } catch {
        // leave the temp dir to the OS
      }
    }
  }, {scope: 'worker',
    // Playwright's DEFAULT fixture-setup timeout is 30 s — under load Windows
    // boots the next node slower than that and the run reports a phantom
    // «test failure» at consoleTest.ts:69. The spawn's own 90 s wait is the
    // real budget; give the fixture headroom above it.
    timeout: 120_000}],

  baseURL: async ({workerServer}, use) => {
    await use(workerServer.baseURL);
  },
});
