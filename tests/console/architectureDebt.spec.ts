import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE ARCHITECTURE DEBT LEDGER — what of the console still runs on a mechanism the flow kernel REPLACES, counted and
 * FROZEN (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §11; the reviewer's checklist is REVIEW.md).
 *
 * The coverage ledger (`kernelCoverage.spec.ts`) answers «does anything WAIT outside a scope» — and its answer is
 * «nothing»: every timer, frame, run and module state of the client is the kernel's. This ledger answers the other
 * question: «which DECISIONS and NETS of the shell are still written the old way» — a flag every exit path must
 * remember to lower, a sampler that catches what no owner ended, a surface reached through a `$ref`, a promise whose
 * resolver is a module variable. Each of them has a kernel form (the `instead` of its row), and each is retired by a
 * REDESIGN of named controllers (the `plan` of its row), not by a codemod — so it is done slice by slice, with the full
 * e2e run between slices.
 *
 * Until then THE DEBT ONLY SHRINKS:
 *  · a file may not gain a use of a frozen mechanism, and A NEW FILE STARTS AT ZERO — new console code is written in
 *    the kernel's form by construction, whoever writes it;
 *  · whoever TOUCHES a site converts it when the conversion is local (the recipe is in the row), and lowers the
 *    baseline with `npm run debt:architecture`;
 *  · the baseline (`architectureDebtBaseline.json`) IS the worklist of the shell's redesign — empty = S-last.
 *
 * A row here is never «allowed forever»: it is a mechanism with a date on it.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE = path.resolve(__dirname, 'architectureDebtBaseline.json');
const FRAMEWORK = /^src\/client\/console\/(?:kernel|session)\//;

type Mechanism = {
  /** What is counted (a use, never the definition). */
  pattern: RegExp,
  /** Where it is counted (default: the whole client). */
  within?: RegExp,
  /** The file that DEFINES the mechanism — its own body is not a use. */
  definedIn?: RegExp,
  what: string,
  instead: string,
  plan: string,
};

export const FROZEN: Readonly<Record<string, Mechanism>> = {
  'wait-source': {
    pattern: /\bregisterWaitSource\(/g,
    definedIn: /waitGraph\/waitGraph\.ts$/,
    what: 'a hand-written SOURCE of the legacy wait graph — a function that re-describes, once a second, what some state is waiting for',
    instead: 'a flow that waits is a scope with a kernel wait (`scope.wait(target, {bound})`) or an owned row (`after` / `guarantee` / `note`): ' +
      'the wait table IS the graph, exact and at once. A new flow declares nothing to the legacy graph',
    plan: 'C3 · the observer reads `waitTable()` — after the shell\'s lifecycles are scopes (S4 · S5 · S6)',
  },
  'wait-recovery': {
    pattern: /\bregisterWaitRecovery\(/g,
    definedIn: /waitGraph\/waitGraph\.ts$/,
    what: 'a recovery DOOR of the legacy wait graph — what a sampled finding calls to end a wait nobody ended',
    instead: 'the wait is BOUNDED where it is declared (`{bound: {ms}}` / a machine state\'s `after`) and its owner\'s end is its recovery: ' +
      '`scope.end()` cancels what stands inside it. A wait that needs a door is a wait without an owner',
    plan: '§6 · a door retires with the net that calls it',
  },
  'liveness-rung': {
    pattern: /\bregisterLivenessRelease\(/g,
    definedIn: /console\/consoleLiveness\.ts$/,
    what: 'a RUNG of the liveness arbiter\'s release ladder — «if the screen stood still N seconds, let THIS go»',
    instead: 'what the rung releases has an owner with a bound: a hold is a `scene:hold` scope with its ceiling, a story a `story` scope ' +
      'with its due, a claim a machine with its backstops. A new mechanism is released by its owner\'s end, never by the arbiter',
    plan: '§6 · the arbiter keeps its rungs until the field shows them idle; none is added',
  },
  'truth-witness': {
    pattern: /\bregisterTruthWitness\(/g,
    definedIn: /console\/presentationLedger\.ts$/,
    what: 'a TRUTH WITNESS of the presentation ledger — a polled «is the player being lied to?» with a grace and a heal',
    instead: 'the presented lie is a run with an owner (a `story` scope, a hold): it cannot outlive its session, and its release is ' +
      'its owner\'s end. A release edge that can be missed is replaced by a level (`until` / `polled`), not watched by a witness',
    plan: '§6 · retires with the edge-watchers of S6',
  },
  'resolver-mailbox': {
    pattern: /^(?:let| {2}let| {2}private) \w*(?:[Rr]esolve(?:Cb|Active)?|Resolver)\s*:\s*\(\((?:[^()]|\([^()]*\))*\) => void\) \| undefined/gm,
    what: 'a PROMISE WHOSE RESOLVER IS A MODULE VARIABLE — every exit path of the module must remember to call it, or whoever awaits ' +
      'it waits for ever (the transport\'s gate, a pick\'s caller)',
    instead: 'what is awaited is a RUN: `await run.scope…` ends by every path at once (`scope.onEnd`), a pick resolves through its run\'s ' +
      '`orphaned`; a one-shot signal is `flowSignal()` awaited with `scope.wait(signalled(…), {bound})` — bounded, a row of the table',
    plan: 'S6 · with each module\'s lifecycle (the gate\'s resolver first: `freeRunGate`)',
  },
  'controller-latch': {
    pattern: /^\s+const (?:\w*(?:Owed|Pending|Armed|Latch|Committing|Leaving|Held|Busy|InFlight)|pending|owed|armed|held)\w* = (?:ref|shallowRef)\(/gm,
    within: /^src\/client\/console\/(?:shell|supervisor)\//,
    what: 'a LATCH of the shell written as a bare `ref` — «pending / owed / armed / leaving»: every exit path must remember to lower ' +
      'it, and nothing says how long it has stood (`commitFoldOwed` after a blockade, 2026-10-28)',
    instead: '`scopedState(label, rest, owner?)` (`console/session/scopedState.ts`) — the same `Ref`, but every raised span is a `step` ' +
      'scope: it falls back to rest when its owner ends, and the tree names it with its age. Name the narrowest true owner ' +
      '(`() => workspaceFrameScope(kind)`, `() => run.scope`)',
    plan: 'S6 · done for the shell\'s twenty-six named latches and «set aside» itself; the one row left is a clock of the supervisor\'s net',
  },
};

/**
 * RETIRED — mechanisms whose last use is gone. Their rows left `FROZEN` (a ratchet with nothing in it guards nothing);
 * what stands here is the other half of «the debt only shrinks»: it does not come BACK. Zero uses, for good.
 */
export const RETIRED: Readonly<Record<string, {pattern: RegExp, within?: RegExp, retired: string, instead: string}>> = {
  'surface-by-ref': {
    pattern: /\$refs\b/g,
    within: /^src\/client\/console\/(?:shell|supervisor)\//,
    retired: 'S3, 2026-11-12 — 117 reads in 16 controllers',
    instead: 'a controller reaches a surface by NAME through the registry — `shell.surfaces.at<T>(\'<name>\')` ' +
      '(`console/shell/surfaceRegistry.ts`); a new surface is a name in `SURFACE_NAMES` and `:ref="surfaces.bind.<name>"` in the template',
  },
  'set-aside-writer': {
    pattern: /\btask\.deferred = /g,
    retired: 'S4, 2026-11-12 — 30 writes in 13 files',
    instead: '«set aside» is a RECORD of the question (`console/setAside.ts`), owned by the question\'s scope: ' +
      '`setQuestionAside(what)` · `takeUpQuestion(why)`. `consoleState.task.deferred` is its read-only projection',
  },
  'view-apply-write': {
    pattern: /\bshell\.\w+ = /g,
    within: /^src\/client\/console\/shell\/viewApplyController\.ts$/,
    retired: 'S4, 2026-11-12 — 19 writes',
    instead: 'the view-apply reaction is the ordered list of who is ASKED to reconcile on an applied view — each domain lowers ' +
      'its own latches in its own controller; what belongs to the question is declared with `questionScope` as its owner and ' +
      'ends at `advanceQuestion` (`session/questionScope.ts`)',
  },
};

type Baseline = {uses: Record<string, Record<string, number>>, supervisorPort: number};

function sources(dir: string, out: Array<string> = []): Array<string> {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      sources(p, out);
    } else if (/\.(ts|vue)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** The code of a file: block comments and whole-line comments out (prose that NAMES a mechanism is not a use). */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function scan(): {files: number, uses: Record<string, Record<string, number>>, supervisorPort: number} {
  const uses: Record<string, Record<string, number>> = {};
  for (const name of Object.keys(FROZEN)) {
    uses[name] = {};
  }
  let files = 0;
  for (const file of sources(path.join(ROOT, 'src', 'client'))) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (FRAMEWORK.test(rel)) {
      continue;
    }
    files++;
    const body = code(fs.readFileSync(file, 'utf8'));
    for (const [name, mechanism] of Object.entries(FROZEN)) {
      if ((mechanism.within !== undefined && !mechanism.within.test(rel)) || mechanism.definedIn?.test(rel) === true) {
        continue;
      }
      const n = (body.match(mechanism.pattern) ?? []).length;
      if (n > 0) {
        uses[name][rel] = n;
      }
    }
  }
  // THE SUPERVISOR'S PORT — every fact a net samples in the shell because no owner ends it (PLAN §5 · S1).
  const supervisor = fs.readFileSync(path.join(ROOT, 'src/client/console/supervisor/supervisorController.ts'), 'utf8');
  const port = /export type SupervisorPort = \{\n([\s\S]*?)\n\};/.exec(supervisor)?.[1] ?? '';
  const supervisorPort = port.split('\n').filter((line) => /^ {2}(?:readonly )?[$\w]+[(:]/.test(line)).length;
  return {files, uses, supervisorPort};
}

const sum = (rows: Record<string, number>): number => Object.values(rows).reduce((a, b) => a + b, 0);

describe('architecture debt — what still runs on a mechanism the kernel replaces only shrinks', () => {
  const now = scan();

  if (process.env.TM_ARCHITECTURE_DEBT === 'lower') {
    // `npm run debt:architecture` — rewrite the baseline DOWNWARDS (a row is lowered to what stands, a clean file
    // leaves). Never raised: growth is a use to rewrite in the kernel's form, not a number to record.
    it('lowers the baseline to what stands now', () => {
      const old: Baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {uses: now.uses, supervisorPort: now.supervisorPort};
      const uses: Record<string, Record<string, number>> = {};
      for (const name of Object.keys(FROZEN)) {
        uses[name] = {};
        const was = old.uses[name] ?? now.uses[name];
        for (const file of Object.keys(was).sort()) {
          const cur = now.uses[name][file];
          if (cur !== undefined) {
            uses[name][file] = Math.min(was[file], cur);
          }
        }
      }
      const next: Baseline = {uses, supervisorPort: Math.min(old.supervisorPort, now.supervisorPort)};
      fs.writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n');
      console.log('architecture debt — ' + Object.keys(FROZEN).map((name) => `${name}: ${sum(next.uses[name])}`).join(' · ') +
        ` · supervisor-port: ${next.supervisorPort} rows`);
    });
    return;
  }

  const baseline: Baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

  it('reads a real corpus (anti-vacuous): the client is scanned and every frozen mechanism is still found — or its row leaves', () => {
    expect(now.files, 'client sources scanned').to.be.greaterThan(900);
    for (const name of Object.keys(FROZEN)) {
      // A mechanism with no use left is RETIRED: delete its row here (and its definition), do not keep a dead guard.
      expect(sum(now.uses[name]) > 0 || sum(baseline.uses[name] ?? {}) === 0, `«${name}» has no use left — retire the row`).to.equal(true);
    }
  });

  for (const [name, mechanism] of Object.entries(FROZEN)) {
    it(`«${name}» does not grow — and a new file starts at zero`, () => {
      const grown: Array<string> = [];
      for (const [file, n] of Object.entries(now.uses[name])) {
        const allowed = baseline.uses[name]?.[file] ?? 0;
        if (n > allowed) {
          grown.push(`${file}: ${allowed} → ${n}`);
        }
      }
      expect(grown, `${mechanism.what}.\n      INSTEAD: ${mechanism.instead}.\n      (It retires with: ${mechanism.plan}.)`).to.deep.equal([]);
    });
  }

  for (const [name, mechanism] of Object.entries(RETIRED)) {
    it(`«${name}» is RETIRED — it does not come back (${mechanism.retired})`, () => {
      const back: Array<string> = [];
      for (const file of sources(path.join(ROOT, 'src', 'client'))) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (mechanism.within !== undefined && !mechanism.within.test(rel)) {
          continue;
        }
        const n = (code(fs.readFileSync(file, 'utf8')).match(mechanism.pattern) ?? []).length;
        if (n > 0) {
          back.push(`${rel}: ${n}`);
        }
      }
      expect(back, `INSTEAD: ${mechanism.instead}.`).to.deep.equal([]);
    });
  }

  it('the supervisor\'s PORT does not grow — a new net is a bound on its owner, never one more fact sampled in the shell', () => {
    expect(now.supervisorPort, 'the port is read').to.be.greaterThan(0);
    expect(now.supervisorPort, 'rows of `SupervisorPort`').to.be.at.most(baseline.supervisorPort);
  });
});
