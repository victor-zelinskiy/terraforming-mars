#!/usr/bin/env node
/**
 * THE AGENTS' DIAGNOSTICS TOOL — `npm run diag -- <command> [args]`.
 *
 * The game's diagnostics subsystem (`docs/claude/diagnostics.md`) sends what fails on a player's machine — and on the
 * owner's Steam Machine — to Sentry (organization `victor-zelinskiy`, project `terraforming-mars`, EU region), and a
 * player's «Сообщить о проблеме» ends there as ONE issue whose event carries the report package as attachments. This
 * tool is how an agent reads all of it with one command instead of clicking through a web UI:
 *
 *   report <TM-XXXXXX | latest>   the report's package downloaded + a SUMMARY.md built from it
 *   issues [filters]              the project's issues, newest first, filtered by the hub's own tags (`--regressed`:
 *                                 only those that came back after being resolved)
 *   issue <shortId | id>          one issue: its latest event (or `--event <id>`) in READING ORDER — the tags, the CAUSE
 *                                 (class, shape, tier, dimensions), what stood (the question, the holders), the episode
 *                                 (how it ended, who cured it, what changed), the flow tree / waits / wait graph / flow
 *                                 trace, the save; then the stack, the breadcrumbs, the attachments
 *   classes [filters]             ONE ROW PER CAUSE CLASS: events, runs, how they ended, first / last seen, the trend by
 *                                 release, the issue it is filed under
 *   class <cause class>           a class OPENED: its last N cases laid out in folders in reading order + a README (the
 *                                 cases, the issue, how to fetch a case's save, where the class is reproduced in the repo)
 *   trend                         «ARE FREEZES FEWER?» — the session ledgers summed by release: defects and episodes per
 *                                 hour of play and per session, outcomes, time-to-cure, long frames, the top classes, the
 *                                 fires of every net
 *   save <g#… saveId | issue>     the game's save AS IT STOOD when an episode began, from the box (`--fixture <name>`:
 *                                 also as an e2e fixture; `--from <file>`: from a save already on this machine)
 *   resolve <class | shortId>     close a class «fixed in release» (default: this checkout's version — run it after
 *                                 the fix is committed; `--in <version>` names another, `--next` asks the collector)
 *   where <word>                  from a word of the evidence (a scope, a hold, a wait, a block, a rung, a door, a tag, a
 *                                 shape) to the line of the source that declares it
 *   selftest [--since 30m]        did the connection check («Проверка связи») arrive from all three runtimes?
 *   box pull [--since 24h]        the box's diagnostic files (logs, reports, outbox, console exports, field logs)
 *   box resolve <fingerprint>     an automatic event's `p#…` / `g#…` back to the id and the save that holds it
 *   key · key rotate · key retire the client key and the plan's quota; its rotation
 *
 * What is PURE of all this (reading an event as a case, the rows of a class, the sums of a trend, the matching of
 * `where`) lives in `scripts/diag-lib.mjs` and is unit-tested (`tests/scripts/diagLib.spec.ts`).
 *
 * AUTHENTICATION, in this order (the token is never printed):
 *   1. `SENTRY_AUTH_TOKEN` in the environment → plain `fetch` against `https://de.sentry.io/api/0/` with a Bearer header;
 *   2. otherwise the already-authorised `sentry` CLI (`sentry` on PATH, else `%USERPROFILE%\.local\bin\sentry.exe`):
 *      `sentry api <endpoint>` prints the response body on stdout and exits non-zero on an HTTP error (60 for a 4xx,
 *      the body's `detail` says why). The CLI RE-FORMATS what it prints (JSON pretty-printed, a newline appended), so
 *      an ATTACHMENT is downloaded with the CLI's stored token (`sentry auth token`, kept in memory) by a plain `fetch`
 *      — the file on disk is byte-for-byte what was attached.
 *
 * The box is reached as `ssh steam-machine` (key auth, non-interactive — `docs/claude/e2e-remote.md`).
 *
 * WHERE IT WRITES — everything under `.diagnostics/` at the repo root (git-ignored):
 *   .diagnostics/reports/<TM-XXXXXX>/   the report's attachments + event.json + SUMMARY.md
 *   .diagnostics/issues/<shortId>/      an issue's attachments + event.json (`--event`: under `events/<eventId>/`)
 *   .diagnostics/classes/<class>/       a class: README.md + one folder per case (`NN-<when>-<outcome>/`: 00-summary.md,
 *                                       01-lines.txt … 05-flow-trace.txt, event.json, the event's attachments)
 *   .diagnostics/sessions/<eventId>.json  a session event, fetched once (what `trend` reads)
 *   .diagnostics/saves/<gameId>-<saveId>.json  a game's save from the box (it holds the table's ids and names)
 *   .diagnostics/box/<YYYYMMDD-HHMMSS>/ the box's files, by their path relative to /home/deck
 * …and ONE thing outside it, only when asked by name: `save --fixture <name>` writes
 * `tests/e2e/fixtures/field-<name>.json` (the save with its names anonymized, checked against the current engine).
 *
 * User input never reaches a shell string: every process is spawned with an argument array, and the values that do go
 * into the box's remote command (`--since`, a fingerprint, a game id, a save id) are validated against a strict
 * pattern first. What goes into a query of the collector is a URL parameter, and a cause class is refused when it
 * holds a quote, a backslash or a wildcard.
 */
import * as fs from 'fs';
import * as path from 'path';
import {spawn} from 'child_process';
import {fileURLToPath} from 'url';
import {
  aggregateTrend, BOX_HISTORY_DIR, caseFiles, caseFolderName, caseSummaryMd, classReadme, cut, extraOf, findReproductions, fingerprintOf,
  FINGERPRINT_DIGITS, fixtureFromSave, fixtureText, hasCause, historyFileName, issueLine, localTime, mergeClassRows, pad2, parseHistoryListing, pickSaveId,
  readCase, RELEASE_PREFIX, renderCase, renderClasses, renderTrend, renderWhere, safeClassDir, shortRelease, table, tagsOf, whereSearch,
} from './diag-lib.mjs';

const ORG = 'victor-zelinskiy';
const PROJECT = 'terraforming-mars';
/** The project's numeric id — what the grouped (Discover) endpoint is scoped by. */
const PROJECT_ID = '4512424269054032';
const API_BASE = 'https://de.sentry.io/api/0/';
const BOX = 'steam-machine';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.diagnostics');
/** The environments an event is filed under (`hubConfig.ts`); `development` is the probe's (`scripts/diag-probe.mjs`). */
const ENVIRONMENTS = ['box', 'production', 'development'];
/** «All time» for the grouped endpoint: the collector keeps events 90 days at most. */
const ALL_PERIOD = '90d';
/** Flags that never take a value — `resolve --next <class>` must not read the class as the flag's. */
const BOOLEAN_FLAGS = new Set(['json', 'regressed', 'next']);

// ───────────────────────────── small helpers ─────────────────────────────

class Failure extends Error {
  constructor(message, code = 1) {
    super(message);
    this.exitCode = code;
  }
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else if (BOOLEAN_FLAGS.has(a.slice(2))) {
        flags[a.slice(2)] = true;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        flags[a.slice(2)] = argv[++i];
      } else {
        flags[a.slice(2)] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return {positional, flags};
}

/** `24h` / `30m` / `7d` (or `all` where allowed) — the one shape a period may take. */
function period(value, fallback, allowAll) {
  const v = value === undefined || value === true ? fallback : String(value);
  if (allowAll && v === 'all') {
    return v;
  }
  if (!/^\d+[mhd]$/.test(v)) {
    throw new Failure(`--since must look like 30m, 24h or 7d${allowAll ? ' (or all)' : ''} — got «${v}»`, 2);
  }
  return v;
}

function minutesOf(p) {
  const n = Number(p.slice(0, -1));
  return p.endsWith('m') ? n : p.endsWith('h') ? n * 60 : n * 1440;
}

function oneOf(name, value, allowed) {
  if (value === undefined) {
    return undefined;
  }
  if (!allowed.includes(String(value))) {
    throw new Failure(`--${name} must be one of ${allowed.join(' | ')} — got «${value}»`, 2);
  }
  return String(value);
}

function qs(params) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

// (`cut`, `pad2`, `localTime`, `table`, `tagsOf` are the pure module's — `diag-lib.mjs`.)

function clock(ms) {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '—' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function size(bytes) {
  if (typeof bytes !== 'number') {
    return '?';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function safeName(name) {
  const base = path.basename(String(name)).replace(/[^A-Za-z0-9._-]/g, '_');
  return base === '' || base === '.' || base === '..' ? 'attachment.bin' : base;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/** Runs a process with an argument array; resolves with its exit code and BOTH streams as buffers. */
function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, {windowsHide: true, ...options});
    } catch (err) {
      reject(err);
      return;
    }
    const out = [];
    const err = [];
    child.stdout?.on('data', (b) => out.push(b));
    child.stderr?.on('data', (b) => err.push(b));
    child.on('error', reject);
    child.on('close', (code) => resolve({code, stdout: Buffer.concat(out), stderr: Buffer.concat(err)}));
  });
}

// ───────────────────────────── Sentry ─────────────────────────────

let sentryBinary;

/** Runs the `sentry` CLI with an argument array: `sentry` on PATH first, then `%USERPROFILE%\.local\bin\sentry.exe`. */
async function sentryCli(args) {
  const candidates = sentryBinary !== undefined ? [sentryBinary] :
    ['sentry', path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.local', 'bin', process.platform === 'win32' ? 'sentry.exe' : 'sentry')];
  let lastError;
  for (const bin of candidates) {
    try {
      const result = await run(bin, args);
      sentryBinary = bin;
      return result;
    } catch (err) {
      lastError = err;
      if (err.code !== 'ENOENT') {
        break;
      }
    }
  }
  throw new Failure(`no Sentry access: SENTRY_AUTH_TOKEN is not set and the \`sentry\` CLI could not be started (${lastError?.message ?? 'not found'})`);
}

function detailOf(body) {
  const text = body.toString('utf8').trim();
  try {
    const json = JSON.parse(text);
    if (json !== null && typeof json === 'object' && json.detail !== undefined) {
      return typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail);
    }
  } catch {
    // not JSON — fall through to the raw text
  }
  return cut(text, 300) || '(no body)';
}

async function fetchWith(token, endpoint) {
  let res;
  try {
    res = await fetch(API_BASE + endpoint, {headers: {Authorization: `Bearer ${token}`}});
  } catch (err) {
    throw new Failure(`sentry: GET ${endpoint} — network error: ${err.cause?.message ?? err.message}`);
  }
  const body = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    throw new Failure(`sentry: GET ${endpoint} — HTTP ${res.status}: ${detailOf(body)}`);
  }
  return body;
}

let cliToken;

/** The CLI's own stored token (`sentry auth token`) — held in memory only, never printed. */
async function tokenFromCli() {
  if (cliToken === undefined) {
    const r = await sentryCli(['auth', 'token']).catch(() => undefined);
    const t = r?.code === 0 ? r.stdout.toString('utf8').trim() : '';
    cliToken = /^\S+$/.test(t) ? t : '';
  }
  return cliToken;
}

/** GET an endpoint (relative to /api/0/). `binary` → a Buffer, else the parsed JSON. */
async function api(endpoint, {binary = false} = {}) {
  const token = process.env.SENTRY_AUTH_TOKEN;
  let body;
  if (token !== undefined && token !== '') {
    body = await fetchWith(token, endpoint);
  }
  if (body === undefined && binary && await tokenFromCli() !== '') {
    // `sentry api` RE-FORMATS what it prints (a JSON attachment comes back pretty-printed, a text one gains a newline):
    // a download goes straight to the API with the CLI's own token, so the file is byte-for-byte what was attached.
    try {
      body = await fetchWith(cliToken, endpoint);
    } catch (err) {
      console.error(`${err.message} — falling back to \`sentry api\` (its copy of a text/JSON file may be re-formatted)`);
    }
  }
  if (body === undefined) {
    const r = await sentryCli(['api', endpoint]);
    if (r.code !== 0) {
      const why = r.stdout.length > 0 ? detailOf(r.stdout) : cut(r.stderr.toString('utf8'), 300);
      throw new Failure(`sentry: GET ${endpoint} — the CLI exited ${r.code}: ${why}`);
    }
    body = r.stdout;
  }
  if (binary) {
    return body;
  }
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new Failure(`sentry: GET ${endpoint} — the answer is not JSON: ${cut(body.toString('utf8'), 200)}`);
  }
}

const projectPath = `projects/${ORG}/${PROJECT}`;

function searchIssues({query, environment, limit, sort}) {
  return api(`${projectPath}/issues/${qs({query, environment, limit, sort})}`);
}

async function issueById(ref) {
  const s = String(ref);
  if (/^\d+$/.test(s)) {
    return api(`organizations/${ORG}/issues/${s}/`);
  }
  if (!/^[A-Za-z0-9-]+$/.test(s)) {
    throw new Failure(`«${s}» is neither a numeric issue id nor a short id (TERRAFORMING-MARS-1A)`, 2);
  }
  const found = await api(`organizations/${ORG}/shortids/${encodeURIComponent(s.toUpperCase())}/`);
  return found.group ?? found;
}

function latestEvent(issueId) {
  return api(`organizations/${ORG}/issues/${issueId}/events/latest/`);
}

/** One event by its id (32 hex digits) — the same JSON `latestEvent` answers. */
function eventById(eventId) {
  const id = String(eventId).toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(id)) {
    throw new Failure(`«${eventId}» is not an event id (32 hex digits)`, 2);
  }
  return api(`${projectPath}/events/${id}/`);
}

/**
 * The GROUPED endpoint (Discover over the `errors` dataset): one row per distinct combination of the plain `fields`,
 * with the functions (`count()`, `count_unique(run)`, `min(timestamp)` …) computed over it. A custom tag of the hub
 * (`cause`, `outcome`, `run` …) is a field and a query term by its own name. ONE page: `limit` ≤ 100.
 */
async function discover({fields, query, since, env, sort, limit = 100}) {
  const params = [
    ...fields.map((f) => ['field', f]),
    ['query', query], ['statsPeriod', since === 'all' ? ALL_PERIOD : since], ['environment', env], ['sort', sort],
    ['dataset', 'errors'], ['project', PROJECT_ID], ['per_page', String(limit)],
  ].filter(([, v]) => v !== undefined && v !== '');
  const answer = await api(`organizations/${ORG}/events/?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`);
  return Array.isArray(answer?.data) ? answer.data : [];
}

/** `fn` over `items`, at most `limit` at a time, the answers in the items' order. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
  return out;
}

/** A cause class as the user typed it: what may stand inside a quoted term of the collector's query, and nothing else. */
function causeClassArg(value, usage) {
  const cls = String(value ?? '').trim();
  if (cls === '' || !cls.includes('/')) {
    throw new Failure(usage, 2);
  }
  if (cls.length > 200 || /["\\*]/.test(cls) || [...cls].some((ch) => ch.charCodeAt(0) < 32)) {
    throw new Failure(`«${cut(cls, 80)}» is not a cause class (no quote, backslash, wildcard or control character; at most 200 characters)`, 2);
  }
  return cls;
}

/** `--release 1.2.3250` (or the full `terraforming-mars@1.2.3250`) → the release as the collector names it. */
function releaseArg(name, value) {
  if (value === undefined) {
    return undefined;
  }
  const v = String(value).startsWith(RELEASE_PREFIX) ? String(value).slice(RELEASE_PREFIX.length) : String(value);
  if (!/^\d+\.\d+\.\d+$/.test(v)) {
    throw new Failure(`--${name} must be a version like 1.2.3250 — got «${value}»`, 2);
  }
  return `${RELEASE_PREFIX}${v}`;
}

function intArg(name, value, fallback, min, max) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Failure(`--${name} must be an integer ${min}…${max}`, 2);
  }
  return n;
}

function entryOf(event, type) {
  return (event.entries ?? []).find((e) => e.type === type)?.data;
}

function framesOf(event) {
  const values = entryOf(event, 'exception')?.values ?? event.exception?.values ?? [];
  return values.flatMap((v) => v.stacktrace?.frames ?? []);
}

function isResolvedFrame(f) {
  const file = String(f.filename ?? f.absPath ?? f.abs_path ?? '');
  const abs = String(f.absPath ?? f.abs_path ?? '');
  return [file, abs].some((s) => /(^|[\\/])src[\\/]/.test(s) || /\.(ts|vue)$/.test(s));
}

/** Downloads every attachment of an event into `dir`; returns [{name, bytes}] (or [] if none). */
async function downloadAttachments(eventId, dir) {
  const list = await api(`${projectPath}/events/${eventId}/attachments/`);
  const got = [];
  for (const a of Array.isArray(list) ? list : []) {
    const data = await api(`${projectPath}/events/${eventId}/attachments/${a.id}/?download=1`, {binary: true});
    const name = safeName(a.name);
    fs.writeFileSync(path.join(dir, name), data);
    got.push({name, bytes: data.length});
  }
  return got;
}

// ───────────────────────────── report ─────────────────────────────

function firstOwnFrame(stackText) {
  for (const line of String(stackText ?? '').split('\n')) {
    const t = line.trim();
    if (t.startsWith('at ') && !/node_modules|node:|<anonymous>|electron\/js2c/.test(t)) {
      return t.slice(3);
    }
  }
  return undefined;
}

function buildSummary({code, issue, event, report, journal, files}) {
  const tags = tagsOf(event ?? {});
  const L = [];
  const ctx = report?.context ?? {};
  L.push(`# Report ${code}`);
  L.push('');
  L.push(`- **When:** ${localTime(report?.createdAt ?? event?.dateCreated)}`);
  L.push(`- **Category:** ${report?.category ?? tags.report_category ?? '—'}`);
  const words = String(report?.comment ?? event?.context?.comment ?? '').trim();
  L.push(`- **The player's words:** ${words === '' ? '(none)' : `«${words}»`}`);
  L.push(`- **Release / env / app mode / os:** ${report?.release ?? event?.release?.version ?? tags.release ?? '—'} · ${report?.environment ?? tags.environment ?? '—'} · ${report?.appMode ?? tags.app_mode ?? '—'} · ${report?.platform ?? tags.os ?? '—'}${report?.osVersion ? ` ${report.osVersion}` : ''}`);
  if (report?.head) {
    L.push(`- **Head:** ${report.head}`);
  }
  L.push(`- **Sentry issue:** ${issue?.permalink ?? '—'} (${issue?.shortId ?? '?'})`);
  L.push('');
  L.push('## The record it was opened from');
  const entry = report?.entry;
  if (entry === undefined || entry === null) {
    L.push('None — the report was opened from a menu, not from a journal record.');
  } else {
    L.push(`- kind **${entry.kind}** · family \`${entry.family}\` · runtime ${entry.runtime} · ×${entry.count ?? 1}`);
    L.push(`- title: ${cut(entry.title, 300)}`);
    if (entry.episode) {
      L.push(`- episode: ${entry.episode.state}, ${Math.round((entry.episode.durationMs ?? 0) / 100) / 10} s, ${entry.episode.lines ?? '?'} lines`);
    }
    const own = firstOwnFrame(entry.stack ?? entry.text);
    if (own !== undefined) {
      L.push(`- first own-code frame: \`${own}\``);
    }
  }
  L.push('');
  L.push('## Screen at the press');
  L.push(`- screen: ${ctx.screen || '—'} · profile: ${ctx.profile || '—'} · promptType: ${ctx.promptType || '—'}`);
  L.push(`- participantId: ${ctx.participantId || '—'} · gameId: ${ctx.gameId || '—'} · saveGameId: ${report?.saveGameId ?? '—'} · seatRef: ${report?.seatRef || '—'}`);
  if (report?.saveOmitted) {
    L.push(`- save omitted: ${report.saveOmitted}`);
  }
  L.push('');
  L.push('## Journal');
  if (!Array.isArray(journal)) {
    L.push('No journal.json in the package.');
  } else if (journal.length === 0) {
    L.push('The journal is empty.');
  } else {
    const counts = {};
    for (const e of journal) {
      counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    }
    L.push(`${journal.length} records — ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    L.push('');
    L.push('| time | kind | runtime | family | × | title |');
    L.push('| --- | --- | --- | --- | --- | --- |');
    for (const e of journal.slice(-15)) {
      L.push(`| ${clock(e.at)} | ${e.kind} | ${e.runtime} | ${e.family} | ${e.count ?? 1} | ${cut(e.title, 120).replace(/\|/g, '\\|')} |`);
    }
    const episodes = journal.filter((e) => e.episode !== undefined && e.episode !== null);
    if (episodes.length > 0) {
      L.push('');
      L.push('Liveness episodes:');
      for (const e of episodes) {
        L.push(`- ${clock(e.at)} ${e.family}: ${e.episode.state}, ${Math.round((e.episode.durationMs ?? 0) / 100) / 10} s — ${cut(e.title, 120)}`);
      }
    }
  }
  L.push('');
  L.push('## Parts');
  const declared = Array.isArray(report?.parts) ? report.parts : [];
  const names = new Set([...declared.map((p) => p.name), ...files.map((f) => f.name)]);
  for (const name of names) {
    const d = declared.find((p) => p.name === name);
    const f = files.find((x) => x.name === name);
    L.push(`- ${name} — ${size(d?.bytes ?? f?.bytes)}${d?.truncated ? ' **truncated**' : ''}${f === undefined ? ' (not downloaded)' : ''}`);
  }
  L.push('');
  L.push('## What to read next');
  if (names.has('console_export.txt')) {
    L.push('- `console_export.txt` — opens with its ERRORS / STALLS / SCREEN digests.');
  }
  if (names.has('field_record.json')) {
    L.push('- `field_record.json` — the screen second by second before the press.');
  }
  if (names.has('save.json')) {
    L.push('- `save.json` — the game\'s save; load it with the dev loader.');
  }
  if (names.has('hang_trace.json')) {
    L.push('- `hang_trace.json` — a Chromium trace (chrome://tracing / Perfetto).');
  }
  if ([...names].some((n) => n.startsWith('log_'))) {
    L.push('- `log_*.txt` — tails of the main process / embedded server logs.');
  }
  L.push('- `event.json` — the full Sentry event (tags, contexts, breadcrumbs).');
  return L.join('\n') + '\n';
}

async function cmdReport(args) {
  const ref = args.positional[0];
  if (ref === undefined) {
    throw new Failure('usage: diag report <TM-XXXXXX | latest>', 2);
  }
  let query;
  if (ref === 'latest') {
    query = 'kind:report';
  } else {
    const code = ref.toUpperCase();
    if (!/^TM-[A-Z0-9]{6}$/.test(code)) {
      throw new Failure(`«${ref}» is not a report code (TM- and six characters, e.g. TM-K7QW3D)`, 2);
    }
    query = `report_code:${code}`;
  }
  const found = await searchIssues({query, sort: 'date', limit: 1});
  if (!Array.isArray(found) || found.length === 0) {
    console.log(ref === 'latest' ? 'No report found in Sentry (no issue tagged kind:report).' : `No report ${ref.toUpperCase()} found in Sentry.`);
    return 0;
  }
  const issue = found[0];
  const event = await latestEvent(issue.id);
  const code = tagsOf(event).report_code ?? (ref === 'latest' ? issue.shortId : ref.toUpperCase());
  const dir = path.join(OUT, 'reports', safeName(code));
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'event.json'), JSON.stringify(event, null, 1));
  const files = await downloadAttachments(event.eventID ?? event.id, dir);
  const summary = buildSummary({
    code, issue, event,
    report: readJson(path.join(dir, 'report.json')),
    journal: readJson(path.join(dir, 'journal.json')),
    files,
  });
  fs.writeFileSync(path.join(dir, 'SUMMARY.md'), summary);
  console.log(summary);
  console.log(`→ ${rel(dir)}/  (${files.length} attachment${files.length === 1 ? '' : 's'} + event.json + SUMMARY.md)`);
  return 0;
}

// ───────────────────────────── issues / issue ─────────────────────────────

async function cmdIssues(args) {
  const f = args.flags;
  // (A class that came back is not «seen in the last day» by default: `--regressed` looks at all of them.)
  const since = period(f.since, f.regressed ? 'all' : '24h', true);
  const env = oneOf('env', f.env, ENVIRONMENTS);
  const terms = [];
  if (f.regressed) {
    // «A class closed in release X returned»: resolved (`diag resolve`), then seen again in a later release.
    terms.push('is:regressed');
  }
  const kind = oneOf('kind', f.kind, ['error', 'stall', 'integrity', 'report', 'session']);
  if (kind) {
    terms.push(`kind:${kind}`);
  }
  if (f.family !== undefined) {
    if (!/^[A-Za-z0-9._-]+$/.test(String(f.family))) {
      throw new Failure(`--family must be a tag like liveness or page-error — got «${f.family}»`, 2);
    }
    terms.push(`family:${f.family}`);
  }
  const runtime = oneOf('runtime', f.runtime, ['page', 'main', 'server']);
  if (runtime) {
    terms.push(`runtime:${runtime}`);
  }
  if (since !== 'all') {
    terms.push(`lastSeen:-${since}`);
  }
  const limit = intArg('limit', f.limit, 25, 1, 100);
  const list = await searchIssues({query: terms.join(' '), environment: env, limit, sort: 'date'});
  if (f.json) {
    console.log(JSON.stringify(list, null, 2));
    return 0;
  }
  const filters = `${terms.join(' ') || '(no filter)'}${env ? ` · environment=${env}` : ''}`;
  if (!Array.isArray(list) || list.length === 0) {
    console.log(f.regressed ? `No issue came back after being resolved (${filters}).` : `No issues found for ${filters}.`);
    return 0;
  }
  console.log(`${list.length} issue${list.length === 1 ? '' : 's'} for ${filters}:\n`);
  console.log(table(list.map((i) => [
    i.shortId, i.level ?? '—', i.count ?? '—', localTime(i.lastSeen), env ?? '—', cut(i.title, 100),
  ]), ['SHORT ID', 'LEVEL', 'SEEN', 'LAST SEEN', 'ENV', 'TITLE']));
  if (f.regressed) {
    console.log('\nEach came back after `diag resolve`: `npm run diag -- issue <SHORT ID>` reads its newest case; its tag `cause` is the class to open.');
  }
  return 0;
}

function contextLines(event, name) {
  const c = event.contexts?.[name];
  if (c === undefined || c === null) {
    return [];
  }
  const L = [`Context ${name}:`];
  for (const [k, v] of Object.entries(c)) {
    if (k !== 'type') {
      L.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
  }
  return L;
}

async function cmdIssue(args) {
  const ref = args.positional[0];
  if (ref === undefined) {
    throw new Failure('usage: diag issue <shortId | numeric id> [--event <eventId>]', 2);
  }
  const issue = await issueById(ref);
  const asked = args.flags.event;
  if (asked === true) {
    throw new Failure('--event needs an event id (32 hex digits) — `diag class <cause class>` lists a class\'s events', 2);
  }
  const event = asked === undefined ? await latestEvent(issue.id) : await eventById(asked);
  if (asked !== undefined && String(event.groupID) !== String(issue.id)) {
    throw new Failure(`event ${asked} is not an event of ${issue.shortId} (it belongs to issue ${event.groupID})`, 2);
  }
  const eventId = event.eventID ?? event.id;
  const L = [];
  L.push(`${issue.shortId} — ${issue.title}`);
  L.push(`level ${issue.level} · status ${issue.status} · seen ${issue.count}× by ${issue.userCount ?? 0} user(s) · first ${localTime(issue.firstSeen)} · last ${localTime(issue.lastSeen)}`);
  L.push(issue.permalink ?? '');
  L.push('');
  L.push(`${asked === undefined ? 'Latest event' : 'Event'} ${eventId} · ${localTime(event.dateCreated)}`);
  L.push('');
  L.push('Tags:');
  for (const [k, v] of Object.entries(tagsOf(event))) {
    L.push(`  ${k}=${v}`);
  }
  // THE CAUSE, IN READING ORDER: what it is → what stood → how it ended → the net's own lines → the long lists → the
  // save. An event with none of it (an exception, a report, an event of an older build) prints what it always did.
  const read = readCase(event);
  const block = (lines) => {
    if (lines.length > 0) {
      L.push('');
      L.push(...lines);
    }
  };
  if (hasCause(read)) {
    const parts = renderCase(read);
    block(parts.cause);
    block(parts.evidence);
    block(parts.episode.length > 0 ? parts.episode : contextLines(event, 'episode'));
    block(contextLines(event, 'screen'));
    block(parts.lines);
    block(parts.lists);
    block(parts.save);
    block(parts.cut);
  } else {
    block(contextLines(event, 'screen'));
    block(contextLines(event, 'episode'));
    block(contextLines(event, 'session'));
  }
  const exc = entryOf(event, 'exception')?.values ?? [];
  if (exc.length > 0) {
    for (const v of exc) {
      L.push('');
      L.push(`Exception ${v.type}: ${v.value}`);
      const frames = [...(v.stacktrace?.frames ?? [])].reverse();
      for (const fr of frames) {
        const where = `${fr.filename ?? fr.absPath ?? '?'}${fr.lineNo ? `:${fr.lineNo}` : ''}${fr.colNo ? `:${fr.colNo}` : ''}`;
        L.push(`  ${fr.inApp ? '*' : ' '} ${fr.function ?? '?'}  ${where}`);
      }
      L.push('  (newest first; * = in-app)');
    }
  } else {
    const msg = entryOf(event, 'message')?.formatted ?? event.message ?? event.title;
    L.push('');
    L.push(`Message: ${msg}`);
  }
  const crumbs = entryOf(event, 'breadcrumbs')?.values ?? [];
  L.push('');
  if (crumbs.length === 0) {
    L.push('No breadcrumbs.');
  } else {
    L.push(`Breadcrumbs (last ${Math.min(15, crumbs.length)} of ${crumbs.length}):`);
    for (const b of crumbs.slice(-15)) {
      L.push(`  ${localTime(b.timestamp)}  ${b.level ?? ''}  ${b.category ?? ''}  ${cut(b.message, 140)}`);
    }
  }
  // (The latest event is the issue's own folder; an event asked for by its id has a folder of its own beside it.)
  const dir = asked === undefined ? path.join(OUT, 'issues', safeName(issue.shortId)) : path.join(OUT, 'issues', safeName(issue.shortId), 'events', safeName(eventId));
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'event.json'), JSON.stringify(event, null, 1));
  const files = await downloadAttachments(eventId, dir);
  L.push('');
  L.push(files.length === 0 ? 'No attachments.' : `Attachments: ${files.map((x) => `${x.name} (${size(x.bytes)})`).join(', ')}`);
  L.push(`→ ${rel(dir)}/`);
  if (read.cause !== undefined) {
    L.push(`the whole class:  npm run diag -- class ${read.cause.cls}`);
  }
  console.log(L.join('\n'));
  return 0;
}

// ───────────────────────────── classes / class ─────────────────────────────

/** The filters `classes`, `class` and `trend` share → the terms of a query, and how to say them. */
function eventFilters(f, {kinds} = {}) {
  const env = oneOf('env', f.env, ENVIRONMENTS);
  const release = releaseArg('release', f.release === true ? '' : f.release);
  const terms = [];
  const said = [];
  if (release !== undefined) {
    terms.push(`release:"${release}"`);
    said.push(`release ${shortRelease(release)}`);
  }
  const tier = oneOf('tier', f.tier, ['defect', 'planned', 'info']);
  if (tier) {
    terms.push(`tier:${tier}`);
    said.push(`tier ${tier}`);
  }
  const kind = oneOf('kind', f.kind, kinds ?? ['stall', 'integrity']);
  if (kind) {
    terms.push(`kind:${kind}`);
    said.push(`kind ${kind}`);
  }
  if (env) {
    said.push(`environment ${env}`);
  }
  return {env, release, terms, said};
}

async function cmdClasses(args) {
  const f = args.flags;
  const since = period(f.since, '14d', true);
  const limit = intArg('limit', f.limit, 50, 1, 100);
  const {env, terms, said} = eventFilters(f);
  const query = ['has:cause', ...terms].join(' ');
  // THREE grouped questions, one page each. The issue a class is filed under comes from the FIRST one (grouped by
  // `cause` + `issue`) — cheaper than a search of the issues per class, and it shows by itself a class the
  // fingerprint did not group (two rows of one cause).
  const [main, outcomes, releases] = await Promise.all([
    discover({fields: ['cause', 'tier', 'kind', 'issue', 'issue.id', 'count()', 'count_unique(run)', 'min(timestamp)', 'max(timestamp)'], query, since, env, sort: '-count()'}),
    discover({fields: ['cause', 'outcome', 'count()'], query, since, env}),
    discover({fields: ['cause', 'release', 'count()'], query, since, env}),
  ]);
  const rows = mergeClassRows(
    main.map((r) => ({cause: r.cause, tier: r.tier, kind: r.kind, issue: r.issue, issueId: r['issue.id'], count: r['count()'], runs: r['count_unique(run)'], first: r['min(timestamp)'], last: r['max(timestamp)']})),
    outcomes.map((r) => ({cause: r.cause, outcome: r.outcome, count: r['count()']})),
    releases.map((r) => ({cause: r.cause, release: r.release, count: r['count()']})),
  );
  const shown = rows.slice(0, limit);
  if (f.json) {
    console.log(JSON.stringify(shown, null, 2));
    return 0;
  }
  const window = `${since === 'all' ? `all the collector keeps (${ALL_PERIOD})` : `the last ${since}`}${said.length > 0 ? ` · ${said.join(' · ')}` : ''}`;
  if (rows.length === 0) {
    console.log(`No event names a cause class in ${window}.`);
    return 0;
  }
  console.log(`${rows.length} cause class${rows.length === 1 ? '' : 'es'} in ${window}${rows.length > shown.length ? ` — the ${shown.length} with the most events` : ''}:\n`);
  console.log(renderClasses(shown));
  console.log('');
  console.log('EVENTS = what was SENT (a class is capped per run — `diag trend` counts every record) · RUNS = app runs that sent one · BY RELEASE reads left to right as time does');
  if ([main, outcomes, releases].some((page) => page.length >= 100)) {
    console.log('⚠ a grouped answer filled its page of 100 rows — some classes or cells may be missing: narrow --since, --env or --release.');
  }
  if (rows.some((r) => r.issues.length > 1)) {
    console.log('⚠ SPLIT = one cause class filed under several issues: the fingerprint did not group it (an event of a build before the cause existed, or a merge undone in the collector).');
  }
  console.log(`open one:  npm run diag -- class ${rows[0].cls}`);
  return 0;
}

/** The text files a search of the repo reads: every one under `dir` with one of `extensions`, the heavy folders left out. */
function sourceFiles(dir, extensions, {skip = [], maxBytes = 4 * 1024 * 1024, depth = 12} = {}) {
  const out = [];
  const visit = (d, left) => {
    let entries;
    try {
      entries = fs.readdirSync(d, {withFileTypes: true});
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (left > 0 && e.name !== 'node_modules' && !e.name.startsWith('.') && !skip.includes(e.name)) {
          visit(full, left - 1);
        }
      } else if (e.isFile() && extensions.some((x) => (typeof x === 'string' ? e.name.endsWith(x) : x.test(e.name)))) {
        try {
          if (fs.statSync(full).size <= maxBytes) {
            out.push(full);
          }
        } catch {
          // gone between the listing and the look — not a file to read
        }
      }
    }
  };
  visit(dir, depth);
  return out;
}

/** WHERE THE CLASS IS REPRODUCED IN THE REPO: the specs and drivers under `tests/`, and the monkey's reports the box sent back. */
function reproductionsOf(cls) {
  const paths = [
    // (The e2e fixtures are saves — megabytes of them, and a save never names a class.)
    ...sourceFiles(path.join(ROOT, 'tests'), ['.ts', '.mjs', '.cjs', '.js', '.json', '.md', '.txt'], {skip: ['fixtures']}),
    // (`.e2e-remote/<task>/test-results[/<pass>]/monkey-report.json` — `scripts/monkey-report.mjs`.)
    ...sourceFiles(path.join(ROOT, '.e2e-remote'), [/^monkey-report.*\.json$/], {depth: 3, maxBytes: 32 * 1024 * 1024}),
  ];
  const needle = Buffer.from(cls, 'utf8');
  const files = [];
  for (const p of paths) {
    let data;
    try {
      data = fs.readFileSync(p);
    } catch {
      continue;
    }
    if (data.includes(needle)) {
      files.push({path: rel(p), text: data.toString('utf8')});
    }
  }
  return {hits: findReproductions(files, cls), searched: paths.length};
}

async function cmdClass(args) {
  const f = args.flags;
  const cls = causeClassArg(args.positional[0], 'usage: diag class <cause class> [--last 5] [--env box|production|development] [--release <version>] [--since 14d|all]\n(`diag classes` lists them; a class looks like liveness/stall/unserved/handpick/hand:committed/block:reveal)');
  const last = intArg('last', f.last, 5, 1, 20);
  const since = period(f.since, 'all', true);
  const {env, terms, said} = eventFilters(f, {kinds: []});
  const query = [`cause:"${cls}"`, ...terms].join(' ');
  const found = await discover({fields: ['id', 'timestamp', 'issue.id'], query, since, env, sort: '-timestamp', limit: last});
  const filters = [`the last ${last}`, ...said, ...(since === 'all' ? [] : [`within ${since}`])].join(' · ');
  const dir = path.join(OUT, 'classes', safeClassDir(cls));
  // The folder is the class as it is read NOW: the cases of an earlier look are not left beside the new ones.
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const events = await mapLimit(found, 8, (row) => eventById(row.id));
  const issueIds = [...new Set(events.map((e) => String(e.groupID ?? '')).filter((id) => id !== ''))];
  let issues = await mapLimit(issueIds, 4, (id) => api(`organizations/${ORG}/issues/${id}/`));
  if (issues.length === 0) {
    // No event in the window: the issue (resolved, perhaps) still says when the class was last seen.
    const listed = await searchIssues({query: `cause:"${cls}"`, limit: 5});
    issues = Array.isArray(listed) ? listed : [];
  }
  const cases = [];
  for (const [i, event] of events.entries()) {
    const read = readCase(event);
    const folder = caseFolderName(i, read);
    const caseDir = path.join(dir, folder);
    fs.mkdirSync(caseDir, {recursive: true});
    fs.writeFileSync(path.join(caseDir, 'event.json'), JSON.stringify(event, null, 1));
    for (const [name, lines] of caseFiles(read)) {
      fs.writeFileSync(path.join(caseDir, name), lines.length === 0 ? '' : `${lines.join('\n')}\n`);
    }
    const attachments = await downloadAttachments(read.eventId, caseDir);
    fs.writeFileSync(path.join(caseDir, '00-summary.md'), caseSummaryMd(read, {index: i, issue: issues.find((x) => String(x.id) === read.issueId), attachments}));
    cases.push({folder, case: read, attachments});
  }
  const repro = reproductionsOf(cls);
  const readme = classReadme({cls, cases, issues, repro: repro.hits, filters});
  fs.writeFileSync(path.join(dir, 'README.md'), readme);
  console.log(readme);
  const attached = cases.reduce((n, c) => n + c.attachments.length, 0);
  console.log(`→ ${rel(dir)}/  (README.md + ${cases.length} case folder${cases.length === 1 ? '' : 's'}, ${attached} attachment${attached === 1 ? '' : 's'}; ${repro.searched} files of the repo searched for the class)`);
  return events.length === 0 ? 1 : 0;
}

// ───────────────────────────── trend ─────────────────────────────

async function cmdTrend(args) {
  const f = args.flags;
  const since = period(f.since, '30d', true);
  const {env, terms, said} = eventFilters(f, {kinds: []});
  // The session events are found through the grouped endpoint (their ids, the newest first — one page of 100 runs),
  // and each event's full JSON is fetched ONCE: a ledger never changes after it was sent.
  const found = await discover({fields: ['id', 'timestamp'], query: ['kind:session', ...terms].join(' '), since, env, sort: '-timestamp'});
  const cacheDir = path.join(OUT, 'sessions');
  fs.mkdirSync(cacheDir, {recursive: true});
  let fetched = 0;
  const ledgers = await mapLimit(found, 8, async (row) => {
    const file = path.join(cacheDir, `${safeName(row.id)}.json`);
    let event = readJson(file);
    if (event === undefined) {
      event = await eventById(row.id);
      fs.writeFileSync(file, JSON.stringify(event, null, 1));
      fetched++;
    }
    return extraOf(event).ledger;
  });
  const agg = aggregateTrend(ledgers);
  if (f.json) {
    console.log(JSON.stringify(agg, null, 2));
    return 0;
  }
  const window = `${since === 'all' ? `all the collector keeps (${ALL_PERIOD})` : `the last ${since}`}${said.length > 0 ? ` · ${said.join(' · ')}` : ''}`;
  console.log(`${found.length} session event${found.length === 1 ? '' : 's'} in ${window} (${fetched} fetched now, ${found.length - fetched} read from ${rel(cacheDir)}/)\n`);
  console.log(renderTrend(agg));
  if (found.length >= 100) {
    console.log('\n⚠ the page of 100 session events is full — older runs of the window are not counted: narrow --since or --release.');
  }
  return 0;
}

// ───────────────────────────── selftest ─────────────────────────────

async function cmdSelftest(args) {
  const since = period(args.flags.since, '30m', false);
  const list = await searchIssues({query: `selftest:true lastSeen:-${since}`, sort: 'date', limit: 25});
  const byRuntime = {};
  for (const issue of Array.isArray(list) ? list : []) {
    const event = await latestEvent(issue.id);
    const tags = tagsOf(event);
    const runtime = tags.runtime ?? '?';
    if (byRuntime[runtime] !== undefined) {
      continue;
    }
    const frames = framesOf(event);
    byRuntime[runtime] = {
      at: localTime(event.dateCreated),
      env: tags.environment ?? '—',
      release: tags.release ?? event.release?.version ?? '—',
      stack: frames.length === 0 ? 'no stack' : (frames.some(isResolvedFrame) ? 'RESOLVED' : 'NOT resolved'),
      issue: issue.shortId,
    };
  }
  const runtimes = ['page', 'main', 'server'];
  if (Object.keys(byRuntime).length === 0) {
    console.log(`No connection-check event arrived in the last ${since}.`);
  } else {
    const order = [...runtimes, ...Object.keys(byRuntime).filter((r) => !runtimes.includes(r))];
    console.log(table(order.filter((r) => byRuntime[r]).map((r) => {
      const x = byRuntime[r];
      return [r, x.at, x.env, x.release, x.stack, x.issue];
    }), ['RUNTIME', 'EVENT TIME', 'ENV', 'RELEASE', 'STACK', 'ISSUE']));
    console.log('');
  }
  console.log(runtimes.map((r) => {
    const x = byRuntime[r];
    if (x === undefined) {
      return `${r} ✗ not found`;
    }
    return `${r} ✓ ${x.stack === 'RESOLVED' ? 'resolved' : x.stack === 'no stack' ? 'arrived (no stack)' : 'arrived, NOT resolved'}`;
  }).join(' · '));
  return runtimes.every((r) => byRuntime[r] !== undefined) ? 0 : 1;
}

// ───────────────────────────── box ─────────────────────────────

/** Paths relative to /home/deck; `find -path` patterns. The saves are deliberately NOT here. */
const BOX_ROOTS = ['.config/terraforming-mars', 'Applications'];
const BOX_PATTERNS = [
  '.config/terraforming-mars/logs/*',
  '.config/terraforming-mars/diagnostics/*',
  '.config/terraforming-mars/diagnostics.json',
  '.config/terraforming-mars/embedded/embedded-server*.log',
  '.config/terraforming-mars/embedded/db/field-log/*.jsonl',
  'Applications/*console_export*.txt',
  'Applications/renderer-hang-*.trace.json',
  'Applications/terraforming-mars-steam.log',
];
/** Never descend: Chromium's caches, the saves, the AppImage's neighbours' subfolders. */
const BOX_PRUNE = [
  '.config/terraforming-mars/embedded/db/files',
  '.config/terraforming-mars/*Cache*',
  '.config/terraforming-mars/blob_storage',
  'Applications/*/*',
];

function boxPullCommand(since) {
  const q = (s) => `'${s}'`;
  const prune = BOX_PRUNE.map((p) => `-path ${q(p)}`).join(' -o ');
  const match = BOX_PATTERNS.map((p) => `-path ${q(p)}`).join(' -o ');
  const age = since === 'all' ? '' : ` -mmin -${minutesOf(since)}`;
  return `cd ~ && find ${BOX_ROOTS.join(' ')} \\( ${prune} \\) -prune -o -type f \\( ${match} \\)${age} -print0 2>/dev/null | tar -czf - --null -T -`;
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walk(p));
    } else if (e.isFile()) {
      const st = fs.statSync(p);
      out.push({path: p, bytes: st.size, mtime: st.mtimeMs});
    }
  }
  return out;
}

async function boxPull(args) {
  const since = period(args.flags.since, '24h', true);
  const dest = path.join(OUT, 'box', stamp());
  fs.mkdirSync(dest, {recursive: true});
  const result = await new Promise((resolve) => {
    const ssh = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', BOX, boxPullCommand(since)], {windowsHide: true});
    // Extract with the destination as cwd: GNU tar would read `C:\…` given to -C as a remote host.
    const tar = spawn('tar', ['-xzf', '-'], {cwd: dest, windowsHide: true});
    const sshErr = [];
    const tarErr = [];
    let sshCode;
    let tarCode;
    let failed;
    const done = () => {
      if (failed !== undefined || (sshCode !== undefined && tarCode !== undefined)) {
        resolve({sshCode, tarCode, failed, sshErr: Buffer.concat(sshErr).toString('utf8').trim(), tarErr: Buffer.concat(tarErr).toString('utf8').trim()});
      }
    };
    ssh.on('error', (err) => {
      failed = `ssh could not be started: ${err.message}`;
      tar.kill();
      done();
    });
    tar.on('error', (err) => {
      failed = `tar could not be started: ${err.message}`;
      ssh.kill();
      done();
    });
    ssh.stderr.on('data', (b) => sshErr.push(b));
    tar.stderr.on('data', (b) => tarErr.push(b));
    tar.stdin.on('error', () => {
      // tar died early; its own exit code says why
    });
    ssh.stdout.pipe(tar.stdin);
    ssh.on('close', (code) => {
      sshCode = code;
      done();
    });
    tar.on('close', (code) => {
      tarCode = code;
      done();
    });
  });
  if (result.failed !== undefined || result.sshCode !== 0) {
    fs.rmSync(dest, {recursive: true, force: true});
    throw new Failure(`ssh ${BOX}: ${result.failed ?? (cut(result.sshErr, 300) || `exited ${result.sshCode}`)}`, 2);
  }
  if (result.tarCode !== 0) {
    throw new Failure(`local tar failed (exit ${result.tarCode}): ${cut(result.tarErr, 300)}`, 2);
  }
  const files = walk(dest);
  if (files.length === 0) {
    fs.rmSync(dest, {recursive: true, force: true});
    console.log(`Nothing on the box was modified within ${since === 'all' ? 'any time' : `the last ${since}`}.`);
    return 0;
  }
  const total = files.reduce((n, f) => n + f.bytes, 0);
  console.log(`${files.length} file${files.length === 1 ? '' : 's'}, ${size(total)} → ${rel(dest)}/`);
  const byNewest = (a, b) => b.mtime - a.mtime;
  const exports = files.filter((f) => /console_export.*\.txt$/.test(path.basename(f.path))).sort(byNewest);
  const reportsDir = path.join(dest, '.config', 'terraforming-mars', 'diagnostics', 'reports');
  const reports = fs.existsSync(reportsDir) ?
    fs.readdirSync(reportsDir, {withFileTypes: true}).filter((d) => d.isDirectory())
      .map((d) => ({name: d.name, mtime: fs.statSync(path.join(reportsDir, d.name)).mtimeMs})).sort(byNewest) :
    [];
  const groups = {};
  for (const f of files) {
    const r = rel(f.path).slice(rel(dest).length + 1);
    const key = r.split('/').slice(0, r.startsWith('.config') ? 3 : 1).join('/');
    groups[key] = (groups[key] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(groups)) {
    console.log(`  ${k}  ×${n}`);
  }
  console.log(`newest report folder: ${reports.length === 0 ? '—' : `${reports[0].name} (${localTime(reports[0].mtime)})`}`);
  if (exports.length === 0) {
    console.log('newest console export: —');
    return 0;
  }
  const newest = exports[0];
  console.log(`newest console export: ${rel(newest.path)} (${size(newest.bytes)}, ${localTime(newest.mtime)})`);
  console.log('──── its head ────');
  const head = fs.readFileSync(newest.path, 'utf8').split('\n').slice(0, 40);
  console.log(head.join('\n'));
  return 0;
}

/**
 * One command on the box. `remote` is built by the caller from CONSTANTS and from values it has validated against a
 * strict pattern — never from raw input. The box unreachable (ssh's own exit 255, or ssh not startable) is exit 2 with
 * ssh's words; any other exit code is the remote command's own and is the caller's to read.
 */
async function boxRun(remote) {
  let r;
  try {
    r = await run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', BOX, remote]);
  } catch (err) {
    throw new Failure(`ssh could not be started: ${err.message}`, 2);
  }
  if (r.code === 255) {
    throw new Failure(`ssh ${BOX}: ${cut(r.stderr.toString('utf8'), 300) || 'exited 255'}`, 2);
  }
  return r;
}

function fingerprintArg(value, letters, usage) {
  const fp = String(value ?? '').toLowerCase();
  if (!new RegExp(`^[${letters}]#[0-9a-f]{${FINGERPRINT_DIGITS}}$`).test(fp)) {
    throw new Failure(usage, 2);
  }
  return fp;
}

/** A fingerprint of an automatic event → the ids on the box it is the print of, each with the saves that hold it. */
async function resolveOnBox(fp) {
  const remote = 'cd ~/.config/terraforming-mars/embedded/db/files && grep -roE \'"[pgs][0-9a-f]{8,16}"\' --include=\'*.json\' . | sort -u';
  const r = await boxRun(remote);
  // grep exits 1 for «no match» — an empty answer, not a failure.
  if (r.code !== 0 && r.code !== 1) {
    throw new Failure(`ssh ${BOX}: ${cut(r.stderr.toString('utf8'), 300) || `exited ${r.code}`}`, 2);
  }
  const hits = new Map();
  const seen = new Set();
  for (const line of r.stdout.toString('utf8').split('\n')) {
    const m = /^(.*):"([pgs][0-9a-f]{8,16})"$/.exec(line.trim());
    if (m === null) {
      continue;
    }
    const [, file, id] = m;
    seen.add(id);
    if (fingerprintOf(id) === fp) {
      if (!hits.has(id)) {
        hits.set(id, []);
      }
      hits.get(id).push(`~/.config/terraforming-mars/embedded/db/files/${file.replace(/^\.\//, '')}`);
    }
  }
  return {hits, ids: seen.size};
}

async function boxResolve(args) {
  const fp = fingerprintArg(args.positional[1], 'pgs', 'usage: diag box resolve <p#xxxxxxxxxx | g#… | s#…>  (a letter, #, ten hex digits)');
  const {hits, ids} = await resolveOnBox(fp);
  if (hits.size === 0) {
    console.log(`No save on the box holds ${fp} (${ids} distinct ids checked).`);
    return 0;
  }
  for (const [id, files] of hits) {
    console.log(`${fp} = ${id}`);
    for (const f of files) {
      console.log(`  ${f}`);
    }
  }
  return 0;
}

// ───────────────────────────── save ─────────────────────────────

/*
 * THE GAME AS IT STOOD WHEN AN EPISODE BEGAN. An automatic event never carries the save (it is the table's keys and
 * names): it names it — the game by its fingerprint and the number of its newest save (`contexts.save`). The embedded
 * server keeps EVERY save of a game (`db/files/history/<game>-<n>.json`), so on a machine the agent can read the pair
 * is a file. A save loads as an e2e fixture AS IT IS: `POST /api/dev/load-game` remaps its ids and rides
 * `Game.deserialize` — the path every real save rides (`.claude/rules/tests.md` § STATE IS DECLARED).
 */

const SAVES_DIR = path.join(OUT, 'saves');
const FIXTURES_DIR = path.join(ROOT, 'tests', 'e2e', 'fixtures');

/** `0…130, 132…363` — the save ids the box holds, as ranges. */
function rangesText(ids) {
  const parts = [];
  let from;
  let prev;
  for (const id of ids) {
    if (from === undefined) {
      from = id;
    } else if (id !== prev + 1) {
      parts.push(from === prev ? `${from}` : `${from}…${prev}`);
      from = id;
    }
    prev = id;
  }
  if (from !== undefined) {
    parts.push(from === prev ? `${from}` : `${from}…${prev}`);
  }
  return `${parts.join(', ')} (${ids.length} save${ids.length === 1 ? '' : 's'})`;
}

/** What the command was asked for → the game's fingerprint and the save's number (`undefined` = the event did not say). */
async function saveRefOf(args) {
  const [first, second] = args.positional;
  const usage = 'usage: diag save <g#xxxxxxxxxx> <saveId> [--fixture <name>]\n       diag save <issue shortId | event id> [--event <eventId>] [--fixture <name>]\n       diag save --from <a save file> --fixture <name>';
  if (first === undefined) {
    throw new Failure(usage, 2);
  }
  if (first.includes('#')) {
    const gameRef = fingerprintArg(first, 'g', `«${first}» is not a game's fingerprint (g#, ten hex digits — an event's \`game_ref\` / \`contexts.save.game_ref\`)\n${usage}`);
    if (!/^\d{1,9}$/.test(String(second ?? ''))) {
      throw new Failure(`the save's number is missing or not a number — got «${second ?? ''}»\n${usage}`, 2);
    }
    return {gameRef, saveId: Number(second), said: `${gameRef} at save ${second}`};
  }
  let event;
  let said;
  if (/^[0-9a-f]{32}$/i.test(first)) {
    event = await eventById(first);
    said = `event ${first.toLowerCase()}`;
  } else {
    const issue = await issueById(first);
    const asked = args.flags.event;
    if (asked === true) {
      throw new Failure(`--event needs an event id (32 hex digits)\n${usage}`, 2);
    }
    event = asked === undefined ? await latestEvent(issue.id) : await eventById(asked);
    if (asked !== undefined && String(event.groupID) !== String(issue.id)) {
      throw new Failure(`event ${asked} is not an event of ${issue.shortId} (it belongs to issue ${event.groupID})`, 2);
    }
    said = `${issue.shortId}, ${asked === undefined ? 'its latest event' : 'event'} ${event.eventID ?? event.id}`;
  }
  const save = readCase(event).save;
  if (save === undefined) {
    throw new Failure(`${said} names no save (no \`contexts.save\`): only an episode on a device that HOSTS the game does. Its tags may still name the game: \`game_ref\`.`);
  }
  fingerprintArg(save.gameRef, 'g', `${said} names «${save.gameRef}» as its game — not a game's fingerprint`);
  return {gameRef: save.gameRef, saveId: Number.isInteger(save.saveId) && save.saveId >= 0 ? save.saveId : undefined, said: `${said} → ${save.gameRef} at save ${save.saveId}`};
}

/**
 * A GAME's fingerprint → its id on the box, by the same rule as `box resolve` (the print of an id is compared with
 * the fingerprint) — but the ids are read off the saves' FILE NAMES (`<gameId>.json`, `history/<gameId>-<n>.json`),
 * not out of their contents: a game's id is its file's name, and reading 60 000 saves (21 GB on the owner's box,
 * 2026-11-14) to learn it took a minute and a half; the listing takes under a second.
 */
async function gameIdsOnBox(fp) {
  const r = await boxRun('cd ~/.config/terraforming-mars/embedded/db/files && ls -1 . history 2>/dev/null | grep -oE \'^g[0-9a-f]{8,16}\' | sort -u');
  // grep exits 1 for «no match» — an empty answer, not a failure.
  if (r.code !== 0 && r.code !== 1) {
    throw new Failure(`ssh ${BOX}: ${cut(r.stderr.toString('utf8'), 300) || `exited ${r.code}`}`, 2);
  }
  const ids = r.stdout.toString('utf8').split('\n').map((s) => s.trim()).filter((s) => /^g[0-9a-f]{8,16}$/.test(s));
  return {hits: ids.filter((id) => fingerprintOf(id) === fp), ids: ids.length};
}

/** The save from the box → `.diagnostics/saves/<gameId>-<saveId>.json`; the path it was written to. */
async function fetchSave({gameRef, saveId, said}) {
  const {hits, ids} = await gameIdsOnBox(gameRef);
  if (hits.length === 0) {
    throw new Failure(`${said}: no game on the box has the fingerprint ${gameRef} (${ids} games checked) — it was hosted by another device, or its saves are gone.`);
  }
  if (hits.length > 1) {
    throw new Failure(`${gameRef} is the print of ${hits.length} games on the box (${hits.join(', ')}) — cannot tell which.`);
  }
  // (The id goes into the box's command line: `gameIdsOnBox` let through only what a game id is made of.)
  const gameId = hits[0];
  const listing = await boxRun(`ls -1 ~/${BOX_HISTORY_DIR}/ | grep -E '^${gameId}-[0-9]+\\.json$'`);
  const available = parseHistoryListing(listing.stdout.toString('utf8'), gameId);
  if (available.length === 0) {
    throw new Failure(`${gameRef} = ${gameId}, but the box keeps no save of it under ~/${BOX_HISTORY_DIR}/.`);
  }
  let pick;
  if (saveId === undefined) {
    pick = {saveId: available[available.length - 1], exact: false};
    console.log(`the event did not say which save — taking the NEWEST the box holds: ${pick.saveId} (of ${rangesText(available)})`);
  } else {
    pick = pickSaveId(available, saveId);
    if (pick === undefined) {
      throw new Failure(`save ${saveId} of ${gameId} is not on the box and none below it is — the box holds ${rangesText(available)}.`);
    }
    if (!pick.exact) {
      console.log(`save ${saveId} of ${gameId} is NOT on the box (it holds ${rangesText(available)}) — taking the nearest below: ${pick.saveId}`);
    }
  }
  const name = historyFileName(gameId, pick.saveId);
  if (!/^g[0-9a-f]+-\d{5,}\.json$/.test(name)) {
    throw new Failure(`«${name}» is not a history file's name.`);
  }
  const got = await boxRun(`cat ~/${BOX_HISTORY_DIR}/${name}`);
  if (got.code !== 0) {
    throw new Failure(`ssh ${BOX}: ~/${BOX_HISTORY_DIR}/${name} could not be read (exit ${got.code}): ${cut(got.stderr.toString('utf8'), 300)}`, 2);
  }
  fs.mkdirSync(SAVES_DIR, {recursive: true});
  const file = path.join(SAVES_DIR, name);
  fs.writeFileSync(file, got.stdout);
  console.log(`${gameRef} = ${gameId} · save ${pick.saveId} · ${size(got.stdout.length)} → ${rel(file)}`);
  return file;
}

/** Checks a written fixture against the CURRENT engine with the suite's own guard (`e2eFixturesLoad.spec.ts`). */
async function checkFixture(fixtureFile) {
  const mocha = path.join(ROOT, 'node_modules', 'mocha', 'bin', 'mocha.js');
  const spec = 'tests/console/e2eFixturesLoad.spec.ts';
  const command = `npx mocha --import=tsx --require tests/testing/setup.ts ${spec} -g "${path.basename(fixtureFile)}"`;
  if (!fs.existsSync(mocha)) {
    return {ran: false, ok: false, command, output: 'mocha is not installed here'};
  }
  let r;
  try {
    r = await run(process.execPath, [mocha, '--import=tsx', '--require', 'tests/testing/setup.ts', spec, '-g', path.basename(fixtureFile)], {cwd: ROOT});
  } catch (err) {
    return {ran: false, ok: false, command, output: err.message};
  }
  const output = `${r.stdout.toString('utf8')}\n${r.stderr.toString('utf8')}`;
  const passing = Number(/(\d+) passing/.exec(output)?.[1] ?? 0);
  // (A runner that collected nothing also exits 0: the check is «the one test of this fixture passed».)
  return {ran: true, ok: r.code === 0 && passing >= 1, command, output};
}

async function cmdSave(args) {
  const f = args.flags;
  const fixture = f.fixture;
  if (fixture !== undefined && (fixture === true || !/^[a-z0-9][a-z0-9-]{0,48}$/.test(String(fixture)))) {
    throw new Failure('--fixture needs a name of lower-case letters, digits and dashes (it becomes tests/e2e/fixtures/field-<name>.json)', 2);
  }
  let file;
  if (f.from !== undefined) {
    if (f.from === true) {
      throw new Failure('--from needs the path of a save file (a file of .diagnostics/saves/, or the `save.json` of a report)', 2);
    }
    file = path.resolve(String(f.from));
    if (!fs.existsSync(file)) {
      throw new Failure(`${f.from}: no such file`, 2);
    }
  } else {
    file = await fetchSave(await saveRefOf(args));
  }
  let made;
  try {
    made = fixtureFromSave(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (err) {
    throw new Failure(`${rel(file)} is not a game's save: ${err.message}`);
  }
  const seats = made.seats.map((s) => `${s.index}:${s.color}${s.bot ? ' (the bot)' : ''}${s.active ? ' ← on the move' : ''}`).join(' · ');
  console.log(`game ${made.gameId} · save ${made.saveId ?? '?'} · phase ${made.phase} · generation ${made.generation ?? '?'} · seats ${seats}`);
  console.log('(the file holds the table\'s ids and its players\' names — it stays under .diagnostics/, which git ignores)');
  const byHand = (name) => [
    'by hand after it:',
    `  1. add '${name}' to the \`FixtureName\` union — tests/e2e/consoleStart.ts (\`bootFixture\` takes only a declared name);`,
    `  2. the spec boots it: \`bootFixtureSeats(page, request, '${name}')\` → \`seats[i]\` is seat i above (\`bootFixture\` answers seats[0]).`,
    '     The save is the table BEFORE the episode: the spec drives, on the real UI, the action the episode began with;',
    '  3. only when the table must first be MOVED by the engine (an action replayed, a hand arranged): put the save under',
    '     tests/e2e/fixtures/field/ and add its block to tests/e2e/fixtures/generate.ts, as `field-venus-unity-trade` does.',
    '     That part is a decision about the case — it is not mechanical.',
  ];
  if (fixture === undefined) {
    console.log('');
    console.log('TO MAKE IT AN E2E FIXTURE (as the `field-*` fixtures were made — .claude/rules/tests.md § STATE IS DECLARED):');
    console.log(`  npm run diag -- save --from ${rel(file)} --fixture <name>`);
    console.log('      → tests/e2e/fixtures/field-<name>.json: the table AS SAVED, its names anonymized (seat1, seat2 …; the bot keeps its');
    console.log('        own), checked against the current engine. The loader (`POST /api/dev/load-game`) remaps the ids and rides');
    console.log('        `Game.deserialize` — the path every real save rides; the resume block re-primes the prompt.');
    console.log(byHand('field-<name>').join('\n'));
    return 0;
  }
  const name = `field-${fixture}`;
  const target = path.join(FIXTURES_DIR, `${name}.json`);
  if (fs.existsSync(target)) {
    throw new Failure(`${rel(target)} already exists — choose another name (a fixture a spec stands on is never overwritten by a tool).`, 2);
  }
  fs.writeFileSync(target, fixtureText(made.fixture));
  const check = await checkFixture(target);
  if (check.ran && !check.ok) {
    fs.rmSync(target, {force: true});
    const tail = check.output.split('\n').filter((l) => l.trim() !== '').slice(-14).join('\n');
    throw new Failure(`the save does NOT load against the current engine — ${rel(target)} was not left behind (it would turn the server suite red):\n${tail}\n\nrerun the check:  ${check.command}`);
  }
  console.log('');
  console.log(`→ ${rel(target)}  (${size(fs.statSync(target).size)}; names anonymized: ${made.seats.filter((s) => !s.bot).map((s) => `seat${s.index + 1}`).join(', ') || 'none'}; ids kept — the loader remaps them at every boot)`);
  console.log(check.ran ?
    '  checked: it deserializes with the current engine and resumes a live prompt (tests/console/e2eFixturesLoad.spec.ts).' :
    `  ⚠ NOT checked (${check.output}) — run:  ${check.command}`);
  console.log(byHand(name).join('\n'));
  return 0;
}

// ───────────────────────────── key ──────────────────────────────

/*
 * THE CLIENT KEY (the DSN's public half). A key inside a shipped game is PUBLIC by nature — anyone can unpack the app
 * and read it — so its safety is not secrecy: it is that the key is nowhere easier to find than inside the app (never
 * in the repository, never in a public build log), that the plan's quota is watched, and that a key someone abuses is
 * REPLACED in minutes: a new key → the GitHub secret TM_SENTRY_DSN → a release → the old key retired.
 */

/** A WRITE to the API — with the same token the reads use (the CLI's own, or SENTRY_AUTH_TOKEN). */
async function apiWrite(method, endpoint, payload) {
  const token = process.env.SENTRY_AUTH_TOKEN || await tokenFromCli();
  if (token === '' || token === undefined) {
    throw new Failure('no Sentry access for a write: set SENTRY_AUTH_TOKEN or authorise the `sentry` CLI');
  }
  let res;
  try {
    res = await fetch(API_BASE + endpoint, {method, headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
  } catch (err) {
    throw new Failure(`sentry: ${method} ${endpoint} — network error: ${err.cause?.message ?? err.message}`);
  }
  const body = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    throw new Failure(`sentry: ${method} ${endpoint} — HTTP ${res.status}: ${detailOf(body)}`);
  }
  return body.length === 0 ? {} : JSON.parse(body.toString('utf8'));
}

/**
 * A read that is NEVER the CLI's cached copy. `sentry api` answers a GET from its own cache for a while: right after
 * a key was retired it still listed the key as active (2026-11-14) — and a command that changes a key must read what
 * the server holds now.
 */
async function apiFresh(endpoint) {
  const token = process.env.SENTRY_AUTH_TOKEN || await tokenFromCli();
  if (token === '' || token === undefined) {
    return api(endpoint);
  }
  return JSON.parse((await fetchWith(token, endpoint)).toString('utf8'));
}

function keyLine(k) {
  const limit = k.rateLimit ? `${k.rateLimit.count} per ${Math.round(k.rateLimit.window / 3600)}h` : 'none';
  return [k.id.slice(0, 8), k.isActive ? 'active' : 'RETIRED', cut(k.name, 34), limit, localTime(k.dateCreated)];
}

async function keyStatus() {
  const keys = await apiFresh(`${projectPath}/keys/`);
  console.log(table(keys.map(keyLine), ['KEY', 'STATE', 'NAME', 'RATE LIMIT', 'CREATED']));
  // The plan's quota for the running period — what a flood (or a broken build) would burn.
  const customer = await apiFresh(`customers/${ORG}/`).catch(() => undefined);
  if (customer !== undefined) {
    const errors = customer.categories?.errors;
    const files = customer.categories?.attachments;
    console.log('');
    console.log(`plan ${customer.planDetails?.name ?? '?'} · period ends ${customer.onDemandPeriodEnd ?? '?'}${customer.trialEnd ? ` · trial features until ${String(customer.trialEnd).slice(0, 10)}` : ''}`);
    if (errors) {
      console.log(`events        ${errors.usage} of ${errors.reserved}${errors.usageExceeded ? '   ← EXCEEDED: the collector answers 429 until the period ends' : ''}`);
    }
    if (files) {
      console.log(`attachments   ${size(files.usage)} of ${files.reserved} GB${files.usageExceeded ? '   ← EXCEEDED: reports arrive without their files' : ''}`);
    }
  }
  return 0;
}

async function keyRotate(args) {
  const name = typeof args.flags.name === 'string' ? args.flags.name : `release builds — ${new Date().toISOString().slice(0, 10)}`;
  const created = await apiWrite('POST', `${projectPath}/keys/`, {name});
  console.log(`a new key is created: ${created.id.slice(0, 8)} «${created.name}». The old keys still work — nothing is cut off yet.`);
  console.log('');
  console.log('its DSN (put it into the GitHub SECRET, never into a file of the repository):');
  console.log(`  ${created.dsn.public}`);
  console.log('');
  console.log('next:');
  console.log('  1. GitHub → Settings → Secrets and variables → Actions → Secrets → TM_SENTRY_DSN = the DSN above');
  console.log('     (and delete the VARIABLE of the same name, if there is one: a variable is printed in the public build log)');
  console.log('  2. push anything to main — the release bakes the new key in; installed games update themselves');
  console.log('  3. npm run diag -- selftest        (after the box updated and ran the connection check: the events arrive)');
  console.log(`  4. npm run diag -- key retire <the old key's id>     — only now the old key stops being accepted`);
  return 0;
}

async function keyRetire(args) {
  const ref = args.positional[1];
  if (!ref) {
    throw new Failure('usage: diag key retire <key id or its first characters>   (see `diag key`)', 2);
  }
  const keys = await apiFresh(`${projectPath}/keys/`);
  const hits = keys.filter((k) => k.id.startsWith(ref));
  if (hits.length !== 1) {
    throw new Failure(`«${ref}» names ${hits.length} keys — give more of the id (\`npm run diag -- key\`)`, 2);
  }
  const key = hits[0];
  if (keys.filter((k) => k.isActive && k.id !== key.id).length === 0) {
    throw new Failure('this is the only ACTIVE key: retiring it would silence every installed game. Create the next one first (`diag key rotate`).');
  }
  if (!key.isActive) {
    console.log(`key ${key.id.slice(0, 8)} «${key.name}» is already retired.`);
    return 0;
  }
  await apiWrite('PUT', `${projectPath}/keys/${key.id}/`, {isActive: false});
  // SAID ONLY WHEN TRUE: the answer of a write is not the state — the key is read again, past every cache.
  const after = (await apiFresh(`${projectPath}/keys/`)).find((k) => k.id === key.id);
  if (after === undefined || after.isActive) {
    throw new Failure(`the collector still lists key ${key.id.slice(0, 8)} as ACTIVE — it was not retired. Do it in Sentry → Settings → Client Keys.`);
  }
  console.log(`key ${key.id.slice(0, 8)} «${key.name}» is retired (it can be switched back on in Sentry → Client Keys).`);
  console.log('note: the ingest endpoint answers 200 to ANY key and drops the event afterwards — a game that still carries');
  console.log('      this key will say «sent», and nothing will arrive. The proof of arrival is `npm run diag -- selftest`.');
  return 0;
}

// ───────────────────────────── resolve ─────────────────────────────

/*
 * A CLASS IS CLOSED «FIXED IN RELEASE». The issue is resolved in a release (the one named, or the next one the
 * collector sees); an event of the class from a LATER release makes the collector reopen it as REGRESSED — which is
 * what `diag issues --regressed` lists. So «the class closed in X came back» costs one command and no memory.
 */
/** The version this checkout builds (`package.json`) — after the fix is committed, the release that carries it. */
function checkoutVersion() {
  try {
    const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
    return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version) ? version : undefined;
  } catch {
    return undefined;
  }
}

/** «Resolved in release X» needs X to EXIST for the collector: a version nothing was sent from yet is created (empty). */
async function ensureRelease(release) {
  try {
    await api(`organizations/${ORG}/releases/${encodeURIComponent(release)}/`);
    return false;
  } catch {
    await apiWrite('POST', `organizations/${ORG}/releases/`, {version: release, projects: [PROJECT]});
    return true;
  }
}

async function cmdResolve(args) {
  const ref = args.positional[0];
  const f = args.flags;
  const usage = 'usage: diag resolve <cause class | issue shortId> [--in <version> | --next]   (default: --in <this checkout\'s version> — run it after the fix is committed)';
  if (ref === undefined) {
    throw new Failure(usage, 2);
  }
  if (f.in !== undefined && f.next) {
    throw new Failure(`--in and --next exclude each other\n${usage}`, 2);
  }
  // THE DEFAULT IS THE VERSION THAT CARRIES THE FIX — this checkout's, once the fix is committed (the commit takes the
  // next free version). «The next release» is the collector's notion and hangs on what IT calls the latest: one stray
  // release with a greater number (2026-11-14: `45.3.1`, an early probe that sent Electron's version) and a class
  // closed that way never regresses. `--next` stays for who asks for it, with that warning.
  const own = f.in === undefined && !f.next ? checkoutVersion() : undefined;
  if (f.in === undefined && !f.next && own === undefined) {
    throw new Failure(`this checkout's version is unreadable (package.json) — name the release of the fix: --in <version>\n${usage}`, 2);
  }
  const release = releaseArg('in', own ?? (f.in === true ? '' : f.in));
  let issue;
  if (ref.includes('/')) {
    const cls = causeClassArg(ref, usage);
    const found = await searchIssues({query: `cause:"${cls}"`, limit: 10});
    const list = Array.isArray(found) ? found : [];
    if (list.length === 0) {
      console.log(`No issue is filed under the class ${cls} — nothing to resolve.`);
      return 1;
    }
    if (list.length > 1) {
      throw new Failure(`${list.length} issues are filed under ${cls} — resolve the one you mean by its short id:\n${list.map((i) => `  ${issueLine(i)}`).join('\n')}`);
    }
    issue = list[0];
  } else {
    issue = await issueById(ref);
  }
  const statusDetails = release !== undefined ? {inRelease: release} : {inNextRelease: true};
  if (release !== undefined && await ensureRelease(release)) {
    console.log(`(the collector had not heard of ${shortRelease(release)} yet — the release is created, empty)`);
  }
  const done = await apiWrite('PUT', `organizations/${ORG}/issues/${issue.id}/`, {status: 'resolved', statusDetails});
  const details = done.statusDetails ?? statusDetails;
  console.log(`${issue.shortId} — ${cut(issue.title, 110)}`);
  const was = `was ${issue.status}${issue.substatus ? ` (${issue.substatus})` : ''}`;
  if (release !== undefined) {
    console.log(`  ${was} → ${done.status ?? 'resolved'} in ${shortRelease(details.inRelease ?? release)}`);
    console.log(`  an event of it from ${shortRelease(release)} or a later version reopens it as REGRESSED:  npm run diag -- issues --regressed`);
  } else {
    // «The next release» is the collector's own notion: the first one AFTER the release it calls the latest — and it
    // answers which that is. The project's versions are compared as versions, so a stray release with a greater
    // number than every real one (2026-11-14: `terraforming-mars@45.3.1`, an early probe that sent Electron's version)
    // becomes «the latest» for ever, and a class closed «in the next release» after it can never come back.
    const anchor = typeof details.inRelease === 'string' ? details.inRelease : undefined;
    console.log(`  ${was} → ${done.status ?? 'resolved'} in the next release${anchor !== undefined ? ` — the first one after ${shortRelease(anchor)}, which the collector takes for the latest` : ''}`);
    const releases = anchor === undefined ? undefined : await api(`${projectPath}/releases/?per_page=5`).catch(() => undefined);
    const newest = Array.isArray(releases) && releases.length > 0 ? releases[0].version : undefined;
    if (anchor !== undefined && newest !== undefined && anchor !== newest) {
      console.log(`  ⚠ ${shortRelease(anchor)} is NOT the newest release (that is ${shortRelease(newest)}): its number outranks the real versions, so no release will ever be`);
      console.log('    «after» it and THIS CLASS WOULD NEVER REGRESS. Close it by the version that carries the fix instead:');
      console.log(`      npm run diag -- resolve ${issue.shortId} --in <version>`);
      console.log(`    (or archive the stray release ${anchor} in the collector, once).`);
    } else {
      console.log('  an event of it from a later release reopens it as REGRESSED:  npm run diag -- issues --regressed');
    }
  }
  if (issue.permalink) {
    console.log(`  ${issue.permalink}`);
  }
  return 0;
}

// ───────────────────────────── where ─────────────────────────────

function cmdWhere(args) {
  const word = args.positional.join(' ').trim();
  if (word === '') {
    throw new Failure('usage: diag where <a word of the evidence>\n' +
      '  a scope / a hold / a wait / a block / a rung / a door as the evidence prints it:  frame:hand#3 · scene:hold:played-hero#12 ·\n' +
      '  step:commit-fold-owed · story:owed:board-beat-park · card-receive · played-hero:payback · block:reveal · workspace-outcome · question-open\n' +
      '  a line\'s tag, a shape or a whole cause class:  [workspace-stale] · wait-graph/ceiling · liveness/stall/unserved/…', 2);
  }
  const read = (p) => ({path: rel(p), text: fs.readFileSync(p, 'utf8')});
  // The client declares the names; the Electron lane prints tags of its own (`[renderer-hang]`).
  const files = [
    ...sourceFiles(path.join(ROOT, 'src', 'client'), ['.ts', '.vue']),
    ...sourceFiles(path.join(ROOT, 'electron'), ['.ts']),
  ].map(read);
  const shapesPath = path.join(ROOT, 'src', 'common', 'diagnostics', 'shapes.ts');
  const shapesText = fs.existsSync(shapesPath) ? fs.readFileSync(shapesPath, 'utf8') : '';
  const result = whereSearch(files, word, {shapesText, shapesPath: rel(shapesPath)});
  console.log(renderWhere(result));
  console.log(`\n(${files.length} files of src/client and electron searched)`);
  return result.hits.length === 0 && result.row === undefined ? 1 : 0;
}

// ───────────────────────────── main ─────────────────────────────

const USAGE = `diag — the game's diagnostics, read from Sentry and from the box (docs/claude/diagnostics.md)

usage: npm run diag -- <command> [args]

  report <TM-XXXXXX | latest>   download a player's report package + write SUMMARY.md (.diagnostics/reports/<code>/)
  issues [--since 24h|all] [--env box|production|development] [--kind error|stall|integrity|report|session]
         [--family <tag>] [--runtime page|main|server] [--regressed] [--limit 25] [--json]
                                list the project's issues, newest first; --regressed: only those that CAME BACK
                                after being resolved (a class closed in a release and seen in a later one)
  issue <shortId | id> [--event <eventId>]
                                one issue, its latest event (or the one named) in READING ORDER: tags → the CAUSE (class,
                                shape, tier, dimensions) → what stood (question, holders) → the episode (outcome, who cured
                                it, what changed) → the net's lines → flow tree · waits · wait graph · flow trace → the
                                save; then stack, breadcrumbs; attachments → .diagnostics/issues/<shortId>/

  classes [--since 14d|all] [--env …] [--release <version>] [--tier defect|planned|info] [--kind stall|integrity]
          [--limit 50] [--json]
                                ONE ROW PER CAUSE CLASS: events, runs, how they ended, first / last seen, the trend by
                                release (1.2.3250:4 1.2.3251:1), the issue it is filed under
  class <cause class> [--last 5] [--env …] [--release <version>] [--since 14d|all]
                                OPEN A CLASS: its last N cases → .diagnostics/classes/<class>/NN-<when>-<outcome>/
                                (00-summary.md · 01-lines.txt · 02-flow-tree.txt · 03-waits.txt · 04-wait-graph.txt ·
                                05-flow-trace.txt · event.json · the attachments) + README.md: the cases, the issue, the
                                save of each case, WHERE THE CLASS IS REPRODUCED in tests/ and the monkey's reports
  trend [--since 30d|all] [--env …] [--release <version>] [--json]
                                ARE FREEZES FEWER? the session ledgers by release: sessions, hours of play, defects and
                                episodes per hour and per session, outcomes, time-to-cure, renderer stops, long frames
                                (where their time went); the top classes per release; the fires of EVERY net
  save <g#xxxxxxxxxx> <saveId> [--fixture <name>]
  save <shortId | eventId> [--event <eventId>] [--fixture <name>]
                                the game's save AS IT STOOD when the episode began, from the box →
                                .diagnostics/saves/<gameId>-<saveId>.json (the nearest save below, when that one is gone)
  save --from <save file> --fixture <name>
                                a save already here (a fetched one, a report's save.json) → tests/e2e/fixtures/field-<name>.json:
                                names anonymized, checked against the current engine; prints what is left to do by hand
  resolve <cause class | shortId> [--in <version> | --next]
                                close a class «fixed in release» (default: this checkout's version — run it after the
                                fix is committed) — it REGRESSES if an event of that version or a later one returns
  where <word>                  from a word of the evidence — frame:hand#3 · scene:hold:played-hero#12 · step:commit-fold-owed ·
                                card-receive · played-hero:payback · block:reveal · question-open · [workspace-stale] ·
                                wait-graph/ceiling — to the line of the source that DECLARES it (file:line)

  selftest [--since 30m]        did the connection check arrive from page · main · server? (exit 1 if one is missing)
  box pull [--since 24h|all]    the box's logs, reports, outbox, console exports, field logs → .diagnostics/box/<stamp>/
  box resolve <p#xxxxxxxxxx>    map a fingerprint of an automatic event back to an id and its save on the box
  key                           the project's client keys and how much of the plan's quota is used
  key rotate [--name <text>]    create the NEXT key and print its DSN + the four steps of a rotation
  key retire <key id>           stop accepting a key (refused while it is the only active one)
  help                          this text

examples:
  npm run diag -- report TM-K7QW3D
  npm run diag -- issues --since 7d --env box --kind stall
  npm run diag -- classes --env box --since 30d
  npm run diag -- class liveness/stall/unserved/handpick/hand:committed/block:reveal --last 3
  npm run diag -- where scene:hold:played-hero#12
  npm run diag -- trend --env box
  npm run diag -- resolve liveness/stall/unserved/handpick/hand:committed/block:reveal --in 1.2.3260
  npm run diag -- issues --regressed
  npm run diag -- box pull --since 2h

auth: SENTRY_AUTH_TOKEN if set, else the authorised \`sentry\` CLI.`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [command, sub] = args.positional;
  args.positional = args.positional.slice(1);
  switch (command) {
  case 'report': return cmdReport(args);
  case 'issues': return cmdIssues(args);
  case 'issue': return cmdIssue(args);
  case 'classes': return cmdClasses(args);
  case 'class': return cmdClass(args);
  case 'trend': return cmdTrend(args);
  case 'save': return cmdSave(args);
  case 'resolve': return cmdResolve(args);
  case 'where': return cmdWhere(args);
  case 'selftest': return cmdSelftest(args);
  case 'box':
    if (sub === 'pull') {
      return boxPull(args);
    }
    if (sub === 'resolve') {
      return boxResolve(args);
    }
    throw new Failure('usage: diag box pull [--since 24h] | diag box resolve <fingerprint>', 2);
  case 'key':
    if (sub === undefined || sub === 'status') {
      return keyStatus();
    }
    if (sub === 'rotate') {
      return keyRotate(args);
    }
    if (sub === 'retire') {
      return keyRetire(args);
    }
    throw new Failure('usage: diag key [status] | diag key rotate [--name <text>] | diag key retire <key id>', 2);
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    console.log(USAGE);
    return 0;
  default:
    throw new Failure(`unknown command «${command}» — run \`npm run diag -- help\``, 2);
  }
}

main().then((code) => {
  process.exitCode = code;
}, (err) => {
  if (err instanceof Failure) {
    console.error(err.message);
    process.exitCode = err.exitCode;
  } else {
    console.error(`diag: ${err?.stack ?? err}`);
    process.exitCode = 1;
  }
});
