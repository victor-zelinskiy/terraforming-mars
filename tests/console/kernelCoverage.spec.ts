import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE COVERAGE LEDGER — how much of the client still waits OUTSIDE the flow kernel (architecture v2 —
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
 *  ④ a FLOW-STATE MODULE (reactive state with a `live` / `active` flag — the wait-graph law's own definition — or a
 *     `phase` / `stage` resting at `'idle'`) whose
 *     RUN is not a scope: its «I am playing» is a flag every exit path must remember to lower, its timers are its own.
 *     On the kernel its run is a `scene` scope (the hold it holds the foreground with — `beginAnimationHold(…).scope`)
 *     that ends exactly once and takes its timers and waits with it.
 *
 * …and the list the session is replacing:
 *
 *  ⑤ the shell's `reset…()` rows in `beforeUnmount` — module state cleaned by a hand-written list. A flow opened in
 *     the session needs no row: the session's end ends it; module state that is not a flow DECLARES itself beside its
 *     own reset (`sessionState(label, reset, at)`) and the leaving shell says one thing — `leaveConsoleSession()`.
 *
 * WHAT MAY STAND OUTSIDE, BY NAME (`DEVICE_CLOCKS`): a sampling loop of a DEVICE is not a wait — nothing is waited for,
 * nothing can be left waiting — and the kernel's clock is not free per tick. Such a file is declared with its reason and
 * its exact count; it may not grow, and a row whose file became clean must leave.
 *
 * THE LEDGER ONLY SHRINKS. `kernelCoverageBaseline.json` holds, per file, what still stands outside; a file may not
 * grow, and A NEW FILE STARTS AT ZERO — new console code is on the kernel by construction. When a count drops, lower
 * its row (`npm run coverage:kernel` rewrites the baseline downwards — it never raises a row). The baseline IS the
 * worklist: empty = the whole console client waits on the kernel.
 */
const ROOT = path.resolve(__dirname, '..', '..');
/**
 * THE WHOLE CLIENT. The ledger began with the console's own trees; since the second coverage round (2026-11-11) it reads
 * every source under `src/client` — the shared layer the console stands on (the board, the journal, the endgame, the
 * realtime channel, the lobby) waits on the kernel as well, and a timer there fires into the next game just the same.
 */
const ROOTS = ['src/client'];
/** The framework itself: the kernel's clock is where the raw primitives live, the session's waits where the owned
 *  `delayedCall` does. */
const FRAMEWORK = /^src\/client\/console\/(?:kernel|session)\//;
const BASELINE = path.resolve(__dirname, 'kernelCoverageBaseline.json');
const SHELL_WIRING = 'src/client/console/shell/wiringController.ts';

type Counts = [timer: number, frame: number, delayed: number];

/**
 * DEVICE CLOCKS — the raw primitives that are NOT waits of a flow, declared with their reason and their exact count.
 * The gamepad layer sits BELOW the console (it imports nothing of it; the console stands on its intents): its sampling
 * loop is started and stopped by the pad's presence, and its cadence is the input budget itself.
 */
const DEVICE_CLOCKS: Readonly<Record<string, {counts: Counts, why: string}>> = {
  'src/client/gamepad/gamepadCore.ts': {
    counts: [1, 2, 0],
    why: 'the pad\'s SAMPLING LOOP (an 8 / 16 ms interval — the correctness driver that keeps reading across a stretched frame — plus a ' +
      'frame loop while hot): a device driver with its own start / stop (`startLoop` / `stopLoop` on the pad\'s presence). Nothing ' +
      'waits on it and it holds no flow; on the kernel every sample would re-arm a timer and a row of the wait table — a per-tick ' +
      'cost on the input path the perf budget forbids',
  },
  'src/client/gamepad/focusEngine.ts': {
    counts: [0, 1, 0],
    why: 'ONE coalesced frame to re-measure the focus ring after an action (`scheduleSync`) — the focus engine is the device layer ' +
      'below the console session and is live in the menus before any session; nothing waits on the frame (the 400 ms validity ' +
      'tick re-measures anyway)',
  },
};
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

/** A raw timer — the platform's, or a helper that wraps one with no owner (VueUse's). */
const TIMER = /\b(?:window\.)?set(?:Timeout|Interval)\(|\buse(?:IntervalFn|TimeoutFn|DebounceFn|ThrottleFn|RafFn)\(/g;
const FRAME = /\b(?:window\.)?requestAnimationFrame\(/g;
const DELAYED = /\bdelayedCall\(/g;
/** A flow-state module: exported reactive state carrying a `live` / `active` flag (the wait-graph law's definition) —
 *  or a `phase` / `stage` that rests at `'idle'` (a flow keyed by its phase: «I am playing» is «not idle»). */
const FLOW_STATE = /export const \w+ = reactive/;
const FLOW_FLAG = /^\s+(?:live|active):\s*(?:false|true)|^\s+(?:phase|stage):\s*'(?:idle|closed|docked)'/m;
/** …whose run is a scope: it opens one, binds a machine, or holds the foreground with a handle (whose scope is the run). */
const ON_KERNEL = /\.open\('|\bcreateFlowRun\(|\bderiveFlowRun\(|\bsessionChild\(|\bstartFlowActor\(|\bbeginAnimationHold\(|\buseFlowScope\(/;

/**
 * Modules that carry a `live` / `active` flag and are NOT a flow of their own — `file` → whose run their state belongs
 * to, or why the flag is not a lifetime. A row whose file stopped matching (the flag is gone, or the module got a run)
 * fails: the list states only what is true now.
 */
const NOT_A_FLOW: Readonly<Record<string, string>> = {
  'src/client/console/cardDiscard/cardDiscardState.ts':
    'the STAGE registry of the discard: its `live` is written only by `consoleCardDiscard.ts`, whose run (`card-discard`) is the lifetime and whose every ending resets it (`resetCardDiscardStage`)',
  'src/client/console/consoleColoniesModel.ts':
    '`colonyDockCursor.active` is a cursor\'s on/off inside the colonies section (view state, set and cleared by the pad in one component) — nothing waits on it and nothing outlives the section',
  'src/client/components/mainMenu/lobbyState.ts':
    '`live` is a field of a lobby SOURCE row («the push channel of this server is carrying») — a fact about a connection, written by the channel\'s own events; the lobby is the page\'s, not a flow',
  'src/client/components/initialDraft/initialDraftSharedState.ts':
    '`active` has no writer left (the desktop initial-draft overlay that raised it went in deletion wave 3) — the awaiting window is DERIVED from the server\'s view (`isInitialDraftAwaiting`), nothing is held by the flag',
  'src/client/components/actions/actionsPickState.ts':
    'a desktop-era pick bridge nothing in `src` imports any more (only its own spec) — it goes with the next deletion wave; no flow can stand on it',
};

type DeclaredState = {file: string, label: string, at: number};

function scan(): {
  files: number, primitives: Record<string, Counts>, devices: Record<string, Counts>, flows: Array<string>, declared: Array<string>,
  shellResets: number, states: Array<DeclaredState>, shellLeaves: boolean, shadowed: Array<string>,
  } {
  /** Components whose scope's setup key collides with another member. */
  const shadowed: Array<string> = [];
  const primitives: Record<string, Counts> = {};
  /** What the declared device clocks hold now. */
  const devices: Record<string, Counts> = {};
  /** Every `sessionState('label', reset, at)` declaration of the client. */
  const states: Array<DeclaredState> = [];
  const flows: Array<string> = [];
  /** The `NOT_A_FLOW` rows that still describe a module with the flag and no run. */
  const declared: Array<string> = [];
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
      if (DEVICE_CLOCKS[rel] !== undefined) {
        devices[rel] = counts;
      } else if (counts[0] + counts[1] + counts[2] > 0) {
        primitives[rel] = counts;
      }
      if (rel.endsWith('.vue')) {
        // A component's scope is a SETUP binding, and a setup binding SHADOWS a `data` / `computed` / `methods` / `props`
        // member of the same name at run time — silently (vue-tsc does not see it; the Parliament section's `flow`
        // computed stood behind a scope for an hour of the coverage round, 2026-11-11). The key must be free.
        for (const m of body.matchAll(/\b(\w+): useFlowScope\(|\bconst (\w+) = useFlowScope\(/g)) {
          const key = m[1] ?? m[2];
          const data = /\n {2}data\(\)[^\n]*\{\n([\s\S]*?)\n {2}\},\n/.exec(body)?.[1] ?? '';
          const member = new RegExp(`^    ${key}(?:\\(|: \\{|: (?:function|\\())`, 'm').test(body) ||
            new RegExp(`^      ${key}[:,]`, 'm').test(data) || new RegExp(`props: \\[[^\\]]*'${key}'`).test(body);
          if (member) {
            shadowed.push(`${rel}: the scope's setup key «${key}» shadows another member of the same name`);
          }
        }
      }
      for (const m of body.matchAll(/\bsessionState\('([^']+)',[^\n]*?, (\d+)\);/g)) {
        states.push({file: rel, label: m[1], at: Number(m[2])});
      }
      if (rel.endsWith('.ts') && FLOW_STATE.test(text) && FLOW_FLAG.test(text) && !ON_KERNEL.test(body)) {
        if (NOT_A_FLOW[rel] !== undefined) {
          declared.push(rel);
          continue;
        }
        flows.push(rel);
      }
    }
  }
  // (S-last: the shell's `beforeUnmount` is ONE call of the wiring controller's `shellLeaving` — the pass is read there.)
  const wiring = fs.readFileSync(path.join(ROOT, SHELL_WIRING), 'utf8').replace(/\r\n/g, '\n');
  const leaving = wiring.indexOf('\n  function shellLeaving(): void {\n');
  const teardown = leaving === -1 ? '' : wiring.slice(leaving, wiring.indexOf('\n  }\n', leaving));
  // A row that takes MODULE state down by hand: `resetX()` / `abortX()` / `clearX()` / `releaseX()` / `endX()` / `stopX()`.
  const shellResets = (teardown.match(/^\s+(?:reset|abort|clear|release|end|stop)[A-Z]\w*\(/gm) ?? []).length;
  return {files, primitives, devices, flows: flows.sort(), declared: declared.sort(), shellResets, states, shellLeaves: /^\s+leaveConsoleSession\(\);$/m.test(teardown), shadowed};
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

  it('④ the «not a flow» list states only what is true — a row whose module got a run (or lost the flag) leaves', () => {
    expect(Object.keys(NOT_A_FLOW).sort(), 'every row still describes a flag-carrying module with no run of its own').to.deep.equal(now.declared);
  });

  it('⑤ the shell\'s teardown list does not grow — a flow opened in the session needs no `reset…()` row', () => {
    expect(now.shellResets, 'the reset rows are read').to.be.at.most(baseline.shellResets);
  });

  it('① ② the DEVICE clocks hold exactly what they declare — a sampling loop does not grow, and a row that became clean leaves', () => {
    for (const [file, device] of Object.entries(DEVICE_CLOCKS)) {
      expect(now.devices[file], `${file} — ${device.why}`).to.deep.equal(device.counts);
    }
  });

  it('a component\'s scope never SHADOWS a member: the setup key of `useFlowScope` is free in data / computed / methods / props', () => {
    expect(now.shadowed, 'name the setup key `flowScope` where the component already has a `flow` (its module\'s flow state)').to.deep.equal([]);
  });

  it('⑤ the leaving shell says ONE thing, and the pass it runs is a TOTAL ORDER — no two session states share a label or a place', () => {
    expect(now.shellLeaves, 'the leaving shell (`shellLeaving` — its one `beforeUnmount`) calls `leaveConsoleSession()`').to.equal(true);
    expect(now.states.length, 'the modules declare their session state (anti-vacuous)').to.be.greaterThan(50);
    const seen = new Map<string, string>();
    const clashes: Array<string> = [];
    for (const state of now.states) {
      for (const key of [`label «${state.label}»`, `place ${state.at}`]) {
        const other = seen.get(key);
        if (other !== undefined) {
          clashes.push(`${key}: ${other} and ${state.file}`);
        }
        seen.set(key, state.file);
      }
    }
    expect(clashes, 'a session state has ONE label and ONE place in the pass (`sessionState(label, reset, at)` — pick a free number ' +
      'beside its family)').to.deep.equal([]);
  });

  it('the ledger is honest about its size (what the report of each slice quotes)', () => {
    const [t, f, d] = total(now.primitives);
    const [bt, bf, bd] = total(baseline.primitives);
    expect(t, 'raw timers').to.be.at.most(bt);
    expect(f, 'raw frames').to.be.at.most(bf);
    expect(d, 'delayedCalls').to.be.at.most(bd);
  });
});
