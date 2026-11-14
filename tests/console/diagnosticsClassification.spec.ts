import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {buildStallDigest} from '../../electron/consoleExport';
import {DIAG_FAMILIES, readLivenessLine} from '../../src/common/diagnostics/classify';

/**
 * EVERY TAGGED LINE HAS A CLASS — the guard of `src/common/diagnostics/classify.ts` (docs/claude/diagnostics.md).
 *
 * The client and the Electron main process print their diagnostics as `console.warn('[tag] …')` /
 * `console.error('[tag] …')` from about two hundred sites. The journal's filters, the developer's notice and the hub's
 * sending policy all decide by the tag's KIND, so a tag with no row in the table would be read by its level alone —
 * a new stall family would be filed under «Прочее» and never sent. This spec reads the sources and FAILS WITH THE LIST
 * of tags that have no row (CLAUDE.md invariant 11: the guard is the worklist).
 *
 * How a site is read: the FIRST argument of every `console.warn(` / `console.error(`.
 *  · a string / template literal that starts with `[tag]` → the tag must have a row;
 *  · a literal with no tag → an untagged line (its class is its level — nothing to declare);
 *  · anything else (a variable, a call, a template that starts with `${…}`) → the site is INDIRECT: its file is a row
 *    of `INDIRECT` below, saying which tags it prints (each checked against the table) or that it is untagged.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const TREES = ['src/client', 'electron'];

/** file → the tags its indirect sites print ([] = they print an untagged value: an error object, a server's status text). */
const INDIRECT: Readonly<Record<string, ReadonlyArray<string>>> = {
  'src/client/components/App.vue': [],
  'src/client/components/auth/LoginHome.vue': [],
  'src/client/components/LoadGameForm.vue': [],
  'src/client/components/drawnCards/drawnCardsState.ts': [],
  'src/client/console/consoleSystemAlertState.ts': [],
  'src/client/console/transport/gameTransport.ts': [],
  // `botTurnTimingLine(record)` — `[bot-turn] …`.
  'src/client/components/marsbot/marsBotTurnTiming.ts': ['bot-turn'],
  // `line` — built by `longFrameLine` as `[long-frame] …`.
  'src/client/console/longFrameWatch.ts': ['long-frame'],
  // `${TOLD_TWICE} — …` — the constant is `[transfer] told twice`.
  'src/client/console/resourceTransfer/oneTeller.ts': ['transfer'],
  // `why ?? (…)` — the stuck-workspace recovery's own line: `[workspace-stall] …` / `[console-foreground-watchdog] …`.
  'src/client/console/supervisor/supervisorController.ts': ['workspace-stall', 'console-foreground-watchdog'],
  // The page's interceptor prints through the ORIGINAL console (`original.error(line, err)` is not a console call the
  // scan sees); its two wrappers call `console.warn(...args)` / `console.error(...args)` as the platform fallback.
  'src/client/diagnostics/diagnosticsCapture.ts': ['vue-error', 'page-error', 'selftest'],
  // The main process: `console.error(line)` of the embedded supervisor (`[embedded] …`), the hang watch's `note`.
  'electron/embeddedServer.ts': ['embedded'],
  'electron/main.ts': ['renderer-hang', 'embedded'],
  'electron/diagnosticsMain.ts': ['main-error', 'process-gone'],
};

type Site = {file: string, line: number, tag?: string, indirect: boolean};

let cache: Array<Site> | undefined;

function sites(): Array<Site> {
  if (cache !== undefined) {
    return cache;
  }
  const found: Array<Site> = [];
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
  const scan = (full: string): void => {
    const file = path.relative(ROOT, full).replace(/\\/g, '/');
    // Comments name console calls freely (`// console.warn('[x] …')` in a header) — they are not sites.
    const text = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^\s*(?:\/\/|\*).*$/gm, '');
    // (A trailing `// …` between the parenthesis and the first argument is skipped with the whitespace.)
    const re = /console\.(?:warn|error)\(\s*(?:\/\/[^\n]*\n\s*)*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const rest = text.slice(re.lastIndex, re.lastIndex + 200);
      const line = text.slice(0, m.index).split('\n').length;
      const literal = /^([`'"])(.*)/s.exec(rest);
      if (literal === null || /^\$\{/.test(literal[2])) {
        found.push({file, line, indirect: true});
        continue;
      }
      const tag = /^\[([a-z][a-z0-9 -]*)\]/i.exec(literal[2])?.[1];
      // A template whose tag is itself interpolated (`[party ${id}]`) is read by its literal head.
      found.push({file, line, indirect: false, ...(tag !== undefined ? {tag} : {})});
    }
  };
  for (const tree of TREES) {
    walk(path.join(ROOT, tree));
  }
  cache = found;
  return found;
}

describe('diagnostics — every tagged console line has a class', function() {
  // A walk of two source trees — not a 2 s logic budget (`.claude/rules/tests.md` ⑤).
  // eslint-disable-next-line no-invalid-this
  this.timeout(30_000);

  it('every tag the client and the main process print has a row in DIAG_FAMILIES', () => {
    const missing = new Map<string, string>();
    for (const site of sites()) {
      if (site.tag !== undefined && !DIAG_FAMILIES.has(site.tag) && !missing.has(site.tag)) {
        missing.set(site.tag, `${site.file}:${site.line}`);
      }
    }
    const list = [...missing].map(([tag, where]) => `  [${tag}] — first printed at ${where}`).join('\n');
    expect(missing.size, `tags with NO class — add each to a kind's list in src/common/diagnostics/classify.ts ` +
      `(error · stall · integrity · perf · note):\n${list}\n`).to.eq(0);
  });

  it('every indirect site is declared with the tags it prints', () => {
    const undeclared = sites().filter((s) => s.indirect && INDIRECT[s.file] === undefined).map((s) => `  ${s.file}:${s.line}`);
    expect(undeclared, 'a console.warn / console.error whose first argument is not a literal — say in INDIRECT (this spec) ' +
      `which tags the file prints that way, or [] for an untagged value:\n${undeclared.join('\n')}\n`).to.deep.eq([]);
    const unknown = Object.entries(INDIRECT).flatMap(([file, tags]) => tags.filter((t) => !DIAG_FAMILIES.has(t)).map((t) => `${file}: [${t}]`));
    expect(unknown, 'an INDIRECT row names a tag with no class').to.deep.eq([]);
    const stale = Object.keys(INDIRECT).filter((file) => !fs.existsSync(path.join(ROOT, file)));
    expect(stale, 'an INDIRECT row names a file that is gone').to.deep.eq([]);
  });

  it('the scan sees the sites it is there for', () => {
    const tags = new Set(sites().map((s) => s.tag).filter((t) => t !== undefined));
    expect(sites().length).to.be.greaterThan(200);
    expect(tags.size).to.be.greaterThan(80);
    expect([...tags]).to.include.members(['liveness', 'presentation-ledger', 'transport', 'embedded']);
  });
});

describe('diagnostics — the liveness line has ONE shape for its three readers', () => {
  const supervisor = fs.readFileSync(path.join(ROOT, 'src/client/console/supervisor/supervisorController.ts'), 'utf8');

  it('the arbiter still prints the line the journal and the console export parse', () => {
    // The line's fixed words, as the arbiter writes them — moving one of them moves `readLivenessLine` (the journal's
    // episode) and `buildStallDigest` (the console export) in the same diff.
    for (const fragment of ['`[liveness] stall (${verdict.reason}): ${', 's without progress, ${verdict.presses} presses; `', '`asked: ${', '\'the ladder is spent\'', '`[liveness] recovered after ${']) {
      expect(supervisor, `the arbiter's line lost «${fragment}»`).to.contain(fragment);
    }
  });

  it('both parsers read the same sample', () => {
    const stall = '[liveness] stall (presses-no-effect): 6s without progress, 3 presses; asked: card; beat: executing; stranded: no; last in flight: nothing; claim: none; holds: none — rung 1: a claim released';
    const cured = '[liveness] recovered after 9s, 2 rung(s) run';
    expect(readLivenessLine(stall)).to.deep.include({is: 'stall', reason: 'presses-no-effect', quietS: 6, asked: 'card', step: 'rung 1: a claim released'});
    expect(readLivenessLine(cured)).to.deep.eq({is: 'recovered', afterS: 9, rungs: 2});
    const digest = buildStallDigest([{t: 1, level: 'WARN', text: stall, source: ''}, {t: 2, level: 'WARN', text: cured, source: ''}]);
    expect(digest).to.contain('STALLS: 1 — 1 cured (worst 9s)');
    expect(digest).to.contain('presses-no-effect, asked card → cured after 9s');
  });
});

describe('diagnostics — the developer\'s notice stands outside every gate', () => {
  /*
   * «Errors and stall warnings are on screen even when the screen hangs — no animation hold, no cinematic gate may
   * hide them.» A stall IS a hold that never let go, a gate that never opened: a notice that asked any of them for
   * leave would be silent exactly when it is needed. So the notice, its plate and the layer that mounts it read the
   * journal and their own setting — and nothing of the machinery that can stand still.
   */
  const GATES: ReadonlyArray<{name: string, source: RegExp}> = [
    {name: 'the animation-hold registry', source: /components\/presentation\/animationHold/},
    {name: 'the presentation flow', source: /components\/presentation\/presentationFlow/},
    {name: 'the prompt admission', source: /consolePromptAdmission/},
    {name: 'the game transport and its cinematic holds', source: /console\/transport\//},
    {name: 'the workspace stack', source: /consoleWorkspaceStack/},
    {name: 'the liveness arbiter', source: /consoleLiveness/},
  ];
  const NOTICE_FILES = [
    'src/client/diagnostics/diagnosticsNotice.ts',
    'src/client/diagnostics/diagnosticsPrefs.ts',
    'src/client/components/console/diagnostics/ConsoleDevNotice.vue',
    'src/client/components/console/diagnostics/DiagnosticsLayer.vue',
  ];

  it('neither the notice, its plate nor its layer imports a hold, a gate or a flow that can stand still', () => {
    const offenders: Array<string> = [];
    for (const file of NOTICE_FILES) {
      const imports = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/).filter((line) => /^\s*import\b/.test(line));
      for (const gate of GATES) {
        if (imports.some((line) => gate.source.test(line))) {
          offenders.push(`${file} ← ${gate.name}`);
        }
      }
    }
    expect(offenders, 'the notice must rise while the screen stands still — it may not wait for what is standing').to.deep.eq([]);
  });

  it('the layer is mounted by the APP, beside the game\'s shell — never inside it', () => {
    const app = fs.readFileSync(path.join(ROOT, 'src/client/components/App.vue'), 'utf8');
    expect(app, 'App.vue mounts the diagnostics layer').to.match(/<DiagnosticsLayer\b/);
    const shell = fs.readFileSync(path.join(ROOT, 'src/client/components/console/ConsoleShell.vue'), 'utf8');
    expect(shell, 'the shell (whose surfaces obey the admission and the holds) does not own it').to.not.match(/DiagnosticsLayer|ConsoleDevNotice/);
  });
});

describe('diagnostics — the page runs no SDK and nothing in the client sends by itself', () => {
  it('nothing under src/client imports the Sentry SDK (the hub is the one sender)', () => {
    const offenders: Array<string> = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|vue)$/.test(entry.name) && /from '@sentry\/|require\('@sentry\//.test(fs.readFileSync(full, 'utf8'))) {
          offenders.push(path.relative(ROOT, full).replace(/\\/g, '/'));
        }
      }
    };
    walk(path.join(ROOT, 'src/client'));
    expect(offenders, 'the page sends nothing itself: its records go to the hub over the transport seam ' +
      '(src/client/diagnostics/diagnosticsTransport.ts), and the hub — not a browser SDK — decides, scrubs and sends').to.deep.eq([]);
  });
});
