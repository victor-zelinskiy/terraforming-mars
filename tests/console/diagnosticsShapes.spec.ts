import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {DIAG_FAMILIES} from '../../src/common/diagnostics/classify';
import {DIAG_SHAPES, declaredShapeIds, shapeOf, WAIT_GRAPH_FINDINGS} from '../../src/common/diagnostics/shapes';

/**
 * EVERY STALL / INTEGRITY LINE HAS A SHAPE — the guard of `src/common/diagnostics/shapes.ts`
 * (docs/claude/console/freeze-zero/PLAN.md §2 · docs/claude/diagnostics.md § 2.4).
 *
 * A stall is filed under its CAUSE CLASS, and the class is read off the line's SHAPE. So a line no row matches would
 * be filed as `<family>/unshaped` — every such line of a family in ONE issue, whatever its cause — and a line reworded
 * out of its row would silently change class. This spec reads the sources and FAILS WITH THE LIST (CLAUDE.md
 * invariant 11: the guard is the worklist).
 *
 * How a site is read: the first argument of every `console.warn(` / `console.error(` in `src/client` and `electron`
 * is rendered — a template's `${…}` and any non-literal operand become `0` — and the result is given to `shapeOf`.
 *  · it matches a row → the site is shaped;
 *  · it does not (its distinguishing word is itself interpolated: `[wait-graph] ${f.kind} …`), or the line is printed
 *    through a helper the scan cannot see (`flowAnomaly`, the hang watch's `note`) → the file is a row of `DECLARED`
 *    below: the full sample lines it prints, the shape each must read as, and a fragment of the SOURCE that proves the
 *    sample is still what the file writes.
 *  · and every row of the table must be reached by a site or a declared sample — a row nothing prints is dead.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const TREES = ['src/client', 'electron'];

type Declared = {sample: string, shape: string, needle: string};

/** file → the lines it prints that the scan cannot shape by itself. */
const DECLARED: Readonly<Record<string, ReadonlyArray<Declared>>> = {
  // The arbiter's own line is a row of its own readers' guard too (`diagnosticsClassification.spec` § the liveness line).
  'src/client/console/supervisor/supervisorController.ts': [
    // `why ?? (…)` — the stuck workspace's default line; the beat's own line is passed in by the rung.
    {sample: '[workspace-stall] «hand» reported finished but could not dismiss for 11s with nothing served — forcing teardown (held: live-outcome)', shape: 'workspace-stall/ghost-forced', needle: 'reported finished but could not dismiss for'},
    {sample: '[workspace-stall] beat «hydro:executing» torn down by the liveness arbiter', shape: 'workspace-stall/beat-arbiter', needle: 'torn down by the liveness arbiter'},
  ],
  'src/client/console/shell/wiringController.ts': [
    {sample: '[workspace-stall] beat «hand:executing» torn down at the frame\'s own bound', shape: 'workspace-stall/beat-bound', needle: 'torn down at the frame\'s own bound'},
  ],
  // `${stage} — the start serves nothing …` — the stage is one of two fixed texts.
  'src/client/console/shell/startController.ts': [
    {sample: '[start-stranded] confirmed — the start serves nothing while the server asks «card»', shape: 'start-stranded/confirmed', needle: '\'confirmed\''},
    {sample: '[start-stranded] yielded to the shell (the heal did not end it) — the start serves nothing while the server asks «card:corporation»', shape: 'start-stranded/yielded', needle: 'yielded to the shell (the heal did not end it)'},
    {sample: '[start-shadow] disagree — expected «step», on screen «none» for «card#12» {}', shape: 'start-shadow/finding', needle: '[start-shadow] ${'},
  ],
  'src/client/console/consoleLeakDetector.ts': [
    {sample: '[screen-shadow] unserved — expected «hand», on screen «nothing» for «card#12» {}', shape: 'screen-shadow/finding', needle: '[screen-shadow] ${'},
    // `warnOnce(key, message)` prints `[console-leak-detector] ${message}`.
    {sample: '[console-leak-detector] COVERED PROMPT: waitingFor "card" (task kind "deckPick") — its surface is mounted but painted over (con-start)', shape: 'console-leak-detector/covered-prompt', needle: 'COVERED PROMPT: waitingFor "'},
    {sample: '[console-leak-detector] STRANDED PROMPT: waitingFor "card" (task kind "deckPick") has NO serving surface in console mode', shape: 'console-leak-detector/stranded-prompt', needle: 'STRANDED PROMPT: waitingFor "'},
  ],
  // `[console-preselect] ${report}` — the report is one of the witness's two sentences.
  'src/client/console/preselectWitness.ts': [
    {sample: '[console-preselect] RE-ASKED PRE-SELECT: the venusBonus of Atmoscoop was answered in the batch and is asked again', shape: 'console-preselect/reasked', needle: 'RE-ASKED PRE-SELECT'},
    {sample: '[console-preselect] POST-COMMIT CHOICE: the target of Predators is asked after the commit — its answer was known before the press', shape: 'console-preselect/post-commit', needle: 'POST-COMMIT CHOICE'},
  ],
  'src/client/console/consoleForegroundWatchdog.ts': [
    {sample: '[console-foreground-watchdog] the foreground claimed to be busy with NOTHING rendered — expired played-hero[blocking] (claims at the time: none)', shape: 'console-foreground-watchdog/expired', needle: 'expired'},
    {sample: '[console-foreground-watchdog] the foreground claimed to be busy with NOTHING rendered — QUARANTINED (recurring leak, suppressed for the session) played-hero[blocking] (claims at the time: none)', shape: 'console-foreground-watchdog/quarantined', needle: 'QUARANTINED (recurring leak, suppressed for the session)'},
  ],
  // `[wait-graph] ${f.kind} ${members} — ${f.why} …` — the finding's kind is the shape's own name.
  'src/client/console/waitGraph/waitGraph.ts': WAIT_GRAPH_FINDINGS.map((shape) => ({
    sample: `[wait-graph] ${shape.split('/')[1]} question:card#12 (server: card / handPick) — why — standing 3 s`, shape, needle: '[wait-graph] ${f.kind} ${',
  })),
  // `flowAnomaly(now, scope, detail, cause)` prints `[flow] ${scope} — ${detail}` (`flowTrace.ts`): the LAW's refusals go through it.
  'src/client/console/kernel/flowScope.ts': [
    {sample: '[flow] frame:hand#3 — LAW — «frame» may not wait for the end of «story» (story:owed:x#2): the pair is not in WAITS_ON; the wait is refused', shape: 'flow/law-refused', needle: 'LAW — '},
  ],
  // `${TOLD_TWICE} — …` — the constant is `[transfer] told twice`.
  'src/client/console/resourceTransfer/oneTeller.ts': [
    {sample: '[transfer] told twice — vp:card: railReward tells it; vpShareLedger reached for it too and yields (the unit is told once)', shape: 'transfer/told-twice', needle: '[transfer] told twice'},
  ],
  // The main process's watch says its lines through `say(…)` / `deps.note(…)` → `console.warn(line)` in `main.ts`.
  'electron/rendererHangWatch.ts': [
    {sample: '[renderer-hang] the page stopped answering — the last screen (read 3s before: prompt card#12, accepting, frames hand:committed, section hand/, quiet 2s)', shape: 'renderer-hang/unresponsive', needle: 'the page stopped answering — the last screen ('},
    {sample: '[renderer-hang] still not answering after 30s — the renderer is restarted and the page reloads (the game restores itself)', shape: 'renderer-hang/restart', needle: 'the renderer is restarted and the page reloads'},
    {sample: '[renderer-hang] the page answers again after 4s', shape: 'renderer-hang/recovered', needle: 'the page answers again after'},
    {sample: '[renderer-hang] the renderer process is gone (crashed, exit 139) — the page reloads (last screen: no heartbeat read yet)', shape: 'renderer-hang/process-gone', needle: 'the renderer process is gone ('},
    {sample: '[renderer-hang] the renderer is gone — NOT reloaded: 3 reloads in 5 min already', shape: 'renderer-hang/reload-budget-spent', needle: ' — NOT reloaded: '},
    {sample: '[renderer-hang] trace of the stop (its first seconds): /home/deck/Applications/renderer-hang-20261114-101500.trace.json — open it in chrome://tracing / ui.perfetto.dev', shape: 'renderer-hang/trace-written', needle: 'trace of the stop ('},
  ],
  'electron/hangTrace.ts': [
    {sample: '[renderer-hang] the trace could not start — Error: x', shape: 'renderer-hang/trace-failed', needle: 'the trace could not start'},
    {sample: '[renderer-hang] old traces could not be pruned — Error: x', shape: 'renderer-hang/trace-failed', needle: 'old traces could not be pruned'},
    {sample: '[renderer-hang] the trace (its first seconds) could not be written — Error: x', shape: 'renderer-hang/trace-failed', needle: 'could not be written'},
  ],
};

/** Shapes a row's `read` names by itself (the findings) — reached through `DECLARED`, never by a row's own name. */
const RENAMED_ROWS: ReadonlySet<string> = new Set(['wait-graph/finding']);

type Site = {file: string, line: number, sample: string};

const SHAPED_KINDS: ReadonlySet<string> = new Set(['stall', 'integrity']);

/** A string-ish expression as the text it would print: every hole is `0`. `undefined` when it is not string-shaped at all. */
function render(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => `0${span.literal.text}`).join('');
  }
  if (ts.isParenthesizedExpression(node)) {
    return render(node.expression);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = render(node.left);
    return left === undefined ? undefined : left + (render(node.right) ?? '0');
  }
  return undefined;
}

let cache: Array<Site> | undefined;

function sites(): Array<Site> {
  if (cache !== undefined) {
    return cache;
  }
  const found: Array<Site> = [];
  const scan = (full: string): void => {
    const raw = fs.readFileSync(full, 'utf8');
    if (!/console\.(?:warn|error)\(/.test(raw)) {
      return;
    }
    const file = path.relative(ROOT, full).replace(/\\/g, '/');
    // A `.vue` file is read by its script blocks; every other line is blanked so that positions stay the file's own.
    const text = full.endsWith('.vue') ?
      raw.replace(/^[\s\S]*?(?=<script\b)|<\/script>[\s\S]*?(?=<script\b|$)/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/<script\b[^>]*>/g, (m) => ' '.repeat(m.length)) :
      raw;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'console' && (node.expression.name.text === 'warn' || node.expression.name.text === 'error') &&
          node.arguments.length > 0) {
        const sample = render(node.arguments[0]);
        if (sample !== undefined) {
          found.push({file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, sample});
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  };
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|vue)$/.test(entry.name)) {
        scan(full);
      }
    }
  };
  for (const tree of TREES) {
    walk(path.join(ROOT, tree));
  }
  cache = found;
  return found;
}

function familyOf(sample: string): string | undefined {
  const tag = /^\[([a-z][a-z0-9 -]*)\]/i.exec(sample)?.[1];
  return tag !== undefined && SHAPED_KINDS.has(DIAG_FAMILIES.get(tag) ?? '') ? tag : undefined;
}

describe('diagnostics — every stall / integrity line has a shape', function() {
  // A parse of two source trees — not a 2 s logic budget (`.claude/rules/tests.md` ⑤).
  // eslint-disable-next-line no-invalid-this
  this.timeout(60_000);

  it('every print site of a stall / integrity family reads as a row of the shape table — or is declared with its sample', () => {
    const unshaped: Array<string> = [];
    for (const site of sites()) {
      const family = familyOf(site.sample);
      if (family === undefined) {
        continue;
      }
      if (!shapeOf(site.sample, family).unshaped) {
        continue;
      }
      // A line whose distinguishing word is interpolated is shaped by its declared samples.
      const declared = (DECLARED[site.file] ?? []).some((row) => row.shape.startsWith(`${family}/`));
      if (!declared) {
        unshaped.push(`  ${site.file}:${site.line} — «${site.sample.slice(0, 140)}»`);
      }
    }
    expect(unshaped, 'lines of a stall / integrity family that NO row of src/common/diagnostics/shapes.ts matches — each would be ' +
      'filed as `<family>/unshaped`, one issue for every cause. Add a row (its fixed words, its structural captures, its tier), ' +
      `or declare the file's sample lines in this spec's DECLARED:\n${unshaped.join('\n')}\n`).to.deep.eq([]);
  });

  it('every declared sample reads as the shape it names, and its file still writes it', () => {
    const wrong: Array<string> = [];
    for (const [file, rows] of Object.entries(DECLARED)) {
      const full = path.join(ROOT, file);
      if (!fs.existsSync(full)) {
        wrong.push(`${file}: the file is gone`);
        continue;
      }
      const source = fs.readFileSync(full, 'utf8');
      for (const row of rows) {
        const read = shapeOf(row.sample);
        if (read.id !== row.shape) {
          wrong.push(`${file}: «${row.sample.slice(0, 90)}» reads as ${read.id}, declared ${row.shape}`);
        }
        if (!source.includes(row.needle)) {
          wrong.push(`${file}: the source no longer contains «${row.needle}» — the declared sample of ${row.shape} is stale`);
        }
      }
    }
    expect(wrong, 'a DECLARED row of this spec disagrees with the table or with its file').to.deep.eq([]);
  });

  it('no row is dead: every shape is printed by a site or a declared sample', () => {
    const reached = new Set<string>();
    for (const site of sites()) {
      const family = familyOf(site.sample);
      if (family !== undefined) {
        reached.add(shapeOf(site.sample, family).id);
      }
    }
    for (const rows of Object.values(DECLARED)) {
      for (const row of rows) {
        reached.add(row.shape);
      }
    }
    const dead = declaredShapeIds().filter((id) => !reached.has(id) && !RENAMED_ROWS.has(id));
    expect(dead, 'rows of src/common/diagnostics/shapes.ts that no print site reaches — the line was reworded or removed: ' +
      'fix the row\'s words or delete it').to.deep.eq([]);
  });

  it('the scan sees the sites it is there for', () => {
    const shaped = sites().filter((site) => familyOf(site.sample) !== undefined);
    expect(shaped.length, 'print sites of stall / integrity families').to.be.greaterThan(70);
    expect(Object.keys(DIAG_SHAPES).length).to.be.greaterThan(25);
  });
});
