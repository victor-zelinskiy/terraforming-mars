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
 * clean. So a bottle's page is EVALUATED ANEW: the bundle's module cache (`require.cache` — webpack's
 * `__webpack_require__.c`) drops every module of `src/**` and of the stateful libraries (GSAP, XState, VueUse), the
 * page side (`bottlePage.ts`) is imported — a fresh instance of everything it reaches — and the cache is put back when
 * the bottle is disposed (the rest of the suite keeps the instances it was linked with). That is what `reload()` is,
 * too: the same table, the same storage, a new page.
 */
import {BottleClock, takeTime} from './bottleTime'; // (first: the `Date.now` indirection stands before any page)
import {BottleWire, takeWire} from './bottleNet';
import {BottlePage, takePage} from './bottleDom';
import {bottleServer, nodeRequire} from './bottleNode';
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
];

export type BottleLiveness = {
  /** The bottle's judgement: the server's question is served by a surface that accepts, or something is in flight, and no net acted. */
  ok: boolean,
  /** Why not (empty when `ok`). */
  why: Array<string>,
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
  seatId: string,
  clock: BottleClock,
  wire: BottleWire,
  /** ONE press of the pad (down + up), then every microtask. Returns the key bridge's own echo of it. */
  press(key: BottleKey): Promise<string>,
  /** The world moves by `ms` of the bottle's clock. */
  advance(ms: number): Promise<void>,
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

/** The bundle's module cache (webpack rewrites `require.cache` to its own `__webpack_require__.c`). */
const moduleCache = require.cache as unknown as Record<string, unknown>;
/** A module of the PAGE: the product's sources and the libraries that keep state of their own. */
const PAGE_MODULE = /(^|!)\.\/src\/|\/node_modules\/(gsap|xstate|@xstate|@vueuse)\/|\/tests\/client\/bottle\/bottlePage\.ts$/;

async function loadPage(): Promise<{page: typeof import('./bottlePage'), restore: () => void}> {
  const kept = {...moduleCache};
  for (const id of Object.keys(moduleCache)) {
    if (PAGE_MODULE.test(id)) {
      delete moduleCache[id];
    }
  }
  const page = await import('./bottlePage');
  return {
    page,
    restore: () => {
      for (const id of Object.keys(moduleCache)) {
        delete moduleCache[id];
      }
      Object.assign(moduleCache, kept);
    },
  };
}

export async function bootBottle(table: BottleTable, options: BottleOptions = {}): Promise<ConsoleBottle> {
  if (live !== undefined) {
    throw new Error('one bottle at a time — dispose the previous one (the document and the globals are the process\'s)');
  }
  const server = bottleServer();
  const seat = table.seats[options.seat ?? 0];
  const query = `id=${seat.id}&fastboot=1&realtime=0${options.query !== undefined ? '&' + options.query : ''}`;
  const dom: BottlePage = takePage(nodeRequire(), `http://bottle.local/player?${query}`, options.storage);
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

  const bottle: ConsoleBottle = {
    table,
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
      for (const defect of defects) {
        why.push(`${defect.cls} ×${defect.count}: ${defect.text.split('\n')[0]}`);
      }
      if (clock.errors.length > 0) {
        why.push(`${clock.errors.length} task(s) threw: ${String(clock.errors[0])}`);
      }
      return {ok: why.length === 0, why, asked: truth.waitingFor, viewInSync, beat, defects, blind};
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
