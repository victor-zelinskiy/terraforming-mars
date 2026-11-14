/*
 * A DIAGNOSTIC RECORD → A SENTRY EVENT. Pure: everything it needs is in its arguments.
 *
 * Four shapes, one function each:
 *
 *  · an ERROR with a stack is an EXCEPTION (`exception.values[0]` + frames + the files' debug ids) — Sentry resolves
 *    the frames against the maps the release uploaded and groups by the resolved stack;
 *  · a STALL or an INTEGRITY warning is a MESSAGE filed under its CAUSE CLASS (`common/diagnostics/cause.ts`): the
 *    fingerprint is the class, so one cause is one issue across sessions, players, releases and rewordings of the
 *    line — and what must not split it (the outcome, who cured it, the source card, how long it stood) is a TAG;
 *  · an EPISODE (the arbiter's stall, the renderer's stop) is one such message for the whole episode, with what stood
 *    at its start and what was different at its end;
 *  · a SESSION is the run's ledger (`sessionLedger.ts`) — the denominator of «are freezes fewer?».
 *
 * Every event carries the tags an agent filters by (`kind`, `family`, `runtime`, `app_mode`, `screen`, `prompt_type`,
 * `game_ref` / `seat_ref` — fingerprints, never the ids —, `profile`, `head`; `os` is derived by the collector from the
 * context) and the journal's recent records as breadcrumbs. Nothing here scrubs: the hub scrubs the finished event
 * (`privacy.ts`) before it is sent — every string of it, so the evidence is scrubbed by construction.
 */

import {causeDims} from '@/common/diagnostics/cause';
import {readLivenessLine} from '@/common/diagnostics/classify';
import {DiagEntry, DiagFrame} from '@/common/diagnostics/DiagnosticModel';
import {DiagAppMode, DiagContext} from '@/common/diagnostics/protocol';
import {normalizeMessage, parseStack, stackHead} from '@/common/diagnostics/stackFrames';
import {ledgerTags, SessionLedger} from './sessionLedger';

export type SentryEvent = Record<string, unknown> & {event_id: string};

/**
 * Where the game's save stood when an episode began: the game by its FINGERPRINT (never its id) and the number of its
 * newest save — `npm run diag -- save` turns the pair into the file on a machine the agent can read.
 */
export type SaveRef = {game: string, saveId: number};

export type EventFacts = {
  eventId: string;
  release: string;
  environment: string;
  appMode: DiagAppMode;
  /** `settings.json` head — the commit of the build. */
  head: string;
  os: string;
  osVersion: string;
  arch: string;
  /** `Electron 45.3.1` — the runtime's name and version. */
  runtimeName: string;
  runtimeVersion: string;
  context: DiagContext | undefined;
  /** Fingerprints of the game and the seat ('' outside a game). */
  gameRef: string;
  seatRef: string;
  /** File / URL → its debug id, for every runtime the hub has heard from. */
  debugIds: ReadonlyMap<string, string>;
  /** The journal's records before this one, oldest first. */
  trail: ReadonlyArray<DiagEntry>;
  selfTest: boolean;
  /** The app run (the hub's session) — every event of one run finds the others, and the run's ledger, by it. */
  run?: string;
  save?: SaveRef;
};

const BREADCRUMBS = 30;
const EXTRA_TEXT_MAX = 12_000;
/**
 * THE COLLECTOR KEEPS ~16 KB OF ONE `extra` VALUE and drops the rest of it in silence (measured on the real project,
 * 2026-11-14: 69 of the tree's 90 lines arrived, 70 of the trace's 80) — while the whole `extra` may be far larger. So
 * a long list leaves in PARTS, each under the limit with a margin: `flow_tree`, `flow_tree_2`, … (`extraLists`); the
 * reader (`scripts/diag-lib.mjs` `partsOf`) joins them back in order.
 */
const EXTRA_LIST_BYTES = 12_000;

/** One list as the `extra` members it leaves in: the first under the list's own name, the next ones numbered from 2. */
export function extraLists(name: string, lines: ReadonlyArray<string>): Record<string, ReadonlyArray<string>> {
  const out: Record<string, Array<string>> = {[name]: []};
  let list = out[name];
  let part = 1;
  let bytes = 0;
  for (const line of lines) {
    // (A line costs its bytes and its quotes and comma in the collector's JSON.)
    const cost = Buffer.byteLength(line, 'utf8') + 4;
    if (list.length > 0 && bytes + cost > EXTRA_LIST_BYTES) {
      part++;
      list = [];
      bytes = 0;
      out[`${name}_${part}`] = list;
    }
    list.push(line);
    bytes += cost;
  }
  return out;
}
/** The dimensions that become TAGS (short structural words); the rest of a cause's dimensions stay in its context. */
const DIM_TAGS: ReadonlyArray<string> = ['reason', 'asked', 'task', 'where', 'holder', 'source', 'owner', 'by', 'how', 'outcome', 'stood', 'cure'];
/** The fingerprint's own namespace: a class is never confused with a default grouping of the collector. */
export const CAUSE_FINGERPRINT = 'tm-cause';

function sentryFrames(frames: ReadonlyArray<DiagFrame>): Array<Record<string, unknown>> {
  // Sentry reads a stack OLDEST frame first; V8 prints the newest first.
  return [...frames].reverse().map((f) => ({
    function: f.fn === '' ? '?' : f.fn,
    filename: f.file,
    abs_path: f.file,
    ...(f.line !== undefined ? {lineno: f.line} : {}),
    ...(f.col !== undefined ? {colno: f.col} : {}),
    in_app: f.inApp,
  }));
}

/** The debug images of the files a stack names — what lets the collector find their source maps. */
export function debugImagesFor(frames: ReadonlyArray<DiagFrame>, debugIds: ReadonlyMap<string, string>): Array<Record<string, string>> {
  const images: Array<Record<string, string>> = [];
  const seen = new Set<string>();
  for (const frame of frames) {
    const id = debugIds.get(frame.file);
    if (id !== undefined && !seen.has(frame.file)) {
      seen.add(frame.file);
      images.push({type: 'sourcemap', code_file: frame.file, debug_id: id});
    }
  }
  return images;
}

/** `TypeError: message` → its two halves; a head with no type is a plain `Error`. */
export function splitErrorHead(head: string): {type: string, value: string} {
  const first = head.split('\n')[0];
  const m = /^([A-Za-z_$][\w$.]*(?:Error|Exception|Rejection)?): ([\s\S]*)$/.exec(first);
  if (m !== null && /Error|Exception|Rejection|Warning/.test(m[1])) {
    return {type: m[1], value: m[2] === '' ? first : m[2]};
  }
  return {type: 'Error', value: first};
}

function environmentOf(facts: EventFacts): Record<string, unknown> {
  return {
    // (The collector derives the `os` / `os.name` tags from this context. The host's own runtime — Electron and its
    // version — goes under a name of OURS: a context called `runtime` would make the collector derive a `runtime` tag
    // and overwrite the one that says which of the three runtimes the signal was born in.)
    os: {name: facts.os, version: facts.osVersion},
    device: {arch: facts.arch},
    host_runtime: {name: facts.runtimeName, version: facts.runtimeVersion},
  };
}

/** WHERE THE PLAYER IS, IS NOT SAID — see the comment in `baseEvent`. */
const NOWHERE = {
  sdk: {name: 'tm.diagnostics', version: '1.0.0', settings: {infer_ip: 'never'}},
  user: {geo: {region: 'not collected'}},
};

function baseEvent(entry: DiagEntry, facts: EventFacts): SentryEvent {
  const tags: Record<string, string> = {
    kind: entry.kind,
    family: entry.family,
    runtime: entry.runtime,
    app_mode: facts.appMode,
    head: facts.head,
  };
  const screen = entry.screen;
  const put = (key: string, value: string | undefined): void => {
    if (value !== undefined && value !== '' && tags[key] === undefined) {
      tags[key] = value.replace(/\s+/g, ' ').slice(0, 190);
    }
  };
  put('screen', screen?.screen !== '' ? screen?.screen : facts.context?.screen);
  put('section', screen?.section);
  put('profile', screen?.profile !== '' ? screen?.profile : facts.context?.profile);
  put('prompt_type', facts.context?.promptType);
  put('game_ref', facts.gameRef);
  put('seat_ref', facts.seatRef);
  put('locale', facts.context?.locale);
  put('run', facts.run);
  if (facts.selfTest) {
    tags.selftest = 'true';
  }
  if (entry.episode !== undefined) {
    tags.episode = entry.episode.state;
  }
  // THE CAUSE: its class (what the issue is filed under), its shape and tier, and the dimensions a reader slices by.
  const cause = entry.cause;
  const dims = cause === undefined ? {} : causeDims(cause, entry.episode);
  if (cause !== undefined) {
    put('cause', cause.cls);
    put('shape', cause.shape);
    put('tier', cause.tier);
    for (const key of DIM_TAGS) {
      put(key, dims[key]);
    }
  }
  const evidence = entry.evidence;
  return {
    event_id: facts.eventId,
    timestamp: entry.at / 1000,
    platform: entry.runtime === 'page' ? 'javascript' : 'node',
    level: entry.level === 'error' ? 'error' : 'warning',
    logger: 'tm.diagnostics',
    release: facts.release,
    environment: facts.environment,
    tags,
    contexts: {
      ...environmentOf(facts),
      app: {app_version: facts.release, app_build: entry.build},
      ...(screen !== undefined ? {
        screen: {
          screen: screen.screen, section: screen.section, prompt: screen.prompt, accepting: screen.accepting,
          in_flight: screen.inFlight, frames: screen.frames, quiet_s: screen.quietS, block: screen.block,
          profile: screen.profile, viewport: screen.viewport,
        },
      } : {}),
      ...(cause !== undefined ? {cause: {class: cause.cls, shape: cause.shape, tier: cause.tier, ...dims}} : {}),
      ...(entry.episode !== undefined ? {
        episode: {
          state: entry.episode.state, outcome: entry.episode.outcome ?? entry.episode.state,
          duration_s: Math.round(entry.episode.durationMs / 100) / 10,
          lines: entry.episode.lines, steps: entry.episode.steps,
          ...(entry.episode.cure !== undefined ? {cured_by: entry.episode.cure.by, cure: entry.episode.cure.did, changed: entry.episode.cure.changed} : {}),
          ...(entry.episode.nets !== undefined && entry.episode.nets.length > 0 ? {nets: entry.episode.nets.map((n) => `${n.cls} ×${n.n} (${n.tier})`)} : {}),
          ...(entry.episode.after !== undefined && entry.episode.after.length > 0 ? {after: entry.episode.after} : {}),
        },
      } : {}),
      // WHAT STOOD — the short half here (who was asked, who held); the long half (the tree, the waits, the trace) in `extra`.
      ...(evidence !== undefined ? {evidence: {question: evidence.question, holders: evidence.holders, input: evidence.input, taken_at: new Date(evidence.at).toISOString()}} : {}),
      ...(facts.save !== undefined && facts.save.game !== '' ? {save: {game_ref: facts.save.game, save_id: facts.save.saveId, fetch: `npm run diag -- save ${facts.save.game} ${facts.save.saveId}`}} : {}),
    },
    extra: {
      title: entry.title,
      text: entry.text.length > EXTRA_TEXT_MAX ? `${entry.text.slice(0, EXTRA_TEXT_MAX)}…` : entry.text,
      count: entry.count,
      journal_id: entry.id,
      ...(entry.episode !== undefined ? {ending: episodeEnd(entry)} : {}),
      ...(evidence !== undefined ? {
        ...extraLists('flow_tree', evidence.tree), ...extraLists('waits', evidence.waits),
        ...extraLists('wait_graph', evidence.graph), ...extraLists('flow_trace', evidence.trace),
      } : {}),
    },
    breadcrumbs: {
      values: facts.trail.slice(-BREADCRUMBS).map((e) => ({
        timestamp: e.at / 1000,
        category: `${e.runtime}.${e.family}`,
        level: e.level === 'error' ? 'error' : 'warning',
        message: e.title,
        type: e.kind === 'error' ? 'error' : 'default',
        ...(e.cause !== undefined ? {data: {cause: e.cause.cls, tier: e.cause.tier}} : {}),
      })),
    },
    // WHERE THE PLAYER IS, IS NOT SAID. `infer_ip: never` keeps the sender's address out of the event — but the
    // collector still looked the connection up and stored a CITY under `user.geo` (measured with the probe,
    // 2026-11-14). It derives a geo only when the event brings none: so the event brings one that says nothing.
    ...NOWHERE,
  };
}

/**
 * THE ISSUE'S TITLE IS THE CLASS'S, NEVER ONE OCCURRENCE'S. The collector titles an issue by the FIRST LINE of its
 * newest event's message — so a line that carries how THIS episode ended («cured after 18s by workspace-outcome»), a
 * card's name or a duration makes the issue read as whatever happened last (measured 2026-11-14: an issue of healed
 * and reloaded episodes was titled «cured»). The first line is therefore built from the class alone — its shape and
 * its structural parts —, and the occurrence's own words are the SECOND line (and `extra.title` / `extra.ending`).
 */
export function classTitle(cls: string): string {
  const [family, shape, ...parts] = cls.split('/');
  return `[${family}] ${shape ?? ''}${parts.length > 0 ? ` (${parts.join(' · ')})` : ''}`.trim();
}

/** How an episode ended, in words (`extra.ending`, and the second line of its event's message). */
function episodeEnd(entry: DiagEntry): string {
  const episode = entry.episode;
  if (episode === undefined) {
    return '';
  }
  const seconds = Math.round(episode.durationMs / 1000);
  if (episode.state === 'open') {
    return `standing for ${seconds}s`;
  }
  if (episode.state === 'healed') {
    const by = episode.cure?.by ?? '';
    return `cured after ${seconds}s${by !== '' ? ` by ${by}` : ''}`;
  }
  const outcome = episode.outcome ?? 'unhealed';
  return outcome === 'reload' ? `NOT cured — the page was reloaded under it after ${seconds}s` :
    (outcome === 'quit' ? `NOT cured — the game was closed under it after ${seconds}s` : `NOT cured (stood ${seconds}s)`);
}

/** The record as the event the collector files. */
export function eventOf(entry: DiagEntry, facts: EventFacts): SentryEvent {
  const event = baseEvent(entry, facts);
  const frames = parseStack(entry.stack);
  if (frames.length > 0) {
    const head = splitErrorHead(stackHead(entry.stack));
    event.exception = {
      values: [{
        type: head.type,
        value: head.value,
        stacktrace: {frames: sentryFrames(frames)},
        mechanism: {type: entry.family, handled: entry.family !== 'page-error' && entry.family !== 'main-error' && entry.family !== 'server-error'},
      }],
    };
    const images = debugImagesFor(frames, facts.debugIds);
    if (images.length > 0) {
      event.debug_meta = {images};
    }
    if (facts.selfTest) {
      event.fingerprint = ['selftest', entry.runtime];
    }
    return event;
  }
  if (facts.selfTest) {
    event.message = {formatted: `[${entry.family}] ${entry.title}`};
    event.fingerprint = ['selftest', entry.runtime];
    return event;
  }
  const cause = entry.cause;
  if (entry.family === 'liveness' && entry.episode !== undefined) {
    const first = readLivenessLine(entry.text.split('\n')[0]);
    const dims = cause?.dims ?? {};
    const what = first.is === 'stall' ?
      `${first.reason} · asked ${dims.task ?? first.asked}${dims.where !== undefined ? ` · ${dims.where}` : ''}${dims.holder !== undefined ? ` · held by ${dims.holder}` : ''}` :
      'a stall';
    // (The sentence is made of the class's own parts — the reason, the task, where, the holder: stable across occurrences.)
    event.message = {formatted: `[liveness] the screen stood still (${what})\n${episodeEnd(entry)}`};
    // A line written before the cause class existed (an older page's record in the mirror) keeps the old key's shape.
    event.fingerprint = cause !== undefined ? [CAUSE_FINGERPRINT, cause.cls] :
      ['stall', 'liveness', first.is === 'stall' ? first.reason : '', first.is === 'stall' ? first.asked : ''];
    return event;
  }
  const own = `[${entry.family}] ${entry.title}`;
  const ending = entry.episode !== undefined ? ` — ${episodeEnd(entry)}` : '';
  if (cause !== undefined) {
    event.message = {formatted: `${classTitle(cause.cls)}\n${own}${ending}`};
    event.fingerprint = [CAUSE_FINGERPRINT, cause.cls];
    return event;
  }
  event.message = {formatted: `${own}${ending}`};
  event.fingerprint = [entry.kind, entry.family, normalizeMessage(entry.title)];
  return event;
}

/**
 * ONE APP RUN, COUNTED (`sessionLedger.ts`) — the denominator: how long it was played, what every net counted, how
 * every episode ended. One issue for all of them (`['tm-session']`); `npm run diag -- trend` reads the events.
 */
export function sessionEventOf(ledger: SessionLedger, facts: EventFacts): SentryEvent {
  const minutes = Math.round(ledger.playMs / 60_000);
  const defects = Object.values(ledger.classes).filter((row) => row.tier === 'defect').reduce((sum, row) => sum + row.n, 0);
  return {
    event_id: facts.eventId,
    timestamp: ledger.lastAt / 1000,
    platform: 'node',
    level: 'info',
    logger: 'tm.diagnostics',
    // The run's OWN release and environment (it is sent by the next launch, which may be a newer build).
    release: ledger.release,
    environment: ledger.environment,
    tags: {
      kind: 'session', family: 'session', runtime: 'main', app_mode: ledger.appMode, head: facts.head, run: ledger.run,
      ...ledgerTags(ledger),
    },
    contexts: {
      ...environmentOf(facts),
      session: {
        run: ledger.run, started: new Date(ledger.startedAt).toISOString(), ended: new Date(ledger.lastAt).toISOString(),
        play_min: minutes, games: ledger.games, pages: ledger.pages, defects, episodes: ledger.episodes.length,
        outcomes: ledger.outcomes, stood: ledger.stood, renderer_stops: ledger.rendererStops,
      },
    },
    extra: {ledger},
    message: {formatted: `session — ${minutes} min of play, ${defects} defect(s), ${ledger.episodes.length} episode(s)`},
    fingerprint: ['tm-session'],
    ...NOWHERE,
  };
}

export type ReportEventInput = {
  code: string;
  category: string;
  comment: string;
  at: number;
  /** The record the report was opened from. */
  entry: DiagEntry | undefined;
};

/** An explicit report: one event of its own (never grouped with another report), the package rides it as attachments. */
export function reportEventOf(input: ReportEventInput, facts: EventFacts): SentryEvent {
  const carrier: DiagEntry = input.entry ?? {
    id: '', at: input.at, lastAt: input.at, kind: 'note', family: 'report', level: 'warn', runtime: 'page',
    title: '', text: '', count: 1, build: '',
  };
  const event = baseEvent({...carrier, at: input.at}, facts);
  const tags = event.tags as Record<string, string>;
  tags.kind = 'report';
  tags.report_code = input.code;
  tags.report_category = input.category;
  if (input.entry !== undefined) {
    tags.family = input.entry.family;
    tags.entry_kind = input.entry.kind;
  } else {
    tags.family = 'report';
  }
  event.level = 'info';
  const comment = input.comment.trim();
  event.message = {formatted: `Отчёт игрока ${input.code} · ${input.category}${comment === '' ? '' : ` — ${comment.slice(0, 400)}`}`};
  event.fingerprint = ['report', input.code];
  (event.extra as Record<string, unknown>).comment = comment;
  return event;
}
