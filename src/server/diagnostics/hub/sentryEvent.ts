/*
 * A DIAGNOSTIC RECORD → A SENTRY EVENT. Pure: everything it needs is in its arguments.
 *
 * Three shapes, one function each:
 *
 *  · an ERROR with a stack is an EXCEPTION (`exception.values[0]` + frames + the files' debug ids) — Sentry resolves
 *    the frames against the maps the release uploaded and groups by the resolved stack;
 *  · a line with no stack (a stall, an integrity warning, a stackless error) is a MESSAGE with an explicit
 *    fingerprint — its family and its text with what varies taken out;
 *  · a liveness EPISODE is one message for the whole episode: what was asked, how long it stood, how it ended.
 *
 * Every event carries the tags an agent filters by (`kind`, `family`, `runtime`, `app_mode`, `screen`, `prompt_type`,
 * `game_ref` / `seat_ref` — fingerprints, never the ids —, `profile`, `head`; `os` is derived by the collector from the
 * context) and the journal's recent records as breadcrumbs. Nothing here scrubs: the hub scrubs the finished event (`privacy.ts`) before it is sent.
 */

import {readLivenessLine} from '@/common/diagnostics/classify';
import {DiagEntry, DiagFrame} from '@/common/diagnostics/DiagnosticModel';
import {DiagAppMode, DiagContext} from '@/common/diagnostics/protocol';
import {normalizeMessage, parseStack, stackHead} from '@/common/diagnostics/stackFrames';

export type SentryEvent = Record<string, unknown> & {event_id: string};

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
};

const BREADCRUMBS = 30;
const EXTRA_TEXT_MAX = 12_000;

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
    if (value !== undefined && value !== '') {
      tags[key] = value.slice(0, 190);
    }
  };
  put('screen', screen?.screen !== '' ? screen?.screen : facts.context?.screen);
  put('section', screen?.section);
  put('profile', screen?.profile !== '' ? screen?.profile : facts.context?.profile);
  put('prompt_type', facts.context?.promptType);
  put('game_ref', facts.gameRef);
  put('seat_ref', facts.seatRef);
  put('locale', facts.context?.locale);
  if (facts.selfTest) {
    tags.selftest = 'true';
  }
  if (entry.episode !== undefined) {
    tags.episode = entry.episode.state;
  }
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
      // (The collector derives the `os` / `os.name` tags from this context. The host's own runtime — Electron and its
      // version — goes under a name of OURS: a context called `runtime` would make the collector derive a `runtime` tag
      // and overwrite the one that says which of the three runtimes the signal was born in.)
      os: {name: facts.os, version: facts.osVersion},
      device: {arch: facts.arch},
      host_runtime: {name: facts.runtimeName, version: facts.runtimeVersion},
      app: {app_version: facts.release, app_build: entry.build},
      ...(screen !== undefined ? {
        screen: {
          screen: screen.screen, section: screen.section, prompt: screen.prompt, accepting: screen.accepting,
          in_flight: screen.inFlight, frames: screen.frames, quiet_s: screen.quietS, block: screen.block,
          profile: screen.profile, viewport: screen.viewport,
        },
      } : {}),
      ...(entry.episode !== undefined ? {
        episode: {
          state: entry.episode.state, duration_s: Math.round(entry.episode.durationMs / 100) / 10,
          lines: entry.episode.lines, steps: entry.episode.steps,
        },
      } : {}),
    },
    extra: {
      title: entry.title,
      text: entry.text.length > EXTRA_TEXT_MAX ? `${entry.text.slice(0, EXTRA_TEXT_MAX)}…` : entry.text,
      count: entry.count,
      journal_id: entry.id,
    },
    breadcrumbs: {
      values: facts.trail.slice(-BREADCRUMBS).map((e) => ({
        timestamp: e.at / 1000,
        category: `${e.runtime}.${e.family}`,
        level: e.level === 'error' ? 'error' : 'warning',
        message: e.title,
        type: e.kind === 'error' ? 'error' : 'default',
      })),
    },
    // WHERE THE PLAYER IS, IS NOT SAID. `infer_ip: never` keeps the sender's address out of the event — but the
    // collector still looked the connection up and stored a CITY under `user.geo` (measured with the probe,
    // 2026-11-14). It derives a geo only when the event brings none: so the event brings one that says nothing.
    sdk: {name: 'tm.diagnostics', version: '1.0.0', settings: {infer_ip: 'never'}},
    user: {geo: {region: 'not collected'}},
  };
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
  if (entry.family === 'liveness' && entry.episode !== undefined) {
    const first = readLivenessLine(entry.text.split('\n')[0]);
    const what = first.is === 'stall' ? `${first.reason}, asked ${first.asked}` : 'a stall';
    const how = entry.episode.state === 'healed' ?
      `cured after ${Math.round(entry.episode.durationMs / 1000)}s` :
      (entry.episode.state === 'unhealed' ? 'NOT cured' : `standing for ${Math.round(entry.episode.durationMs / 1000)}s`);
    event.message = {formatted: `[liveness] the screen stood still (${what}) — ${how}`};
    event.fingerprint = ['stall', 'liveness', first.is === 'stall' ? first.reason : '', first.is === 'stall' ? first.asked : '', entry.episode.state === 'healed' ? 'healed' : 'unhealed'];
    return event;
  }
  event.message = {formatted: `[${entry.family}] ${entry.title}`};
  event.fingerprint = facts.selfTest ? ['selftest', entry.runtime] : [entry.kind, entry.family, normalizeMessage(entry.title)];
  return event;
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
