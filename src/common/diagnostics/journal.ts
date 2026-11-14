/*
 * THE JOURNAL — console lines in, records out. Pure: no clock, no storage, no runtime of its own.
 *
 * Five rules make a stream of lines readable:
 *
 *  1. ONE THROW — ONE RECORD. The same signal repeated inside `DIAG_COALESCE_MS` (an exception thrown on every frame,
 *     a warn re-printed by a 1 Hz net) is the same record with a growing `count`, never a page of rows. «The same»
 *     is the CAUSE CLASS for a stall / integrity line (`cause.ts` — never its wording), the stack for an exception.
 *  2. A LIVENESS STALL IS AN EPISODE. The arbiter prints `[liveness] stall …` once per rung of its ladder (every two
 *     seconds) and `[liveness] recovered after Ns` when the screen comes back. The lines between the first stall and
 *     the cure are ONE record: its steps in order, how long it stood, how it ended — and who cured it.
 *  3. WHAT A NET SAYS INSIDE AN EPISODE IS THE EPISODE'S. While the arbiter's episode is open, every other stall line
 *     of the same runtime (a story the rung degraded, a beat it tore down, a finding of the wait graph) is a line of
 *     that record, counted in `episode.nets` — one incident is one record, found in one step.
 *  4. AN ECHO IS A LINE OF WHAT IT ANSWERS. A door's result after the finding that asked for it (`[wait-graph] cure …`),
 *     the trace's file name after the stop it traced: the shape table names what a line is the echo of, and it is
 *     folded into the newest such record instead of filing a second one.
 *  5. BOUNDED. `DIAG_JOURNAL_MAX` records, `DIAG_TEXT_MAX` characters of text each; the newest win.
 *
 * Every runtime keeps one (`runtime` + `session` make its ids unique within the app run); the page's is what the
 * in-game journal shows, mirrored to the hub so that a reload — or the renderer restarted by the hang watch — does not
 * erase it (`adopt`).
 */

import {causeOf, episodeCure, leftOutcome} from './cause';
import {classifyLine, lineBody, readLivenessLine} from './classify';
import {
  DIAG_COALESCE_MS, DIAG_EPISODE_SILENCE_MS, DIAG_JOURNAL_MAX, DIAG_TEXT_MAX, DIAG_TITLE_MAX,
  DiagCause, DiagEntry, DiagEpisodeOutcome, DiagEvidence, DiagLevel, DiagRuntime, DiagScreen,
} from './DiagnosticModel';
import {shapeOf} from './shapes';
import {normalizeMessage, parseStack, stackFingerprint, stackHead} from './stackFrames';

/** One console line as a runtime saw it. */
export type DiagLine = {
  at: number;
  level: DiagLevel;
  /** The full text: every argument, an `Error` as its stack. */
  text: string;
  /** The stack of the first `Error` among the arguments. */
  stack?: string;
  screen?: DiagScreen;
  /** What stood when the line was printed — or, for an acting net, BEFORE it acted (the page's provider). */
  evidence?: DiagEvidence;
};

export type DiagChange =
  /** A record that did not exist. */
  'new' |
  /** The same record: a repeat, or one more line of its episode. */
  'update' |
  /** One more line of a record that is NOT a plain repeat — an echo folded into what it answers. Always mirrored. */
  'fold' |
  /** An episode ended (healed / unhealed) — the record will not change again. */
  'close';

export type DiagIngested = {entry: DiagEntry, change: DiagChange};

export type DiagJournalOptions = {
  runtime: DiagRuntime;
  /** Unique per start of the runtime (a page load, a launch of the app). */
  session: string;
  build: string;
  max?: number;
};

const LIVENESS_EPISODE = 'liveness|episode';
const HANG_EPISODE = 'renderer-hang|episode';
/** How long after a record's last line an echo of it may still arrive (a door runs in the finding's own tick; a trace is written seconds after the stop it recorded). */
export const DIAG_ECHO_MS = 12_000;
/** Classes an episode names as folded into it (the rest are in its text). */
const EPISODE_NETS_MAX = 24;
/** The dimensions a folded line may add to an EPISODE (see `fold`): only what is about the episode itself. */
const EPISODE_FOLD_DIMS: ReadonlySet<string> = new Set(['trace']);
/** A defect named this long before an episode began is «what it followed» (`episode.after`). */
export const DIAG_EPISODE_AFTER_MS = 20_000;

/** `text` within the bound: its head (the first line names the signal) and its newest tail. */
export function boundText(text: string, max: number = DIAG_TEXT_MAX): string {
  if (text.length <= max) {
    return text;
  }
  const head = text.slice(0, Math.floor(max * 0.3));
  const tail = text.slice(text.length - Math.floor(max * 0.65));
  return `${head}\n… (${text.length - head.length - tail.length} characters cut) …\n${tail}`;
}

export class DiagJournal {
  private list: Array<DiagEntry> = [];
  /** Coalescing key → the record that may still take a repeat. */
  private readonly live = new Map<string, DiagEntry>();
  /** The first line's own «N s without progress» of an open episode — its true beginning is that far before `at`. */
  private readonly episodeLead = new Map<string, number>();
  /** Record id → the shapes of the lines folded into it: an echo of a folded line is a line of the same record. */
  private readonly foldedShapes = new Map<string, Set<string>>();
  private n = 0;
  private readonly max: number;

  constructor(private readonly options: DiagJournalOptions) {
    this.max = options.max ?? DIAG_JOURNAL_MAX;
  }

  entries(): ReadonlyArray<DiagEntry> {
    return this.list;
  }

  /** This start of the runtime (a page load, a launch of the app) — the middle of every id it makes. */
  get session(): string {
    return this.options.session;
  }

  find(id: string): DiagEntry | undefined {
    return this.list.find((e) => e.id === id);
  }

  /** One line in. The record it made or changed, and how. */
  ingest(line: DiagLine): DiagIngested {
    const cls = classifyLine(line.text, line.level);
    const cause = causeOf(line.text, line.level);
    if (cls.family === 'liveness') {
      const read = readLivenessLine(line.text);
      if (read.is === 'stall') {
        return this.stallLine(line, read.quietS, read.step, cause);
      }
      if (read.is === 'recovered') {
        return this.recoveredLine(line, read.afterS, read.rungs);
      }
    }
    if (cause !== undefined && cls.family === 'renderer-hang') {
      const hang = this.hangLine(line, cause);
      if (hang !== undefined) {
        return hang;
      }
    }
    // RULE 3 — while the arbiter's episode is open, a stall line of this runtime is a line of that episode.
    const episode = this.live.get(LIVENESS_EPISODE);
    if (cause !== undefined && cls.kind === 'stall' && episode?.episode !== undefined && episode.episode.state === 'open') {
      return this.fold(episode, line, cause);
    }
    // RULE 4 — an echo is a line of what it answers.
    if (cause !== undefined) {
      const target = this.echoTarget(line, cause);
      if (target !== undefined) {
        return this.fold(target, line, cause);
      }
    }
    const frames = parseStack(line.stack);
    const head = line.stack !== undefined ? stackHead(line.stack) : '';
    const firstLine = line.text.split('\n')[0];
    const identity = frames.length > 0 ? stackFingerprint(head, frames) : (cause?.cls ?? normalizeMessage(lineBody(firstLine)));
    const key = `${cls.kind}|${cls.family}|${identity}`;
    const standing = this.live.get(key);
    if (standing !== undefined && line.at - standing.lastAt <= DIAG_COALESCE_MS) {
      standing.count++;
      standing.lastAt = line.at;
      return {entry: standing, change: 'update'};
    }
    const entry = this.add(key, {
      at: line.at, lastAt: line.at, kind: cls.kind, family: cls.family, level: line.level,
      title: (lineBody(firstLine) || head || firstLine).slice(0, DIAG_TITLE_MAX),
      text: boundText(line.text), count: 1,
      ...(line.stack !== undefined ? {stack: line.stack} : {}),
      ...(line.screen !== undefined ? {screen: line.screen} : {}),
      ...(cause !== undefined ? {cause} : {}),
      // What stood is kept for a DEFECT only: a planned wait and a breadcrumb describe nothing that needs a cause.
      ...(cause?.tier === 'defect' && line.evidence !== undefined ? {evidence: line.evidence} : {}),
    });
    return {entry, change: 'new'};
  }

  /** One more line of a record that is not a repeat of its first: appended, and counted when the record is an episode. */
  private fold(target: DiagEntry, line: DiagLine, cause: DiagCause): DiagIngested {
    target.lastAt = line.at;
    target.text = boundText(`${target.text}\n${line.text}`);
    const shapes = this.foldedShapes.get(target.id) ?? new Set<string>();
    shapes.add(cause.shape);
    this.foldedShapes.set(target.id, shapes);
    if (target.episode !== undefined) {
      target.episode.lines++;
      const nets = target.episode.nets ?? (target.episode.nets = []);
      const known = nets.find((n) => n.cls === cause.cls);
      if (known !== undefined) {
        known.n++;
      } else if (nets.length < EPISODE_NETS_MAX) {
        nets.push({cls: cause.cls, tier: cause.tier, n: 1});
      }
    }
    // What an echo adds to the record's dimensions (a trace's file, the door that answered) — never over its own.
    // AN EPISODE TAKES ONLY WHAT IS ABOUT ITSELF (the trace's file): who cured it is the episode's own cure, and a
    // folded line's `by` / `source` / `asked` are that LINE's — a liveness episode once left tagged `by: the liveness
    // arbiter`, the author of a line folded into it (2026-11-14, the probe on the real collector).
    if (target.cause !== undefined) {
      for (const [key, value] of Object.entries(cause.dims)) {
        if (target.cause.dims[key] === undefined && (target.episode === undefined || EPISODE_FOLD_DIMS.has(key))) {
          target.cause.dims[key] = value;
        }
      }
    }
    return {entry: target, change: 'fold'};
  }

  /** The record a line is the echo of: the newest one of a shape its row names, still within the echo's window. */
  private echoTarget(line: DiagLine, cause: DiagCause): DiagEntry | undefined {
    const shape = shapeOf(line.text.split('\n')[0]);
    if (shape.echoOf.length === 0) {
      return undefined;
    }
    // `cure dead-end …` answers a `dead-end` finding, never a `cycle` that stood beside it.
    const named = shape.parts[0] ?? '';
    let fallback: DiagEntry | undefined;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const entry = this.list[i];
      if (line.at - entry.lastAt > DIAG_ECHO_MS) {
        // (Records are in birth order; an older one whose LAST line is recent can still stand below — keep looking a little.)
        if (line.at - entry.at > DIAG_ECHO_MS * 4) {
          break;
        }
        continue;
      }
      if (entry.cause === undefined || entry.cause.cls === cause.cls) {
        continue;
      }
      // The record IS one of the shapes this line answers — or took one in (a finding folded into the incident's
      // first record: its door's result follows it there).
      const own = shape.echoOf.includes(entry.cause.shape);
      const tookIn = [...(this.foldedShapes.get(entry.id) ?? [])].filter((s) => shape.echoOf.includes(s));
      if (!own && tookIn.length === 0) {
        continue;
      }
      if (named !== '' && (entry.cause.shape.endsWith(`/${named}`) || tookIn.some((s) => s.endsWith(`/${named}`)))) {
        return entry;
      }
      fallback ??= entry;
    }
    return fallback;
  }

  private stallLine(line: DiagLine, quietS: number, step: string, cause: DiagCause | undefined): DiagIngested {
    const open = this.live.get(LIVENESS_EPISODE);
    if (open !== undefined && open.episode !== undefined && open.episode.state === 'open') {
      open.lastAt = line.at;
      open.text = boundText(`${open.text}\n${line.text}`);
      open.episode.lines++;
      open.episode.steps.push(step);
      open.episode.durationMs = (this.episodeLead.get(open.id) ?? 0) + (line.at - open.at);
      return {entry: open, change: 'update'};
    }
    // What was named just before it (a stranded question, a finding whose door did not cure it) — the incident's first words.
    const after = [...new Set(this.list
      .filter((e) => e.kind === 'stall' && e.cause?.tier === 'defect' && e.episode === undefined && line.at - e.lastAt <= DIAG_EPISODE_AFTER_MS)
      .map((e) => e.cause?.cls ?? ''))];
    const entry = this.add(LIVENESS_EPISODE, {
      at: line.at, lastAt: line.at, kind: 'stall', family: 'liveness', level: line.level,
      title: lineBody(line.text.split('\n')[0]).slice(0, DIAG_TITLE_MAX),
      text: boundText(line.text), count: 1,
      episode: {state: 'open', durationMs: quietS * 1000, lines: 1, steps: [step], ...(after.length > 0 ? {after} : {})},
      ...(line.screen !== undefined ? {screen: line.screen} : {}),
      ...(cause !== undefined ? {cause} : {}),
      ...(line.evidence !== undefined ? {evidence: line.evidence} : {}),
    });
    this.episodeLead.set(entry.id, quietS * 1000);
    return {entry, change: 'new'};
  }

  private recoveredLine(line: DiagLine, afterS: number, rungs: number): DiagIngested {
    const open = this.live.get(LIVENESS_EPISODE);
    if (open !== undefined && open.episode !== undefined && open.episode.state === 'open') {
      open.lastAt = line.at;
      open.text = boundText(`${open.text}\n${line.text}`);
      open.episode.lines++;
      open.episode.durationMs = afterS * 1000;
      this.closeEpisode(open, 'healed', line.evidence);
      return {entry: open, change: 'close'};
    }
    // The cure of an episode this journal never saw begin (its lines were cut, or it began before a reload): still a
    // record — a stall happened, and this is how long it took.
    const entry = this.add(undefined, {
      at: line.at, lastAt: line.at, kind: 'stall', family: 'liveness', level: line.level,
      title: lineBody(line.text).slice(0, DIAG_TITLE_MAX), text: boundText(line.text), count: 1,
      episode: {state: 'healed', outcome: 'healed', durationMs: afterS * 1000, lines: 1, steps: [`${rungs} rung(s) run`]},
      ...(line.screen !== undefined ? {screen: line.screen} : {}),
    });
    return {entry, change: 'close'};
  }

  /**
   * THE RENDERER'S STOP IS AN EPISODE TOO (the main process's watch): `the page stopped answering` opens it, `the page
   * answers again after Ns` heals it, `still not answering … the renderer is restarted` ends it in a reload. The
   * trace's own line arrives seconds later and is folded in as an echo (rule 4).
   */
  private hangLine(line: DiagLine, cause: DiagCause): DiagIngested | undefined {
    const open = this.live.get(HANG_EPISODE);
    const standing = open !== undefined && open.episode !== undefined && open.episode.state === 'open' ? open : undefined;
    if (cause.shape === 'renderer-hang/unresponsive') {
      if (standing !== undefined) {
        return this.fold(standing, line, cause);
      }
      const entry = this.add(HANG_EPISODE, {
        at: line.at, lastAt: line.at, kind: 'stall', family: 'renderer-hang', level: line.level,
        title: lineBody(line.text.split('\n')[0]).slice(0, DIAG_TITLE_MAX), text: boundText(line.text), count: 1,
        episode: {state: 'open', durationMs: 0, lines: 1, steps: []},
        cause,
      });
      return {entry, change: 'new'};
    }
    if (standing === undefined || standing.episode === undefined) {
      return undefined;
    }
    if (cause.shape === 'renderer-hang/recovered' || cause.shape === 'renderer-hang/restart') {
      standing.lastAt = line.at;
      standing.text = boundText(`${standing.text}\n${line.text}`);
      standing.episode.lines++;
      standing.episode.steps.push(lineBody(line.text.split('\n')[0]).slice(0, 200));
      standing.episode.durationMs = line.at - standing.at;
      this.closeEpisode(standing, cause.shape === 'renderer-hang/recovered' ? 'healed' : 'reload', undefined);
      return {entry: standing, change: 'close'};
    }
    return undefined;
  }

  /** An episode is over: how, by whom, and what was different after (`cause.ts`). */
  private closeEpisode(entry: DiagEntry, outcome: DiagEpisodeOutcome, end: DiagEvidence | undefined): void {
    if (entry.episode === undefined) {
      return;
    }
    entry.episode.state = outcome === 'healed' ? 'healed' : 'unhealed';
    // (A page the LAST LINE replaced was rebuilt, not «reloaded under it» — `leftOutcome`.)
    entry.episode.outcome = outcome === 'reload' ? leftOutcome(entry.episode, 'reload') : outcome;
    entry.episode.cure = episodeCure(entry.episode, entry.evidence, end);
    this.settle(entry);
  }

  /**
   * Time passed: an episode nobody is curing any more (no line of it for `DIAG_EPISODE_SILENCE_MS`) is closed as
   * unhealed, and a record too old to take a repeat stops waiting for one. Returns the records it closed.
   */
  tick(now: number): Array<DiagEntry> {
    const closed: Array<DiagEntry> = [];
    for (const [key, entry] of [...this.live]) {
      if (entry.episode !== undefined && entry.episode.state === 'open') {
        if (now - entry.lastAt >= DIAG_EPISODE_SILENCE_MS) {
          this.closeEpisode(entry, 'unhealed', undefined);
          closed.push(entry);
        }
      } else if (now - entry.lastAt > DIAG_COALESCE_MS) {
        this.live.delete(key);
      }
    }
    return closed;
  }

  /**
   * The page is leaving (or the runtime is ending) under whatever is open: an episode that was never cured here is
   * closed as such — «не вылечено» is what the reader of the next page must see. `how` says what took the runtime
   * away: the page was reloaded under it (the hub turns that into `quit` when the app ends instead), or the app ended.
   */
  closeOpenEpisodes(how: 'reload' | 'quit' = 'reload'): Array<DiagEntry> {
    const closed: Array<DiagEntry> = [];
    for (const entry of this.list) {
      if (entry.episode !== undefined && entry.episode.state === 'open') {
        this.closeEpisode(entry, how, undefined);
        closed.push(entry);
      }
    }
    return closed;
  }

  /**
   * Records of EARLIER sessions (the hub's mirror, read at boot) stand before this session's own. An episode that was
   * open when its page went away was never cured on it.
   */
  adopt(prior: ReadonlyArray<DiagEntry>): void {
    const known = new Set(this.list.map((e) => e.id));
    const fresh = prior.filter((e) => !known.has(e.id)).map((e) => {
      if (e.episode !== undefined && e.episode.state === 'open') {
        return {...e, episode: {...e.episode, state: 'unhealed' as const, outcome: leftOutcome(e.episode, 'reload')}};
      }
      return e;
    });
    this.list = [...fresh, ...this.list].sort((a, b) => a.at - b.at);
    this.trim();
  }

  /** A record born in another runtime (the hub pushes the main process's and the server's) joins the list as it is. */
  accept(entry: DiagEntry): DiagChange {
    const at = this.list.findIndex((e) => e.id === entry.id);
    if (at >= 0) {
      this.list[at] = entry;
      return 'update';
    }
    this.list.push(entry);
    this.trim();
    return 'new';
  }

  clear(): void {
    this.list = [];
    this.live.clear();
    this.episodeLead.clear();
    this.foldedShapes.clear();
  }

  private settle(entry: DiagEntry): void {
    for (const [key, standing] of this.live) {
      if (standing === entry) {
        this.live.delete(key);
      }
    }
    this.episodeLead.delete(entry.id);
  }

  private add(key: string | undefined, fields: Omit<DiagEntry, 'id' | 'runtime' | 'build'>): DiagEntry {
    const entry: DiagEntry = {
      id: `${this.options.runtime}-${this.options.session}-${++this.n}`,
      runtime: this.options.runtime, build: this.options.build,
      ...fields,
    };
    this.list.push(entry);
    if (key !== undefined) {
      this.live.set(key, entry);
    }
    this.trim();
    return entry;
  }

  private trim(): void {
    if (this.list.length > this.max) {
      const gone = this.list.splice(0, this.list.length - this.max);
      for (const entry of gone) {
        this.settle(entry);
        this.foldedShapes.delete(entry.id);
      }
    }
  }
}
