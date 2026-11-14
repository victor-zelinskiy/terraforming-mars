/*
 * THE DIAGNOSTIC SIGNAL — one model for the three runtimes (the page, the Electron main process, the game server).
 *
 * A signal is whatever a developer would otherwise have read in a console: an exception, a tagged warning of the
 * console's own nets (`[liveness] …`, `[workspace-stall] …`), a process that went away. Every runtime turns what it
 * sees into the SAME record (`DiagEntry`), and every consumer — the in-game journal, the developer's notice, the field
 * recorder, the report package, Sentry — reads that record and nothing else. Contract: `docs/claude/diagnostics.md`.
 *
 * Pure types and constants: no runtime of either side is imported here.
 */

/** What a signal IS — decided by `classifyLine` from its tag, never by a consumer. */
export type DiagKind =
  /** An exception or a failed operation: something threw, or a call did not do what it was asked. */
  'error' |
  /** The screen stood still, owed something, or a net had to release something that should have ended itself. */
  'stall' |
  /** The picture disagreed with the truth (a unit told twice, a cached predicate that latched). */
  'integrity' |
  /** A frame or a turn took too long. */
  'perf' |
  /** Everything else a module chose to say (a scene that degraded honestly, a fallback that was taken). */
  'note';

export const DIAG_KINDS: ReadonlyArray<DiagKind> = ['error', 'stall', 'integrity', 'perf', 'note'];

/** Where the signal was born. */
export type DiagRuntime = 'page' | 'main' | 'server';

export type DiagLevel = 'error' | 'warn';

/** One frame of a parsed stack (`stackFrames.ts`). */
export type DiagFrame = {
  /** The function as V8 printed it ('' for an anonymous frame). */
  fn: string;
  /** The file or URL as V8 printed it ('' when the frame names none — `native`, `<anonymous>`). */
  file: string;
  line?: number;
  col?: number;
  /** Ours (a frame of the game's own code) or a library's / the runtime's — the reading surface dims the latter. */
  inApp: boolean;
};

/** How a run of repeated lines of ONE incident ended. */
export type DiagEpisodeState =
  /** Still going: lines of it keep arriving (or the screen still stands). */
  'open' |
  /** The net cured it (`[liveness] recovered after Ns`). */
  'healed' |
  /** It was never cured on this page: the ladder ran out, or the page was reloaded under it. */
  'unhealed';

export type DiagEpisode = {
  state: DiagEpisodeState;
  /** From the first line to the cure (healed), to the last line seen (open / unhealed). */
  durationMs: number;
  /** How many console lines the episode folded into this one record. */
  lines: number;
  /** What the net did, in its own words, in order (`rung 2: a claim released with force`). */
  steps: Array<string>;
};

/**
 * What the screen was doing when the signal was born — the field recorder's heartbeat, reduced to what a reader needs.
 * It may carry ids (the game's); a consumer that leaves the device scrubs them (`privacy.ts`).
 */
export type DiagScreen = {
  /** The app's screen (`player-home`, `main-menu`, …) — '' before the app mounted. */
  screen: string;
  /** The console section / sheet the player stood on. */
  section: string;
  /** The server's question as the arbiter saw it ('' = none asked). */
  prompt: string;
  /** A surface served the question and took input. */
  accepting: boolean;
  /** What was provably moving. */
  inFlight: Array<string>;
  /** The workspace stack, `<kind>:<phase>`. */
  frames: Array<string>;
  /** Seconds since the picture last moved. */
  quietS: number;
  /** The admission block holding the question ('' = none). */
  block: string;
  /** The layout profile and the viewport. */
  profile: string;
  viewport: string;
};

export type DiagEntry = {
  /** Unique within the app run: `<runtime>-<session>-<n>`. */
  id: string;
  /** Milliseconds since the epoch — the first line, and the latest one folded in. */
  at: number;
  lastAt: number;
  kind: DiagKind;
  /** The tag without its brackets (`liveness`, `vue-error`); `console` for an untagged line. */
  family: string;
  level: DiagLevel;
  runtime: DiagRuntime;
  /** The first line of the signal, without its tag — what a list row prints. */
  title: string;
  /**
   * THE FULL TEXT — verbatim what the console received: every argument, an `Error` as its stack. For an episode, every
   * line of it in order. Bounded by `DIAG_TEXT_MAX`.
   */
  text: string;
  /** The stack of the first `Error` among the arguments, as V8 printed it. */
  stack?: string;
  /** How many times the same signal repeated (1 = once). */
  count: number;
  episode?: DiagEpisode;
  screen?: DiagScreen;
  /** The build that printed it (`settings.json` version). */
  build: string;
  /** What the sender did with it (set by the hub; absent = never offered — the web build, a unit test). */
  delivery?: DiagDelivery;
};

/** What happened to a signal on its way to the developer. */
export type DiagDelivery =
  /** Accepted by the transport (sent, or queued for when the network returns). */
  {state: 'sent', eventId: string} |
  {state: 'queued', eventId: string} |
  /** Not offered, and why: the player's choice, this kind is never sent, the session's budget is spent. */
  {state: 'held', reason: 'consent' | 'policy' | 'budget' | 'disabled'};

/** The longest full text one entry keeps; an episode's older lines give way to its newest. */
export const DIAG_TEXT_MAX = 24_000;
/** The longest title a row prints. */
export const DIAG_TITLE_MAX = 220;
/** Entries the journal keeps (the newest win). */
export const DIAG_JOURNAL_MAX = 240;
/** A repeat of the same signal within this window is the SAME record (`count` grows) — an exception thrown per frame. */
export const DIAG_COALESCE_MS = 30_000;
/** A liveness episode with no line and no cure for this long is no longer «open»: nobody is curing it. */
export const DIAG_EPISODE_SILENCE_MS = 60_000;
