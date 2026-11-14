/**
 * THE PURE HALF OF `scripts/diag.mjs` — everything of the agents' diagnostics tool that needs no network, no ssh and no
 * walk of the disk: reading a Sentry event as a CASE (its cause, what stood, how it ended), laying a case and a class
 * out for a reader, merging the grouped answers of the collector into one row per cause class, summing the session
 * ledgers into «are freezes fewer?», finding the save that held an episode, turning a save into an e2e fixture, and
 * going from a word of the evidence to the line that declares it.
 *
 * `diag.mjs` fetches and writes; this module only computes — so it is unit-tested (`tests/scripts/diagLib.spec.ts`)
 * with hand-made events, ledgers and source strings, and what it prints cannot drift from what it is checked on.
 *
 * Words it shares with the game's own code (`src/common/diagnostics/cause.ts`, `src/server/diagnostics/hub/`): a CAUSE
 * CLASS is the grouping key of a defect, its SHAPE is its first two `/`-words, a TIER is what a line is for, a
 * DIMENSION is a tag that must not split a class.
 */
import * as crypto from 'crypto';

/** Must match `src/common/diagnostics/privacy.ts` — `FINGERPRINT_DIGITS` (the spec compares the two functions). */
export const FINGERPRINT_DIGITS = 10;
/** The release's prefix in the collector (`hubConfig.ts`: `terraforming-mars@<package.json version>`). */
export const RELEASE_PREFIX = 'terraforming-mars@';
/** Where the embedded server keeps every save of a game, relative to the box's home (`LocalFilesystem.ts`). */
export const BOX_HISTORY_DIR = '.config/terraforming-mars/embedded/db/files/history';

// ───────────────────────────── formatting ─────────────────────────────

export function cut(s, n) {
  const one = String(s ?? '').replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateOf(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const d = new Date(typeof value === 'number' ? value : String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** `2026-11-14 14:43:42` in the reader's own time zone; `—` for nothing, the value itself for what is not a date. */
export function localTime(value) {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  const d = dateOf(value);
  if (d === undefined) {
    return String(value);
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** `20261114-144342` — the same moment as a folder's name. */
export function localStamp(value) {
  const d = dateOf(value) ?? new Date(0);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export function table(rows, header) {
  const all = [header, ...rows];
  const widths = header.map((_, i) => Math.max(...all.map((r) => String(r[i]).length)));
  return all.map((r) => r.map((c, i) => (i === r.length - 1 ? String(c) : String(c).padEnd(widths[i]))).join('  ')).join('\n');
}

/** `terraforming-mars@1.2.3250` → `1.2.3250` (anything else stays as it is). */
export function shortRelease(release) {
  const r = String(release ?? '');
  return r.startsWith(RELEASE_PREFIX) ? r.slice(RELEASE_PREFIX.length) : (r === '' ? '(none)' : r);
}

/** Newest first: dotted numbers compared number by number; what is not a version sorts last, by name. */
export function compareReleases(a, b) {
  const parts = (r) => shortRelease(r).split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  const pa = parts(a);
  const pb = parts(b);
  const versionA = pa.every((n) => !Number.isNaN(n));
  const versionB = pb.every((n) => !Number.isNaN(n));
  if (versionA !== versionB) {
    return versionA ? -1 : 1;
  }
  if (!versionA) {
    return String(a).localeCompare(String(b));
  }
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (d !== 0) {
      return d;
    }
  }
  return 0;
}

/** The shape of a class: its first two words (`wait-graph/ceiling/played-hero:payback` → `wait-graph/ceiling`). */
export function shapeOfClass(cls) {
  return String(cls).split('/').slice(0, 2).join('/');
}

// ───────────────────────────── a Sentry event, read as a CASE ─────────────────────────────

export function tagsOf(event) {
  const out = {};
  for (const t of event?.tags ?? []) {
    out[t.key] = t.value;
  }
  return out;
}

/**
 * An event's `extra`. ⚠ The collector's API returns it under `context` (singular) — `contexts` (plural) are the named
 * contexts, and there is no `extra` key at all in what it answers (measured on a real event, 2026-11-14).
 */
export function extraOf(event) {
  const x = event?.context ?? event?.extra;
  return x !== null && typeof x === 'object' ? x : {};
}

function contextOf(event, name) {
  const c = event?.contexts?.[name];
  return c !== null && typeof c === 'object' ? c : undefined;
}

function listOf(value) {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
  }
  return typeof value === 'string' && value !== '' ? value.split('\n') : [];
}

/**
 * A long list leaves in PARTS (`sentryEvent.ts` `extraLists`: the collector keeps ~16 KB of one `extra` value) —
 * `flow_tree`, `flow_tree_2`, `flow_tree_3`, … — and is read back as one list, in order.
 */
export function partsOf(extra, name) {
  const out = listOf(extra?.[name]);
  for (let part = 2; extra?.[`${name}_${part}`] !== undefined; part++) {
    out.push(...listOf(extra[`${name}_${part}`]));
  }
  return out;
}

/** The dimensions that are TAGS of an event (`sentryEvent.ts` `DIM_TAGS`), in the order a reader asks them. */
export const DIM_ORDER = ['reason', 'asked', 'task', 'where', 'holder', 'source', 'owner', 'by', 'how', 'outcome', 'stood', 'cure'];

function orderedDims(dims) {
  const known = DIM_ORDER.filter((k) => dims[k] !== undefined && dims[k] !== '').map((k) => [k, dims[k]]);
  const rest = Object.keys(dims).filter((k) => !DIM_ORDER.includes(k) && dims[k] !== undefined && dims[k] !== '').sort().map((k) => [k, dims[k]]);
  return [...known, ...rest];
}

/**
 * What the collector CUT of an event (its `_meta` names every value it trimmed or dropped — a context over its size, a
 * tag over 200 characters): the paths, so that «the evidence did not arrive» is never mistaken for «there was none».
 */
export function cutPaths(event) {
  const out = [];
  const walk = (node, at, value, label) => {
    if (node === null || typeof node !== 'object' || out.length >= 40) {
      return;
    }
    const own = node[''];
    if (own !== null && typeof own === 'object') {
      if (Array.isArray(own.rem) || Array.isArray(own.err)) {
        const why = [...(own.rem ?? []), ...(own.err ?? [])].map((r) => (Array.isArray(r) ? r[0] : r)).filter((r) => typeof r === 'string');
        out.push(`${[label, ...at].join('.')}${why.length > 0 ? ` (${[...new Set(why)].join(', ')})` : ''}`);
      } else if (typeof own.len === 'number' && Array.isArray(value) && value.length < own.len) {
        // A list that lost its END: the collector says how long it was sent, the event how much of it arrived.
        out.push(`${[label, ...at].join('.')}: ${value.length} of ${own.len} arrived`);
      }
    }
    for (const [key, below] of Object.entries(node)) {
      if (key !== '') {
        walk(below, [...at, key], value === null || value === undefined ? undefined : value[key], label);
      }
    }
  };
  const meta = event?._meta;
  walk(meta?.contexts, [], event?.contexts, 'contexts');
  walk(meta?.context, [], event?.context, 'extra');
  walk(meta?.tags, [], event?.tags, 'tags');
  return out;
}

/**
 * ONE EVENT AS ONE CASE: the cause (class, shape, tier, dimensions), what stood (the question, the holders), how it
 * ended (the episode: outcome, who cured it, what changed), the long lists, and where the game's save stood. Every
 * part is `undefined` / empty for an event that carries none of it (an exception, a report, an event of an older build).
 */
export function readCase(event) {
  const tags = tagsOf(event);
  const extra = extraOf(event);
  const c = contextOf(event, 'cause');
  const cls = c?.class ?? tags.cause;
  let cause;
  if (typeof cls === 'string' && cls !== '') {
    const dims = {};
    for (const key of DIM_ORDER) {
      if (tags[key] !== undefined) {
        dims[key] = String(tags[key]);
      }
    }
    for (const [key, value] of Object.entries(c ?? {})) {
      if (!['type', 'class', 'shape', 'tier'].includes(key) && value !== undefined && value !== null) {
        dims[key] = String(value);
      }
    }
    cause = {cls, shape: String(c?.shape ?? tags.shape ?? shapeOfClass(cls)), tier: String(c?.tier ?? tags.tier ?? ''), dims};
  }
  const ep = contextOf(event, 'episode');
  const episode = ep === undefined ? undefined : {
    state: String(ep.state ?? tags.episode ?? ''),
    outcome: String(ep.outcome ?? tags.outcome ?? ep.state ?? ''),
    durationS: typeof ep.duration_s === 'number' ? ep.duration_s : undefined,
    lines: typeof ep.lines === 'number' ? ep.lines : undefined,
    steps: listOf(ep.steps),
    curedBy: String(ep.cured_by ?? ''),
    cure: String(ep.cure ?? ''),
    changed: listOf(ep.changed),
    nets: listOf(ep.nets),
  };
  const ev = contextOf(event, 'evidence');
  const evidence = ev === undefined ? undefined : {
    question: String(ev.question ?? ''), holders: listOf(ev.holders), input: String(ev.input ?? ''), takenAt: String(ev.taken_at ?? ''),
  };
  const sv = contextOf(event, 'save');
  const save = sv !== undefined && typeof sv.game_ref === 'string' && sv.game_ref !== '' ? {gameRef: sv.game_ref, saveId: Number(sv.save_id)} : undefined;
  const screen = contextOf(event, 'screen');
  return {
    eventId: String(event?.eventID ?? event?.id ?? ''),
    issueId: event?.groupID === undefined || event?.groupID === null ? '' : String(event.groupID),
    at: event?.dateCreated ?? event?.dateReceived ?? '',
    release: String(tags.release ?? event?.release?.version ?? ''),
    environment: String(tags.environment ?? ''),
    title: String(event?.title ?? event?.message ?? ''),
    tags, cause, episode, evidence, save, screen,
    text: typeof extra.text === 'string' ? extra.text : '',
    flowTree: partsOf(extra, 'flow_tree'), waits: partsOf(extra, 'waits'), waitGraph: partsOf(extra, 'wait_graph'), flowTrace: partsOf(extra, 'flow_trace'),
    ending: typeof extra.ending === 'string' ? extra.ending : '',
    cut: cutPaths(event),
  };
}

/** Has the event anything of the cause's own (a cause, evidence, or an episode with an outcome)? */
export function hasCause(c) {
  return c.cause !== undefined || c.evidence !== undefined;
}

/** How a case ended, in a few words (`healed after 18 s — cured by presentation-ledger`). */
export function endingOf(c) {
  const ep = c.episode;
  if (ep === undefined) {
    return c.cause === undefined ? '—' : 'no episode (a single line)';
  }
  const stood = ep.durationS === undefined ? '' : ` after ${ep.durationS} s`;
  const word = ep.outcome !== '' ? ep.outcome : ep.state;
  if (word === 'healed') {
    return `healed${stood}${ep.curedBy !== '' ? ` — cured by ${ep.curedBy}` : ''}`;
  }
  if (word === 'open' || word === 'standing') {
    return `still standing${stood} when the event left`;
  }
  return `NOT cured: ${word}${stood}`;
}

const LINES_SHOWN = 30;

/**
 * A case in READING ORDER, as the sections `diag issue` prints (each a list of lines; an empty list = nothing of it in
 * the event): the cause → what stood → how it ended → the net's own lines → the long lists → the save.
 */
export function renderCase(c, {saveHint} = {}) {
  const cause = [];
  if (c.cause !== undefined) {
    cause.push('Cause:');
    cause.push(`  class  ${c.cause.cls}`);
    cause.push(`  shape  ${c.cause.shape} · tier ${c.cause.tier === '' ? '?' : c.cause.tier}`);
    const dims = orderedDims(c.cause.dims);
    if (dims.length > 0) {
      cause.push(`  ${dims.map(([k, v]) => `${k}=${v}`).join(' · ')}`);
    }
  }
  const evidence = [];
  if (c.evidence !== undefined) {
    evidence.push(`Evidence${c.evidence.takenAt === '' ? '' : ` (what stood at ${localTime(c.evidence.takenAt)})`}:`);
    evidence.push(`  question  ${c.evidence.question === '' ? '—' : c.evidence.question}`);
    evidence.push(c.evidence.holders.length === 0 ? '  holders   —' : '  holders:');
    for (const h of c.evidence.holders) {
      evidence.push(`    ${h}`);
    }
    if (c.evidence.input !== '') {
      evidence.push(`  input     ${c.evidence.input}`);
    }
  }
  const episode = [];
  if (c.episode !== undefined && c.cause !== undefined) {
    const ep = c.episode;
    episode.push('Episode:');
    episode.push(`  ${[
      `state ${ep.state === '' ? '?' : ep.state}`, `outcome ${ep.outcome === '' ? '?' : ep.outcome}`,
      ...(ep.durationS === undefined ? [] : [`stood ${ep.durationS} s`]), ...(ep.lines === undefined ? [] : [`${ep.lines} line(s)`]),
    ].join(' · ')}`);
    if (ep.steps.length > 0) {
      episode.push('  steps:');
      for (const s of ep.steps) {
        episode.push(`    ${s}`);
      }
    }
    episode.push(`  cured by  ${ep.curedBy === '' ? 'nobody' : ep.curedBy}${ep.cure === '' ? '' : ` — ${ep.cure}`}`);
    if (ep.changed.length > 0) {
      episode.push('  changed (what stood at the start and no longer stood at the end):');
      for (const s of ep.changed) {
        episode.push(`    ${s}`);
      }
    } else if (ep.state !== 'open' && c.evidence !== undefined) {
      episode.push('  changed   nothing the evidence names (the picture moved, the structure did not — or no snapshot was taken at the end)');
    }
    if (ep.nets.length > 0) {
      episode.push('  nets (what else spoke inside it):');
      for (const s of ep.nets) {
        episode.push(`    ${s}`);
      }
    }
  }
  const lines = [];
  if (c.cause !== undefined && c.text !== '') {
    const all = c.text.split('\n');
    lines.push(`Lines (the net's own, ${all.length}):`);
    for (const s of all.slice(0, LINES_SHOWN)) {
      lines.push(`  ${s}`);
    }
    if (all.length > LINES_SHOWN) {
      lines.push(`  … +${all.length - LINES_SHOWN} more (event.json → context.text)`);
    }
  }
  const lists = [];
  for (const [name, list] of [['Flow tree', c.flowTree], ['Waits', c.waits], ['Wait graph', c.waitGraph], ['Flow trace', c.flowTrace]]) {
    if (list.length > 0) {
      if (lists.length > 0) {
        lists.push('');
      }
      lists.push(`${name} (${list.length}):`);
      for (const s of list) {
        lists.push(`  ${s}`);
      }
    }
  }
  const save = [];
  if (c.save !== undefined) {
    save.push('Save (where the game stood when the episode began):');
    save.push(`  ${c.save.gameRef} at save ${c.save.saveId}`);
    save.push(`  fetch it:  npm run diag -- save ${saveHint ?? `${c.save.gameRef} ${c.save.saveId}`}`);
  }
  const cutNote = c.cut.length === 0 ? [] : [`⚠ the collector CUT ${c.cut.length} value(s) of this event: ${c.cut.join(' · ')}`];
  return {cause, evidence, episode, lines, lists, save, cut: cutNote};
}

// ───────────────────────────── a class, opened: the folders of its cases ─────────────────────────────

/**
 * A cause class as a folder's name: `/` → `__`, whatever a file system refuses → `_`, and six hex digits of the class's
 * own hash — two classes that differ only in a refused character never share a folder.
 */
export function safeClassDir(cls) {
  const s = String(cls);
  const readable = s.replace(/\//g, '__').replace(/[^A-Za-z0-9._+-]/g, '_').replace(/^\.+/, '_').slice(0, 110);
  return `${readable}-${crypto.createHash('sha256').update(s).digest('hex').slice(0, 6)}`;
}

/** `01-20261114-144342-healed` — the case's number (01 = the newest), when, how it ended. */
export function caseFolderName(index, c) {
  const outcome = (c.episode?.outcome ?? '').replace(/[^a-z0-9-]/gi, '') || (c.episode === undefined ? 'line' : 'unknown');
  return `${pad2(index + 1)}-${localStamp(c.at)}-${outcome}`;
}

/** The files of a case folder, in the order they are read: [name, the lines] (an empty list is still written — «none» is an answer). */
export function caseFiles(c) {
  return [
    ['01-lines.txt', c.text === '' ? [] : c.text.split('\n')],
    ['02-flow-tree.txt', c.flowTree],
    ['03-waits.txt', c.waits],
    ['04-wait-graph.txt', c.waitGraph],
    ['05-flow-trace.txt', c.flowTrace],
  ];
}

function mdList(items, indent = '') {
  return items.map((s) => `${indent}- ${s}`);
}

/** `00-summary.md` of a case: the cause, the dimensions, the question, the holders, how it ended, who cured it, what changed. */
export function caseSummaryMd(c, {index = 0, issue, attachments = []} = {}) {
  const L = [];
  const run = c.tags.run ?? '—';
  L.push(`# ${c.cause?.cls ?? c.title} — case ${pad2(index + 1)}`);
  L.push('');
  L.push(`- **When:** ${localTime(c.at)} · release ${shortRelease(c.release)} · environment ${c.environment === '' ? '—' : c.environment} · run ${run}`);
  L.push(`- **Event:** ${c.eventId}${issue !== undefined ? ` · issue ${issue.shortId ?? issue.id}${issue.permalink ? ` (${issue.permalink})` : ''}` : ''}`);
  L.push(`- **How it ended:** ${endingOf(c)}`);
  L.push(`- **Said as:** ${c.title}`);
  L.push('');
  L.push('## The cause');
  if (c.cause === undefined) {
    L.push('The event names no cause class (an event of a build before the cause existed).');
  } else {
    L.push(`- class \`${c.cause.cls}\``);
    L.push(`- shape \`${c.cause.shape}\` · tier ${c.cause.tier === '' ? '?' : c.cause.tier}`);
    for (const [k, v] of orderedDims(c.cause.dims)) {
      L.push(`- ${k}: ${v}`);
    }
  }
  L.push('');
  L.push('## The question, and who held it');
  if (c.evidence === undefined) {
    L.push('No evidence snapshot in this event.');
  } else {
    L.push(`- question: ${c.evidence.question === '' ? '—' : c.evidence.question}`);
    L.push(c.evidence.holders.length === 0 ? '- holders: —' : '- holders (the first is the one the class names):');
    L.push(...mdList(c.evidence.holders, '  '));
    if (c.evidence.input !== '') {
      L.push(`- input: ${c.evidence.input}`);
    }
    if (c.evidence.takenAt !== '') {
      L.push(`- taken at ${localTime(c.evidence.takenAt)} — BEFORE the first cure ran`);
    }
  }
  L.push('');
  L.push('## The episode');
  const ep = c.episode;
  if (ep === undefined) {
    L.push('Not an episode: one line, sent when it was born.');
  } else {
    L.push(`- state ${ep.state} · outcome ${ep.outcome}${ep.durationS === undefined ? '' : ` · stood ${ep.durationS} s`}${c.tags.stood ? ` (${c.tags.stood})` : ''}${ep.lines === undefined ? '' : ` · ${ep.lines} line(s)`}`);
    if (ep.steps.length > 0) {
      L.push('- steps, in order:');
      L.push(...ep.steps.map((s, i) => `  ${i + 1}. ${s}`));
    }
    L.push(`- cured by: ${ep.curedBy === '' ? 'nobody' : `**${ep.curedBy}**`}${ep.cure === '' ? '' : ` — ${ep.cure}`}`);
    if (ep.changed.length > 0) {
      L.push('- what changed (stood at the start, no longer at the end):');
      L.push(...mdList(ep.changed, '  '));
    } else {
      L.push('- what changed: nothing the evidence names');
    }
    if (ep.nets.length > 0) {
      L.push('- what else spoke inside it:');
      L.push(...mdList(ep.nets, '  '));
    }
  }
  if (c.screen !== undefined) {
    L.push('');
    L.push('## The screen');
    L.push(`- ${Object.entries(c.screen).filter(([k]) => k !== 'type').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}`);
  }
  L.push('');
  L.push('## The save');
  L.push(c.save === undefined ?
    'The event names no save (not a hosting device, or not an episode).' :
    `\`npm run diag -- save ${c.save.gameRef} ${c.save.saveId}\` — the game as it stood when the episode began (\`${c.save.gameRef}\`, save ${c.save.saveId}).`);
  L.push('');
  L.push('## Read next, in this order');
  for (const [name, list] of caseFiles(c)) {
    L.push(`- \`${name}\` — ${list.length} line(s)`);
  }
  L.push('- `event.json` — the full event (tags, contexts, breadcrumbs)');
  for (const a of attachments) {
    L.push(`- \`${a.name}\` — attached to the event`);
  }
  if (c.cut.length > 0) {
    L.push('');
    L.push(`⚠ The collector CUT ${c.cut.length} value(s) of this event: ${c.cut.join(' · ')}`);
  }
  return L.join('\n') + '\n';
}

function mdCell(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

function issueStatus(issue) {
  const d = issue.statusDetails ?? {};
  const how = d.inNextRelease ? ' in the next release' : (d.inRelease ? ` in ${shortRelease(d.inRelease)}` : (d.inCommit ? ' in a commit' : ''));
  const sub = issue.substatus && issue.substatus !== issue.status ? ` (${issue.substatus})` : '';
  return `${issue.status ?? '?'}${how}${sub}`;
}

/** One line for an issue wherever it is named. */
export function issueLine(issue) {
  return `${issue.shortId ?? issue.id} — ${issueStatus(issue)} · seen ${issue.count ?? '?'}× · first ${localTime(issue.firstSeen)} · last ${localTime(issue.lastSeen)}${issue.permalink ? ` · ${issue.permalink}` : ''}`;
}

/**
 * The class's `README.md`: its cases as a table, the issue with its status, how to fetch the save of a case, and WHERE
 * THE CLASS IS REPRODUCED IN THE REPO (`repro` — the hits of `findReproductions`).
 */
export function classReadme({cls, cases, issues = [], repro = [], filters = '', reproSearched = 'tests/ and .e2e-remote/**/monkey-report*.json'}) {
  const L = [];
  const first = cases[0]?.case;
  L.push(`# ${cls}`);
  L.push('');
  L.push(`- shape \`${shapeOfClass(cls)}\`${first?.cause?.tier ? ` · tier ${first.cause.tier}` : ''}`);
  if (issues.length === 0) {
    L.push('- issue: none found in the collector for this class');
  } else if (issues.length === 1) {
    L.push(`- issue: ${issueLine(issues[0])}`);
  } else {
    L.push(`- ⚠ ONE CLASS IS FILED UNDER ${issues.length} ISSUES (the fingerprint did not group it):`);
    L.push(...mdList(issues.map(issueLine), '  '));
  }
  L.push(`- ${cases.length} case(s) below, the newest first${filters === '' ? '' : ` — ${filters}`}`);
  L.push('');
  if (cases.length === 0) {
    L.push('No event of this class matched.');
  } else {
    L.push('| # | when | release | env | outcome | stood | cure | holder | source | run | folder |');
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    cases.forEach(({folder, case: c}, i) => {
      const d = c.cause?.dims ?? {};
      const stood = c.episode?.durationS === undefined ? (d.stood ?? '—') : `${c.episode.durationS} s`;
      L.push(`| ${pad2(i + 1)} | ${localTime(c.at)} | ${shortRelease(c.release)} | ${c.environment || '—'} | ${c.episode?.outcome || d.outcome || '—'} | ${stood} | ` +
        `${mdCell(c.episode?.curedBy || d.cure || '—')} | ${mdCell(d.holder ?? '—')} | ${mdCell(d.source ?? '—')} | ${mdCell(c.tags.run ?? '—')} | \`${folder}/\` |`);
    });
  }
  L.push('');
  L.push('## The save of a case');
  const saves = cases.filter(({case: c}) => c.save !== undefined);
  if (saves.length === 0) {
    L.push('No case names a save (only an episode on a hosting device does).');
  } else {
    for (const {folder, case: c} of saves) {
      L.push(`- \`${folder}\`: \`npm run diag -- save ${c.save.gameRef} ${c.save.saveId}\``);
    }
    L.push('');
    L.push('The save is the game as it stood when the episode BEGAN; `--fixture <name>` writes it as `tests/e2e/fixtures/field-<name>.json`.');
  }
  L.push('');
  L.push('## Where the class is reproduced in the repo');
  // A REPRODUCTION drives the console (an e2e spec, a walk of the monkey); a unit spec that holds the key is a sample of it.
  const replays = repro.filter((h) => isReplay(h.file));
  const samples = repro.filter((h) => !isReplay(h.file));
  const hitLine = (h) => `\`${h.file}:${h.line}\`  ${cut(h.text, 160)}`;
  if (replays.length === 0) {
    L.push(`Nowhere: no e2e spec and no monkey report names \`${cls}\` (searched: ${reproSearched}) — a field case with no reproducing spec yet.`);
  } else {
    L.push('The class key, as an exact string, in what DRIVES the console (e2e specs, the monkey\'s reports):');
    L.push(...mdList(replays.map(hitLine)));
  }
  if (samples.length > 0) {
    L.push('');
    L.push('Also named by unit specs (a sample of the key — how it is computed and filed, not a replay of the stall):');
    L.push(...mdList(samples.map(hitLine)));
  }
  L.push('');
  L.push('## Reading order of a case folder');
  L.push('`00-summary.md` (the cause, the question, the holders, how it ended) → `01-lines.txt` (the net\'s own lines) → `02-flow-tree.txt` → `03-waits.txt` → ' +
    '`04-wait-graph.txt` → `05-flow-trace.txt` → `event.json` → the attachments (`hang_trace.json`, `console_export.txt`).');
  return L.join('\n') + '\n';
}

/** Does a file DRIVE the console (an e2e spec or driver, a report of the monkey) — as against a unit spec that only holds the key? */
export function isReplay(file) {
  const f = String(file).split('\\').join('/');
  return f.startsWith('tests/e2e/') || f.startsWith('.e2e-remote/');
}

const CLASS_WORD = /[A-Za-z0-9_\-/:+]/;

/**
 * WHERE A CLASS IS NAMED IN THE REPO — the class key as an EXACT string (a longer class that merely starts with it is
 * another class): `files` = [{path, text}], the answer = [{file, line, text}].
 */
export function findReproductions(files, cls) {
  const hits = [];
  for (const {path: file, text} of files) {
    if (!text.includes(cls)) {
      continue;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let from = 0;
      for (;;) {
        const at = line.indexOf(cls, from);
        if (at < 0) {
          break;
        }
        const before = at === 0 ? '' : line[at - 1];
        const after = line[at + cls.length] ?? '';
        // (A full stop that ends a sentence is not a word of a class; one followed by a letter is — `board.journal`.)
        const afterIsWord = CLASS_WORD.test(after) || (after === '.' && CLASS_WORD.test(line[at + cls.length + 1] ?? ''));
        if (!CLASS_WORD.test(before) && before !== '.' && !afterIsWord) {
          hits.push({file, line: i + 1, text: line.trim()});
          break;
        }
        from = at + 1;
      }
    }
  }
  return hits;
}

// ───────────────────────────── classes: one row per cause class ─────────────────────────────

/**
 * The collector's three grouped answers → ONE ROW PER CAUSE CLASS:
 *   `main`     [{cause, tier, kind, issue, issueId, count, runs, first, last}]  (grouped by cause + issue)
 *   `outcomes` [{cause, outcome, count}]
 *   `releases` [{cause, release, count}]
 * A class the fingerprint split over several issues is ONE row that lists them all (and that is a finding).
 */
export function mergeClassRows(main, outcomes = [], releases = []) {
  const rows = new Map();
  for (const r of main) {
    const cls = String(r.cause ?? '');
    if (cls === '') {
      continue;
    }
    const row = rows.get(cls) ?? {cls, tier: '', kind: '', events: 0, runs: 0, runsExact: true, first: '', last: '', outcomes: {}, releases: [], issues: []};
    if (rows.has(cls)) {
      // (Distinct runs cannot be summed over two groups: the larger is the floor.)
      row.runsExact = false;
    }
    row.tier ||= String(r.tier ?? '');
    row.kind ||= String(r.kind ?? '');
    row.events += Number(r.count ?? 0);
    row.runs = Math.max(row.runs, Number(r.runs ?? 0));
    if (r.first && (row.first === '' || String(r.first) < row.first)) {
      row.first = String(r.first);
    }
    if (r.last && (row.last === '' || String(r.last) > row.last)) {
      row.last = String(r.last);
    }
    if (r.issue && !row.issues.some((i) => i.shortId === r.issue)) {
      row.issues.push({shortId: String(r.issue), id: r.issueId === undefined ? '' : String(r.issueId)});
    }
    rows.set(cls, row);
  }
  for (const r of outcomes) {
    const row = rows.get(String(r.cause ?? ''));
    if (row !== undefined) {
      const key = r.outcome === undefined || r.outcome === '' ? 'no-episode' : String(r.outcome);
      row.outcomes[key] = (row.outcomes[key] ?? 0) + Number(r.count ?? 0);
    }
  }
  for (const r of releases) {
    const row = rows.get(String(r.cause ?? ''));
    if (row !== undefined) {
      const release = String(r.release ?? '');
      const had = row.releases.find((x) => x.release === release);
      if (had !== undefined) {
        had.n += Number(r.count ?? 0);
      } else {
        row.releases.push({release, n: Number(r.count ?? 0)});
      }
    }
  }
  for (const row of rows.values()) {
    // Oldest release first: the column reads left to right as time does (`1.2.3250:4 1.2.3251:1`).
    row.releases.sort((a, b) => compareReleases(b.release, a.release));
  }
  return [...rows.values()].sort((a, b) => b.events - a.events || a.cls.localeCompare(b.cls));
}

const OUTCOME_ORDER = ['healed', 'unhealed', 'reload', 'quit', 'standing', 'no-episode'];

function outcomesText(outcomes) {
  const keys = [...OUTCOME_ORDER.filter((k) => outcomes[k] !== undefined), ...Object.keys(outcomes).filter((k) => !OUTCOME_ORDER.includes(k)).sort()];
  return keys.length === 0 ? '—' : keys.map((k) => `${k} ${outcomes[k]}`).join(' · ');
}

/** The table `diag classes` prints (the class last: it is the long one). */
export function renderClasses(rows) {
  return table(rows.map((r) => [
    r.events,
    `${r.runsExact ? '' : '≥'}${r.runs}`,
    r.tier === '' ? '—' : r.tier,
    outcomesText(r.outcomes),
    localTime(r.first),
    localTime(r.last),
    r.issues.length === 0 ? '—' : `${r.issues.map((i) => i.shortId).join('+')}${r.issues.length > 1 ? ' ⚠SPLIT' : ''}`,
    r.releases.length === 0 ? '—' : r.releases.map((x) => `${shortRelease(x.release)}:${x.n}`).join(' '),
    r.cls,
  ]), ['EVENTS', 'RUNS', 'TIER', 'OUTCOMES', 'FIRST SEEN', 'LAST SEEN', 'ISSUE', 'BY RELEASE', 'CAUSE CLASS']);
}

// ───────────────────────────── trend: «are freezes fewer?» from the session ledgers ─────────────────────────────

export const STOOD_ORDER = ['under-5s', '5-10s', '10-20s', '20-40s', 'over-40s'];
const FRAME_FIELDS = ['n', 'native', 'pressWaited', 'totalMs', 'scriptMs', 'forcedLayoutMs', 'styleLayoutMs', 'renderMs'];

function emptyFrames() {
  return {n: 0, worstMs: 0, native: 0, pressWaited: 0, totalMs: 0, scriptMs: 0, forcedLayoutMs: 0, styleLayoutMs: 0, renderMs: 0};
}

/** One ledger row of long frames added into a sum. A ledger written before the split existed lacks its fields: they count as 0. */
function addFrames(into, row) {
  for (const field of FRAME_FIELDS) {
    into[field] += Number(row?.[field] ?? 0) || 0;
  }
  into.worstMs = Math.max(into.worstMs, Number(row?.worstMs ?? 0) || 0);
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function sumValues(record) {
  return Object.values(record ?? {}).reduce((sum, n) => sum + num(n), 0);
}

function perUnit(n, units) {
  return units > 0 ? Math.round((n / units) * 100) / 100 : null;
}

/**
 * «ARE FREEZES FEWER?» — the session ledgers (`sessionLedger.ts` `SessionLedger`, one per app run) summed BY RELEASE:
 * the sessions and their hours of play (the denominator), defect-tier records and episodes per hour and per session,
 * how the episodes ended, how long they stood, the renderer's stops, the long frames and where their time went; then
 * the top defect classes with their count per release, and THE FIRES OF EVERY NET — every class of every tier summed
 * by its shape, a row for every shape seen in ANY release (a zero is the evidence a net's retirement needs).
 *
 * A run counted twice (the same `run`) is taken once; what is not a ledger is skipped and counted in `skipped`.
 */
export function aggregateTrend(ledgers) {
  const byRun = new Map();
  let skipped = 0;
  for (const l of ledgers) {
    if (l === null || typeof l !== 'object' || typeof l.run !== 'string' || l.classes === null || typeof l.classes !== 'object') {
      skipped++;
      continue;
    }
    const had = byRun.get(l.run);
    if (had === undefined || num(l.lastAt) >= num(had.lastAt)) {
      byRun.set(l.run, l);
    }
  }
  const releases = new Map();
  const classes = new Map();
  const shapes = new Map();
  for (const l of byRun.values()) {
    const release = String(l.release ?? '');
    const acc = releases.get(release) ?? {
      release, sessions: 0, playMs: 0, games: 0, pages: 0, defects: 0, episodes: 0, errors: 0, outcomes: {}, stood: {}, rendererStops: 0,
      frames: emptyFrames(), sections: new Map(), firstAt: 0, lastAt: 0,
    };
    releases.set(release, acc);
    acc.sessions++;
    acc.playMs += num(l.playMs);
    acc.games += num(l.games);
    acc.pages += num(l.pages);
    acc.errors += num(l.kinds?.error);
    acc.rendererStops += num(l.rendererStops);
    acc.firstAt = acc.firstAt === 0 ? num(l.startedAt) : Math.min(acc.firstAt, num(l.startedAt) || acc.firstAt);
    acc.lastAt = Math.max(acc.lastAt, num(l.lastAt));
    // (The ledger lists only its newest episodes; the outcomes count them all.)
    acc.episodes += Math.max(sumValues(l.outcomes), Array.isArray(l.episodes) ? l.episodes.length : 0);
    for (const [k, n] of Object.entries(l.outcomes ?? {})) {
      acc.outcomes[k] = (acc.outcomes[k] ?? 0) + num(n);
    }
    for (const [k, n] of Object.entries(l.stood ?? {})) {
      acc.stood[k] = (acc.stood[k] ?? 0) + num(n);
    }
    for (const [section, row] of Object.entries(l.longFrames ?? {})) {
      addFrames(acc.frames, row);
      const s = acc.sections.get(section) ?? emptyFrames();
      addFrames(s, row);
      acc.sections.set(section, s);
    }
    for (const [cls, row] of Object.entries(l.classes)) {
      const tier = String(row?.tier ?? '');
      const n = num(row?.n);
      const lines = num(row?.lines);
      const sent = num(row?.sent);
      if (tier === 'defect') {
        acc.defects += n;
      }
      const c = classes.get(cls) ?? {cls, tier, total: 0, lines: 0, sent: 0, perRelease: {}};
      c.total += n;
      c.lines += lines;
      c.sent += sent;
      c.perRelease[release] = (c.perRelease[release] ?? 0) + n;
      classes.set(cls, c);
      const shape = shapeOfClass(cls);
      const s = shapes.get(shape) ?? {shape, tiers: [], total: 0, lines: 0, perRelease: {}};
      if (tier !== '' && !s.tiers.includes(tier)) {
        s.tiers.push(tier);
      }
      s.total += n;
      s.lines += lines;
      const cell = s.perRelease[release] ?? (s.perRelease[release] = {n: 0, lines: 0});
      cell.n += n;
      cell.lines += lines;
      shapes.set(shape, s);
    }
  }
  const order = [...releases.keys()].sort(compareReleases);
  const share = (n, of) => (of > 0 ? Math.round((n / of) * 1000) / 10 : null);
  const framesOut = (f) => ({
    ...f,
    // WHERE THE TIME WENT, as shares of the frames' own total (forced layout is a part OF the script's share).
    shares: {script: share(f.scriptMs, f.totalMs), forcedLayout: share(f.forcedLayoutMs, f.totalMs), styleLayout: share(f.styleLayoutMs, f.totalMs), render: share(f.renderMs, f.totalMs)},
  });
  const releaseRows = order.map((release) => {
    const acc = releases.get(release);
    const hours = acc.playMs / 3_600_000;
    const outcomeShares = {};
    for (const [k, n] of Object.entries(acc.outcomes)) {
      outcomeShares[k] = share(n, sumValues(acc.outcomes));
    }
    return {
      release, sessions: acc.sessions, playHours: Math.round(hours * 100) / 100, games: acc.games, pages: acc.pages,
      firstAt: acc.firstAt, lastAt: acc.lastAt,
      defects: acc.defects, defectsPerHour: perUnit(acc.defects, hours), defectsPerSession: perUnit(acc.defects, acc.sessions),
      episodes: acc.episodes, episodesPerHour: perUnit(acc.episodes, hours), episodesPerSession: perUnit(acc.episodes, acc.sessions),
      outcomes: acc.outcomes, outcomeShares, stood: acc.stood,
      errors: acc.errors, rendererStops: acc.rendererStops,
      longFrames: {
        ...framesOut(acc.frames),
        sections: [...acc.sections.entries()].map(([section, f]) => ({section, ...framesOut(f)}))
          .sort((a, b) => b.totalMs - a.totalMs || b.n - a.n || a.section.localeCompare(b.section)),
      },
    };
  });
  // Every shape seen in any release has a cell for EVERY release — the zero rows are the point.
  const nets = [...shapes.values()].map((s) => {
    const perRelease = {};
    for (const release of order) {
      perRelease[release] = s.perRelease[release] ?? {n: 0, lines: 0};
    }
    return {...s, tiers: s.tiers.sort(), perRelease};
  }).sort((a, b) => b.total - a.total || a.shape.localeCompare(b.shape));
  const topClasses = [...classes.values()].filter((c) => c.tier === 'defect').map((c) => {
    const perRelease = {};
    for (const release of order) {
      perRelease[release] = c.perRelease[release] ?? 0;
    }
    return {...c, perRelease};
  }).sort((a, b) => b.total - a.total || a.cls.localeCompare(b.cls));
  return {
    sessions: byRun.size, skipped,
    playHours: Math.round(releaseRows.reduce((sum, r) => sum + r.playHours, 0) * 100) / 100,
    releases: releaseRows, topClasses, nets,
  };
}

function rate(v) {
  return v === null || v === undefined ? '—' : String(v);
}

function percent(v) {
  return v === null || v === undefined ? '—' : `${v} %`;
}

function framesText(f) {
  if (f.n === 0) {
    return 'none';
  }
  const split = f.totalMs > 0 ?
    ` · where the time went: script ${percent(f.shares.script)} (of it forced layout ${percent(f.shares.forcedLayout)}) · style+layout ${percent(f.shares.styleLayout)} · render ${percent(f.shares.render)}` :
    ' · where the time went: not recorded (a ledger of a build before the split)';
  return `${f.n} frame(s) · worst ${f.worstMs} ms · native ${f.native} · a press waited in ${f.pressWaited}${split}`;
}

/** What `diag trend` prints. `releasesMax` = the releases the two matrices give a column to (the newest). */
export function renderTrend(agg, {releasesMax = 6, classesMax = 15, sectionsMax = 3} = {}) {
  const L = [];
  if (agg.sessions === 0) {
    return 'No session ledger to read — no run has sent its session event in this window.';
  }
  L.push(`ARE FREEZES FEWER? — ${agg.sessions} session(s), ${agg.playHours} h of play, by release (the newest first)`);
  if (agg.skipped > 0) {
    L.push(`(${agg.skipped} session event(s) carried no readable ledger and are not counted)`);
  }
  L.push('');
  L.push(table(agg.releases.map((r) => [
    shortRelease(r.release), r.sessions, r.playHours,
    r.defects, rate(r.defectsPerHour), rate(r.defectsPerSession),
    r.episodes, rate(r.episodesPerHour), rate(r.episodesPerSession),
    r.rendererStops, r.errors, r.longFrames.n,
  ]), ['RELEASE', 'SESSIONS', 'PLAY h', 'DEFECTS', '/h', '/session', 'EPISODES', '/h', '/session', 'STOPS', 'ERRORS', 'LONG FRAMES']));
  L.push('');
  L.push('DEFECTS = records of defect tier (every one counted, whatever was sent) · EPISODES = stalls that had a beginning and an end · STOPS = the renderer stopped answering');
  for (const r of agg.releases) {
    L.push('');
    L.push(`── ${shortRelease(r.release)} — ${r.sessions} session(s), ${r.playHours} h${r.lastAt > 0 ? `, last ${localTime(r.lastAt)}` : ''}`);
    const total = sumValues(r.outcomes);
    if (total === 0) {
      L.push('  how the episodes ended: no episode');
    } else {
      const keys = [...OUTCOME_ORDER.filter((k) => r.outcomes[k] !== undefined), ...Object.keys(r.outcomes).filter((k) => !OUTCOME_ORDER.includes(k)).sort()];
      L.push(`  how the episodes ended: ${keys.map((k) => `${k} ${r.outcomes[k]} (${percent(r.outcomeShares[k])})`).join(' · ')}`);
      const stood = [...STOOD_ORDER.filter((k) => r.stood[k] !== undefined), ...Object.keys(r.stood).filter((k) => !STOOD_ORDER.includes(k)).sort()];
      L.push(`  how long they stood:    ${stood.length === 0 ? '—' : stood.map((k) => `${k} ${r.stood[k]}`).join(' · ')}`);
    }
    L.push(`  long frames: ${framesText(r.longFrames)}`);
    for (const s of r.longFrames.sections.slice(0, sectionsMax)) {
      L.push(`    ${s.section}: ${framesText(s)}`);
    }
    if (r.longFrames.sections.length > sectionsMax) {
      L.push(`    … +${r.longFrames.sections.length - sectionsMax} more section(s)`);
    }
  }
  const columns = agg.releases.slice(0, releasesMax);
  const hoursOf = (release) => agg.releases.find((r) => r.release === release)?.playHours ?? 0;
  L.push('');
  L.push(`TOP DEFECT CLASSES — records per release (per hour of play)${agg.releases.length > columns.length ? ` · the ${columns.length} newest releases` : ''}`);
  if (agg.topClasses.length === 0) {
    L.push('  none: no run counted a defect.');
  } else {
    L.push(table(agg.topClasses.slice(0, classesMax).map((c) => [
      c.total,
      ...columns.map((r) => {
        const n = c.perRelease[r.release] ?? 0;
        const h = hoursOf(r.release);
        return n === 0 ? '0' : `${n}${h > 0 ? ` (${Math.round((n / h) * 100) / 100}/h)` : ''}`;
      }),
      c.cls,
    ]), ['TOTAL', ...columns.map((r) => shortRelease(r.release)), 'CAUSE CLASS']));
    if (agg.topClasses.length > classesMax) {
      L.push(`… +${agg.topClasses.length - classesMax} more class(es) — --json has them all`);
    }
  }
  L.push('');
  L.push('THE FIRES OF EVERY NET — every class of every tier, by shape: records/lines per release (a zero is evidence too)');
  if (agg.nets.length === 0) {
    L.push('  none: no run counted a stall or an integrity line.');
  } else {
    L.push(table(agg.nets.map((s) => [
      s.total, s.lines, s.tiers.join('+') || '—',
      ...columns.map((r) => {
        const cell = s.perRelease[r.release] ?? {n: 0, lines: 0};
        return cell.n === 0 && cell.lines === 0 ? '0' : `${cell.n}/${cell.lines}`;
      }),
      s.shape,
    ]), ['RECORDS', 'LINES', 'TIER', ...columns.map((r) => shortRelease(r.release)), 'SHAPE']));
  }
  return L.join('\n');
}

// ───────────────────────────── save: the game as it stood when an episode began ─────────────────────────────

/** `p#aa5f39ebdc` of an id — what an automatic event carries instead of the id (`privacy.ts` `fingerprintId`). */
export function fingerprintOf(id) {
  return `${id[0]}#${crypto.createHash('sha256').update(id).digest('hex').slice(0, FINGERPRINT_DIGITS)}`;
}

/** `<gameId>-<saveId, five digits>.json` — `LocalFilesystem.ts` `historyFilename`. */
export function historyFileName(gameId, saveId) {
  return `${gameId}-${String(saveId).padStart(5, '0')}.json`;
}

/** The save ids a listing of the history folder holds for one game (file names or paths, one per line), ascending. */
export function parseHistoryListing(text, gameId) {
  const ids = new Set();
  for (const line of String(text).split('\n')) {
    const name = line.trim().split('/').pop() ?? '';
    const m = /^(g[0-9a-f]+)-(\d+)\.json$/.exec(name);
    if (m !== null && m[1] === gameId) {
      ids.add(Number(m[2]));
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * Which save to take: the one asked for, else THE NEAREST BELOW it (the game went on and the box pruned nothing — but a
 * save id an event names can be one the server never wrote to the history: the usual answer is the one before).
 * `undefined` = none at or below.
 */
export function pickSaveId(available, wanted) {
  if (available.includes(wanted)) {
    return {saveId: wanted, exact: true};
  }
  const below = available.filter((id) => id < wanted);
  return below.length === 0 ? undefined : {saveId: Math.max(...below), exact: false};
}

/**
 * A SAVE → AN E2E FIXTURE, the way the `field-*` fixtures were made (`tests/e2e/fixtures/generate.ts`): the table AS
 * SAVED — the loader (`POST /api/dev/load-game` → `bootFixtureGame`) remaps its ids and rides `Game.deserialize`, the
 * path every real save rides, and the resume block re-primes the prompt — with THE NAMES ANONYMIZED (`seat1`, `seat2`,
 * …; the bot keeps its own). Returns the fixture and what a spec needs to know of it. Throws on what is not a save.
 */
export function fixtureFromSave(save) {
  if (save === null || typeof save !== 'object' || typeof save.id !== 'string' || !Array.isArray(save.players) || save.players.length === 0) {
    throw new Error('not a SerializedGame (id / players missing)');
  }
  const fixture = JSON.parse(JSON.stringify(save));
  const seats = fixture.players.map((p, i) => {
    const bot = p.isMarsBot === true;
    if (!bot) {
      p.name = `seat${i + 1}`;
    }
    return {index: i, color: String(p.color ?? ''), bot, active: p.id === fixture.activePlayer};
  });
  return {
    fixture, seats,
    gameId: fixture.id, saveId: typeof fixture.lastSaveId === 'number' ? fixture.lastSaveId : undefined,
    phase: String(fixture.phase ?? ''), generation: fixture.generation,
  };
}

/** A fixture is written the way the generator writes one (`JSON.stringify(serialized, null, 1) + '\n'`). */
export function fixtureText(fixture) {
  return JSON.stringify(fixture, null, 1) + '\n';
}

// ───────────────────────────── where: from a word of the evidence to its source ─────────────────────────────

const Q = '[\'"`]';

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The functions whose FIRST argument is the label a scope / a hold / a door is known by. */
const FIRST_ARG_DECLARERS = [
  'createFlowRun', 'deriveFlowRun', 'useFlowScope', 'scopedState', 'owedAnswer', 'sessionState',
  'beginAnimationHold', 'registerAnimationHoldSupplier', 'holdAnimationWhile', 'registerWaitRecovery',
];
/** …and those that take an object whose property is the name (`beginCeilingWait({id: …`, `registerLivenessRelease({… name: …`). */
const OBJECT_DECLARERS = [
  {prop: 'id', fns: ['beginCeilingWait', 'raceCeiling', 'untilCeiling', 'owePresentation']},
  {prop: 'name', fns: ['registerLivenessRelease']},
];
/**
 * The KINDS a printed id is prefixed with (a scope's kind, a holder's kind): inside a longer word such a prefix is
 * never the name — alone it would match half the client. A word that is ONLY that (`where beat`) is searched as it is.
 */
const KIND_WORDS = new Set([
  'session', 'frame', 'claim', 'scene', 'step', 'story', 'question', 'admission', 'surface', 'chain', 'hold', 'owed', 'block',
  'dead-frame', 'awaiting', 'stranded', 'beat', 'deaf', 'none',
]);

function isComment(line) {
  const t = line.trimStart();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/**
 * What a word of the evidence may be declared AS, the most specific first: the word without its run number
 * (`frame:hand#3` → `frame:hand`), then without each leading kind (`scene:hold:played-hero` → `hold:played-hero` →
 * `played-hero`; a ceiling wait's `played-hero:payback` is tried whole first), then its inner words.
 */
export function whereNeedles(word) {
  const clean = String(word).trim().replace(/^[«"'`]+|[»"'`]+$/g, '').replace(/#[0-9a-z]*/gi, '').replace(/\s+\d+(?:\.\d+)?s$/, '').trim();
  const segments = clean.split(':').map((s) => s.trim()).filter((s) => s !== '');
  if (segments.length === 1 && !segments[0].includes('+')) {
    return [segments[0]];
  }
  const out = [];
  const push = (needle) => {
    if (needle !== '' && !out.includes(needle) && !KIND_WORDS.has(needle)) {
      out.push(needle);
    }
  };
  for (let i = 0; i < segments.length; i++) {
    push(segments.slice(i).join(':'));
  }
  for (let i = segments.length - 2; i >= 0; i--) {
    push(segments[i]);
    // (`stranded+claim` names two things.)
    for (const piece of segments[i].split('+')) {
      push(piece);
    }
  }
  return out;
}

/** The union type a line is a member of (`  | 'reveal'` under `export type AdmissionBlock =`), or ''. */
function unionOf(lines, i) {
  const own = /\btype\s+(\w+)\s*=/.exec(lines[i]);
  if (own !== null) {
    return own[1];
  }
  const t = lines[i].trimStart();
  if (!t.startsWith('|') && !/^['"]/.test(t)) {
    return '';
  }
  for (let k = i - 1; k >= 0 && k >= i - 120; k--) {
    const above = lines[k].trimStart();
    if (above === '' || above.startsWith('|') || /^['"]/.test(above) || isComment(lines[k])) {
      continue;
    }
    return /^(?:export\s+)?type\s+(\w+)\s*=/.exec(above)?.[1] ?? '';
  }
  return '';
}

/**
 * The lines of one file that DECLARE a name (rank 0 — a scope's / a hold's / a wait's / a door's own call; rank 1 — a
 * member of a union type, e.g. an `AdmissionBlock`; rank 2 — an `id:` / `name:` / `label:` / `kind:` property) or
 * merely mention it as a string (rank 3). A comment never declares.
 */
export function whereLabelHits(text, needle) {
  if (!text.includes(needle)) {
    return [];
  }
  const n = esc(needle);
  const quoted = new RegExp(`${Q}${n}${Q}`);
  const firstArg = new RegExp(`\\b(${FIRST_ARG_DECLARERS.join('|')})\\(\\s*${Q}${n}${Q}`);
  // (…the same call with its first argument on the next line.)
  const firstArgBelow = new RegExp(`^\\s*${Q}${n}${Q}`);
  const openerAbove = new RegExp(`\\b(${FIRST_ARG_DECLARERS.join('|')})\\(\\s*$`);
  const anyArg = new RegExp(`\\b(sessionChild)\\([^)]*${Q}${n}${Q}`);
  const scopeVerb = new RegExp(`\\.(open|run)\\(\\s*(?:${Q}[\\w-]+${Q}\\s*,\\s*)?${Q}${n}${Q}`);
  const objects = OBJECT_DECLARERS.map(({prop, fns}) => ({
    same: new RegExp(`\\b(${fns.join('|')})\\(\\s*\\{[^}]*\\b${prop}:\\s*${Q}${n}${Q}`),
    own: new RegExp(`(?:^|[{,\\s])${prop}:\\s*${Q}${n}${Q}`),
    opener: new RegExp(`\\b(${fns.join('|')})\\(`),
  }));
  const property = new RegExp(`(?:^|[{,\\s])(id|name|label|kind):\\s*${Q}${n}${Q}`);
  const lines = text.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!quoted.test(line)) {
      continue;
    }
    const hit = (rank, by) => hits.push({line: i + 1, text: line.trim(), rank, by});
    if (isComment(line)) {
      hit(3, '');
      continue;
    }
    const direct = firstArg.exec(line) ?? anyArg.exec(line) ?? (firstArgBelow.test(line) ? openerAbove.exec(lines[i - 1] ?? '') : null);
    if (direct !== null) {
      hit(0, direct[1]);
      continue;
    }
    const verb = scopeVerb.exec(line);
    if (verb !== null) {
      hit(0, `.${verb[1]}`);
      continue;
    }
    let by = '';
    for (const o of objects) {
      const same = o.same.exec(line);
      if (same !== null) {
        by = same[1];
        break;
      }
      if (o.own.test(line)) {
        for (let k = i - 1; k >= 0 && k >= i - 4 && by === ''; k--) {
          by = o.opener.exec(lines[k])?.[1] ?? '';
        }
        if (by !== '') {
          break;
        }
      }
    }
    if (by !== '') {
      hit(0, by);
      continue;
    }
    const union = unionOf(lines, i);
    if (union !== '') {
      hit(1, `type ${union}`);
      continue;
    }
    const prop = property.exec(line);
    if (prop !== null) {
      hit(2, `${prop[1]}:`);
      continue;
    }
    hit(3, '');
  }
  return hits;
}

const PRINTER = /console\.(?:warn|error|info|log)\(|reportDiagnosticError\(|flowAnomaly\(/;

/**
 * The lines of one file that PRINT a tag (rank 0) or mention it (rank 3). A print is a string that STARTS with `[tag]`
 * and is handed to a call: in or right under a console call, or an argument of any call (`say('renderer-hang',
 * `[renderer-hang] …`)` — the Electron lane prints through its own `note` / `say`). `lead` narrows to one shape of the
 * family: the fixed words its line starts with.
 */
export function whereTagHits(text, tag, lead = '') {
  if (!text.includes(`[${tag}]`)) {
    return [];
  }
  const literal = new RegExp(`${Q}\\[${esc(tag)}\\]${lead === '' ? '' : ` ${esc(lead)}`}`);
  const lines = text.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = literal.exec(line);
    if (m === null) {
      continue;
    }
    const before = line.slice(0, m.index);
    const above = lines[i - 1] ?? '';
    const argument = (/[(,]\s*$/.test(before) && before.includes('(')) || (before.trim() === '' && /\(\s*$/.test(above) && !isComment(above));
    const prints = !isComment(line) && (argument || [line, above, lines[i - 2] ?? ''].some((l) => PRINTER.test(l) && !isComment(l)));
    hits.push({line: i + 1, text: line.trim(), rank: prints ? 0 : 3, by: prints ? 'prints' : ''});
  }
  return hits;
}

/** The families the shape table declares (`'wait-graph': [` — `src/common/diagnostics/shapes.ts`, read as text). */
export function shapeFamilies(shapesText) {
  const out = [];
  for (const line of String(shapesText).split('\n')) {
    const m = /^\s{2}'([a-z][a-z0-9-]*)': \[\s*$/.exec(line);
    if (m !== null) {
      out.push(m[1]);
    }
  }
  return out;
}

/** The fixed words a row's pattern starts with (`/^ceiling (\S+) …/` → `ceiling `), '' when it starts with a capture. */
function leadOf(source) {
  if (!source.startsWith('^')) {
    return '';
  }
  const m = /^[^\\()[\]{}.*+?|$]*/.exec(source.slice(1));
  return m === null ? '' : m[0];
}

/**
 * The row of the shape table a shape is declared by: its line, and the fixed words its lines start with. A finding
 * (`wait-graph/dead-end`) is named by its row's own alternation — it has the row, and no fixed words.
 */
export function shapeRowOf(shapesText, shape) {
  const [family, name] = String(shape).split('/');
  const lines = String(shapesText).split('\n');
  let current = '';
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const head = /^\s{2}'([a-z][a-z0-9-]*)': \[\s*$/.exec(lines[i]);
    if (head !== null) {
      current = head[1];
      continue;
    }
    if (/^\s{2}\],?\s*$/.test(lines[i])) {
      current = '';
      continue;
    }
    if (current !== family) {
      continue;
    }
    const row = /\bname: '([^']+)',\s*re: \/((?:[^/\\\n]|\\.)+)\//.exec(lines[i]);
    if (row !== null) {
      rows.push({line: i + 1, text: lines[i].trim(), name: row[1], source: row[2]});
    }
  }
  const exact = rows.find((r) => r.name === name);
  if (exact !== undefined) {
    return {line: exact.line, text: exact.text, lead: leadOf(exact.source), family, name};
  }
  const named = name === undefined ? undefined : rows.find((r) => new RegExp(`[(|]${esc(name)}[|)]`).test(r.source));
  return named === undefined ? undefined : {line: named.line, text: named.text, lead: '', family, name};
}

/**
 * FROM A WORD OF THE EVIDENCE TO ITS SOURCE. `files` = [{path, text}] (the client and the Electron lane), `word` = a
 * scope id or label as the evidence prints it, a tag (`[workspace-stale]`), a shape or a whole cause class
 * (`wait-graph/ceiling/…`). The answer: what the word was read as, the name that was found, and the hits — the
 * declarations first.
 */
export function whereSearch(files, word, {shapesText = '', shapesPath = 'src/common/diagnostics/shapes.ts'} = {}) {
  const raw = String(word).trim();
  const byRank = (a, b) => a.rank - b.rank || a.file.localeCompare(b.file) || a.line - b.line;
  const collect = (fn) => {
    const hits = [];
    for (const {path: file, text} of files) {
      for (const h of fn(text)) {
        hits.push({file, ...h});
      }
    }
    return hits.sort(byRank);
  };
  const tag = /^\[([a-z][a-z0-9-]*)\]$/.exec(raw)?.[1];
  if (tag !== undefined) {
    return {word: raw, kind: 'tag', needle: `[${tag}]`, tried: [`[${tag}]`], row: undefined, rest: [], hits: collect((text) => whereTagHits(text, tag))};
  }
  const families = shapeFamilies(shapesText);
  const words = raw.split('/');
  if (words.length >= 2 && families.includes(words[0])) {
    const shape = words.slice(0, 2).join('/');
    const row = shapeRowOf(shapesText, shape);
    let hits = row !== undefined && row.lead !== '' ? collect((text) => whereTagHits(text, words[0], row.lead)) : [];
    let needle = `[${words[0]}] ${row?.lead ?? ''}`.trim();
    if (!hits.some((h) => h.rank === 0)) {
      // (A line built from parts — `[wait-graph] ${finding.kind} …` — has no fixed words in one string: every print of the tag.)
      hits = collect((text) => whereTagHits(text, words[0]));
      needle = `[${words[0]}]`;
    }
    return {
      word: raw, kind: words.length > 2 ? 'class' : 'shape', needle, tried: [needle],
      row: row === undefined ? undefined : {file: shapesPath, line: row.line, text: row.text},
      rest: words.slice(2), hits,
    };
  }
  const tried = whereNeedles(raw);
  // The kind the word was printed with says which declaration is meant: `block:reveal` is the `AdmissionBlock`, not
  // any other union that has a `'reveal'` — among equals, a declaration whose own name holds that kind stands first.
  const kinds = raw.replace(/#[0-9a-z]*/gi, '').split(/[:+]/).map((s) => s.trim().toLowerCase()).filter((s) => KIND_WORDS.has(s));
  const meant = (h) => (kinds.some((k) => h.by.toLowerCase().includes(k)) ? 0 : 1);
  let fallback;
  for (const needle of tried) {
    const hits = collect((text) => whereLabelHits(text, needle)).sort((a, b) => a.rank - b.rank || meant(a) - meant(b));
    if (hits.some((h) => h.rank <= 2)) {
      return {word: raw, kind: 'label', needle, tried, row: undefined, rest: [], hits};
    }
    if (fallback === undefined && hits.length > 0) {
      fallback = {needle, hits};
    }
  }
  return {word: raw, kind: 'label', needle: fallback?.needle ?? '', tried, row: undefined, rest: [], hits: fallback?.hits ?? []};
}

/** What `diag where` prints: the declarations first, then the other mentions, about `max` lines in all. */
export function renderWhere(result, {max = 30} = {}) {
  const L = [];
  const declares = result.hits.filter((h) => h.rank <= 2);
  const mentions = result.hits.filter((h) => h.rank > 2);
  const row = (h) => `  ${h.file}:${h.line}  ${h.by === '' ? '' : `[${h.by}] `}${cut(h.text, 200)}`;
  if (result.kind === 'label') {
    if (result.needle === '') {
      return `«${result.word}» — no string literal of the client or the Electron lane names it (tried: ${result.tried.map((t) => `'${t}'`).join(', ') || 'nothing — the word is only a kind'}).\n` +
        'A name built at run time (a template, a variable) has no literal: search for its fixed part.';
    }
    L.push(`«${result.word}» → '${result.needle}'${result.tried.length > 1 && result.tried[0] !== result.needle ? `   (no declaration of ${result.tried.slice(0, result.tried.indexOf(result.needle)).map((t) => `'${t}'`).join(', ')})` : ''}`);
  } else if (result.kind === 'tag') {
    L.push(`«${result.word}» — a line's tag`);
  } else {
    L.push(`«${result.word}» — ${result.kind === 'class' ? 'a cause class of the shape' : 'the shape'} ${result.word.split('/').slice(0, 2).join('/')} → lines that start with «${result.needle}»`);
    L.push('');
    L.push(result.row === undefined ?
      '⚠ the shape table has no row of this name (src/common/diagnostics/shapes.ts) — a class of an older build, or `<family>/unshaped`.' :
      `THE SHAPE'S ROW (what the line is, which of its words are the class):\n  ${result.row.file}:${result.row.line}  ${cut(result.row.text, 220)}`);
  }
  L.push('');
  const what = result.kind === 'label' ? 'DECLARED' : 'PRINTED';
  // The declarations first; the mentions keep a few lines of the bound whatever the declarations take.
  const declaresShown = declares.slice(0, Math.max(1, max - Math.min(6, mentions.length)));
  const mentionsShown = mentions.slice(0, Math.max(0, max - declaresShown.length));
  if (declares.length === 0) {
    L.push(`${what}: nowhere as a literal${result.kind === 'label' ? '' : ' (the line is built from parts — see the mentions)'}.`);
  } else {
    L.push(`${what} (${declares.length}):`);
    L.push(...declaresShown.map(row));
    if (declares.length > declaresShown.length) {
      L.push(`  … +${declares.length - declaresShown.length} more`);
    }
  }
  if (mentions.length > 0) {
    L.push('');
    L.push(`OTHER MENTIONS (${mentions.length}):`);
    L.push(...mentionsShown.map(row));
    if (mentions.length > mentionsShown.length) {
      L.push(`  … +${mentions.length - mentionsShown.length} more`);
    }
  }
  if (result.rest.length > 0) {
    L.push('');
    L.push(`The class's own words: ${result.rest.join(' · ')} — each is a name of the code too: \`npm run diag -- where <word>\`.`);
  }
  return L.join('\n');
}
