/*
 * THE PAGE SIDE OF THE BOTTLE (FREEZE ZERO · B3, the spike) — the one module that imports the APPLICATION.
 *
 * `consoleBottle.ts` evaluates this module ANEW for every bottle (it drops the bundle's module cache for `src/**` and
 * the stateful libraries first — that file's § a pristine page), so every `import` below is a fresh instance: the
 * client's module state — the workspace stack, the hold registry, the transport, the kernel's tree, GSAP's ticker — is
 * exactly a freshly loaded page's. Nothing outside this file may import a module of `src/client` at run time.
 */
import {createVaporApp, nextTick} from 'vue';
import {gsap} from 'gsap';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import {whenPainted} from '@/client/console/session/sessionWaits';
import App from '@/client/components/App.vue';
import {installVueErrorReport} from '@/client/console/vueErrorReport';
import {__setSessionRebuildNavigateForTesting} from '@/client/console/session/sessionRebuild';
import {__installDiagnosticsJournalForTesting, __resetDiagnosticsCaptureForTesting} from '@/client/diagnostics/diagnosticsCapture';
import {DiagJournal} from '@/common/diagnostics/journal';
import type {DiagEntry} from '@/common/diagnostics/DiagnosticModel';
import {workspaceStackState} from '@/client/console/consoleWorkspaceStack';
import {consoleReadinessSnapshot, ConsoleReadinessSnapshot} from '@/client/console/e2eReadiness';
import {dumpFlowTree, waitTable} from '@/client/console/kernel/flowScope';
import {setFlowClock} from '@/client/console/kernel/flowClock';
import {flowTraceStats} from '@/client/console/kernel/flowTrace';
import {transportState} from '@/client/console/transport/gameTransport';
import {leakDetectorState} from '@/client/console/consoleLeakDetector';
import {inputEchoSnapshot, InputEchoSnapshot} from '@/client/console/inputEcho';
import {livenessStateSnapshot} from '@/client/console/consoleLiveness';
import {reactivityWitnessStats} from '@/client/components/presentation/reactivityWitness';
import type {PlayerViewModel} from '@/common/models/PlayerModel';
import type {BottleClock} from './bottleTime';

export type PageBeat = {accepting: boolean, inFlight: ReadonlyArray<string>, frames: ReadonlyArray<string>, section: string, quietS: number, graph?: string};

export type BottlePageHandle = {
  screen(): string,
  view(): PlayerViewModel | undefined,
  frames(): Array<string>,
  journal(): ReadonlyArray<DiagEntry>,
  ready(): ConsoleReadinessSnapshot,
  tree(): Array<string>,
  waits(): number,
  stranded(): string | undefined,
  requestInProgress(): boolean,
  progressAt(): number,
  echo(): InputEchoSnapshot,
  /** The supervisor's last heartbeat (what the arbiter saw at its last tick). */
  beat(): PageBeat | undefined,
  /** Counters of the kernel's trace and the reactivity witness — a determinism fact. */
  counters(): Record<string, number>,
  /**
   * How many times THE LAST LINE asked for this page to be replaced (`session/sessionRebuild.ts`). A bottle's page
   * cannot navigate — the ask is counted, and the bottle's own `reload()` is what serves it.
   */
  rebuildsAsked(): number,
  /**
   * WHO KEEPS A CLOCK — one wait on each source of time the client has, started NOW; the returned reader says when
   * (in ms of the bottle's clock after the start) each of them came, `-1` while it has not.
   */
  timeProbe(): () => {gsapTween1000: number, gsapDelayedCall500: number, kernelAfter700: number, painted2: number, tweenValue: number, gsapTickerMs: number},
  /** The first frame: the route resolved, the view fetched and applied. */
  settle(): Promise<void>,
  close(): Promise<void>,
};

type RootPort = {screen: string, playerView: PlayerViewModel | undefined};
type FieldRecord = {heartbeats: Array<PageBeat>};

export function openPage(clock: BottleClock, lines: Array<string>, echo: boolean): BottlePageHandle {
  const previousClock = setFlowClock(clock);

  // ── the page's journal: the product's record path over a journal of this bottle ──
  __resetDiagnosticsCaptureForTesting();
  const journal = new DiagJournal({runtime: 'page', session: 'bottle', build: 'bottle'});
  const record = __installDiagnosticsJournalForTesting(journal);
  const realWarn = console.warn;
  const realError = console.error;
  const tap = (level: 'warn' | 'error', real: (...args: Array<unknown>) => void) => (...args: Array<unknown>): void => {
    const text = args.map((arg) => (arg instanceof Error ? arg.stack ?? arg.message : typeof arg === 'string' ? arg : safeJson(arg))).join(' ');
    lines.push(`${level}: ${text}`);
    if (echo) {
      real.call(console, ...args);
    }
    try {
      record(level, args);
    } catch {
      // never into the console being recorded
    }
  };
  console.warn = tap('warn', realWarn);
  console.error = tap('error', realError);

  // ── the application, as `main.ts` builds it ──
  const host = document.createElement('div');
  host.id = 'app';
  document.body.appendChild(host);
  const app = createVaporApp(App as unknown as Parameters<typeof createVaporApp>[0]);
  installVueErrorReport(app as unknown as Parameters<typeof installVueErrorReport>[0]);
  // A handler that THROWS loses the error it was given (Vue then only warns «Unhandled error during execution of app
  // errorHandler»): the bottle keeps both — the original and what the handler threw — as a line of its own.
  const reportVueError = app.config.errorHandler;
  app.config.errorHandler = (err, instance, info) => {
    try {
      reportVueError?.(err, instance, info);
    } catch (inner) {
      console.error(`[bottle] the app's errorHandler threw (${inner instanceof Error ? inner.message : String(inner)}) while reporting «${info}»:`, err);
    }
  };
  let rebuildsAsked = 0;
  const restoreRebuild = __setSessionRebuildNavigateForTesting(() => {
    rebuildsAsked++;
  });
  const root = app.mount(host) as unknown as RootPort;

  return {
    screen: () => root.screen,
    view: () => root.playerView,
    frames: () => workspaceStackState.frames.map((f) => `${f.kind}:${f.phase}`),
    journal: () => journal.entries(),
    ready: () => consoleReadinessSnapshot(),
    tree: () => dumpFlowTree(clock.now()),
    waits: () => waitTable().length,
    stranded: () => leakDetectorState.stranded?.inputType,
    requestInProgress: () => transportState.requestInProgress,
    progressAt: () => livenessStateSnapshot().progressAt,
    echo: () => inputEchoSnapshot(),
    beat: () => (window as unknown as {__conFieldRecorder?: () => FieldRecord}).__conFieldRecorder?.().heartbeats.at(-1),
    counters: () => ({...flowTraceStats, reactivityLatches: reactivityWitnessStats.latches}),
    rebuildsAsked: () => rebuildsAsked,
    timeProbe: () => {
      const started = clock.now();
      const tickerAt = gsap.ticker.time;
      const came = {gsapTween1000: -1, gsapDelayedCall500: -1, kernelAfter700: -1, painted2: -1};
      const subject = {x: 0};
      gsap.to(subject, {x: 100, duration: 1, ease: 'none', onComplete: () => {
        came.gsapTween1000 = clock.now() - started;
      }});
      gsap.delayedCall(0.5, () => {
        came.gsapDelayedCall500 = clock.now() - started;
      });
      consoleSessionScope().after(700, 'the bottle\'s time probe', () => {
        came.kernelAfter700 = clock.now() - started;
      });
      void whenPainted(2, 400).then(() => {
        came.painted2 = clock.now() - started;
      });
      return () => ({...came, tweenValue: subject.x, gsapTickerMs: Math.round((gsap.ticker.time - tickerAt) * 1000)});
    },
    settle: async () => {
      await nextTick();
      await clock.advance(0);
    },
    close: async () => {
      try {
        app.unmount();
      } catch (error) {
        lines.push(`error: [bottle] unmount threw ${error instanceof Error ? error.stack : String(error)}`);
      }
      await clock.drain();
      host.remove();
      restoreRebuild();
      console.warn = realWarn;
      console.error = realError;
      __resetDiagnosticsCaptureForTesting();
      setFlowClock(previousClock);
    },
  };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
