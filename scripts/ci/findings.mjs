#!/usr/bin/env node
/**
 * CI FINDINGS — ONE MECHANISM FOR EVERY WORKFLOW (docs/claude/ci-findings.md).
 *
 * A scheduled run that goes red at night must not wait for somebody to open its log. Every workflow of this repository
 * ends by saying WHAT IT FOUND in one shape (a «finding»), and one filer turns findings into GitHub issues — one issue
 * per finding KEY, for good: seen again → the same issue is touched (a counter in its body, never a comment a night);
 * closed and seen again → reopened as a regression. The morning triage agent works that queue.
 *
 *   node scripts/ci/findings.mjs from-monkey <monkey-report.json> --source freeze-gate|monkey --context "seed fz1" [--repro "<command>"]
 *   node scripts/ci/findings.mjs from-playwright <merged-report.json> --source e2e [--context "nightly"]
 *   node scripts/ci/findings.mjs broken --source <source> --context "seed fz1" --what "the gate died before its report"
 *   node scripts/ci/findings.mjs red-run --source ci|release --workflow "CI" --run-id <id>   (a red run of a push: one finding per failed job)
 *   node scripts/ci/findings.mjs from-sentry <issues.json> [<issues.json> …] [--since 26h]   (what REAL sessions reported: `node scripts/diag.mjs issues --env box|production --json`, a file per environment)
 *   node scripts/ci/findings.mjs sentry-open                                   (the Sentry short ids of the OPEN `src:sentry` issues, a line each)
 *   node scripts/ci/findings.mjs sentry-settled <statuses.json> [--dry]        (closes the ones Sentry no longer holds open: `node scripts/diag.mjs status <ids> --json`)
 *   node scripts/ci/findings.mjs sentry-id-of <issue number>                   (the Sentry short id a finding's issue is of — or nothing)
 *   node scripts/ci/findings.mjs file <findings.json> [<findings.json> …]      (needs GH_TOKEN and GITHUB_REPOSITORY)
 *   node scripts/ci/findings.mjs file --dry <findings.json>                    (prints what it would do)
 *
 * `from-monkey` also takes `--failed-walks <dir>` (a walk the harness itself failed — one finding per walk) and
 * `--gate-red` (the gate was red and the report names nothing: said as a `broken-run`, never a quiet night).
 *
 * `from-*` print the findings file to stdout (`--out <file>` writes it). A findings file:
 *   {source, context, run: {id, url, sha}, findings: [{key, kind, title, body, proof?}]}
 *
 * `proof` = THE RE-RUN THAT WOULD PROVE A FIX: `{workflow, inputs}` — the same table by the same seed, the same test
 * by its title. It rides the issue as a hidden marker (`<!-- ci-proof:… -->`), and the ci-fix lane
 * (scripts/ci/land.mjs) starts exactly that run on a fix's branch — so what proves a fix is named by the run that
 * FOUND the defect, never by whoever fixes it.
 *
 * KINDS: `new-class` (a cause class no baseline holds) · `never-cured` (a stall nobody ended) · `failed` (a test red on
 * every attempt) · `flaky` (red, then green on a retry) · `broken-run` (the run itself did not produce a verdict) ·
 * `field` (a defect a real session reported to Sentry — the box, a player's machine).
 *
 * A FLOOD IS ONE FINDING: a run that names more than MASS findings (a broken build reads as 571 red tests) files ONE
 * issue that lists them — never a hundred issues a night.
 *
 * LABELS (created on demand): `ci-finding` · `src:<source>` · `kind:<kind>` · `triage:needed` — the agent replaces the
 * last one with its verdict (`triage:real` · `triage:harness` · `triage:noise` · `triage:flake` · `triage:infra`).
 */
import {execFileSync} from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {findReproductions, whereSearch} from '../diag-lib.mjs';

const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = rest.indexOf(`--${name}`);
  return at === -1 || rest[at + 1] === undefined ? fallback : rest[at + 1];
};
const positional = rest.filter((arg, i) => !arg.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && rest[i - 1] !== '--dry'));

function runInfo() {
  const repo = process.env.GITHUB_REPOSITORY ?? '';
  // (A watcher files for the run it WATCHED, not for itself.)
  const id = process.env.FINDING_RUN_ID ?? process.env.GITHUB_RUN_ID ?? '';
  return {
    id,
    url: repo !== '' && id !== '' ? `https://github.com/${repo}/actions/runs/${id}` : '',
    sha: process.env.FINDING_SHA ?? process.env.GITHUB_SHA ?? '',
  };
}

function emit(doc) {
  const text = `${JSON.stringify(doc, null, 1)}\n`;
  const out = flag('out', undefined);
  if (out === undefined) {
    process.stdout.write(text);
  } else {
    fs.writeFileSync(out, text);
    console.error(`[findings] ${doc.findings.length} finding(s) → ${out}`);
  }
}

const fence = (text) => `\`\`\`\n${String(text).replace(/```/g, "'''")}\n\`\`\``;

/*
 * WHERE TO START — every finding of a cause class says where its class LIVES IN THE CODE, read off this checkout by
 * the same search as `npm run diag -- where <class>`: the row of the shape table that reads the line, the site that
 * prints it, where each word of the class is declared, the tests and replays that name the class, and the lines of
 * the freeze program's worklist that mention it. A reader of the ticket — the morning agent has no collector access
 * and no memory of yesterday — starts at a file and a line instead of at a grep (the owner, 2026-11-19: «чтобы
 * проблемы зависаний было как можно более удобно находить … и другим агентам»). Nothing of a session is in it: it is
 * the repository's own text.
 */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let sourceCache;
function repoTexts() {
  if (sourceCache !== undefined) {
    return sourceCache;
  }
  const read = (dir, exts) => {
    const out = [];
    const walk = (at) => {
      for (const entry of fs.readdirSync(at, {withFileTypes: true})) {
        const full = path.join(at, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'genfiles') {
            walk(full);
          }
        } else if (exts.some((ext) => entry.name.endsWith(ext))) {
          out.push({path: path.relative(REPO, full).split(path.sep).join('/'), text: fs.readFileSync(full, 'utf8')});
        }
      }
    };
    if (fs.existsSync(dir)) {
      walk(dir);
    }
    return out;
  };
  const shapesPath = path.join(REPO, 'src', 'common', 'diagnostics', 'shapes.ts');
  const planPath = path.join(REPO, 'docs', 'claude', 'console', 'freeze-zero', 'PLAN.md');
  sourceCache = {
    code: [...read(path.join(REPO, 'src', 'client'), ['.ts', '.vue']), ...read(path.join(REPO, 'electron'), ['.ts'])],
    tests: read(path.join(REPO, 'tests'), ['.ts']),
    shapes: fs.existsSync(shapesPath) ? fs.readFileSync(shapesPath, 'utf8') : '',
    plan: fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf8').split('\n') : [],
  };
  return sourceCache;
}

/** The «where to start» lines of a cause class (markdown) — empty when the class names nothing this checkout knows. */
function startHere(cls) {
  if (typeof cls !== 'string' || !/^[a-z][a-z0-9-]*\/[^\s]+$/i.test(cls)) {
    return [];
  }
  let repo;
  try {
    repo = repoTexts();
  } catch {
    return [];
  }
  const lines = [];
  const at = (hit) => `\`${hit.file}:${hit.line}\``;
  try {
    const found = whereSearch(repo.code, cls, {shapesText: repo.shapes});
    if (found.row !== undefined) {
      lines.push(`- the shape's row (what the line is, its tier): ${at(found.row)}`);
    }
    const printed = found.hits.filter((hit) => hit.rank === 0).slice(0, 3);
    if (printed.length > 0) {
      lines.push(`- printed at: ${printed.map(at).join(' · ')}`);
    }
    // AN INVARIANT's id is the first argument of its one door (`invariantBroken('<module>:<what>', …)`) — often built
    // from parts, so it is found by its module word beside the call, never as one literal.
    const invariant = cls.startsWith('invariant/broken/') ? cls.slice('invariant/broken/'.length).split(':')[0] : undefined;
    if (invariant !== undefined) {
      const checked = [];
      for (const {path: file, text} of repo.code) {
        if (!text.includes('invariantBroken(')) {
          continue;
        }
        text.split('\n').forEach((line, index) => {
          if (checked.length < 4 && line.includes('invariantBroken(') && line.toLowerCase().includes(`${invariant}:`)) {
            checked.push({file, line: index + 1});
          }
        });
      }
      if (checked.length > 0) {
        lines.push(`- the invariant is checked at: ${checked.map(at).join(' · ')}`);
      }
    }
    // The class's own words are names of the code too — a wait's id, a hold's label.
    for (const word of invariant !== undefined ? [] : found.rest.slice(0, 4)) {
      if (!/[a-z]{3}/i.test(word)) {
        continue;
      }
      const declared = whereSearch(repo.code, word, {shapesText: repo.shapes}).hits.filter((hit) => hit.rank <= 2).slice(0, 2);
      if (declared.length > 0) {
        lines.push(`- \`${word}\` is declared at: ${declared.map(at).join(' · ')}`);
      }
    }
  } catch {
    // (A search that failed says nothing — the finding is filed without its pointers.)
  }
  const named = findReproductions(repo.tests, cls).slice(0, 4);
  lines.push(named.length > 0 ? `- named in the tests: ${named.map(at).join(' · ')}` : '- no test or replay names this class yet');
  const tail = cls.split('/').slice(2).join('/');
  const planned = [];
  repo.plan.forEach((line, index) => {
    if (planned.length < 4 && (line.includes(cls) || (tail.length >= 6 && line.includes(tail)))) {
      planned.push(index + 1);
    }
  });
  if (planned.length > 0) {
    lines.push(`- the freeze program's worklist mentions it: \`docs/claude/console/freeze-zero/PLAN.md\` line${planned.length === 1 ? '' : 's'} ${planned.join(', ')}`);
  }
  return lines.length === 0 ? [] : ['', '**Where to start** (read off this checkout — `npm run diag -- where <class>` prints the same, with the lines):', ...lines];
}

// ── from a monkey report (the bottle's gate and the real-browser monkey speak the same report) ──────────────────────
function fromMonkey() {
  const source = flag('source', 'monkey');
  const context = flag('context', '');
  const repro = flag('repro', '');
  const report = JSON.parse(fs.readFileSync(positional[0], 'utf8'));
  const findings = [];
  for (const cls of report.diff?.newClasses ?? []) {
    const info = report.classes?.[cls] ?? {};
    const first = info.first ?? {};
    const table = String(first.title ?? '').replace(/^monkey · /, '');
    const seed = String(first.seed ?? '').split(':')[0];
    const named = /^[A-Za-z0-9_-]+$/.test(table) && /^[A-Za-z0-9_-]+$/.test(seed);
    findings.push({
      key: `${source}|class|${cls}`,
      kind: 'new-class',
      ...(named ? {proof: source === 'freeze-gate' ?
        {workflow: 'Freeze gate', inputs: {seeds: seed, only: `^${table}$`}} :
        {workflow: 'Monkey', inputs: {seed, only: `^${table}$`, shards: '1', perturb: flag('perturb', 'none')}}} : {}),
      title: `[${source}] new cause class: ${cls}`,
      body: [
        `**A cause class no baseline holds** — named by \`${source}\`${context === '' ? '' : ` (${context})`}.`,
        '',
        `- class: \`${cls}\` (tier \`${info.tier ?? '?'}\`)`,
        `- walks that named it: ${info.tests ?? '?'} · records: ${info.records ?? '?'}`,
        `- first: ${first.title ?? '?'}${first.seed === undefined ? '' : ` · seed \`${first.seed}\``}`,
        ...(first.line === undefined ? [] : ['', fence(first.line)]),
        ...startHere(cls),
        ...(repro === '' ? [] : ['', '**Repeat it:**', fence(repro.replace(/<table>/g, String(first.title ?? '').replace(/^monkey · /, '')).replace(/<seed>/g, String(first.seed ?? '').split(':')[0]))]),
      ].join('\n'),
    });
  }
  if ((report.totals?.notCured ?? 0) > 0) {
    findings.push({
      key: `${source}|never-cured`,
      kind: 'never-cured',
      title: `[${source}] a stall that was never cured`,
      body: `**${report.totals.notCured} episode(s) ended with the screen still standing**${context === '' ? '' : ` (${context})`} — read the run's report for the tables.`,
    });
  }
  // A WALK THE HARNESS ITSELF FAILED (a Vue error, a page that died, a stall nobody cured): the report sums cause
  // files, and a failed walk may have left none — it is read from the walk's own folder.
  const walksDir = flag('failed-walks', '');
  if (walksDir !== '' && fs.existsSync(walksDir)) {
    for (const entry of fs.readdirSync(walksDir, {recursive: true, withFileTypes: true})) {
      if (!entry.isFile() || entry.name !== 'error-context.md') {
        continue;
      }
      const dir = String(entry.parentPath ?? entry.path).replace(/\\/g, '/');
      // (ONE walk, however many times it was run: a retry or a repeat of the same table is the same finding.)
      const walk = dir.split('/').pop().replace(/^console-monkey-/, '').replace(/-chromium(-retry\d+)?(-repeat\d+)?$/, '');
      if (findings.some((finding) => finding.key === `${source}|walk|${walk}`)) {
        continue;
      }
      const text = fs.readFileSync(`${dir}/error-context.md`, 'utf8').split('\n').slice(0, 40).join('\n');
      findings.push({
        key: `${source}|walk|${walk}`,
        kind: 'failed',
        title: `[${source}] a walk failed: ${walk}`.slice(0, 240),
        body: [
          `**The harness failed this walk**${context === '' ? '' : ` (${context})`} — its own guards (a stall nobody cured, a Vue error, a page that died), not a class of the report.`,
          '',
          `- walk: \`${walk}\``,
          `- its folder in the artifacts of the run: \`${dir.split('/').slice(-2).join('/')}\` (\`monkey-walk.txt\` — the presses and the tail of the console)`,
          '',
          fence(text),
        ].join('\n'),
      });
    }
  }
  // RED, AND NOTHING NAMED: a shard that died, a replay of a closed class that failed — a red night with nothing
  // filed would read as a quiet one.
  if (rest.includes('--gate-red') && findings.length === 0) {
    findings.push({
      key: `${source}|broken-run|${context}`,
      kind: 'broken-run',
      title: `[${source}] red with nothing named${context === '' ? '' : ` (${context})`}`,
      body: '**The run was red and its report names no new class and no uncured stall** — a shard that died, a replay of a closed class that failed, or a walk that failed with no trace. Read the log of the run.',
    });
  }
  emit({source, context, run: runInfo(), findings});
}

/**
 * A test's title as a `--grep` that matches it literally. The e2e workflow puts the value inside a double-quoted
 * shell word, so what a shell reads there (a quote, a backtick, a dollar, a backslash) becomes «any character» —
 * the pattern can only match MORE, never run anything.
 */
function grepFor(title) {
  return [...String(title)].map((ch) => {
    if (ch === '"' || ch === '`' || ch === '$' || ch === '\\' || ch === '\n' || ch === '\r') {
      return '.';
    }
    return /[.*+?^{}()|[\]]/.test(ch) ? `\\${ch}` : ch;
  }).join('');
}

// ── from Playwright's merged JSON report ────────────────────────────────────────────────────────────────────────────
function fromPlaywright() {
  const source = flag('source', 'e2e');
  const context = flag('context', '');
  if (!fs.existsSync(positional[0]) || fs.statSync(positional[0]).size === 0) {
    emit({source, context, run: runInfo(), findings: [{
      key: `${source}|broken-run|${context}`, kind: 'broken-run', title: `[${source}] the run produced no verdict${context === '' ? '' : ` (${context})`}`,
      body: '**The suite left no merged report** — the build or every shard ended before a test could be judged. Read the log of the run; this is the failure of the run itself, not a finding of the game.',
    }]});
    return;
  }
  const report = JSON.parse(fs.readFileSync(positional[0], 'utf8'));
  const strip = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
  const rel = (file) => {
    const p = String(file ?? '').replace(/\\/g, '/').replace(/^.*?(tests\/e2e\/)/, '$1');
    return p === '' || p.startsWith('tests/') ? p : `tests/e2e/${p}`;
  };
  const findings = [];
  const walk = (suite, file, path) => {
    const ownFile = suite.file ?? file;
    const ownPath = suite.title && suite.title !== ownFile && !/\.spec\.ts$/.test(suite.title) ? [...path, suite.title] : path;
    for (const child of suite.suites ?? []) {
      walk(child, ownFile, ownPath);
    }
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status !== 'unexpected' && test.status !== 'flaky') {
          continue;
        }
        const kind = test.status === 'flaky' ? 'flaky' : 'failed';
        const where = rel(spec.file ?? ownFile);
        const name = [...ownPath, spec.title].join(' › ');
        const failedAttempt = (test.results ?? []).find((r) => r.status !== 'passed' && r.status !== 'skipped');
        const error = strip(failedAttempt?.error?.message ?? failedAttempt?.errors?.[0]?.message ?? '').split('\n').slice(0, 30).join('\n');
        findings.push({
          // (One key for a test whether it failed or flaked: a flake that hardens into a failure is the same story.)
          key: `${source}|test|${where}|${name}|${test.projectName ?? ''}`,
          kind,
          // ONE shard: a grep that matches nothing is then red («No tests found»), so a green proof is a test that RAN.
          // A FLAKE is proven by RATE (tests.md law 10 — THE HUNT): one green run proves nothing of a 1–3 % flake, twenty
          // with no retry do.
          proof: {workflow: 'Playwright E2E', inputs: {grep: grepFor(spec.title), shards: '1', burnin_depth: '0',
            ...(kind === 'flaky' ? {repeat_each: '20', retries: '0'} : {})}},
          title: `[${source}] ${kind}: ${where.replace(/^tests\/e2e\//, '')} › ${spec.title}`.slice(0, 240),
          body: [
            `**An e2e test ${kind === 'flaky' ? 'FLAKED (red, then green on a retry)' : 'FAILED on every attempt'}**${context === '' ? '' : ` (${context})`}.`,
            '',
            `- spec: \`${where}:${spec.line ?? '?'}\` · project \`${test.projectName ?? '?'}\``,
            `- test: ${name}`,
            `- attempts: ${(test.results ?? []).map((r) => r.status).join(' → ')}`,
            ...(error === '' ? [] : ['', fence(error)]),
            '',
            '**Repeat it:**',
            fence(`npm run e2e:remote -- <task> ${where}   # or on CI: gh workflow run "Playwright E2E" -f grep="${spec.title.replace(/"/g, '\\"').slice(0, 80)}"`),
          ].join('\n'),
        });
      }
    }
  };
  for (const suite of report.suites ?? []) {
    walk(suite, undefined, []);
  }
  emit({source, context, run: runInfo(), findings});
}

// ── the filer ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** More findings than this from ONE run are one story (a broken build, a dead server) — filed as one issue. */
const MASS = 25;

/*
 * WHAT A REAL SESSION REPORTED (docs/claude/ci-findings.md § 1 — `Sentry findings`). The game sends what failed to
 * Sentry (docs/claude/diagnostics.md): one Sentry issue per CAUSE CLASS. Nobody opened Sentry on 2026-11-18 until the
 * owner said «we played a game today and it found one» — so the unresolved issues seen in the window are filed in the
 * SAME queue as what CI finds: one GitHub issue per Sentry issue, touched while it keeps happening, reopened as a
 * regression when it returns after `npm run diag -- resolve`.
 *
 * THE REPOSITORY IS PUBLIC, THE SESSIONS ARE NOT: the finding carries the issue's title (a cause class is structure,
 * never data — and it is scrubbed all the same), its counts, its dates and the link into Sentry (which asks for a
 * login). Never an event, a breadcrumb, a save, a name.
 */
const scrubbed = (text) => String(text ?? '')
  .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<ip>')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>')
  .replace(/([?&][\w-]+=)[^&\s)]+/g, '$1<…>')
  .replace(/\/(?:home|Users)\/[^/\s]+/g, '/<home>')
  .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, '<home>');

/*
 * WHAT IS NOT A DEFECT OF THE GAME among Sentry's issues (the first dry run, 2026-11-18: 25 unresolved issues of a
 * week, 19 of them these): the diagnostics' own PROBES — the connection check of each runtime, the probe's report and
 * its «must NOT arrive» error (`scripts/diag-probe.mjs`, `npm run diag -- selftest`) — and a SESSION's summary (a
 * record of a session, never a class). Their titles are the tool's own fixed words.
 */
const NOT_A_DEFECT = /\(probe\)\s*$|the probe's automatic error|TM_DIAG_PROBE|diag-probe\.mjs|^session — /;
/** A PLAYER's REPORT: its code and its category are structure; the words after them are the player's and stay in Sentry. */
const REPORT_HEAD = /^(Отчёт игрока TM-[A-Z0-9]+ · [\w-]+)/;

function fromSentry() {
  // A FILE PER ENVIRONMENT, asked of Sentry by the caller — `box` and `production`, NEVER `development`: the probe
  // sends SAMPLES of real stalls there (`head=probe`), with titles no rule can tell from a player's (the first real
  // filing, 2026-11-18: five of six issues were the probe's samples). The same issue seen in two environments is one.
  const byId = new Map();
  for (const file of positional) {
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const issue of Array.isArray(list) ? list : []) {
      byId.set(issue.shortId, issue);
    }
  }
  const issues = [...byId.values()];
  const since = flag('since', '26h');
  const day = (iso) => String(iso ?? '').slice(0, 16).replace('T', ' ');
  const unresolved = issues.filter((issue) => issue.status === 'unresolved');
  const real = unresolved.filter((issue) => !NOT_A_DEFECT.test(String(issue.title ?? '')));
  console.error(`[findings] sentry: ${unresolved.length} unresolved in the window — ${unresolved.length - real.length} of them the tool's own probes or a session's summary (not filed)`);
  const findings = real.map((issue) => {
    const report = REPORT_HEAD.exec(String(issue.title ?? ''));
    const title = report !== null ? `${report[1]} — the player's words stay in Sentry` : scrubbed(issue.title).slice(0, 200);
    const returned = issue.substatus === 'regressed';
    return {
      // (One Sentry issue is one cause class — the diagnostics' own grouping; the short id is its name for good.)
      key: `sentry|issue|${issue.shortId}`,
      kind: 'field',
      title: `[sentry] ${title}`.slice(0, 240),
      body: [
        `**A real session reported it** — Sentry \`${issue.shortId}\`${returned ? ' · **it came back after being resolved**' : ''}.`,
        '',
        fence(title),
        '',
        `- level: \`${issue.level ?? '?'}\` · events: ${issue.count ?? '?'} · sessions' users: ${issue.userCount ?? '?'}`,
        `- first seen: ${day(issue.firstSeen)} UTC · last seen: ${day(issue.lastSeen)} UTC`,
        ...(issue.permalink ? [`- in Sentry (a login is asked): ${issue.permalink}`] : []),
        // WHAT THE EVENT SAID OF ITSELF — its structural tags only (`diag.mjs` STRUCTURAL_TAGS, a white list): the
        // class, the build, the screen. The reader of this issue has no Sentry access; a session's identity has no
        // tag in that list.
        ...(issue.structure !== undefined && Object.keys(issue.structure).length > 0 ? [
          '',
          '**What its latest event said of itself** (structural tags — nothing of a session\'s identity):',
          ...Object.entries(issue.structure).map(([key, value]) => `- \`${key}\`: \`${String(value).replace(/`/g, "'").slice(0, 160)}\``),
        ] : []),
        ...startHere(issue.structure?.cause),
        '',
        '**Read it** (a machine with Sentry access — the laptop; the triage sandbox has none):',
        fence(`npm run diag -- issue ${issue.shortId}        # the newest case, laid out in reading order\nnpm run diag -- resolve ${issue.shortId}      # AFTER the fix is committed: closes the class in that release`),
        '',
        'The title of a stall is its cause class — `[family] shape (structural words)`: the row in `src/common/diagnostics/shapes.ts` names the print site, and `docs/claude/console/freeze-zero/PLAN.md` § 4 says whether the class is already known.',
      ].join('\n'),
    };
  });
  emit({source: 'sentry', context: `the last ${since}`, run: runInfo(), findings});
}

function asOneStory(doc) {
  if (doc.findings.length <= MASS) {
    return doc;
  }
  const kinds = {};
  for (const finding of doc.findings) {
    kinds[finding.kind] = (kinds[finding.kind] ?? 0) + 1;
  }
  return {...doc, findings: [{
    key: `${doc.source}|flood|${doc.context}`,
    kind: 'broken-run',
    title: `[${doc.source}] ${doc.findings.length} findings in one run${doc.context === '' ? '' : ` (${doc.context})`}`,
    body: [
      `**One run named ${doc.findings.length} findings** (${Object.entries(kinds).map(([kind, n]) => `${n} ${kind}`).join(' · ')}) — more than ${MASS} at once is one cause (a build, the server, a shared driver), so they are filed as ONE issue. Find what they share before reading any of them alone.`,
      '',
      ...doc.findings.slice(0, 60).map((finding) => `- ${finding.title}`),
      ...(doc.findings.length > 60 ? [`- … and ${doc.findings.length - 60} more (the report of the run has them all)`] : []),
    ].join('\n'),
  }]};
}

const MARK = (key) => `<!-- ci-finding:${Buffer.from(key).toString('base64')} -->`;
const PROOF = (proof) => (proof === undefined ? '' : `\n<!-- ci-proof:${Buffer.from(JSON.stringify(proof)).toString('base64')} -->`);
const SEEN = /<!-- seen:(\d+) -->[\s\S]*?<!-- \/seen -->/;

function gh(args, input) {
  return execFileSync('gh', args, {encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024});
}

function seenBlock(count, doc) {
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `<!-- seen:${count} -->\n**Seen ${count} time(s)** — last: ${when} UTC${doc.context === '' ? '' : ` · ${doc.context}`}` +
    `${doc.run.url === '' ? '' : ` · [run ${doc.run.id}](${doc.run.url})`}${doc.run.sha === '' ? '' : ` · \`${doc.run.sha.slice(0, 10)}\``}\n<!-- /seen -->`;
}

function file() {
  const dry = rest.includes('--dry');
  const files = rest.filter((arg) => !arg.startsWith('--'));
  const repo = process.env.GITHUB_REPOSITORY ?? flag('repo', '');
  if (repo === '' && !dry) {
    console.error('[findings] GITHUB_REPOSITORY (or --repo) is not set');
    process.exit(2);
  }
  const docs = files.filter((f) => fs.existsSync(f)).map((f) => asOneStory(JSON.parse(fs.readFileSync(f, 'utf8'))));
  const total = docs.reduce((n, doc) => n + doc.findings.length, 0);
  console.log(`[findings] ${docs.length} file(s), ${total} finding(s)`);
  if (total === 0) {
    return;
  }
  // Every issue this mechanism ever opened — open and closed — matched by the marker in its body.
  const known = dry ? [] : JSON.parse(gh(['issue', 'list', '--repo', repo, '--label', 'ci-finding', '--state', 'all', '--limit', '1000', '--json', 'number,state,body,labels']));
  const labels = new Set();
  const ensureLabel = (name, color, description) => {
    if (labels.has(name) || dry) {
      return;
    }
    labels.add(name);
    try {
      gh(['label', 'create', name, '--repo', repo, '--color', color, '--description', description, '--force']);
    } catch (err) {
      console.error(`[findings] label ${name}: ${String(err.message).split('\n')[0]}`);
    }
  };
  ensureLabel('ci-finding', '5319e7', 'Filed by a CI run (scripts/ci/findings.mjs) — the triage queue');
  ensureLabel('triage:needed', 'd93f0b', 'No verdict yet — the morning triage agent takes it');
  ensureLabel('regression', 'b60205', 'Closed once, and seen again');
  let opened = 0;
  let touched = 0;
  let reopened = 0;
  for (const doc of docs) {
    ensureLabel(`src:${doc.source}`, '0e8a16', `Found by the ${doc.source} workflow`);
    for (const finding of doc.findings) {
      ensureLabel(`kind:${finding.kind}`, '1d76db', `A finding of kind «${finding.kind}»`);
      const mark = MARK(finding.key);
      const issue = known.find((candidate) => (candidate.body ?? '').includes(mark));
      if (issue === undefined) {
        const body = `${finding.body}\n\n${seenBlock(1, doc)}\n\n${mark}${PROOF(finding.proof)}`;
        if (dry) {
          console.log(`  OPEN  ${finding.title}`);
        } else {
          const url = gh(['issue', 'create', '--repo', repo, '--title', finding.title, '--body-file', '-',
            '--label', 'ci-finding', '--label', `src:${doc.source}`, '--label', `kind:${finding.kind}`, '--label', 'triage:needed'], body).trim();
          known.push({number: Number(url.split('/').pop()), state: 'OPEN', body, labels: []});
          console.log(`  opened ${url} — ${finding.title}`);
        }
        opened++;
        continue;
      }
      // THE SAME RUN, FILED TWICE (a re-run of the filing job, the sweep coming by again) is seen ONCE.
      if (doc.run.id !== '' && issue.state !== 'CLOSED' && (issue.body ?? '').includes(`/actions/runs/${doc.run.id})`)) {
        console.log(`  already counted for run ${doc.run.id}: #${issue.number}`);
        continue;
      }
      const count = Number(SEEN.exec(issue.body ?? '')?.[1] ?? 1) + 1;
      const counted = SEEN.test(issue.body ?? '') ? issue.body.replace(SEEN, seenBlock(count, doc)) : `${issue.body ?? ''}\n\n${seenBlock(count, doc)}`;
      // (An issue filed before proofs existed gains its proof the next time it is seen.)
      const body = counted.includes('<!-- ci-proof:') ? counted : `${counted}${PROOF(finding.proof)}`;
      if (dry) {
        console.log(`  ${issue.state === 'CLOSED' ? 'REOPEN' : 'TOUCH '} #${issue.number} ${finding.title}`);
        continue;
      }
      gh(['issue', 'edit', String(issue.number), '--repo', repo, '--body-file', '-', '--add-label', `kind:${finding.kind}`], body);
      issue.body = body;
      if (issue.state === 'CLOSED') {
        // CLOSED AND SEEN AGAIN — a regression: back in the queue, said once.
        gh(['issue', 'reopen', String(issue.number), '--repo', repo, '--comment',
          `Seen again after it was closed${doc.run.url === '' ? '' : ` — [run ${doc.run.id}](${doc.run.url})`}${doc.context === '' ? '' : ` (${doc.context})`}.`]);
        // (Back to the agent: its old verdict and the hand-over to a session are both withdrawn.)
        const verdicts = (issue.labels ?? []).map((label) => label.name)
          .filter((name) => (name.startsWith('triage:') && name !== 'triage:needed') || name === 'for:session');
        gh(['issue', 'edit', String(issue.number), '--repo', repo, '--add-label', 'triage:needed', '--add-label', 'regression',
          ...verdicts.flatMap((name) => ['--remove-label', name])]);
        issue.state = 'OPEN';
        reopened++;
        console.log(`  reopened #${issue.number} — ${finding.title}`);
      } else {
        touched++;
      }
    }
  }
  console.log(`[findings] opened ${opened} · seen again ${touched} · reopened ${reopened}`);
}

/*
 * SENTRY ⇄ THE QUEUE — CLOSING GOES BOTH WAYS (docs/claude/ci-findings.md § 1b). An issue of this queue whose Sentry
 * issue is no longer held open there — resolved by a session's `diag resolve`, resolved by the collector itself
 * because nobody has reported it for the project's auto-resolve age, archived, gone — is closed here too
 * (`sentry-settled`); and one closed HERE is closed there by the `Sentry housekeeping` workflow, which asks
 * `sentry-id-of` whose it is. If it happens again the collector reopens it and `from-sentry` reopens the issue.
 *
 * ONLY WHAT THE FILER WROTE IS TRUSTED: the repository is public — anybody may open an issue with any marker in its
 * body. A Sentry short id is read from an issue only when the Actions bot opened it AND it carries `src:sentry` (a
 * label is a maintainer's to set), and only in a short id's own shape: it becomes an argument of a command.
 */
const SENTRY_KEY = /^sentry\|issue\|([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)$/;
const MARKED = /<!-- ci-finding:([A-Za-z0-9+/=]+) -->/;
const THE_FILER = new Set(['app/github-actions', 'github-actions[bot]', 'github-actions']);

function sentryIdOf(issue) {
  const labels = (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));
  if (!THE_FILER.has(issue.author?.login ?? '') || !labels.includes('src:sentry')) {
    return undefined;
  }
  const mark = MARKED.exec(issue.body ?? '');
  const key = mark === null ? '' : Buffer.from(mark[1], 'base64').toString('utf8');
  return SENTRY_KEY.exec(key)?.[1];
}

/** The queue's Sentry issues (`--issues <file>`: the list as `gh` prints it — a spec's, a dry run's). */
function sentryIssues(extra) {
  const given = flag('issues', undefined);
  if (given !== undefined) {
    return JSON.parse(fs.readFileSync(given, 'utf8'));
  }
  const repo = process.env.GITHUB_REPOSITORY ?? flag('repo', '');
  return JSON.parse(gh(['issue', 'list', '--repo', repo, '--label', 'src:sentry', '--limit', '500', '--json', 'number,state,body,labels,author', ...extra]));
}

/** What the queue does with an issue whose Sentry issue reads `row` (`diag status --json`) — `undefined` = it stays open. */
function settledVerdict(row) {
  const back = 'If a session meets it again, Sentry reopens it there and the nightly filing reopens this issue as a regression.';
  if (row.status === 'resolved' && row.auto === true) {
    return {reason: 'not planned', how: 'unseen — resolved by the collector',
      comment: `**No session has reported it for the project's auto-resolve age — Sentry closed it by itself** (\`npm run diag -- autoresolve\`). Nothing here proves a fix; nothing has met it either. ${back}`};
  }
  if (row.status === 'resolved') {
    // (A release is printed only in a release's own shape — the scrub reads `name@1.2.3` as an e-mail, and anything
    // else in that field is not for a public page.)
    const release = typeof row.inRelease === 'string' && /^[\w.-]+@\d+\.\d+\.\d+$/.test(row.inRelease) ? row.inRelease : undefined;
    const where = release !== undefined ? ` in \`${release}\`` : (row.inNextRelease === true ? ' in the next release' : '');
    return {reason: 'completed', how: `resolved${where}`,
      comment: `**Resolved in Sentry${where}** (\`npm run diag -- resolve\` — the half of a fix that is said to the collector). An event of it from that version or a later one reopens it there. ${back}`};
  }
  if (row.status === 'ignored') {
    return {reason: 'not planned', how: 'archived',
      comment: `**Archived in Sentry** (\`npm run diag -- archive\` / \`tidy\`: judged not a defect of the game, or the diagnostics' own). ${row.substatus === 'archived_forever' ? 'It is archived for good: it will not come back to this queue.' : back}`};
  }
  if (row.status === 'missing') {
    return {reason: 'not planned', how: 'gone', comment: '**The Sentry issue no longer exists** (deleted, or merged into another one — which has its own issue here if it is still open).'};
  }
  return undefined;
}

function sentrySettled() {
  const dry = rest.includes('--dry');
  const statuses = new Map(JSON.parse(fs.readFileSync(positional[0], 'utf8')).map((row) => [row.shortId, row]));
  const repo = process.env.GITHUB_REPOSITORY ?? flag('repo', '');
  let closed = 0;
  for (const issue of sentryIssues(['--state', 'open']).filter((candidate) => (candidate.state ?? 'OPEN') === 'OPEN')) {
    const id = sentryIdOf(issue);
    const verdict = id === undefined || !statuses.has(id) ? undefined : settledVerdict(statuses.get(id));
    if (verdict === undefined) {
      continue;
    }
    closed++;
    if (!dry) {
      gh(['issue', 'close', String(issue.number), '--repo', repo, '--reason', verdict.reason, '--comment', verdict.comment]);
    }
    console.log(`  ${dry ? 'CLOSE ' : 'closed'} #${issue.number} as ${verdict.reason} — ${id}: ${verdict.how}`);
  }
  console.log(`[findings] sentry: ${closed} open issue(s) the collector no longer holds open${dry ? ' (--dry: nothing was closed)' : ' — closed here too'}`);
}

if (command === 'sentry-open') {
  const ids = sentryIssues(['--state', 'open']).filter((issue) => (issue.state ?? 'OPEN') === 'OPEN').map(sentryIdOf).filter((id) => id !== undefined);
  process.stdout.write([...new Set(ids)].map((id) => `${id}\n`).join(''));
} else if (command === 'sentry-settled') {
  sentrySettled();
} else if (command === 'sentry-id-of') {
  const number = Number(positional[0]);
  const list = flag('issues', undefined) !== undefined ? sentryIssues([]) :
    [JSON.parse(gh(['issue', 'view', String(number), '--repo', process.env.GITHUB_REPOSITORY ?? flag('repo', ''), '--json', 'number,state,body,labels,author']))];
  const id = sentryIdOf(list.find((issue) => issue.number === number) ?? {});
  process.stdout.write(id === undefined ? '' : `${id}\n`);
} else if (command === 'broken') {
  // THE RUN ITSELF PRODUCED NO VERDICT (a build that failed, a shard that died): said as a finding of its own —
  // a red night with nothing filed would read as a quiet one.
  const source = flag('source', 'ci');
  const context = flag('context', '');
  const what = flag('what', 'the run did not produce a report');
  emit({source, context, run: runInfo(), findings: [{
    key: `${source}|broken-run|${context}`, kind: 'broken-run', title: `[${source}] the run produced no verdict${context === '' ? '' : ` (${context})`}`,
    body: `**${what}** — the workflow ended before it could judge anything. Read the run's log; this is the run's own failure (a build, a dependency, a runner), not a finding of the game.`,
  }]});
} else if (command === 'red-run') {
  // A RED RUN OF A PUSH (CI, the release): one finding per failed JOB — the job is what a fix is aimed at, and the
  // same job red again touches the same issue.
  const source = flag('source', 'ci');
  const workflow = flag('workflow', 'CI');
  const id = flag('run-id', process.env.FINDING_RUN_ID ?? '');
  const repo = process.env.GITHUB_REPOSITORY ?? flag('repo', '');
  const run = JSON.parse(gh(['run', 'view', id, '--repo', repo, '--json', 'jobs,displayTitle,headSha,headBranch']));
  process.env.FINDING_RUN_ID = id;
  process.env.FINDING_SHA = run.headSha ?? '';
  const failed = (run.jobs ?? []).filter((job) => job.conclusion === 'failure' || job.conclusion === 'timed_out');
  emit({source, context: workflow, run: runInfo(), findings: failed.map((job) => ({
    key: `${source}|job|${workflow}|${job.name}`,
    kind: 'failed',
    title: `[${source}] red: ${workflow} › ${job.name}`.slice(0, 240),
    body: [
      `**A push left \`${workflow}\` red** — job \`${job.name}\`.`,
      '',
      `- commit: \`${String(run.headSha ?? '').slice(0, 10)}\` — ${String(run.displayTitle ?? '').slice(0, 200)}`,
      `- failed step(s): ${(job.steps ?? []).filter((step) => step.conclusion === 'failure' || step.conclusion === 'timed_out').map((step) => `\`${step.name}\``).join(' · ') || '?'}`,
      '',
      '**Read it:**',
      fence(`gh run view ${id} --repo ${repo} --log-failed | tail -n 200`),
    ].join('\n'),
  }))});
} else if (command === 'from-monkey') {
  fromMonkey();
} else if (command === 'from-playwright') {
  fromPlaywright();
} else if (command === 'from-sentry') {
  fromSentry();
} else if (command === 'file') {
  file();
} else {
  console.error('usage: node scripts/ci/findings.mjs from-monkey|from-playwright|from-sentry|sentry-open|sentry-settled|sentry-id-of|broken|red-run|file … (see the header)');
  process.exit(2);
}
