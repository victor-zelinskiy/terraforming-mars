import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE COVERAGE LEDGER — how much of the console client still waits OUTSIDE the flow kernel (architecture v2 —
 * docs/claude/console/architecture-v2/PLAN.md §10).
 *
 * «The console runs on the framework» is a number, not an impression. A lifetime the kernel does not own is one of
 * three things in the source, and each can be counted:
 *
 *  ① a RAW TIMER — `setTimeout` / `setInterval`: a callback nobody owns. It fires into whatever stands there by then
 *     (the next game, a surface that left), and a release that rides it does not happen when it is cleared. On the
 *     kernel it is `scope.after(ms, what, run)` / `scope.sleep(ms)` — taken back when its owner ends, a row of the wait
 *     table until then, on the kernel's clock;
 *  ② a RAW FRAME — `requestAnimationFrame`: the same, on the page's frames → `scope.afterFrame(what, run)` /
 *     `scope.wait(frames(n), {bound})`;
 *  ③ a GSAP `delayedCall` used as a timer → `scope.after` (a tween's own delay inside a timeline is not one);
 *
 * …and one that is a module rather than a call:
 *
 *  ④ a FLOW-STATE MODULE (reactive state with a `live` / `active` flag — the wait-graph law's own definition) whose
 *     RUN is not a scope: its «I am playing» is a flag every exit path must remember to lower, its timers are its own.
 *     On the kernel its run is a `scene` scope (the hold it holds the foreground with — `beginAnimationHold(…).scope`)
 *     that ends exactly once and takes its timers and waits with it.
 *
 * …and the list the session is replacing:
 *
 *  ⑤ the shell's `reset…()` rows in `beforeUnmount` — module state cleaned by a hand-written list. A flow opened in
 *     the session needs no row: the session's end ends it.
 *
 * THE LEDGER ONLY SHRINKS. `kernelCoverageBaseline.json` holds, per file, what still stands outside; a file may not
 * grow, and A NEW FILE STARTS AT ZERO — new console code is on the kernel by construction. When a count drops, lower
 * its row (`npm run coverage:kernel` rewrites the baseline downwards — it never raises a row). The baseline IS the
 * worklist: empty = the whole console client waits on the kernel.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const ROOTS = [
  'src/client/console', 'src/client/components/console', 'src/client/components/presentation',
  'src/client/components/notifications', 'src/client/components/marsbot', 'src/client/components/motion',
  'src/client/components/feedback', 'src/client/components/ma', 'src/client/components/card', 'src/client/gamepad',
  'src/client/parliament',
];
/** The framework itself: the kernel's clock is where the raw primitives live. */
const FRAMEWORK = /^src\/client\/console\/kernel\//;
const BASELINE = path.resolve(__dirname, 'kernelCoverageBaseline.json');
const SHELL = 'src/client/components/console/ConsoleShell.vue';

type Counts = [timer: number, frame: number, delayed: number];
type Baseline = {primitives: Record<string, Counts>, flows: Array<string>, shellResets: number};

function sources(dir: string, out: Array<string> = []): Array<string> {
  if (!fs.existsSync(dir)) {
    return out;
  }
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

/** The code of a file: block comments and whole-line comments out (a comment that NAMES a primitive is not a use). */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const TIMER = /\b(?:window\.)?set(?:Timeout|Interval)\(/g;
const FRAME = /\b(?:window\.)?requestAnimationFrame\(/g;
const DELAYED = /\bdelayedCall\(/g;
/** A flow-state module (the wait-graph law's definition): exported reactive state carrying a `live` / `active` flag. */
const FLOW_STATE = /export const \w+ = reactive/;
const FLOW_FLAG = /^\s+(?:live|active):\s*(?:false|true)/m;
/** …whose run is a scope: it opens one, binds a machine, or holds the foreground with a handle (whose scope is the run). */
const ON_KERNEL = /\.open\('|\bcreateFlowRun\(|\bsessionChild\(|\bstartFlowActor\(|\bbeginAnimationHold\(|\buseFlowScope\(/;

function scan(): {files: number, primitives: Record<string, Counts>, flows: Array<string>, shellResets: number} {
  const primitives: Record<string, Counts> = {};
  const flows: Array<string> = [];
  let files = 0;
  for (const root of ROOTS) {
    for (const file of sources(path.join(ROOT, root))) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      if (FRAMEWORK.test(rel)) {
        continue;
      }
      files++;
      const text = fs.readFileSync(file, 'utf8');
      const body = code(text);
      const counts: Counts = [(body.match(TIMER) ?? []).length, (body.match(FRAME) ?? []).length, (body.match(DELAYED) ?? []).length];
      if (counts[0] + counts[1] + counts[2] > 0) {
        primitives[rel] = counts;
      }
      if (rel.endsWith('.ts') && FLOW_STATE.test(text) && FLOW_FLAG.test(text) && !ON_KERNEL.test(body)) {
        flows.push(rel);
      }
    }
  }
  const shell = fs.readFileSync(path.join(ROOT, SHELL), 'utf8');
  const teardown = shell.slice(shell.indexOf('\n  beforeUnmount() {\n'));
  // A row that takes MODULE state down by hand: `resetX()` / `abortX()` / `clearX()` / `releaseX()` / `endX()` / `stopX()`.
  const shellResets = (teardown.match(/^\s+(?:reset|abort|clear|release|end|stop)[A-Z]\w*\(/gm) ?? []).length;
  return {files, primitives, flows: flows.sort(), shellResets};
}

const total = (rows: Record<string, Counts>): Counts => Object.values(rows)
  .reduce<Counts>((sum, c) => [sum[0] + c[0], sum[1] + c[1], sum[2] + c[2]], [0, 0, 0]);

describe('kernel coverage — what still waits outside the flow kernel only shrinks', () => {
  const now = scan();
  const mode = process.env.TM_KERNEL_COVERAGE;

  if (mode === 'lower') {
    // `npm run coverage:kernel` — rewrite the baseline DOWNWARDS: a row is lowered to what stands, a covered file and a
    // covered flow leave. Never raised: growth is a failure to fix, not a number to record.
    it('lowers the baseline to what stands now', () => {
      const old: Baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {primitives: now.primitives, flows: now.flows, shellResets: now.shellResets};
      const primitives: Record<string, Counts> = {};
      for (const file of Object.keys(old.primitives).sort()) {
        const cur = now.primitives[file];
        if (cur !== undefined) {
          const was = old.primitives[file];
          primitives[file] = [Math.min(was[0], cur[0]), Math.min(was[1], cur[1]), Math.min(was[2], cur[2])];
        }
      }
      const next: Baseline = {
        primitives,
        flows: old.flows.filter((f) => now.flows.includes(f)),
        shellResets: Math.min(old.shellResets, now.shellResets),
      };
      const rows = Object.keys(next.primitives).map((file) => `    ${JSON.stringify(file)}: ${JSON.stringify(next.primitives[file])}`);
      fs.writeFileSync(BASELINE, `{\n  "primitives": {\n${rows.join(',\n')}\n  },\n  "flows": ${JSON.stringify(next.flows, null, 2).replace(/\n/g, '\n  ')},\n  "shellResets": ${next.shellResets}\n}\n`);
      const [t, f, d] = total(next.primitives);
      console.log(`kernel coverage — outside the kernel: ${t} raw timers, ${f} raw frames, ${d} delayedCalls in ${rows.length} files; ` +
        `${next.flows.length} flow-state modules whose run is not a scope; ${next.shellResets} reset rows in the shell's teardown`);
    });
    return;
  }

  const baseline: Baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

  it('reads a real corpus (anti-vacuous)', () => {
    expect(now.files, 'console client sources scanned').to.be.greaterThan(600);
    expect(Object.keys(baseline.primitives).every((file) => fs.existsSync(path.join(ROOT, file)) || now.primitives[file] === undefined),
      'the baseline names files').to.equal(true);
  });

  it('① ② ③ no file waits on MORE raw timers / frames / delayedCalls than its row — and a new file starts at zero', () => {
    const grown: Array<string> = [];
    for (const [file, counts] of Object.entries(now.primitives)) {
      const allowed = baseline.primitives[file] ?? [0, 0, 0];
      const names = ['setTimeout/setInterval', 'requestAnimationFrame', 'delayedCall'];
      counts.forEach((n, i) => {
        if (n > allowed[i]) {
          grown.push(`${file}: ${names[i]} ${allowed[i]} → ${n}`);
        }
      });
    }
    expect(grown, 'a wait of the console lives in a SCOPE: `scope.after(ms, what, run)` / `scope.sleep(ms)` / `scope.afterFrame(what, run)` / ' +
      '`scope.wait(frames(n), {bound})` — the scope of the run it serves (`hold.scope`, a frame\'s, a submit\'s), a component\'s own ' +
      '(`useFlowScope(label)` in setup()), or the session\'s. See .claude/rules/console-flow.md § Timers, frames and runs').to.deep.equal([]);
  });

  it('④ no NEW flow-state module whose run is not a scope', () => {
    const fresh = now.flows.filter((f) => !baseline.flows.includes(f));
    expect(fresh, 'a module with a `live` / `active` flag is a flow: its run is a `scene` scope (`beginAnimationHold(label, {expire}).scope`) that ' +
      'ends once and takes its timers with it — not a flag every exit path must remember to lower').to.deep.equal([]);
  });

  it('⑤ the shell\'s teardown list does not grow — a flow opened in the session needs no `reset…()` row', () => {
    expect(now.shellResets, 'the reset rows are read').to.be.at.most(baseline.shellResets);
  });

  it('the ledger is honest about its size (what the report of each slice quotes)', () => {
    const [t, f, d] = total(now.primitives);
    const [bt, bf, bd] = total(baseline.primitives);
    expect(t, 'raw timers').to.be.at.most(bt);
    expect(f, 'raw frames').to.be.at.most(bf);
    expect(d, 'delayedCalls').to.be.at.most(bd);
  });
});
