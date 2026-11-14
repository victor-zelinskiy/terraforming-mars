/*
 * THE JOURNAL — console lines in, records out. Pure: no clock, no storage, no runtime of its own.
 *
 * Three rules make a stream of lines readable:
 *
 *  1. ONE THROW — ONE RECORD. The same signal repeated inside `DIAG_COALESCE_MS` (an exception thrown on every frame,
 *     a warn re-printed by a 1 Hz net) is the same record with a growing `count`, never a page of rows.
 *  2. A LIVENESS STALL IS AN EPISODE. The arbiter prints `[liveness] stall …` once per rung of its ladder (every two
 *     seconds) and `[liveness] recovered after Ns` when the screen comes back. The lines between the first stall and
 *     the cure are ONE record: its steps in order, how long it stood, how it ended — «вылечено за N с» or «не вылечено».
 *  3. BOUNDED. `DIAG_JOURNAL_MAX` records, `DIAG_TEXT_MAX` characters of text each; the newest win.
 *
 * Every runtime keeps one (`runtime` + `session` make its ids unique within the app run); the page's is what the
 * in-game journal shows, mirrored to the hub so that a reload — or the renderer restarted by the hang watch — does not
 * erase it (`adopt`).
 */

import {classifyLine, lineBody, readLivenessLine} from './classify';
import {
  DIAG_COALESCE_MS, DIAG_EPISODE_SILENCE_MS, DIAG_JOURNAL_MAX, DIAG_TEXT_MAX, DIAG_TITLE_MAX,
  DiagEntry, DiagLevel, DiagRuntime, DiagScreen,
} from './DiagnosticModel';
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
};

export type DiagChange =
  /** A record that did not exist. */
  'new' |
  /** The same record: a repeat, or one more line of its episode. */
  'update' |
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
  private n = 0;
  private readonly max: number;

  constructor(private readonly options: DiagJournalOptions) {
    this.max = options.max ?? DIAG_JOURNAL_MAX;
  }

  entries(): ReadonlyArray<DiagEntry> {
    return this.list;
  }

  find(id: string): DiagEntry | undefined {
    return this.list.find((e) => e.id === id);
  }

  /** One line in. The record it made or changed, and how. */
  ingest(line: DiagLine): DiagIngested {
    const cls = classifyLine(line.text, line.level);
    if (cls.family === 'liveness') {
      const read = readLivenessLine(line.text);
      if (read.is === 'stall') {
        return this.stallLine(line, read.quietS, read.step);
      }
      if (read.is === 'recovered') {
        return this.recoveredLine(line, read.afterS, read.rungs);
      }
    }
    const frames = parseStack(line.stack);
    const head = line.stack !== undefined ? stackHead(line.stack) : '';
    const firstLine = line.text.split('\n')[0];
    const key = `${cls.kind}|${cls.family}|${frames.length > 0 ? stackFingerprint(head, frames) : normalizeMessage(lineBody(firstLine))}`;
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
    });
    return {entry, change: 'new'};
  }

  private stallLine(line: DiagLine, quietS: number, step: string): DiagIngested {
    const open = this.live.get(LIVENESS_EPISODE);
    if (open !== undefined && open.episode !== undefined && open.episode.state === 'open') {
      open.lastAt = line.at;
      open.text = boundText(`${open.text}\n${line.text}`);
      open.episode.lines++;
      open.episode.steps.push(step);
      open.episode.durationMs = (this.episodeLead.get(open.id) ?? 0) + (line.at - open.at);
      return {entry: open, change: 'update'};
    }
    const entry = this.add(LIVENESS_EPISODE, {
      at: line.at, lastAt: line.at, kind: 'stall', family: 'liveness', level: line.level,
      title: lineBody(line.text.split('\n')[0]).slice(0, DIAG_TITLE_MAX),
      text: boundText(line.text), count: 1,
      episode: {state: 'open', durationMs: quietS * 1000, lines: 1, steps: [step]},
      ...(line.screen !== undefined ? {screen: line.screen} : {}),
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
      open.episode.state = 'healed';
      open.episode.durationMs = afterS * 1000;
      this.settle(open);
      return {entry: open, change: 'close'};
    }
    // The cure of an episode this journal never saw begin (its lines were cut, or it began before a reload): still a
    // record — a stall happened, and this is how long it took.
    const entry = this.add(undefined, {
      at: line.at, lastAt: line.at, kind: 'stall', family: 'liveness', level: line.level,
      title: lineBody(line.text).slice(0, DIAG_TITLE_MAX), text: boundText(line.text), count: 1,
      episode: {state: 'healed', durationMs: afterS * 1000, lines: 1, steps: [`${rungs} rung(s) run`]},
      ...(line.screen !== undefined ? {screen: line.screen} : {}),
    });
    return {entry, change: 'close'};
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
          entry.episode.state = 'unhealed';
          this.settle(entry);
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
   * closed as such — «не вылечено» is what the reader of the next page must see.
   */
  closeOpenEpisodes(): Array<DiagEntry> {
    const closed: Array<DiagEntry> = [];
    for (const entry of this.list) {
      if (entry.episode !== undefined && entry.episode.state === 'open') {
        entry.episode.state = 'unhealed';
        this.settle(entry);
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
        return {...e, episode: {...e.episode, state: 'unhealed' as const}};
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
      }
    }
  }
}
