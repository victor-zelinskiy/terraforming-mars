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
 *   issues [filters]              the project's issues, newest first, filtered by the hub's own tags
 *   issue <shortId | id>          one issue: its latest event's tags, contexts, stack, breadcrumbs, attachments
 *   selftest [--since 30m]        did the connection check («Проверка связи») arrive from all three runtimes?
 *   box pull [--since 24h]        the box's diagnostic files (logs, reports, outbox, console exports, field logs)
 *   box resolve <fingerprint>     an automatic event's `p#…` / `g#…` back to the id and the save that holds it
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
 *   .diagnostics/issues/<shortId>/      an issue's attachments + event.json
 *   .diagnostics/box/<YYYYMMDD-HHMMSS>/ the box's files, by their path relative to /home/deck
 *
 * User input never reaches a shell string: every process is spawned with an argument array, and the two values that
 * do go into the box's remote command (`--since`, a fingerprint) are validated against a strict pattern first.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {spawn} from 'child_process';
import {fileURLToPath} from 'url';

const ORG = 'victor-zelinskiy';
const PROJECT = 'terraforming-mars';
const API_BASE = 'https://de.sentry.io/api/0/';
const BOX = 'steam-machine';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.diagnostics');
/** Must match `src/common/diagnostics/privacy.ts` — `FINGERPRINT_DIGITS`. */
const FINGERPRINT_DIGITS = 10;

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

function cut(s, n) {
  const one = String(s ?? '').replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function localTime(value) {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  const d = new Date(typeof value === 'number' ? value : String(value));
  if (Number.isNaN(d.getTime())) {
    return String(value);
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

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

function table(rows, header) {
  const all = [header, ...rows];
  const widths = header.map((_, i) => Math.max(...all.map((r) => String(r[i]).length)));
  return all.map((r) => r.map((c, i) => (i === r.length - 1 ? String(c) : String(c).padEnd(widths[i]))).join('  ')).join('\n');
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

function tagsOf(event) {
  const out = {};
  for (const t of event.tags ?? []) {
    out[t.key] = t.value;
  }
  return out;
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
  const since = period(f.since, '24h', true);
  const env = oneOf('env', f.env, ['box', 'production']);
  const terms = [];
  const kind = oneOf('kind', f.kind, ['error', 'stall', 'integrity', 'report']);
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
  const limit = f.limit === undefined ? 25 : Number(f.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Failure('--limit must be an integer 1…100', 2);
  }
  const list = await searchIssues({query: terms.join(' '), environment: env, limit, sort: 'date'});
  if (f.json) {
    console.log(JSON.stringify(list, null, 2));
    return 0;
  }
  const filters = `${terms.join(' ') || '(no filter)'}${env ? ` · environment=${env}` : ''}`;
  if (!Array.isArray(list) || list.length === 0) {
    console.log(`No issues found for ${filters}.`);
    return 0;
  }
  console.log(`${list.length} issue${list.length === 1 ? '' : 's'} for ${filters}:\n`);
  console.log(table(list.map((i) => [
    i.shortId, i.level ?? '—', i.count ?? '—', localTime(i.lastSeen), env ?? '—', cut(i.title, 100),
  ]), ['SHORT ID', 'LEVEL', 'SEEN', 'LAST SEEN', 'ENV', 'TITLE']));
  return 0;
}

async function cmdIssue(args) {
  const ref = args.positional[0];
  if (ref === undefined) {
    throw new Failure('usage: diag issue <shortId | numeric id>', 2);
  }
  const issue = await issueById(ref);
  const event = await latestEvent(issue.id);
  const L = [];
  L.push(`${issue.shortId} — ${issue.title}`);
  L.push(`level ${issue.level} · status ${issue.status} · seen ${issue.count}× by ${issue.userCount ?? 0} user(s) · first ${localTime(issue.firstSeen)} · last ${localTime(issue.lastSeen)}`);
  L.push(issue.permalink ?? '');
  L.push('');
  L.push(`Latest event ${event.eventID ?? event.id} · ${localTime(event.dateCreated)}`);
  L.push('');
  L.push('Tags:');
  for (const [k, v] of Object.entries(tagsOf(event))) {
    L.push(`  ${k}=${v}`);
  }
  for (const name of ['screen', 'episode']) {
    const c = event.contexts?.[name];
    if (c !== undefined) {
      L.push('');
      L.push(`Context ${name}:`);
      for (const [k, v] of Object.entries(c)) {
        if (k !== 'type') {
          L.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        }
      }
    }
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
  const dir = path.join(OUT, 'issues', safeName(issue.shortId));
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'event.json'), JSON.stringify(event, null, 1));
  const files = await downloadAttachments(event.eventID ?? event.id, dir);
  L.push('');
  L.push(files.length === 0 ? 'No attachments.' : `Attachments: ${files.map((x) => `${x.name} (${size(x.bytes)})`).join(', ')}`);
  L.push(`→ ${rel(dir)}/`);
  console.log(L.join('\n'));
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

async function boxResolve(args) {
  const fp = String(args.positional[1] ?? '').toLowerCase();
  if (!new RegExp(`^[pgs]#[0-9a-f]{${FINGERPRINT_DIGITS}}$`).test(fp)) {
    throw new Failure('usage: diag box resolve <p#xxxxxxxxxx | g#… | s#…>  (a letter, #, ten hex digits)', 2);
  }
  const remote = 'cd ~/.config/terraforming-mars/embedded/db/files && grep -roE \'"[pgs][0-9a-f]{8,16}"\' --include=\'*.json\' . | sort -u';
  let r;
  try {
    r = await run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', BOX, remote]);
  } catch (err) {
    throw new Failure(`ssh could not be started: ${err.message}`, 2);
  }
  // grep exits 1 for «no match» — an empty answer, not a failure. ssh's own failure is 255.
  if (r.code !== 0 && r.code !== 1) {
    throw new Failure(`ssh ${BOX}: ${cut(r.stderr.toString('utf8'), 300) || `exited ${r.code}`}`, 2);
  }
  const hits = new Map();
  let ids = 0;
  const seen = new Set();
  for (const line of r.stdout.toString('utf8').split('\n')) {
    const m = /^(.*):"([pgs][0-9a-f]{8,16})"$/.exec(line.trim());
    if (m === null) {
      continue;
    }
    const [, file, id] = m;
    if (!seen.has(id)) {
      seen.add(id);
      ids++;
    }
    const print = `${id[0]}#${crypto.createHash('sha256').update(id).digest('hex').slice(0, FINGERPRINT_DIGITS)}`;
    if (print === fp) {
      if (!hits.has(id)) {
        hits.set(id, []);
      }
      hits.get(id).push(`~/.config/terraforming-mars/embedded/db/files/${file.replace(/^\.\//, '')}`);
    }
  }
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

function keyLine(k) {
  const limit = k.rateLimit ? `${k.rateLimit.count} per ${Math.round(k.rateLimit.window / 3600)}h` : 'none';
  return [k.id.slice(0, 8), k.isActive ? 'active' : 'RETIRED', cut(k.name, 34), limit, localTime(k.dateCreated)];
}

async function keyStatus() {
  const keys = await api(`${projectPath}/keys/`);
  console.log(table(keys.map(keyLine), ['KEY', 'STATE', 'NAME', 'RATE LIMIT', 'CREATED']));
  // The plan's quota for the running period — what a flood (or a broken build) would burn.
  const customer = await api(`customers/${ORG}/`).catch(() => undefined);
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
  const keys = await api(`${projectPath}/keys/`);
  const hits = keys.filter((k) => k.id.startsWith(ref));
  if (hits.length !== 1) {
    throw new Failure(`«${ref}» names ${hits.length} keys — give more of the id (\`npm run diag -- key\`)`, 2);
  }
  const key = hits[0];
  if (keys.filter((k) => k.isActive && k.id !== key.id).length === 0) {
    throw new Failure('this is the only ACTIVE key: retiring it would silence every installed game. Create the next one first (`diag key rotate`).');
  }
  await apiWrite('PUT', `${projectPath}/keys/${key.id}/`, {isActive: false});
  console.log(`key ${key.id.slice(0, 8)} «${key.name}» is retired: the collector refuses it from now on (it can be switched back on in Sentry → Client Keys).`);
  return 0;
}

// ───────────────────────────── main ─────────────────────────────

const USAGE = `diag — the game's diagnostics, read from Sentry and from the box (docs/claude/diagnostics.md)

usage: npm run diag -- <command> [args]

  report <TM-XXXXXX | latest>   download a player's report package + write SUMMARY.md (.diagnostics/reports/<code>/)
  issues [--since 24h|all] [--env box|production] [--kind error|stall|integrity|report]
         [--family <tag>] [--runtime page|main|server] [--limit 25] [--json]
                                list the project's issues, newest first
  issue <shortId | id>          one issue: tags, contexts, stack, breadcrumbs; attachments → .diagnostics/issues/<shortId>/
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
