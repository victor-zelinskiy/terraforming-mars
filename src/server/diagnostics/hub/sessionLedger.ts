/*
 * THE SESSION'S LEDGER — what one app run COUNTED, whatever was sent of it.
 *
 * «Are freezes fewer?» needs a numerator nobody capped and a denominator. The numerator cannot be the events: a class
 * is sent a few times per run (the budgets), a PLANNED wait is never sent at all, and a net that fires inside an
 * episode is a line of that episode. So every record the hub mirrors is COUNTED here, by its cause class and tier,
 * with how its episodes ended and how long they stood — and the run's play time stands beside it.
 *
 * The ledger is written to disk as it changes (a run that ends in a native stop cannot send its own) and leaves as ONE
 * event of kind `session` at the NEXT launch (`hub.ts`). `npm run diag -- trend` reads those events: stalls per hour of
 * play and per session by release, the outcomes' shares, the time-to-cure, the top classes, the fires of every net —
 * the evidence a net's retirement needs (`docs/claude/console/architecture-v2/PLAN.md` §6).
 *
 * Pure: the clock and the file are the caller's.
 */

import {durationBucket} from '@/common/diagnostics/cause';
import {DiagEntry, DiagEpisodeOutcome, DiagTier} from '@/common/diagnostics/DiagnosticModel';

/** A gap between two signs of life of the page longer than this is not counted as play (a paused game, a hung page). */
export const PLAY_GAP_MAX_MS = 3 * 60_000;
/** Classes one run's ledger names (the rest are counted under `…other`). */
export const LEDGER_CLASSES_MAX = 120;
/** Episodes one run's ledger lists (the newest are kept). */
export const LEDGER_EPISODES_MAX = 60;

export type LedgerClass = {
  tier: DiagTier;
  /** Records of this class born in the run (a repeat inside one record is its `count`, added to `lines`). */
  n: number;
  /** Console lines of it, repeats and lines folded into an episode included. */
  lines: number;
  /** Events actually sent for it (the budgets cap these — `n` is the truth). */
  sent: number;
};

export type LedgerLongFrames = {
  n: number;
  worstMs: number;
  /** Frames whose scripts were under a third of them — the browser's own work. */
  native: number;
  /** Frames a press waited in. */
  pressWaited: number;
  /** Summed over the described frames, ms. */
  totalMs: number;
  scriptMs: number;
  forcedLayoutMs: number;
  styleLayoutMs: number;
  renderMs: number;
};

export type LedgerEpisode = {
  cls: string;
  outcome: DiagEpisodeOutcome | 'standing';
  /** Seconds it stood. */
  stoodS: number;
  /** Who cured it ('' = nobody). */
  cure: string;
  /** Seconds of play before it began. */
  atPlayS: number;
};

export type SessionLedger = {
  /** The run's id (the hub's own session). */
  run: string;
  release: string;
  environment: string;
  appMode: string;
  startedAt: number;
  lastAt: number;
  /** Milliseconds a game screen stood and gave signs of life (`PLAY_GAP_MAX_MS` caps a silence). */
  playMs: number;
  /** Game screens entered (a page load into a game, or a return to one). */
  games: number;
  /** Page loads seen (1 = no reload). */
  pages: number;
  /** cause class → what the run counted. */
  classes: Record<string, LedgerClass>;
  /** Records with no cause class, by kind (`error` — exceptions; `note`, `perf` — the trail). */
  kinds: Record<string, number>;
  episodes: Array<LedgerEpisode>;
  /** stood bucket → how many episodes (`cause.ts` `durationBucket`). */
  stood: Record<string, number>;
  /** outcome → how many episodes. */
  outcomes: Record<string, number>;
  /**
   * LONG FRAMES BY THE SCREEN THEY HAPPENED ON (`[long-frame]` — a frame of half a second or more): how many (the ones
   * the page's rate limit swallowed included), the worst, how many a press waited in, and WHERE THE TIME WENT — the
   * milliseconds of script (of them forced layout), of style + layout, of render / raster / GPU, summed over the
   * frames the page described. What a native stall's reduction is measured by.
   */
  longFrames: Record<string, LedgerLongFrames>;
  /** The renderer's stops the main process saw. */
  rendererStops: number;
};

export function newSessionLedger(run: string, facts: {release: string, environment: string, appMode: string}, now: number): SessionLedger {
  return {
    run, ...facts, startedAt: now, lastAt: now, playMs: 0, games: 0, pages: 0,
    classes: {}, kinds: {}, episodes: [], stood: {}, outcomes: {}, longFrames: {}, rendererStops: 0,
  };
}

function classRow(ledger: SessionLedger, cls: string, tier: DiagTier): LedgerClass {
  let key = cls;
  if (ledger.classes[key] === undefined && Object.keys(ledger.classes).length >= LEDGER_CLASSES_MAX) {
    key = '…other';
  }
  return ledger.classes[key] ?? (ledger.classes[key] = {tier, n: 0, lines: 0, sent: 0});
}

/**
 * `[long-frame] 812ms — native 700ms (render 500 · style+layout 200) · script 112ms (forced layout 30): … · a press
 * waited in it · +3 long frame(s) since the last line — NATIVE` (`longFrameWatch.ts` `longFrameLine`) → its split.
 */
export function readLongFrame(text: string): {ms: number, script: number, forced: number, styleLayout: number, render: number, native: boolean, pressWaited: boolean, swallowed: number} | undefined {
  const line = text.split('\n')[0];
  const m = /^\[long-frame\] (\d+)ms — native \d+ms \(render (\d+) · style\+layout (\d+)\) · script (\d+)ms(?: \(forced layout (\d+)\))?/.exec(line);
  if (m === null) {
    return undefined;
  }
  return {
    ms: Number(m[1]), render: Number(m[2]), styleLayout: Number(m[3]), script: Number(m[4]), forced: Number(m[5] ?? 0),
    native: / — NATIVE$/.test(line), pressWaited: line.includes('a press waited in it'),
    swallowed: Number(/\+(\d+) long frame\(s\) since the last line/.exec(line)?.[1] ?? 0),
  };
}

/**
 * What of each record was already counted (a record changes — a repeat, a folded line, its close): per record id its
 * lines and whether its episode was closed, and per `<record id>|<class>` the count taken from an episode's nets.
 */
export type LedgerSeen = {
  records: Map<string, {lines: number, closed: boolean}>;
  nets: Map<string, number>;
};

export function newLedgerSeen(): LedgerSeen {
  return {records: new Map(), nets: new Map()};
}

/**
 * A record entered the mirror or changed. Counted ONCE per record (`n`), its lines as they come, its episode when it
 * closes. `playS` — the seconds of play so far.
 */
export function ledgerNote(ledger: SessionLedger, seen: LedgerSeen, entry: DiagEntry, now: number): void {
  ledger.lastAt = now;
  const before = seen.records.get(entry.id);
  const mark = before ?? {lines: 0, closed: false};
  // A record's lines: its repeats, an episode's own count — and, for a single finding, the echoes folded into it
  // (each a tagged line of its text: the cure of a door is a fire of that net, and was counted as none).
  const folded = entry.episode === undefined ? Math.max(0, entry.text.split('\n').filter((l) => /^\[[a-z][a-z0-9-]*\]/.test(l)).length - 1) : 0;
  const lines = Math.max(entry.count + folded, entry.episode?.lines ?? 1);
  if (entry.cause === undefined) {
    if (before === undefined) {
      ledger.kinds[entry.kind] = (ledger.kinds[entry.kind] ?? 0) + 1;
      if (entry.family === 'long-frame') {
        const frame = readLongFrame(entry.text);
        const where = entry.screen?.section !== undefined && entry.screen.section !== '' ? entry.screen.section :
          (entry.screen?.screen !== undefined && entry.screen.screen !== '' ? entry.screen.screen : 'unknown');
        const row = ledger.longFrames[where] ?? (ledger.longFrames[where] = {
          n: 0, worstMs: 0, native: 0, pressWaited: 0, totalMs: 0, scriptMs: 0, forcedLayoutMs: 0, styleLayoutMs: 0, renderMs: 0,
        });
        row.n += 1 + (frame?.swallowed ?? 0);
        if (frame !== undefined) {
          row.worstMs = Math.max(row.worstMs, frame.ms);
          row.native += frame.native ? 1 : 0;
          row.pressWaited += frame.pressWaited ? 1 : 0;
          row.totalMs += frame.ms;
          row.scriptMs += frame.script;
          row.forcedLayoutMs += frame.forced;
          row.styleLayoutMs += frame.styleLayout;
          row.renderMs += frame.render;
        }
      }
    }
  } else {
    const row = classRow(ledger, entry.cause.cls, entry.cause.tier);
    if (before === undefined) {
      row.n++;
      if (entry.cause.shape === 'renderer-hang/unresponsive') {
        ledger.rendererStops++;
      }
    }
    row.lines += Math.max(0, lines - mark.lines);
    // What spoke INSIDE an episode is counted under its own class (it has no record of its own). An episode's nets
    // only grow: each class's count is compared with what was taken of it at the last look.
    for (const net of entry.episode?.nets ?? []) {
      const key = `${entry.id}|${net.cls}`;
      const had = seen.nets.get(key) ?? 0;
      if (net.n > had) {
        const inner = classRow(ledger, net.cls, net.tier);
        if (had === 0) {
          inner.n++;
        }
        inner.lines += net.n - had;
        seen.nets.set(key, net.n);
      }
    }
  }
  mark.lines = lines;
  const episode = entry.episode;
  if (episode !== undefined && episode.state !== 'open' && !mark.closed && entry.cause !== undefined) {
    mark.closed = true;
    const outcome = episode.outcome ?? (episode.state === 'healed' ? 'healed' : 'unhealed');
    ledger.outcomes[outcome] = (ledger.outcomes[outcome] ?? 0) + 1;
    const bucket = durationBucket(episode.durationMs);
    ledger.stood[bucket] = (ledger.stood[bucket] ?? 0) + 1;
    ledger.episodes.push({
      cls: entry.cause.cls, outcome, stoodS: Math.round(episode.durationMs / 100) / 10,
      cure: episode.cure?.by ?? '', atPlayS: Math.round(ledger.playMs / 1000),
    });
    if (ledger.episodes.length > LEDGER_EPISODES_MAX) {
      ledger.episodes.splice(0, ledger.episodes.length - LEDGER_EPISODES_MAX);
    }
  }
  seen.records.set(entry.id, mark);
  if (seen.records.size > 2000) {
    // (A run's mirror holds 400 records; the marks of records long gone are let go in bulk.)
    for (const id of [...seen.records.keys()].slice(0, 1000)) {
      seen.records.delete(id);
    }
    for (const key of [...seen.nets.keys()].slice(0, Math.max(0, seen.nets.size - 1000))) {
      seen.nets.delete(key);
    }
  }
}

/** An event of this class left (or was queued to). */
export function ledgerSent(ledger: SessionLedger, entry: DiagEntry): void {
  if (entry.cause !== undefined) {
    classRow(ledger, entry.cause.cls, entry.cause.tier).sent++;
  }
}

/**
 * A sign of life of the page (its minute's pulse, its context, a record of its journal): the time since the LAST one
 * is play when the page stood on a game screen then — a silence longer than `PLAY_GAP_MAX_MS` counts as that much and
 * no more (a hung page, a player who went away).
 */
export type PlayClock = {at: number, inGame: boolean};

export function ledgerPulse(ledger: SessionLedger, clock: PlayClock, now: number, inGame: boolean): PlayClock {
  ledger.lastAt = now;
  if (clock.inGame && now > clock.at) {
    ledger.playMs += Math.min(now - clock.at, PLAY_GAP_MAX_MS);
  }
  if (inGame && !clock.inGame) {
    ledger.games++;
  }
  return {at: now, inGame};
}

/** Is the run worth an event of its own: somebody played, or something was counted. */
export function ledgerWorthSending(ledger: SessionLedger): boolean {
  const defects = Object.values(ledger.classes).some((row) => row.tier === 'defect' && row.n > 0);
  return ledger.playMs >= 60_000 || defects || (ledger.kinds.error ?? 0) > 0 || ledger.rendererStops > 0;
}

/** The numbers a reader filters and sorts sessions by — an event's tags (short words, never a sentence). */
export function ledgerTags(ledger: SessionLedger): Record<string, string> {
  const rows = Object.values(ledger.classes);
  const defects = rows.filter((row) => row.tier === 'defect').reduce((sum, row) => sum + row.n, 0);
  const minutes = Math.round(ledger.playMs / 60_000);
  return {
    played: minutes < 1 ? 'under-1m' : minutes < 10 ? '1-10m' : minutes < 30 ? '10-30m' : minutes < 90 ? '30-90m' : 'over-90m',
    defects: defects === 0 ? '0' : defects < 3 ? '1-2' : defects < 10 ? '3-9' : '10+',
    episodes: String(Math.min(ledger.episodes.length, 99)),
    unhealed: String(Math.min((ledger.outcomes.unhealed ?? 0) + (ledger.outcomes.reload ?? 0) + (ledger.outcomes.quit ?? 0), 99)),
  };
}
