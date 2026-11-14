import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * MODULE STATE OF THE CLIENT IS REACHED BY THE SESSION'S END — OR SAYS WHY IT IS NOT
 * (docs/claude/console/freeze-zero/PLAN.md §4 · 6 — the ground of the crash-only rebuild).
 *
 * The console's last line against a freeze is to REBUILD the console session from the server's view, in the page
 * (`rebuildConsoleSession`): leave the session, fetch the view, mount the shell again. That is exactly as complete as
 * «every piece of state a game left in a module is taken down by the session's end» — and until this guard nobody
 * could say whether it was: `sessionState` declarations were a list somebody kept (66 of them), and a module that kept
 * a `let`, a `Map` or a `reactive` of the running game outside it survived a remount in silence (the transport's holds,
 * the wait graph's first-seen table, the router's picks — mapped 2026-11-14). A latch that outlives its fact is the
 * commonest freeze this console has had.
 *
 * WHAT IS READ. Every `.ts` module under `src/client`: its TOP-LEVEL mutable state —
 *   · a `let` / `var`;
 *   · a `const` holding `new Map / Set / WeakMap / WeakSet / Array`, an EMPTY `[]` / `{}`, a `reactive` / `ref` /
 *     `shallowRef` / `shallowReactive`, or an object literal with a field of plain data (a number, a string, a flag,
 *     an empty collection). A table — an UPPER_CASE name, a `Readonly…` type, `as const`, `Object.freeze` — is not state.
 *
 * WHEN IT IS FINE. One of:
 *   ① it is REACHED BY THE TEARDOWN — WRITTEN (assigned, cleared, deleted from, `Object.assign`ed) in a function the
 *     session's end runs: the reset of a `sessionState(…)`, an `onConsoleSessionEnd(…)`, a scope's `.defer(…)`, a
 *     component's `onUnmounted` / `onBeforeUnmount` / `onScopeDispose`, the shell's `shellLeaving` — or in a function
 *     those call, a few calls deep, across modules (imports are followed);
 *   ② it is KERNEL-OWNED — a `let` only ever assigned a scope / a run / a scoped timer (`sessionChild`, `createFlowRun`,
 *     `.child`, `.guarantee`, …) or `undefined`: what it holds ends with the session by the kernel's own law;
 *   ③ it is declared PAGE-LIFETIME below, with the reason (a preference, a registry filled at import, a cache of
 *     static data, a device's state) — a whole module (`PAGE_LIFETIME_MODULES`) or one name (`PAGE_LIFETIME`).
 *
 * Anything else is UNDECLARED and counted per file against `moduleStateBaseline.json` — a RATCHET: a file may not gain
 * one, a new file starts at zero, a fall is locked in (`MODULE_STATE_BASELINE=write` rewrites the file). The list a
 * red prints is the worklist (CLAUDE.md invariant 11); `MODULE_STATE_REPORT=1` prints all of it, by directory.
 *
 * «Reached» is a WRITE in a function the teardown runs — a strong hint, not a proof that the value is put back to
 * its rest. The proof is the monkey rebuilding at arbitrary presses on every table; this guard is what keeps the list
 * from rotting.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const TREE = 'src/client';
const BASELINE = path.join(__dirname, 'moduleStateBaseline.json');

/** A whole module whose state is the PAGE's, never a game's: the path (a file, or a folder ending in `/`) → why. */
const PAGE_LIFETIME_MODULES: Readonly<Record<string, string>> = {
  'src/client/console/kernel/': 'the kernel itself: its registries of scopes, waits and machines are the page\'s — what they HOLD ends with the session\'s scope',
  'src/client/diagnostics/': 'the journal and its transport live as long as the page: a record must outlive the session it is about',
  'src/client/console/flowCoverageProbe.ts': 'an e2e instrument: the walk\'s coverage is summed across sessions on purpose',
};

/** One name of a module that is the page's: file → name → why. */
const PAGE_LIFETIME: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'src/client/console/session/consoleSession.ts': {
    sessionStates: 'the registry of the declarations themselves — filled at import, read by every session\'s end',
  },
  'src/client/console/consoleLiveness.ts': {
    rungs: 'the ladder\'s registry — filled at import by the modules that own a release',
  },
  'src/client/console/session/sessionRebuild.ts': {
    leaving: 'true only from the moment THIS document was told to leave for a rebuild — it dies with the document',
    navigate: 'how the document is replaced — a constant of the page (a spec gives its own)',
  },
};

const STATE_CALLS = new Set(['reactive', 'ref', 'shallowRef', 'shallowReactive']);
const STATE_CLASSES = new Set(['Map', 'Set', 'WeakMap', 'WeakSet', 'Array']);
/** What a kernel-owned `let` is assigned: a scope, a run, a scoped timer's cancel. */
const KERNEL_OWNERS = new Set(['sessionChild', 'openFlowRoot', 'createFlowRun', 'deriveFlowRun', 'owedAnswer', 'scopedState', 'child', 'guarantee', 'every', 'after', 'defer']);
/** Calls whose function argument the session's end runs. */
const TEARDOWN_CALLS: Readonly<Record<string, number>> = {sessionState: 1, onConsoleSessionEnd: 0, onUnmounted: 0, onBeforeUnmount: 0, onScopeDispose: 0};
/**
 * How far the teardown is followed: a reset → its helper → that helper's. Deeper than this a «call» is the
 * application itself (a reset that re-arms a poll reaches the whole transport), and a write found there is not the
 * teardown's.
 */
const TEARDOWN_DEPTH = Number(process.env.MODULE_STATE_DEPTH ?? 3);
/** A method that changes the collection it is called on. */
const MUTATORS = new Set(['clear', 'delete', 'set', 'add', 'push', 'pop', 'shift', 'unshift', 'splice', 'fill', 'sort', 'reverse']);
/** Functions the teardown runs that no call site above names (reached through an object: `shell.shellLeaving()`). */
const EXTRA_ROOTS: ReadonlyArray<{file: string, fn: string}> = [
  {file: 'src/client/console/shell/wiringController.ts', fn: 'shellLeaving'},
];

type StateVar = {file: string, name: string, line: number, how: string, node: ts.VariableDeclaration, isLet: boolean};
type Module = {
  file: string,
  sf: ts.SourceFile,
  /** Top-level mutable state, by name. */
  state: Map<string, StateVar>,
  /** Every function-like of the module (any depth), by the name it is reachable under. */
  fns: Map<string, Array<ts.Node>>,
  /** local name → {the module it comes from, the name it has there}. */
  imports: Map<string, {from: string, name: string}>,
};

function walkFiles(dir: string, out: Array<string>): void {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if ((entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) || entry.name.endsWith('.vue')) {
      out.push(full);
    }
  }
}

const rel = (full: string): string => path.relative(ROOT, full).split(path.sep).join('/');

function unwrap(expr: ts.Expression): ts.Expression {
  let e = expr;
  while (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e)) {
    e = e.expression;
  }
  return e;
}

/** The name an assignment or a mutating call writes INTO: `a` of `a = …`, `a.b.c = …`, `a[i].b++`, `a.clear()`. */
function rootOf(expr: ts.Expression): ts.Identifier | undefined {
  let e = unwrap(expr);
  while (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
    e = unwrap(e.expression);
  }
  return ts.isIdentifier(e) ? e : undefined;
}

function calleeName(call: ts.CallExpression | ts.NewExpression): string {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) {
    return callee.text;
  }
  if (ts.isPropertyAccessExpression(callee)) {
    return callee.name.text;
  }
  return '';
}

function plainData(expr: ts.Expression): boolean {
  const e = unwrap(expr);
  if (ts.isNumericLiteral(e) || ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    return true;
  }
  if (e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword || e.kind === ts.SyntaxKind.NullKeyword) {
    return true;
  }
  if (ts.isIdentifier(e) && e.text === 'undefined') {
    return true;
  }
  if (ts.isPrefixUnaryExpression(e) && ts.isNumericLiteral(e.operand)) {
    return true;
  }
  if (ts.isArrayLiteralExpression(e) && e.elements.length === 0) {
    return true;
  }
  if (ts.isObjectLiteralExpression(e) && e.properties.length === 0) {
    return true;
  }
  return ts.isNewExpression(e) && STATE_CLASSES.has(calleeName(e));
}

/** How a `const` holds state — or `undefined` for a table, a function, a derived value. */
function constState(decl: ts.VariableDeclaration, name: string): string | undefined {
  const init = decl.initializer;
  if (init === undefined || /^[A-Z][A-Z0-9_]*$/.test(name)) {
    return undefined;
  }
  const type = decl.type?.getText() ?? '';
  if (/^Readonly|ReadonlyArray|ReadonlyMap|ReadonlySet/.test(type)) {
    return undefined;
  }
  if (ts.isAsExpression(init) && init.type.getText() === 'const') {
    return undefined;
  }
  const e = unwrap(init);
  if (ts.isNewExpression(e)) {
    return STATE_CLASSES.has(calleeName(e)) ? `new ${calleeName(e)}` : undefined;
  }
  if (ts.isCallExpression(e)) {
    return STATE_CALLS.has(calleeName(e)) && ts.isIdentifier(e.expression) ? calleeName(e) : undefined;
  }
  if (ts.isArrayLiteralExpression(e)) {
    return e.elements.length === 0 ? '[]' : undefined;
  }
  if (ts.isObjectLiteralExpression(e)) {
    if (e.properties.length === 0) {
      return '{}';
    }
    return e.properties.some((p) => ts.isPropertyAssignment(p) && plainData(p.initializer)) ? 'an object of plain data' : undefined;
  }
  return undefined;
}

function scriptOf(file: string, text: string): string {
  if (!file.endsWith('.vue')) {
    return text;
  }
  // A component's module scope is its instance's set-up — only the teardown hooks it registers are read.
  return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
}

function readModule(full: string): Module {
  const file = rel(full);
  const sf = ts.createSourceFile(file.replace(/\.vue$/, '.vue.ts'), scriptOf(file, fs.readFileSync(full, 'utf8')), ts.ScriptTarget.Latest, true);
  const mod: Module = {file, sf, state: new Map(), fns: new Map(), imports: new Map()};
  const addFn = (name: string, node: ts.Node): void => {
    const list = mod.fns.get(name) ?? [];
    list.push(node);
    mod.fns.set(name, list);
  };
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.importClause?.namedBindings !== undefined && ts.isNamedImports(st.importClause.namedBindings)) {
      for (const el of st.importClause.namedBindings.elements) {
        mod.imports.set(el.name.text, {from: st.moduleSpecifier.text, name: (el.propertyName ?? el.name).text});
      }
    }
    if (ts.isVariableStatement(st) && !file.endsWith('.vue')) {
      const isConst = (st.declarationList.flags & ts.NodeFlags.Const) !== 0;
      for (const decl of st.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) {
          continue;
        }
        const name = decl.name.text;
        const how = isConst ? constState(decl, name) : 'let';
        if (how !== undefined) {
          mod.state.set(name, {file, name, line: sf.getLineAndCharacterOfPosition(decl.getStart()).line + 1, how, node: decl, isLet: !isConst});
        }
      }
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
      addFn(node.name.text, node);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      addFn(node.name.text, node.initializer);
    } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      addFn(node.name.text, node);
    } else if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      addFn(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return mod;
}

function resolveImport(from: string, spec: string, modules: ReadonlyMap<string, Module>): Module | undefined {
  const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : (spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)) : undefined);
  if (base === undefined) {
    return undefined;
  }
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    const hit = modules.get(candidate);
    if (hit !== undefined) {
      return hit;
    }
  }
  return undefined;
}

/** A `let` only ever assigned a scope / a run / a scoped timer's cancel (or `undefined`) is the kernel's to end. */
function kernelOwned(mod: Module, v: StateVar): boolean {
  if (!v.isLet) {
    return false;
  }
  let assigned = 0;
  let foreign = false;
  const owned = (expr: ts.Expression | undefined): boolean => {
    if (expr === undefined) {
      return true;
    }
    const e = unwrap(expr);
    return (ts.isIdentifier(e) && e.text === 'undefined') || (ts.isCallExpression(e) && KERNEL_OWNERS.has(calleeName(e)));
  };
  if (!owned(v.node.initializer)) {
    return false;
  }
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      ts.isIdentifier(node.left) && node.left.text === v.name) {
      assigned++;
      if (!owned(node.right)) {
        foreign = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(mod.sf);
  return assigned > 0 && !foreign;
}

type Scan = {modules: Map<string, Module>, reached: Set<string>, roots: number};

function scan(): Scan {
  const files: Array<string> = [];
  walkFiles(path.join(ROOT, TREE), files);
  const modules = new Map<string, Module>();
  for (const full of files) {
    const mod = readModule(full);
    modules.set(mod.file, mod);
  }
  // THE TEARDOWN'S CLOSURE: from every function the session's end runs, through the functions those name.
  const reached = new Set<string>();
  const seen = new Set<ts.Node>();
  const queue: Array<{mod: Module, node: ts.Node, depth: number}> = [];
  const enqueue = (mod: Module, node: ts.Node, depth = 0): void => {
    if (!seen.has(node) && depth <= TEARDOWN_DEPTH) {
      seen.add(node);
      queue.push({mod, node, depth});
    }
  };
  const enqueueNamed = (mod: Module, name: string, depth = 0): void => {
    for (const fn of mod.fns.get(name) ?? []) {
      enqueue(mod, fn, depth);
    }
  };
  let roots = 0;
  for (const mod of modules.values()) {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const name = calleeName(node);
        const index = ts.isIdentifier(node.expression) ? TEARDOWN_CALLS[name] : (name === 'defer' ? 0 : undefined);
        const arg = index === undefined ? undefined : node.arguments[index];
        if (arg !== undefined) {
          roots++;
          if (ts.isIdentifier(arg)) {
            enqueueNamed(mod, arg.text);
            const imported = mod.imports.get(arg.text);
            const target = imported === undefined ? undefined : resolveImport(mod.file, imported.from, modules);
            if (target !== undefined && imported !== undefined) {
              enqueueNamed(target, imported.name);
            }
          } else {
            enqueue(mod, arg);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(mod.sf);
  }
  for (const extra of EXTRA_ROOTS) {
    const mod = modules.get(extra.file);
    if (mod !== undefined) {
      enqueueNamed(mod, extra.fn);
    }
  }
  // (Breadth first: a function is read once, at the shallowest depth the teardown reaches it. The queue grows while
  // it is read — a `for…of` over an array visits what is appended to it.)
  for (const {mod, node, depth} of queue) {
    /** `name` is WRITTEN here: the module state it names — this module's, or the one it is imported from. */
    const written = (target: ts.Expression | undefined): void => {
      const root = target === undefined ? undefined : rootOf(target);
      if (root === undefined) {
        return;
      }
      if (mod.state.has(root.text)) {
        reached.add(`${mod.file}#${root.text}`);
        return;
      }
      const imported = mod.imports.get(root.text);
      const from = imported === undefined ? undefined : resolveImport(mod.file, imported.from, modules);
      if (from !== undefined && imported !== undefined && from.state.has(imported.name)) {
        reached.add(`${from.file}#${imported.name}`);
      }
    };
    const visit = (child: ts.Node): void => {
      if (ts.isBinaryExpression(child) && child.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && child.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        written(child.left);
      } else if ((ts.isPrefixUnaryExpression(child) || ts.isPostfixUnaryExpression(child)) &&
        (child.operator === ts.SyntaxKind.PlusPlusToken || child.operator === ts.SyntaxKind.MinusMinusToken)) {
        written(child.operand);
      } else if (ts.isDeleteExpression(child)) {
        written(child.expression);
      } else if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression)) {
        if (MUTATORS.has(child.expression.name.text)) {
          written(child.expression.expression);
        } else if (child.expression.name.text === 'assign' && ts.isIdentifier(child.expression.expression) && child.expression.expression.text === 'Object') {
          written(child.arguments[0]);
        }
      }
      if (ts.isIdentifier(child)) {
        const parent = child.parent;
        const isMember = parent !== undefined && ts.isPropertyAccessExpression(parent) && parent.name === child;
        const isKey = parent !== undefined && ts.isPropertyAssignment(parent) && parent.name === child;
        if (isMember) {
          // `shell.stopSupervisor()` — a function of THIS module reached through an object.
          enqueueNamed(mod, child.text, depth + 1);
        } else if (!isKey) {
          enqueueNamed(mod, child.text, depth + 1);
          const imported = mod.imports.get(child.text);
          const from = imported === undefined ? undefined : resolveImport(mod.file, imported.from, modules);
          if (from !== undefined && imported !== undefined) {
            enqueueNamed(from, imported.name, depth + 1);
          }
        }
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
  }
  return {modules, reached, roots};
}

function pageLifetime(file: string, name: string): string | undefined {
  const own = PAGE_LIFETIME[file]?.[name];
  if (own !== undefined) {
    return own;
  }
  for (const [prefix, why] of Object.entries(PAGE_LIFETIME_MODULES)) {
    if (prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix) {
      return why;
    }
  }
  return undefined;
}

describe('module state — reached by the session\'s end, or declared page-lifetime', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120_000);
  let result: Scan;
  let undeclared: Array<StateVar>;
  let counted: {state: number, reached: number, kernel: number, page: number};

  before(() => {
    result = scan();
    undeclared = [];
    counted = {state: 0, reached: 0, kernel: 0, page: 0};
    for (const mod of result.modules.values()) {
      for (const v of mod.state.values()) {
        counted.state++;
        if (result.reached.has(`${v.file}#${v.name}`)) {
          counted.reached++;
        } else if (kernelOwned(mod, v)) {
          counted.kernel++;
        } else if (pageLifetime(v.file, v.name) !== undefined) {
          counted.page++;
        } else {
          undeclared.push(v);
        }
      }
    }
  });

  it('a module may not GAIN undeclared state — and a new module starts at zero (the ratchet)', () => {
    const counts: Record<string, number> = {};
    for (const v of undeclared) {
      counts[v.file] = (counts[v.file] ?? 0) + 1;
    }
    if (process.env.MODULE_STATE_REPORT === '1') {
      const byDir: Record<string, number> = {};
      for (const [file, n] of Object.entries(counts)) {
        const dir = file.split('/').slice(0, 4).join('/');
        byDir[dir] = (byDir[dir] ?? 0) + n;
      }
      console.log(`module state: ${counted.state} top-level mutable declarations — reached by the teardown ${counted.reached}, kernel-owned ${counted.kernel}, page-lifetime ${counted.page}, UNDECLARED ${undeclared.length}`);
      for (const [dir, n] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(n).padStart(4)}  ${dir}`);
      }
      for (const v of undeclared) {
        console.log(`    ${v.file}:${v.line} ${v.name} (${v.how})`);
      }
    }
    if (process.env.MODULE_STATE_BASELINE === 'write') {
      const sorted = Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
      fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + String.fromCharCode(10));
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    const grew: Array<string> = [];
    const fell: Array<string> = [];
    for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
      const now = counts[file] ?? 0;
      const was = baseline[file] ?? 0;
      if (now > was) {
        const list = undeclared.filter((v) => v.file === file).map((v) => `    ${v.file}:${v.line} ${v.name} (${v.how})`).join('\n');
        grew.push(`${file}: ${was} → ${now} — module state the session's end does not reach. Give it a reset the teardown runs ` +
          '(`sessionState(label, reset, at)`), keep it in a scope / a run, or declare it page-lifetime with its reason ' +
          `(tests/console/moduleStateGuard.spec.ts). The module's undeclared state:\n${list}`);
      } else if (now < was) {
        fell.push(`${file}: ${was} → ${now}`);
      }
    }
    expect(grew, grew.join('\n')).to.deep.eq([]);
    expect(fell, `the debt FELL — lock it in: set these in tests/console/moduleStateBaseline.json (or run with MODULE_STATE_BASELINE=write)\n${fell.join('\n')}`).to.deep.eq([]);
  });

  it('every page-lifetime declaration still names something, and says why', () => {
    const dead: Array<string> = [];
    for (const [file, names] of Object.entries(PAGE_LIFETIME)) {
      const mod = result.modules.get(file);
      for (const [name, why] of Object.entries(names)) {
        if (mod === undefined || !mod.state.has(name)) {
          dead.push(`${file} · ${name} — no such module state (renamed or gone: drop the row)`);
        } else if (why.trim().length < 12) {
          dead.push(`${file} · ${name} — the reason is missing`);
        } else if (result.reached.has(`${file}#${name}`)) {
          dead.push(`${file} · ${name} — the teardown reaches it now: it is not page-lifetime (drop the row)`);
        }
      }
    }
    for (const [prefix, why] of Object.entries(PAGE_LIFETIME_MODULES)) {
      const hit = [...result.modules.keys()].some((file) => (prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix));
      if (!hit) {
        dead.push(`${prefix} — no such module (drop the row)`);
      } else if (why.trim().length < 12) {
        dead.push(`${prefix} — the reason is missing`);
      }
    }
    expect(dead, dead.join('\n')).to.deep.eq([]);
  });

  it('the scan sees what it is there for', () => {
    expect(result.modules.size, 'the client\'s modules').to.be.greaterThan(800);
    expect(result.roots, 'the teardown\'s roots (sessionState resets, session-end hooks, scope defers, unmount hooks)').to.be.greaterThan(150);
    // A state the session resets by its declaration is REACHED…
    expect(result.reached.has('src/client/console/consoleLiveness.ts#rungs'), 'the ladder\'s registry is not reset by a session').to.eq(false);
    const stack = result.modules.get('src/client/console/consoleWorkspaceStack.ts');
    expect(stack, 'the workspace stack').to.not.eq(undefined);
    const stackState = [...(stack?.state.keys() ?? [])];
    expect(stackState.length, 'the stack keeps module state').to.be.greaterThan(0);
    expect(stackState.some((name) => result.reached.has(`src/client/console/consoleWorkspaceStack.ts#${name}`)), 'and its `sessionState` reset reaches it').to.eq(true);
    expect(counted.reached, 'state the teardown reaches').to.be.greaterThan(200);
  });
});
