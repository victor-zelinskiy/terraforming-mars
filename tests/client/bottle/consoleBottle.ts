/*
 * THE CONSOLE IN A BOTTLE — the harness (FREEZE ZERO · B3, the spike; `docs/claude/console/freeze-zero/PLAN.md` § 3.4).
 *
 * `bootBottle(table, options)` stands the REAL application against the REAL game server in one process on ONE manual
 * clock, and hands back what a replay (B4) and a model-based search (B5) are made of:
 *
 *     press(key)      the pad's one funnel — a `keydown` + `keyup` on `window`, through the console key bridge
 *     advance(ms)     the world moves: the page's and the server's timers, frames, GSAP, every microtask between
 *     view()          the view the page APPLIED            journal()   every record the page's interceptor made
 *     frames()        the workspace stack                  liveness()  the bottle's judgement of «can the player act»
 *     reload()        the page closed and opened again     digest()    what two equal runs must agree on
 *
 * ── WHAT IS REAL ─────────────────────────────────────────────────────────────────────────────────────────────────
 *  · THE APPLICATION, as `main.ts` builds it: `createVaporApp(App).mount()` — no `@vue/test-utils`, no stub, no
 *    shallow mount. `App.vue` resolves the route, fetches the view, and mounts `ConsoleShell` with every child the
 *    product mounts (the shell's 34 controllers, the workspace stack, the prompt router / admission, the supervisor's
 *    1 Hz tick with the liveness arbiter, the leak detector and the wait graph, `ConsoleBoardBinder` and the transport
 *    it starts, `GamepadLayer` and the key bridge it installs, the notification / diagnostics layers).
 *  · THE SERVER: `Game` + the routes behind `processRequest` (`server/bottleServerHost.ts`), a table from the engine's
 *    own start or an e2e fixture through `Game.deserialize`.
 *  · THE DIAGNOSTICS: the product's `DiagJournal` fed by the product's record path (`causeOf` — class and tier).
 * ── WHAT IS NOT ──────────────────────────────────────────────────────────────────────────────────────────────────
 *  · TIME — one manual clock under the kernel, the global timers, `Date`, `performance.now`, GSAP (`bottleTime.ts`).
 *  · THE WIRE — `fetch` / `XMLHttpRequest` answered by the server in-process (`bottleNet.ts`); no WebSocket
 *    (`?realtime=0`: the poll is the update signal, as on a host whose socket is down).
 *  · THE PAGE — jsdom: NO LAYOUT (every rect 0×0), no paint, no stylesheet (the LESS bundle is not loaded — a CSS
 *    animation / transition never starts and never ends), no image load, no translations (the English keys are
 *    printed). A Web Animation is a stand-in on the bottle's clock. `bottleDom.ts` lists every stand-in with the
 *    evidence that asked for it; `LAYOUT_BLIND` below lists the defect classes that are this border's, not the game's.
 *  · THE BOOT — `?fastboot=1` (the functional e2e class's own flag: no GPU warm-up, no curtain minima).
 *
 * ── A PRISTINE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────
 * The client is built on MODULE state, and the unit bundle shares one module graph among all its specs. A second
 * application mounted over the first one's module state is not a page that was loaded: measured, the second bottle of
 * a process printed `[reactivity] «hand-reveal-episode» changed without a reactive edge` on presses the first took
 * clean. So a bottle's page is EVALUATED ANEW: the page side (`bottlePage.ts` and everything it reaches — the product's
 * sources, Vue, GSAP, XState, VueUse) is a bundle of its own, built beside the suite's by the unit runner, and every
 * page is that bundle required afresh (`loadPage`) — a fresh instance of everything in it, the suite keeping the
 * instances it was linked with. A spec that must reach a module of the page asks the page for it
 * (`bottle.pageModules` — `bottlePage.ts` § PAGE_MODULES). That is what `reload()` is, too: the same table, the same
 * storage, a new page.
 */
import {BottleClock, takeTime} from './bottleTime'; // (first: the `Date.now` indirection stands before any page)
import {BottleWire, takeWire} from './bottleNet';
import {BottlePage, takePage} from './bottleDom';
import {bottleServer, nodeProcess, nodeRequire} from './bottleNode';
import type {BottleTable} from './server/bottleServerHost';
import type {BottlePageHandle, PageBeat} from './bottlePage';
import type {DiagEntry} from '@/common/diagnostics/DiagnosticModel';
import type {ConsoleReadinessSnapshot} from '@/client/console/e2eReadiness';
import type {PlayerViewModel} from '@/common/models/PlayerModel';

/** The keys of the console key bridge (`CONSOLE_KEY_NAV` / `CONSOLE_KEY_BUTTON`) — the pad's verbs as the monkey presses them. */
export const BOTTLE_KEYS = [
  'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyQ', 'KeyE', 'Comma', 'Period', 'KeyX', 'KeyY', 'KeyR', 'KeyC', 'KeyV',
] as const;
export type BottleKey = typeof BOTTLE_KEYS[number];

export type BottleOptions = {
  /** Which seat of the table the page is (default: the first). */
  seat?: number,
  /** Extra query flags of the page (`waitGraphControl=strand`, `motion=0.5` …). */
  query?: string,
  /** The bottle's epoch (ms). Fixed by default — a run reads the same clock every time. */
  startMs?: number,
  /** Storage carried over from an earlier page of the same bottle (`reload()` hands it on). */
  storage?: Map<string, string>,
  /** Print every warn / error line the page makes (a debugging aid; the journal has them either way). */
  echo?: boolean,
  /**
   * `synthetic` — every displayed element has a non-empty, deterministic rect (`bottleDom.ts` § a synthetic layout):
   * flights land and the holds behind measured ends let go at their time. Default `none` — jsdom's 0×0, the border
   * the first twelve tests were measured on.
   */
  layout?: 'none' | 'synthetic',
};

/**
 * THE CLASSES THE BOTTLE IS BLIND TO — a defect line whose ONLY cause is that jsdom lays nothing out. Each row is a
 * wait for something MEASURABLE (a rect, a painted pose) that cannot come here and therefore ends on its bound; the
 * decision behind it goes on, a beat later than in a browser. They are reported apart (`BottleLiveness.blind`) and do
 * not fail the judgement. A row is added only with the line that asked for it — and the list IS the bottle's border:
 * what stands on it is the browser monkey's to judge.
 */
export const LAYOUT_BLIND: ReadonlyArray<{cls: RegExp, why: string}> = [
  {cls: /^wait-graph\/ceiling\/played-hero:target$/, why: '«a measurable landing slot for the card» — a 0×0 rect is no slot (`transferEndVerdict`: width ≤ 4 → empty)'},
  {cls: /^animation-hold\/ceiling\/parliament-vote-landing$/, why: 'the delegates\' flight between two measured figures (`ConsoleParliamentVoteMode` `flyOwnDelegate`)'},
  // THE FIRST FULL PASS OF THE MONKEY IN THE BOTTLE (2026-11-14, 606 walks, seed `fz0`) — every row below ended a wait
  // for a MEASURED end on its ceiling, on tables where the box monkey's baseline (456 walks) named nothing.
  // ⚠ A ROW IS ADDED ONLY AFTER A REAL BROWSER SAID «not there»: two classes of that pass looked exactly as blind as
  // these (`wait-graph/ceiling/scale-step-rating:stage`, `…/card-reaction:rating-story-quiet`) and a real browser
  // named them too — they are the GAME's (the plan's worklist), and they are not rows here.
  {cls: /^wait-graph\/ceiling\/ma-price:price-end$/, why: '«the price\'s end» — the token of a milestone / award price lands on a measured cell (116 tables in the bottle, none on the box)'},
  {cls: /^wait-graph\/ceiling\/played-hero:reward-place$/, why: '«a place for the reward» of a played card — a measured slot, the sibling of `played-hero:target`'},
  // (2026-11-17 — the wait is new on main since the e2e rework's phase 4: `ConsoleStartScene.startReactorFace`. The same
  // table, the same seed, in a real browser on the box: not there.)
  {cls: /^wait-graph\/ceiling\/start:reactor-face$/, why: '«the corporation\'s face standing in the start» is a face whose rect is VISIBLE (`transferEndVerdict`) — a 0×0 rect is no face'},
  // (2026-11-24 — jsdom runs NO CSS animation: the take-in-place turn's `animationend` cannot come here, and the turn
  // ends on its declared ceiling. Before that wait existed the bottle stood on such a reveal for good and said
  // nothing — the autopilot's sixth game. The whole e2e suite takes cards in place in a real browser.)
  {cls: /^wait-graph\/ceiling\/reveal:take-turn$/, why: '«the end of a card\'s take turn» is the `animationend` of a CSS animation (`con-take-turn`) — jsdom has no animation clock, the turn commits at its ceiling'},
  // (2026-11-23 — the autopilot's first whole games: the monkey's fixtures never stand on a fresh table's start, the
  // autopilot always does. The whole e2e suite walks that start in a real browser and has never named it.)
  {cls: /^invariant\/broken\/start-flight:no-source$/, why: '«the corporation is carried from its source» — the source is a measured face of the start (`transferEndVerdict`); a 0×0 rect is no source, the card is revealed in place'},
  {cls: /^wait-graph\/overdue\/admission:host:card-arrival$/, why: 'the arrival of a drawn card into the dock is a flight to a measured slot; the admission block that waits for it runs to its bound'},
];

export type BottleLiveness = {
  /** The bottle's judgement: the server's question is served by a surface that accepts, or something is in flight, and no net acted. */
  ok: boolean,
  /** Why not (empty when `ok`). */
  why: Array<string>,
  /**
   * THE SCREEN ITSELF, apart from what the journal named: the game screen is not there, the page shows another
   * question than the server asks with nothing on the wire, no surface accepts and nothing is in flight, the question
   * is stranded. Empty — the server's question is on screen before a surface that takes it (or something is on its way).
   */
  standing: Array<string>,
  /** The SERVER's truth for the seat. */
  asked: string | undefined,
  /** The page's applied view agrees with it (the same prompt serial). */
  viewInSync: boolean,
  /** The supervisor's last heartbeat (what the arbiter saw at its last tick). */
  beat: PageBeat | undefined,
  /** Every `defect`-tier record (and every error) of the page's journal so far — the ones the bottle can judge. */
  defects: Array<{cls: string, count: number, text: string}>,
  /** …and the ones it cannot (`LAYOUT_BLIND`): named, never failing. */
  blind: Array<{cls: string, count: number, text: string}>,
};

export type ConsoleBottle = {
  table: BottleTable,
  /** The PAGE's own instances of the modules a replay reaches into (`bottlePage.ts` § PAGE_MODULES). */
  pageModules: typeof import('./bottlePage').PAGE_MODULES,
  seatId: string,
  clock: BottleClock,
  wire: BottleWire,
  /** ONE press of the pad (down + up), then every microtask. Returns the key bridge's own echo of it. */
  press(key: BottleKey): Promise<string>,
  /** The world moves by `ms` of the bottle's clock. */
  advance(ms: number): Promise<void>,
  /**
   * THE PAGE IS NOT LOOKED AT for `ms` (the monkey's `hidden` perturbation — freeze zero, stage 1): no frame is
   * painted, timers wake once a second (`BottleClock.advanceUnpainted`). `hidden: true` is a HIDDEN TAB — the
   * document says so (`visibilityState`, `visibilitychange` on the way out and on the way back); `false` is a window
   * BEHIND ANOTHER, which no event announces. Nothing is pressed meanwhile.
   */
  away(ms: number, hidden: boolean): Promise<void>,
  /** Advance until `done()` holds (checked after every `stepMs`), at most `maxMs`. Returns whether it held. */
  until(done: () => boolean, maxMs?: number, stepMs?: number): Promise<boolean>,
  /** The view the page applied (the root's `playerView`). */
  view(): PlayerViewModel | undefined,
  screen(): string,
  /** The workspace stack, outermost first: `kind:phase`. */
  frames(): Array<string>,
  /** The page's journal (every record), and the raw warn / error lines in order. */
  journal(): ReadonlyArray<DiagEntry>,
  lines(): ReadonlyArray<string>,
  ready(): ConsoleReadinessSnapshot,
  liveness(): BottleLiveness,
  /** The kernel's tree and wait table (the evidence of a red). */
  flow(): {tree: Array<string>, waits: number},
  /** How many times the LAST LINE asked for the page to be replaced — `reload()` is how a test serves the ask. */
  rebuildsAsked(): number,
  /** A STATE DIGEST of the page for determinism checks: no wall clock, no id — what two equal runs must agree on. */
  digest(): string,
  /** The command bar's text (what the player is offered) — a walk's eyes. */
  bar(): string,
  /**
   * THE VERBS THE COMMAND BAR OFFERS RIGHT NOW, as keys of the pad: each enabled command of the bar by its glyph
   * (A → Enter, B → Escape, X, Y, LB / RB, LT / RT, L3 / R3), with whether the bar marks it hot. What a player's eyes
   * read before a press — a guided walk presses what is offered far more often than what is not.
   */
  offered(): Array<{key: BottleKey, hot: boolean, label: string}>,
  /** How much of the kernel's state space this page walked (`__conCoverage()` — only when booted with `coverage=1`). */
  coverage(): {keys: Array<string>, machines: Record<string, Array<string>>, frames: Array<string>} | undefined,
  /** THE ONE FUNCTION's measure (`__conServingOwner()` — stage 2): how often `servingOwnerOf` agreed with what painted. */
  servingOwner(): {looks: number, rows: Record<string, Record<string, number>>, disagreements: Array<Record<string, unknown>>} | undefined,
  /** One wait on each source of time the client has (GSAP, the kernel, the frames) — `BottlePageHandle.timeProbe`. */
  timeProbe(): ReturnType<BottlePageHandle['timeProbe']>,
  /** ANOTHER SEAT'S MOVE through the server's own door (its plainest: a pass, or the plainest legal answer). What it did, or `undefined` when that seat is asked nothing. */
  otherSeatMoves(seat: number): Promise<string | undefined>,
  /** The page is closed and opened again on the same table (storage kept) — the bottle is replaced by the returned one. */
  reload(): Promise<ConsoleBottle>,
  dispose(): Promise<void>,
};

const START_MS = Date.UTC(2026, 0, 1);
let live: ConsoleBottle | undefined;

/**
 * THE PAGE'S BUNDLE — `bottlePage.ts` and everything it reaches (the product's sources, Vue, GSAP, XState, VueUse, the
 * suite's layer), built by the unit runner as a CommonJS file of its own beside the suite's bundle
 * (`scripts/client-tests.mts` § the bottle's page). The runner names it on `globalThis` before the suite loads.
 */
function pageBundle(): string {
  const file = (globalThis as {__TM_BOTTLE_PAGE__?: string}).__TM_BOTTLE_PAGE__;
  if (file === undefined) {
    throw new Error('the bottle\'s page bundle is not built — run a bottle through the unit runner (`npm run test:bottle`, `npm run test:client:one -- <bottle>`)');
  }
  return file;
}

type PageFactory = (exports: object, require: unknown, module: {exports: object}, filename: string, dirname: string) => void;
let pageFactory: PageFactory | undefined;

/**
 * A page, evaluated anew. The bundle is COMPILED ONCE per process (a `vm.Script` of its CommonJS body) and RUN once
 * per page: every run is a fresh instance of every module inside it, while the compiled code is shared — what a page
 * costs is the application's own objects, never another copy of an 18 MB program (a `require` per page recompiled it,
 * and the search's few hundred pages ran the process out of heap).
 */
async function loadPage(): Promise<{page: typeof import('./bottlePage'), restore: () => void}> {
  const file = pageBundle();
  if (pageFactory === undefined) {
    const fs = nodeProcess().getBuiltinModule('node:fs') as {readFileSync(file: string, encoding: 'utf8'): string};
    const vm = nodeProcess().getBuiltinModule('node:vm') as {Script: new (code: string, options: {filename: string}) => {runInThisContext(): unknown}};
    const body = fs.readFileSync(file, 'utf8');
    pageFactory = new vm.Script(`(function (exports, require, module, __filename, __dirname) {${body}\n})`, {filename: file}).runInThisContext() as PageFactory;
  }
  const module = {exports: {}};
  pageFactory.call(module.exports, module.exports, nodeRequire(), module, file, file.replace(/[\\/][^\\/]*$/, ''));
  return {page: module.exports as typeof import('./bottlePage'), restore: () => undefined};
}

/**
 * Dispose WHATEVER bottle stands — the one a test holds, or one a walk left behind (a reload replaces the bottle
 * inside the walk; a throw after it leaves the test's own handle pointing at the page that is already gone).
 */
export async function disposeLiveBottle(): Promise<void> {
  await live?.dispose();
}

export async function bootBottle(table: BottleTable, options: BottleOptions = {}): Promise<ConsoleBottle> {
  if (live !== undefined) {
    throw new Error('one bottle at a time — dispose the previous one (the document and the globals are the process\'s)');
  }
  const server = bottleServer();
  const seat = table.seats[options.seat ?? 0];
  const query = `id=${seat.id}&fastboot=1&realtime=0${options.query !== undefined ? '&' + options.query : ''}`;
  const dom: BottlePage = takePage(nodeRequire(), `http://bottle.local/player?${query}`, options.storage, options.layout ?? 'none');
  const clock = takeTime(options.startMs ?? START_MS);
  const wire = takeWire(server, clock);
  const lines: Array<string> = [];
  const loaded = await loadPage();
  let page: BottlePageHandle;
  try {
    page = loaded.page.openPage(clock, lines, options.echo === true);
  } catch (error) {
    loaded.restore();
    wire.giveBack();
    clock.giveBack();
    dom.giveBack();
    throw error;
  }
  const bar = (): string => (document.querySelector('.con-cmdbar, .con-bar, [data-command-bar]')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  /** The Xbox glyph set's labels (`gamepad/glyphSets.ts`) → the key of the same control (`CONSOLE_KEY_BUTTON`). */
  const GLYPH_KEY: Readonly<Record<string, BottleKey>> = {
    'A': 'Enter', 'B': 'Escape', 'X': 'KeyX', 'Y': 'KeyY', 'LB': 'KeyQ', 'RB': 'KeyE', 'LT': 'Comma', 'RT': 'Period', 'L3': 'KeyC', 'R3': 'KeyV', '⧉': 'KeyR',
  };
  const offered = (): Array<{key: BottleKey, hot: boolean, label: string}> => {
    const out: Array<{key: BottleKey, hot: boolean, label: string}> = [];
    for (const cmd of document.querySelectorAll('.con-cmdbar__cmd')) {
      if (cmd.classList.contains('con-cmdbar__cmd--disabled')) {
        continue;
      }
      const label = (cmd.querySelector('.con-cmdbar__label')?.textContent ?? '').trim();
      for (const glyph of cmd.querySelectorAll('.gp-glyph')) {
        const key = GLYPH_KEY[(glyph.textContent ?? '').trim()];
        if (key !== undefined) {
          out.push({key, hot: cmd.classList.contains('con-cmdbar__cmd--hot'), label});
        }
      }
    }
    return out;
  };

  const bottle: ConsoleBottle = {
    table,
    pageModules: loaded.page.PAGE_MODULES,
    seatId: seat.id,
    clock,
    wire,
    press: async (key) => {
      const KeyEvent = (globalThis as unknown as {KeyboardEvent: new (type: string, init: object) => Event}).KeyboardEvent;
      const before = page.echo().seq;
      window.dispatchEvent(new KeyEvent('keydown', {code: key, key, bubbles: true, cancelable: true}));
      // The DOWN edge's echo is the press's (a nav key has no press edge of its own; the release is a second event).
      const down = page.echo();
      window.dispatchEvent(new KeyEvent('keyup', {code: key, key, bubbles: true, cancelable: true}));
      await clock.drain();
      const seen = down.last;
      // `unseen` = the bridge is not installed (no console screen stands) or the key is not one of its keys.
      return down.seq === before || seen === undefined ? 'unseen' : `${seen.outcome}${seen.absorbedBy !== undefined && seen.absorbedBy.length > 0 ? ':' + seen.absorbedBy.join('+') : ''}`;
    },
    advance: (ms) => clock.advance(ms),
    away: async (ms, hidden) => {
      const say = (state: 'hidden' | 'visible'): void => {
        Object.defineProperty(document, 'visibilityState', {value: state, configurable: true});
        Object.defineProperty(document, 'hidden', {value: state === 'hidden', configurable: true});
        // (The PAGE's own `Event` - the process has one of its own, and jsdom refuses it.)
        const PageEvent = (window as unknown as {Event: new (type: string) => Event}).Event;
        document.dispatchEvent(new PageEvent('visibilitychange'));
      };
      if (hidden) {
        say('hidden');
      }
      await clock.advanceUnpainted(ms);
      if (hidden) {
        say('visible');
      }
      await clock.drain();
    },
    until: async (done, maxMs = 30_000, stepMs = 100) => {
      for (let waited = 0; waited <= maxMs; waited += stepMs) {
        if (done()) {
          return true;
        }
        await clock.advance(stepMs);
      }
      return done();
    },
    view: () => page.view(),
    screen: () => page.screen(),
    frames: () => page.frames(),
    journal: () => page.journal(),
    lines: () => lines,
    ready: () => page.ready(),
    liveness: () => {
      const truth = server.seatTruth(seat.id);
      const view = page.view();
      const why: Array<string> = [];
      const viewInSync = view !== undefined && view.waitingFor?.promptId === truth.promptId;
      const beat = page.beat();
      const named = page.journal()
        .filter((entry) => entry.cause?.tier === 'defect' || entry.kind === 'error')
        .map((entry) => ({cls: entry.cause?.cls ?? `error/${entry.family}`, count: entry.count, text: entry.text.slice(0, 240)}));
      const isBlind = (cls: string) => LAYOUT_BLIND.some((row) => row.cls.test(cls));
      const defects = named.filter((entry) => !isBlind(entry.cls));
      const blind = named.filter((entry) => isBlind(entry.cls));
      if (page.screen() !== 'player-home') {
        why.push(`the game screen does not stand (screen: ${page.screen()})`);
      }
      if (!viewInSync && wire.inFlight() === 0 && !page.requestInProgress()) {
        why.push(`the page shows prompt #${view?.waitingFor?.promptId ?? 'none'}, the server asks #${truth.promptId ?? 'none'} (${truth.waitingFor ?? 'nothing'}) and nothing is on the wire`);
      }
      if (truth.waitingFor !== undefined) {
        if (beat === undefined) {
          why.push('the supervisor has not ticked (no heartbeat)');
        } else if (!beat.accepting && beat.inFlight.length === 0) {
          why.push(`asked «${truth.waitingFor}» — no surface accepts and nothing is in flight (frames: ${beat.frames.join(';') || 'none'})`);
        }
        if (page.stranded() !== undefined) {
          why.push(`the question is STRANDED: ${page.stranded()}`);
        }
      }
      const standing = [...why];
      for (const defect of defects) {
        why.push(`${defect.cls} ×${defect.count}: ${defect.text.split('\n')[0]}`);
      }
      if (clock.errors.length > 0) {
        why.push(`${clock.errors.length} task(s) threw: ${String(clock.errors[0])}`);
      }
      return {ok: why.length === 0, why, standing, asked: truth.waitingFor, viewInSync, beat, defects, blind};
    },
    flow: () => ({tree: page.tree(), waits: page.waits()}),
    rebuildsAsked: () => page.rebuildsAsked(),
    digest: () => {
      const view = page.view();
      const truth = server.seatTruth(seat.id);
      return [
        `screen=${page.screen()}`,
        `phase=${truth.phase} gen=${truth.generation} age=${truth.gameAge} asked=${truth.waitingFor ?? 'none'}`,
        `view.age=${view?.game.gameAge ?? '-'} view.asked=${view?.waitingFor?.type ?? 'none'}`,
        `frames=${page.frames().join(';')}`,
        `holds=${page.ready().holds.join(',')}`,
        `stranded=${page.stranded() ?? 'no'}`,
        `quiet=${Math.round((clock.now() - page.progressAt()) / 1000)}`,
        `dom=${document.body.querySelectorAll('*').length}`,
        `bar=${bar().slice(0, 80)}`,
        `journal=${page.journal().map((entry) => `${entry.cause?.cls ?? entry.kind}×${entry.count}`).join(',')}`,
      ].join(' | ');
    },
    bar,
    offered,
    coverage: () => (window as unknown as {__conCoverage?: () => {keys: Array<string>, machines: Record<string, Array<string>>, frames: Array<string>}}).__conCoverage?.(),
    servingOwner: () => (window as unknown as {__conServingOwner?: () => {looks: number, rows: Record<string, Record<string, number>>, disagreements: Array<Record<string, unknown>>}}).__conServingOwner?.(),
    timeProbe: () => page.timeProbe(),
    otherSeatMoves: async (index) => {
      const moved = await server.otherSeatMoves(table.seats[index].id);
      if (moved !== undefined && moved.answer.status !== 200) {
        throw new Error(`the server refused seat ${index}'s ${moved.did}: ${moved.answer.status} ${moved.answer.body.slice(0, 200)}`);
      }
      await clock.drain();
      return moved?.did;
    },
    reload: async () => {
      const storage = dom.storage;
      const at = clock.now();
      await bottle.dispose();
      return bootBottle(table, {...options, storage, startMs: at});
    },
    dispose: async () => {
      if (live !== bottle) {
        return;
      }
      await page.close();
      wire.giveBack();
      clock.giveBack();
      dom.giveBack();
      loaded.restore();
      live = undefined;
    },
  };
  live = bottle;
  await page.settle();
  return bottle;
}

/** A seeded generator for walks (mulberry32 — the engine's own `SeededRandom` lives on the server side of the bottle). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
