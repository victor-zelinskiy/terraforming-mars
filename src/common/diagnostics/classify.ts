/*
 * EVERY TAGGED LINE HAS A CLASS — the one table.
 *
 * The client prints its diagnostics as `console.warn('[tag] …')` / `console.error('[tag] …')` from about two hundred
 * sites, with no common logger. What a line MEANS used to be decided by whoever read it — the field recorder took
 * every tag alike, the console export counted «errors» by level, the e2e harness kept its own list of red markers.
 * This table is the one answer: a tag belongs to a FAMILY (its own name) and a family has a KIND
 * (`DiagnosticModel.DiagKind`). The journal filters by it, the developer's notice decides by it, the hub's sending
 * policy reads it.
 *
 * A NEW TAG IS A NEW ROW. The guard `tests/console/diagnosticsClassification.spec.ts` reads the client's sources and
 * fails with the LIST of tags that have no row here (CLAUDE.md invariant 11 — the guard is the worklist).
 *
 * Pure.
 */

import {DiagKind, DiagLevel} from './DiagnosticModel';

/** The tag at the head of a diagnostic line: `[liveness] …` → `liveness`. */
const TAG = /^\[([a-z][a-z0-9 -]*)\]/i;

export function tagOf(text: string): string | undefined {
  return TAG.exec(text)?.[1];
}

const ERROR: ReadonlyArray<string> = [
  // An exception Vue caught while rendering / patching (`vueErrorReport.ts`), an uncaught error or an unhandled
  // rejection of the page (`diagnosticsCapture.ts`), of the main process, of the game server.
  'vue-error', 'page-error', 'main-error', 'server-error',
  // A process that went away — written by the main process.
  'renderer-gone', 'process-gone',
];

/**
 * THE SCREEN STOOD, OR A NET HAD TO ACT. Each of these names a moment the player was (or could have been) kept
 * waiting: the arbiter's ladder, a workspace that did not end itself, a hold that outlived its ceiling, a story
 * degraded at its safety, a question nobody served.
 */
const STALL: ReadonlyArray<string> = [
  'liveness', 'workspace-stall', 'workspace-stale', 'workspace-anchor', 'workspace-outcome', 'workspace-conclusion',
  'workspace', 'ws-stack',
  'start-stranded', 'start-shadow', 'start-director', 'screen-shadow', 'console-leak-detector',
  'console-foreground-watchdog', 'wait-graph', 'animation-hold', 'screen-handoff', 'presentation-ledger',
  'notifications', 'deferred-refresh', 'transport', 'flow', 'mandatory-gate', 'teleport', 'scene-transition',
  'cursor', 'realtime',
  // The last line: the console session rebuilt from the server's view (`console/session/sessionRebuild.ts`).
  'session-rebuild',
  // The main process's watch over a renderer that stopped answering (`electron/rendererHangWatch.ts`).
  'renderer-hang',
];

/** The picture disagreed with the truth. */
const INTEGRITY: ReadonlyArray<string> = [
  // One unit told by two tellers (`oneTeller.ts`), an end of a flight that was not painted, a surface folded under
  // its own token (`resourceTransfer`), a cached predicate that latched (`reactivityWitness.ts`), a reading printed
  // with its placeholders (`readingText.ts`), a composer that re-asked what it had answered (`preselectWitness.ts`).
  'transfer', 'reactivity', 'reading', 'console-preselect',
];

const PERF: ReadonlyArray<string> = ['long-frame', 'perf', 'bot-turn', 'console-overflow'];

/**
 * WHAT A MODULE CHOSE TO SAY — a scene that degraded honestly (its safety fired, an anchor was not found, a beat was
 * skipped), a fallback that was taken. Not an error and not a stall by itself: the journal keeps it under «Прочее», and
 * it is evidence around a real one.
 */
const NOTE: ReadonlyArray<string> = [
  'action-commit-rail', 'banner-cube', 'banner-stage', 'board-input', 'boardBeatPark', 'boot-warmup', 'card lore', 'card-discard',
  'card-reaction', 'card-receive', 'cardDealSequence', 'cell-resource', 'cellResourceBeat', 'colony lore',
  'colony-build', 'colony-ledger', 'colony-resolution', 'colony-track-raise', 'colony-track-wave', 'colony-trade',
  'console play', 'console-start', 'consoleBoardCardBonus', 'consoleCardDiscard', 'consoleEndgameState',
  'consoleGovScaleFocus', 'consolePlayedHero', 'consoleTilePlacement', 'deck-draw', 'deck-pick', 'discard-pile',
  'dock-accent', 'draft-pick', 'energyConversionTransition', 'external-draw', 'hand-delivery', 'hand-intake',
  'hand-reveal', 'hazardCleanupTransition', 'hydro-flow', 'hydro-marker', 'maCeremonyState', 'pad', 'parliament',
  'parliament-draw', 'party lore', 'patent-sale', 'placement', 'planetFocus', 'played-hero', 'rail-reward',
  'reaction', 'resource-transfer', 'ruling-change', 'ruling-change-draw', 'scale-step-rating', 'scale-swing',
  'scaleStepRatingBeat', 'scaleSwingDirector', 'score-cell', 'staged-play', 'start', 'start-emerge', 'start-flight',
  'start-seat', 'terraformed-scene', 'tile-placement', 'venus-bonus-cell', 'venusBonusCellBeat',
  // «Проверка связи»: the test error each runtime throws on purpose. A NOTE of the journal — nothing failed — which the
  // hub sends as an exception only when the connection check asks (its event is tagged `selftest`).
  'selftest',
  // The main process's own breadcrumbs (they reach the journal through the hub).
  'embedded', 'electron', 'shutdown', 'velopack', 'diagnostics', 'TM affinity', 'console-export',
];

function rows(kind: DiagKind, tags: ReadonlyArray<string>): Array<[string, DiagKind]> {
  return tags.map((t) => [t, kind]);
}

/** Family (the tag) → its kind. */
export const DIAG_FAMILIES: ReadonlyMap<string, DiagKind> = new Map<string, DiagKind>([
  ...rows('error', ERROR), ...rows('stall', STALL), ...rows('integrity', INTEGRITY), ...rows('perf', PERF),
  ...rows('note', NOTE),
]);

/** The family of an untagged console line. */
export const UNTAGGED_FAMILY = 'console';

export type DiagClass = {
  /** The tag as printed, without brackets; `console` for an untagged line. */
  family: string;
  kind: DiagKind;
  /** The tag has a row in the table (an untagged line is «known» too: it has its own rule). */
  known: boolean;
};

/**
 * The class of one console line. An untagged `console.error` is an error (somebody reported a failure in plain words);
 * an untagged `console.warn` is a note. A tag with no row is read by its level, and `known: false` — the guard exists
 * so that this never ships.
 */
export function classifyLine(text: string, level: DiagLevel): DiagClass {
  const tag = tagOf(text);
  if (tag === undefined) {
    return {family: UNTAGGED_FAMILY, kind: level === 'error' ? 'error' : 'note', known: true};
  }
  const kind = DIAG_FAMILIES.get(tag);
  if (kind === undefined) {
    return {family: tag, kind: level === 'error' ? 'error' : 'note', known: false};
  }
  return {family: tag, kind, known: true};
}

/** The line without its tag — what a title prints. */
export function lineBody(text: string): string {
  return text.replace(TAG, '').trim();
}

// ── The liveness EPISODE's protocol (the arbiter's three lines — `supervisorController.ts`) ───────────────────────────

export type LivenessLine =
  /** `[liveness] stall (<reason>): Ns without progress, P presses; asked: …; … — rung i: <what>` | `… — the ladder is spent`. */
  {is: 'stall', reason: string, quietS: number, asked: string, step: string, spent: boolean} |
  /** `[liveness] recovered after Ns, R rung(s) run`. */
  {is: 'recovered', afterS: number, rungs: number} |
  /** `[liveness] still hold — …` and anything else under the tag: a line of the family, outside the episode. */
  {is: 'other'};

const STALL_LINE = /^\[liveness\] stall \(([^)]*)\): (\d+)s without progress.*?; asked: ([^;]*);.* — (.*)$/s;
const RECOVERED_LINE = /^\[liveness\] recovered after (\d+)s, (\d+) rung/;

/**
 * The arbiter's line, read. The SAME shape `electron/consoleExport.ts` `buildStallDigest` parses — the two are
 * guarded together (`tests/console/diagnosticsClassification.spec.ts` § the liveness line): changing the arbiter's
 * wording moves both readers in one diff.
 */
export function readLivenessLine(text: string): LivenessLine {
  const stall = STALL_LINE.exec(text);
  if (stall !== null) {
    const step = stall[4].trim();
    return {is: 'stall', reason: stall[1], quietS: Number(stall[2]), asked: stall[3].trim(), step, spent: /the ladder is spent$/.test(step)};
  }
  const recovered = RECOVERED_LINE.exec(text);
  if (recovered !== null) {
    return {is: 'recovered', afterS: Number(recovered[1]), rungs: Number(recovered[2])};
  }
  return {is: 'other'};
}
