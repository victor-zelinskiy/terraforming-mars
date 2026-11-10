// `node scripts/shell-extract.mjs <command> …` — take a named set of members OUT of an Options-API monolith
// (ConsoleShell.vue) into a Composition-API CONTROLLER module, mechanically.
//
// Console architecture v2, the shell slices (docs/claude/console/architecture-v2/PLAN.md §5 · S2). The monolith's
// members reach each other through `this`, so nothing in the file says who depends on whom. This tool moves a domain's
// data fields, computeds and methods — with their comments — into `create<Name>Controller(shell)`, rewriting every
// `this.x`:
//
//   x is a moved data field / computed  →  x.value
//   x is a moved method                 →  x
//   x mirrors an imported module state  →  the import itself            (`this.consoleState` → `consoleState`)
//   anything else                       →  shell.x                      (the controller's PORT — typed, explicit)
//
// and it REPORTS the port: every foreign member the domain reads, calls or WRITES. That report is the dependency
// matrix the monolith never had. The members stay reachable under their old names (the shell's `setup()` spreads the
// controller), so the template, the watchers and the rest of the options keep working unchanged — a slice moves one
// domain and nothing else.
//
// Watchers are NOT moved: their creation order is load-bearing (see the plan). They keep calling the moved members
// through `this`.
//
//   index  <sfc>                      every member: kind, line, how many `this.` it reads
//   report <sfc> <spec.json>          the port of a member set (foreign reads / calls / writes), and what blocks a move
//   apply  <sfc> <spec.json>          write the controller, patch the SFC (then: eslint --fix, npm run lint:client)
//   graph  <sfc>                      JSON: every member with what it uses through `this`, the hooks, the watchers
//   lift   <sfc> <target.ts> NAME…    move module-level declarations more than one domain reads into a module
//   delegate-watchers <sfc>           every watcher's body becomes a method; the `watch` block becomes their ordered table
//   prune  <file>                     drop the imports a file (an SFC's script or a module) no longer names
//
// spec.json: {"name": "viewer", "module": "src/client/console/shell/viewerController.ts",
//             "members": ["zoomFlight", …], "port": {"someForeign": "its type"}, "header": "…doc comment…",
//             "exports": ["A_MODULE_LEVEL_CONST the controller owns and the SFC still reads"]}
//
// What it does about NAMES (a `this.x` and a free `x` are different things in the monolith and one scope here):
//   · a moving member whose name also occurs free in the moving code is declared `ownX` and returned as `x`;
//   · a method that IS an import (`methods: {someImport}`) is returned as the import;
//   · a port member a SIBLING controller already owns is typed off that controller (`UnwrapRef<XController['m']>`).
// What it REFUSES (fix by hand first): a bare `this`; `this` inside a plain `function`; a data initializer that reads
// the instance (a controller is built in setup(), before the options exist); a local that would shadow `shell` or a
// mirror's import; a module-level declaration both sides read (move it to a shared module, or `exports` it).
//
// Re-runnable: when `main` moved under a slice, re-apply the spec on the fresh file instead of merging a moved block.

import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const [, , command, sfcPath, specPath] = process.argv;

/**
 * Drop the imports a text no longer names (what a move leaves behind in the SFC, and what the controller's own list
 * took by a word match inside a comment). Reads IDENTIFIER tokens, never text: a name in a comment or a string is not a use.
 */
function pruneUnusedImports(text) {
  const sf = ts.createSourceFile('m.ts', text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const used = new Set();
  (function walk(node) {
    if (ts.isImportDeclaration(node)) {
      return;
    }
    if (ts.isIdentifier(node)) {
      // `shell.x`, `{x: …}`, `x(…) {…}` in a type or an object NAME a member — they do not use an import called `x`.
      const parent = node.parent;
      const isName = (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isQualifiedName(parent) && parent.right === node) ||
        ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertySignature(parent) || ts.isMethodSignature(parent) ||
          ts.isPropertyDeclaration(parent) || ts.isEnumMember(parent)) && parent.name === node) ||
        (ts.isBindingElement(parent) && parent.propertyName === node);
      if (!isName) {
        used.add(node.text);
      }
    }
    ts.forEachChild(node, walk);
  })(sf);
  const edits = [];
  const dropped = [];
  for (const decl of sf.statements.filter(ts.isImportDeclaration)) {
    const clause = decl.importClause;
    if (clause === undefined) {
      continue; // a side-effect import
    }
    const def = clause.name !== undefined && used.has(clause.name.text) ? clause.name.text : undefined;
    let ns;
    let named;
    let lost = clause.name !== undefined && def === undefined ? [clause.name.text] : [];
    if (clause.namedBindings !== undefined) {
      if (ts.isNamespaceImport(clause.namedBindings)) {
        if (used.has(clause.namedBindings.name.text)) {
          ns = `* as ${clause.namedBindings.name.text}`;
        } else {
          lost.push(clause.namedBindings.name.text);
        }
      } else {
        named = clause.namedBindings.elements.filter((el) => used.has(el.name.text)).map((el) => el.getText(sf));
        lost = lost.concat(clause.namedBindings.elements.filter((el) => !used.has(el.name.text)).map((el) => el.name.text));
      }
    }
    if (lost.length === 0) {
      continue;
    }
    dropped.push(...lost);
    const parts = [def, ns, named !== undefined && named.length > 0 ? `{${named.join(', ')}}` : undefined].filter(Boolean);
    if (parts.length === 0) {
      let end = decl.getEnd();
      if (text[end] === '\n') {
        end++;
      }
      edits.push({start: decl.getStart(sf), end, text: ''});
    } else {
      edits.push({
        start: decl.getStart(sf), end: decl.getEnd(),
        text: `import ${clause.isTypeOnly ? 'type ' : ''}${parts.join(', ')} from ${decl.moduleSpecifier.getText(sf)};`,
      });
    }
  }
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return {text: out, dropped};
}
if (command === undefined || sfcPath === undefined) {
  console.error('usage: node scripts/shell-extract.mjs index|graph|report|apply|prune <sfc> [spec.json]');
  process.exit(2);
}

const raw = fs.readFileSync(sfcPath, 'utf8');
const CRLF = raw.includes('\r\n');
if (command === 'prune') {
  const lf = raw.replace(/\r\n/g, '\n');
  let outText;
  let dropped;
  if (sfcPath.endsWith('.vue')) {
    const open = lf.indexOf('\n', lf.indexOf('<script lang="ts">')) + 1;
    const close = lf.lastIndexOf('</script>');
    const r = pruneUnusedImports(lf.slice(open, close));
    outText = lf.slice(0, open) + r.text + lf.slice(close);
    dropped = r.dropped;
  } else {
    const r = pruneUnusedImports(lf);
    outText = r.text;
    dropped = r.dropped;
  }
  fs.writeFileSync(sfcPath, CRLF ? outText.replace(/\n/g, '\r\n') : outText);
  console.log(`${sfcPath}: dropped ${dropped.length} unused import name(s)${dropped.length > 0 ? ' — ' + dropped.join(', ') : ''}`);
  process.exit(0);
}
const sfc = raw.replace(/\r\n/g, '\n');
const scriptOpen = sfc.indexOf('<script lang="ts">');
const scriptStart = sfc.indexOf('\n', scriptOpen) + 1;
const scriptEnd = sfc.lastIndexOf('</script>');
const script = sfc.slice(scriptStart, scriptEnd);
const source = ts.createSourceFile('shell.ts', script, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

// ── locate the component's options ──────────────────────────────────────────────────────────────────────────────────
let options;
ts.forEachChild(source, function visit(node) {
  if (ts.isExportAssignment(node) && ts.isCallExpression(node.expression) && node.expression.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.expression.arguments[0])) {
    options = node.expression.arguments[0];
  }
});
if (options === undefined) {
  throw new Error('no `export default defineComponent({…})` found');
}
const option = (name) => options.properties.find((p) => p.name !== undefined && p.name.getText(source) === name);

/** name → {kind, node, initializer?} */
const members = new Map();
const dataMethod = option('data');
let dataObject;
if (dataMethod !== undefined) {
  const ret = dataMethod.body.statements.find(ts.isReturnStatement);
  dataObject = ret.expression;
  for (const prop of dataObject.properties) {
    members.set(prop.name.getText(source), {kind: 'data', node: prop});
  }
}
for (const [section, kind] of [['computed', 'computed'], ['methods', 'method']]) {
  const block = option(section);
  if (block !== undefined) {
    for (const prop of block.initializer.properties) {
      members.set(prop.name.getText(source), {kind, node: prop});
    }
  }
}
const propsBlock = option('props');
const propNames = new Set(propsBlock === undefined ? [] : propsBlock.initializer.properties.map((p) => p.name.getText(source)));
const setupMethod = option('setup');
const setupReturn = setupMethod?.body.statements.find(ts.isReturnStatement);
const setupNames = new Set(setupReturn === undefined || !ts.isObjectLiteralExpression(setupReturn.expression) ? [] :
  setupReturn.expression.properties.flatMap((p) => (ts.isSpreadAssignment(p) ? [] : [p.name.getText(source)])));
const watchBlock = option('watch');

// Controllers already taken out (`const viewer = createViewerController(…)` in setup()): what each one returns is still
// a member of the shell — a later domain's port reads it with the type the SIBLING declares.
const siblingMembers = new Map(); // member name → {type: 'ViewerController', from: '@/client/…/viewerController'}
for (const st of setupMethod?.body.statements ?? []) {
  if (!ts.isVariableStatement(st)) {
    continue;
  }
  for (const d of st.declarationList.declarations) {
    const call = d.initializer;
    const made = call !== undefined && ts.isCallExpression(call) && ts.isIdentifier(call.expression) ? /^create(\w+)Controller$/.exec(call.expression.text) : null;
    if (made === null) {
      continue;
    }
    const decl = source.statements.find((imp) => ts.isImportDeclaration(imp) && imp.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(imp.importClause.namedBindings) && imp.importClause.namedBindings.elements.some((el) => el.name.text === call.expression.text));
    if (decl === undefined) {
      continue;
    }
    const from = decl.moduleSpecifier.text;
    const file = from.replace(/^@\//, 'src/') + '.ts';
    if (!fs.existsSync(file)) {
      continue;
    }
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const ret = text.lastIndexOf('\n  return {\n');
    const end = text.indexOf('\n  };', ret);
    for (const row of text.slice(ret, end).split('\n')) {
      const key = /^ {4}(\w+)[,:]/.exec(row);
      if (key !== null) {
        siblingMembers.set(key[1], {type: `${made[1]}Controller`, from});
      }
    }
  }
}
const siblingImports = new Map(); // from → Set<type>

// ── imports (for mirrors and for the controller's own import list) ─────────────────────────────────────────────────
const imports = source.statements.filter(ts.isImportDeclaration);
const importedNames = new Set();
for (const decl of imports) {
  const clause = decl.importClause;
  if (clause === undefined) {
    continue;
  }
  if (clause.name !== undefined) {
    importedNames.add(clause.name.text);
  }
  if (clause.namedBindings !== undefined) {
    if (ts.isNamespaceImport(clause.namedBindings)) {
      importedNames.add(clause.namedBindings.name.text);
    } else {
      for (const el of clause.namedBindings.elements) {
        importedNames.add(el.name.text);
      }
    }
  }
}
// Module-level declarations of the SFC script (consts, lets, functions, types) — a moved member may read them.
const moduleLevel = new Map();
for (const st of source.statements) {
  if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) {
      moduleLevel.set(d.name.getText(source), st);
    }
  } else if ((ts.isFunctionDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) && st.name !== undefined) {
    moduleLevel.set(st.name.text, st);
  }
}

/** A data field whose value IS an imported module state (`consoleState`, `boardPeekUi: boardPeekState`). */
function mirrorOf(name) {
  const m = members.get(name);
  if (m === undefined || m.kind !== 'data') {
    return undefined;
  }
  const prop = m.node;
  if (ts.isShorthandPropertyAssignment(prop)) {
    return importedNames.has(prop.name.text) ? prop.name.text : undefined;
  }
  if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.initializer) && importedNames.has(prop.initializer.text)) {
    return prop.initializer.text;
  }
  return undefined;
}

const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 +
  sfc.slice(0, scriptStart).split('\n').length - 1;

/** Every `this` inside a member: property accesses (with whether they are written) and bare uses. */
function thisUses(node) {
  const uses = [];
  const bare = [];
  const ownThis = [];
  (function walk(n, shadowed) {
    if (n.kind === ts.SyntaxKind.ThisKeyword) {
      if (shadowed) {
        ownThis.push(n);
        return;
      }
      const parent = n.parent;
      if (ts.isPropertyAccessExpression(parent) && parent.expression === n) {
        const access = parent;
        const up = access.parent;
        const written =
          (ts.isBinaryExpression(up) && up.left === access && up.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && up.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
          ((ts.isPostfixUnaryExpression(up) || ts.isPrefixUnaryExpression(up)) && (up.operator === ts.SyntaxKind.PlusPlusToken || up.operator === ts.SyntaxKind.MinusMinusToken));
        const called = ts.isCallExpression(up) && up.expression === access;
        uses.push({name: access.name.text, node: access, written, called});
      } else {
        bare.push(n);
      }
      return;
    }
    // A plain `function` (not an arrow) has a `this` of its own.
    const own = (ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n)) && n !== node;
    ts.forEachChild(n, (c) => walk(c, shadowed || own));
  })(node, false);
  return {uses, bare, ownThis};
}

// ── index ───────────────────────────────────────────────────────────────────────────────────────────────────────────
if (command === 'index') {
  for (const [name, m] of members) {
    const {uses} = thisUses(m.node);
    console.log(`${m.kind}\t${lineOf(m.node)}\t${name}\t${new Set(uses.map((u) => u.name)).size}`);
  }
  process.exit(0);
}

// ── graph ───────────────────────────────────────────────────────────────────────────────────────────────────────────
if (command === 'graph') {
  // member → the members it reads / calls / writes through `this` (JSON; the input of any clustering of domains).
  const graph = {};
  for (const [name, m] of members) {
    const {uses} = thisUses(m.node);
    graph[name] = {
      kind: m.kind, line: lineOf(m.node), lines: script.slice(m.node.getStart(source), m.node.getEnd()).split('\n').length,
      mirror: mirrorOf(name) !== undefined,
      moduleLevel: [...new Set((script.slice(m.node.getStart(source), m.node.getEnd()).match(/[A-Za-z_$][\w$]*/g) ?? []).filter((w) => moduleLevel.has(w)))],
      uses: [...new Set(uses.map((u) => u.name))].filter((n) => members.has(n)),
      writes: [...new Set(uses.filter((u) => u.written).map((u) => u.name))].filter((n) => members.has(n)),
    };
  }
  const hooks = {};
  for (const hook of ['created', 'mounted', 'beforeUnmount', 'unmounted']) {
    const node = option(hook);
    if (node !== undefined) {
      hooks[hook] = [...new Set(thisUses(node).uses.map((u) => u.name))].filter((n) => members.has(n));
    }
  }
  const watchers = {};
  if (watchBlock !== undefined) {
    for (const prop of watchBlock.initializer.properties) {
      const key = prop.name.getText(source).replace(/^['"]|['"]$/g, '');
      watchers[`${key}@${lineOf(prop)}`] = [...new Set([key.split('.')[0], ...thisUses(prop).uses.map((u) => u.name)])].filter((n) => members.has(n));
    }
  }
  console.log(JSON.stringify({members: graph, hooks, watchers}));
  process.exit(0);
}

// ── lift ────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (command === 'lift') {
  // `lift <sfc> <target.ts> NAME…` — module-level declarations of the SFC that MORE THAN ONE domain reads (a type, a
  // constant, a pure function) move into a module of their own, exported; the SFC imports them back. A controller taken
  // out afterwards imports them like anything else. (A shared `let` is state: give it an owner by hand.)
  const target = specPath;
  const names = process.argv.slice(5);
  const statements = [];
  for (const name of names) {
    const st = moduleLevel.get(name);
    if (st === undefined) {
      throw new Error(`«${name}» is not a module-level declaration of the SFC`);
    }
    if (ts.isVariableStatement(st) && (st.declarationList.flags & ts.NodeFlags.Const) === 0) {
      throw new Error(`«${name}» is a \`let\` — shared mutable state needs an owner, not a module of constants`);
    }
    if (!statements.includes(st)) {
      statements.push(st);
    }
  }
  const lifted = new Set(statements.flatMap((st) => (ts.isVariableStatement(st) ? st.declarationList.declarations.map((d) => d.name.getText(source)) : [st.name.text])));
  const named = new Set();
  for (const st of statements) {
    (function walk(n) {
      if (ts.isIdentifier(n)) {
        named.add(n.text);
      }
      ts.forEachChild(n, walk);
    })(st);
  }
  const dragged = [...named].filter((n) => moduleLevel.has(n) && !lifted.has(n));
  if (dragged.length > 0) {
    throw new Error(`the lifted declarations name other module-level declarations — lift them too: ${dragged.join(', ')}`);
  }
  const start = (st) => {
    const trivia = script.slice(st.getFullStart(), st.getStart(source));
    const gap = trivia.lastIndexOf('\n\n');
    return gap === -1 ? st.getFullStart() : st.getFullStart() + gap + 1;
  };
  const importLines = [];
  for (const decl of imports) {
    const clause = decl.importClause;
    if (clause === undefined) {
      continue;
    }
    const from = decl.moduleSpecifier.getText(source);
    const parts = [];
    if (clause.name !== undefined && named.has(clause.name.text)) {
      parts.push(clause.name.text);
    }
    if (clause.namedBindings !== undefined) {
      if (ts.isNamespaceImport(clause.namedBindings)) {
        if (named.has(clause.namedBindings.name.text)) {
          parts.push(`* as ${clause.namedBindings.name.text}`);
        }
      } else {
        const els = clause.namedBindings.elements.filter((el) => named.has(el.name.text)).map((el) => el.getText(source));
        if (els.length > 0) {
          parts.push(`{${els.join(', ')}}`);
        }
      }
    }
    if (parts.length > 0) {
      if (/\.vue['"]$/.test(from)) {
        throw new Error(`a lifted declaration names ${parts.join(', ')} from ${from} — a .ts module cannot import a named export of a .vue file`);
      }
      importLines.push(`import ${clause.isTypeOnly ? 'type ' : ''}${parts.join(', ')} from ${from};`);
    }
  }
  const body = statements.map((st) => `${script.slice(start(st), st.getStart(source)).replace(/^\n+/, '')}export ${script.slice(st.getStart(source), st.getEnd())}`).join('\n\n');
  const head = `/*\n * @console-shared LIVE — console native stands on this file.\n *\n * WHAT MORE THAN ONE SHELL CONTROLLER NAMES (architecture v2 — the shell slices): the types, constants and pure\n * functions that were module-level declarations of ConsoleShell.vue and are read by more than one of the domains\n * taken out of it. Lifted by \`scripts/shell-extract.mjs lift\`. A declaration ONE domain reads lives in that domain's\n * controller; shared mutable state lives in \`shellFlowState.ts\`, with its owner named.\n */\n`;
  const moduleText = pruneUnusedImports(`${head}${importLines.join('\n')}${importLines.length > 0 ? '\n\n' : ''}${body}\n`).text;
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, CRLF ? moduleText.replace(/\n/g, '\r\n') : moduleText);
  const cuts = statements.map((st) => ({start: start(st), end: st.getEnd(), text: ''}));
  const lastImport = imports[imports.length - 1];
  const importPath = '@/' + target.replace(/\\/g, '/').replace(/^src\//, '').replace(/\.ts$/, '');
  cuts.push({start: lastImport.getEnd(), end: lastImport.getEnd(), text: `\nimport {${[...lifted].join(', ')}} from '${importPath}';`});
  cuts.sort((a, b) => b.start - a.start);
  let patched = script;
  for (const c of cuts) {
    patched = patched.slice(0, c.start) + c.text + patched.slice(c.end);
  }
  const out = sfc.slice(0, scriptStart) + pruneUnusedImports(patched).text + sfc.slice(scriptEnd);
  fs.writeFileSync(sfcPath, CRLF ? out.replace(/\n/g, '\r\n') : out);
  console.log(`lifted ${lifted.size} declaration(s) → ${target}: ${[...lifted].join(', ')}`);
  process.exit(0);
}

// ── delegate-watchers ───────────────────────────────────────────────────────────────────────────────────────────────
if (command === 'delegate-watchers') {
  // Every watcher's BODY becomes a method (`when<Key>Changes`) and the watcher a one-line delegate to it. The `watch`
  // block stays where it is, in its order (creation order is load-bearing) — it becomes the ordered TABLE of the
  // shell's reactions, and each reaction's body can then move out with its domain like any other method.
  const methodsBlock = option('methods');
  if (watchBlock === undefined || methodsBlock === undefined) {
    throw new Error('the component needs a `watch` and a `methods` block');
  }
  const taken = new Set(members.keys());
  const cuts = [];
  const added = [];
  const skipped = [];
  const pascal = (key) => key.split(/[^A-Za-z0-9_$]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  for (const prop of watchBlock.initializer.properties) {
    const key = prop.name.getText(source).replace(/^['"]|['"]$/g, '');
    let fn; // the node that has parameters + body
    let outerDoc = leading(prop);
    let innerDoc = '';
    if (ts.isMethodDeclaration(prop)) {
      fn = prop;
    } else if (ts.isPropertyAssignment(prop) && ts.isObjectLiteralExpression(prop.initializer)) {
      const handler = prop.initializer.properties.find((q) => q.name !== undefined && q.name.getText(source) === 'handler');
      if (handler !== undefined && ts.isMethodDeclaration(handler)) {
        fn = handler;
        innerDoc = leading(handler);
      } else if (handler !== undefined && ts.isPropertyAssignment(handler) && ts.isFunctionExpression(handler.initializer)) {
        fn = handler.initializer;
        innerDoc = leading(handler);
      }
    } else if (ts.isPropertyAssignment(prop) && ts.isFunctionExpression(prop.initializer)) {
      fn = prop.initializer;
    }
    if (fn === undefined || fn.body === undefined) {
      skipped.push(`${key} (line ${lineOf(prop)}): not a function handler`);
      continue;
    }
    const simple = fn.parameters.every((q) => ts.isIdentifier(q.name) && q.initializer === undefined && q.dotDotDotToken === undefined);
    if (!simple) {
      skipped.push(`${key} (line ${lineOf(prop)}): destructured / defaulted parameters`);
      continue;
    }
    // Already a delegate (`{ this.whenX(a, b); }`)? Leave it.
    const bodyText = script.slice(fn.body.getStart(source), fn.body.getEnd());
    if (/^\{\s*(return )?this\.when\w+Changes\([\w, ]*\);\s*\}$/.test(bodyText)) {
      continue;
    }
    let name = `when${pascal(key)}Changes`;
    for (let n = 2; taken.has(name); n++) {
      name = `when${pascal(key)}Changes${n}`;
    }
    taken.add(name);
    const isAsync = (fn.modifiers ?? []).some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword);
    const params = fn.parameters.map((q) => q.getText(source)).join(', ');
    const args = fn.parameters.map((q) => q.name.getText(source)).join(', ');
    let returnsValue = false;
    (function walk(n) {
      if (n !== fn.body && (ts.isFunctionLike(n))) {
        return;
      }
      if (ts.isReturnStatement(n) && n.expression !== undefined) {
        returnsValue = true;
      }
      ts.forEachChild(n, walk);
    })(fn.body);
    const type = fn.type !== undefined ? `: ${fn.type.getText(source)}` : returnsValue ? '' : isAsync ? ': Promise<void>' : ': void';
    // The handler sits at 4 (method form) or 6 (object form) spaces; a method of `methods` sits at 4.
    const fnIndent = script.slice(script.lastIndexOf('\n', fn.getStart(source)) + 1, fn.getStart(source)).match(/^ */)[0].length;
    const body = fnIndent === 4 ? bodyText : redent(bodyText, fnIndent, 4);
    const doc = [outerDoc, innerDoc].map((d) => d.replace(/^\n+/, '')).filter((d) => d.trim() !== '')
      .map((d) => redent(d.replace(/\s*$/, '\n'), d.match(/^ */)[0].length, 4)).join('');
    const whenDoc = `    /** WATCH \`${key}\` — the reaction's body (the shell's \`watch\` table delegates here, in its order). */\n`;
    added.push(`${doc === '' ? whenDoc : doc}    ${isAsync ? 'async ' : ''}${name}(${params})${type} ${body},`);
    // the delegate
    cuts.push({start: fn.body.getStart(source), end: fn.body.getEnd(), text: `{\n${' '.repeat(fnIndent + 2)}${isAsync || returnsValue ? 'return ' : ''}this.${name}(${args});\n${' '.repeat(fnIndent)}}`});
    // the documentation travels with the body
    if (outerDoc.trim() !== '') {
      cuts.push({start: prop.getFullStart(), end: prop.getStart(source), text: '\n    '});
    }
    if (innerDoc.trim() !== '') {
      const handler = fn.parent !== undefined && ts.isPropertyAssignment(fn.parent) ? fn.parent : fn;
      cuts.push({start: handler.getFullStart(), end: handler.getStart(source), text: `\n${' '.repeat(fnIndent)}`});
    }
  }
  // the methods go at the end of `methods`, in the watchers' order
  const close = methodsBlock.initializer.getEnd() - 1;
  const lastProp = methodsBlock.initializer.properties[methodsBlock.initializer.properties.length - 1];
  const needsComma = script.slice(lastProp.getEnd(), close).trim() !== ',';
  cuts.push({
    start: close, end: close,
    text: `${needsComma ? ',' : ''}\n    // ── the bodies of the watchers (the \`watch\` block is their ordered table) ──────────────────────────────\n${added.join('\n')}\n  `.replace(/^,?\n/, (m) => m),
  });
  cuts.sort((a, b) => b.start - a.start || b.end - a.end);
  let patched = script;
  for (const c of cuts) {
    patched = patched.slice(0, c.start) + c.text + patched.slice(c.end);
  }
  const out = sfc.slice(0, scriptStart) + patched + sfc.slice(scriptEnd);
  fs.writeFileSync(sfcPath, CRLF ? out.replace(/\n/g, '\r\n') : out);
  console.log(`delegated ${added.length} watcher(s) to methods; ${skipped.length} left as they are${skipped.length > 0 ? ':\n  ' + skipped.join('\n  ') : ''}`);
  process.exit(0);
}

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const moving = new Set(spec.members);
for (const name of moving) {
  if (!members.has(name)) {
    throw new Error(`«${name}» is not a data field, a computed or a method of the component`);
  }
}

// ── the port ────────────────────────────────────────────────────────────────────────────────────────────────────────
const INSTANCE_API = new Map([
  ['$refs', '$refs: Record<string, unknown>'],
  ['$nextTick', '$nextTick(fn?: () => void): Promise<void>'],
  ['$el', '$el: Element'],
  ['$watch', '$watch(source: () => unknown, callback: (value: never, old: never) => void, options?: Record<string, unknown>): () => void'],
]);

const port = new Map(); // name → {reads, calls, writes, from: Set<member>}
const blockers = [];
const mirrorsUsed = new Set();

// NAMES. Inside the monolith `this.x` and a free `x` are two different things (a member and an import / a local of
// the same name live side by side: `maPriceWaiverOf(kind) { return maPriceWaiverOf(this.playerView.maCosts, kind); }`,
// `const game = this.game;`). In a controller both are plain identifiers of one scope — so a moving member whose name
// ALSO occurs free in a moving body is declared under an alias (`ownX`) and returned under its real name, and a local
// that would shadow the port (`shell`) or a mirror's import is a blocker.
const freeNames = new Set();
const bindingNames = new Map(); // name → first member that binds it
const isNamePosition = (id) => {
  const parent = id.parent;
  return (ts.isPropertyAccessExpression(parent) && parent.name === id) ||
    (ts.isQualifiedName(parent) && parent.right === id) ||
    ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertySignature(parent) || ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isEnumMember(parent)) && parent.name === id) ||
    (ts.isBindingElement(parent) && parent.propertyName === id);
};
for (const name of moving) {
  (function walk(n) {
    if (ts.isIdentifier(n) && !isNamePosition(n)) {
      freeNames.add(n.text);
      const parent = n.parent;
      if ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent) || ts.isFunctionDeclaration(parent) ||
          ts.isFunctionExpression(parent)) && parent.name === n && !bindingNames.has(n.text)) {
        bindingNames.set(n.text, name);
      }
    }
    ts.forEachChild(n, walk);
  })(members.get(name).node);
}
/** The identifier a moving member is declared under inside the controller. */
const isImportItself = (name) => moving.has(name) && ts.isShorthandPropertyAssignment(members.get(name).node);
const localOf = (name) => (freeNames.has(name) && !isImportItself(name) ? `own${name[0].toUpperCase()}${name.slice(1)}` : name);
for (const name of moving) {
  const m = members.get(name);
  const {uses, bare, ownThis} = thisUses(m.node);
  for (const b of bare) {
    blockers.push(`${name} (line ${lineOf(b)}): a bare \`this\` (${b.parent.getText(source).slice(0, 60)}…) — pass what it needs explicitly`);
  }
  for (const o of ownThis) {
    blockers.push(`${name} (line ${lineOf(o)}): \`this\` inside a plain function — its own \`this\`, review by hand`);
  }
  if (m.kind === 'data' && uses.length > 0) {
    // A controller is constructed in setup(), BEFORE the options (data, computed) exist: an initializer that reads
    // the instance would read nothing.
    blockers.push(`${name}: its data() initializer reads \`this.${uses[0].name}\` — a controller's state is built before the shell's options exist; initialise it in a hook`);
  }
  for (const u of uses) {
    if (moving.has(u.name)) {
      continue;
    }
    if (mirrorOf(u.name) !== undefined) {
      mirrorsUsed.add(u.name);
      continue;
    }
    const entry = port.get(u.name) ?? {reads: 0, calls: 0, writes: 0, from: new Set()};
    if (u.written) {
      entry.writes++;
    } else if (u.called) {
      entry.calls++;
    } else {
      entry.reads++;
    }
    entry.from.add(name);
    port.set(u.name, entry);
  }
}
for (const name of moving) {
  if (mirrorOf(name) !== undefined) {
    blockers.push(`${name}: a MIRROR of imported module state — it stays in the shell's data() (the template reads it); do not list it`);
  }
}
if (bindingNames.has('shell') && port.size > 0) {
  blockers.push(`${bindingNames.get('shell')}: a local named \`shell\` would shadow the port — rename the local first`);
}
for (const mirror of mirrorsUsed) {
  const imported = mirrorOf(mirror);
  if (bindingNames.has(imported)) {
    blockers.push(`${bindingNames.get(imported)}: a local named \`${imported}\` would shadow the module state \`this.${mirror}\` becomes — rename the local first`);
  }
}
for (const name of moving) {
  const alias = localOf(name);
  if (alias !== name && (freeNames.has(alias) || members.has(alias))) {
    blockers.push(`${name}: its name also occurs free in the moving code, and the alias \`${alias}\` is taken — rename one by hand`);
  }
}

/** The declared type of a foreign member, read off its own declaration ('' = cannot tell — give it in spec.port). */
function declaredType(name) {
  if (!members.has(name) && siblingMembers.has(name)) {
    // A sibling controller owns it: its own declaration is the type (a spec.port row for it is stale — ignored).
    const sibling = siblingMembers.get(name);
    siblingImports.set(sibling.from, (siblingImports.get(sibling.from) ?? new Set()).add(sibling.type));
    return `${name}: UnwrapRef<${sibling.type}['${name}']>`;
  }
  if (spec.port?.[name] !== undefined) {
    return spec.port[name];
  }
  if (INSTANCE_API.has(name)) {
    return INSTANCE_API.get(name);
  }
  if (propNames.has(name)) {
    // A prop's type is its `PropType<T>` (or its runtime constructor).
    const text = propsBlock.initializer.properties.find((p) => p.name.getText(source) === name).getText(source);
    const typed = /as PropType<(.+)>\s*[,}]/s.exec(text);
    if (typed !== null) {
      return `readonly ${name}: ${typed[1]}`;
    }
    const runtime = /type:\s*(String|Boolean|Number)\b/.exec(text);
    return runtime === null ? '' : `readonly ${name}: ${runtime[1].toLowerCase()}`;
  }
  const m = members.get(name);
  if (m === undefined) {
    const sibling = siblingMembers.get(name);
    if (sibling === undefined) {
      return '';
    }
    // The shell shows a controller's refs unwrapped — the port says the same.
    siblingImports.set(sibling.from, (siblingImports.get(sibling.from) ?? new Set()).add(sibling.type));
    return `${name}: UnwrapRef<${sibling.type}['${name}']>`;
  }
  const node = m.node;
  if (m.kind === 'method' && ts.isMethodDeclaration(node)) {
    let untypedParam = false;
    const params = node.parameters.map((p) => {
      if (p.initializer === undefined) {
        return p.getText(source);
      }
      // `flag = true` is an implementation; the port says `flag?: boolean`.
      let type = p.type?.getText(source);
      if (type === undefined) {
        const init = p.initializer;
        if (init.kind === ts.SyntaxKind.TrueKeyword || init.kind === ts.SyntaxKind.FalseKeyword) {
          type = 'boolean';
        } else if (ts.isNumericLiteral(init) || (ts.isPrefixUnaryExpression(init) && ts.isNumericLiteral(init.operand))) {
          type = 'number';
        } else if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
          type = 'string';
        } else {
          untypedParam = true;
          type = 'unknown';
        }
      }
      return `${p.dotDotDotToken === undefined ? '' : '...'}${p.name.getText(source)}?: ${type}`;
    }).join(', ');
    // No annotation: a method that returns no VALUE is `void` (`Promise<void>` when async); one that does needs a word.
    let returnsValue = false;
    (function walk(n) {
      if (n !== node && ts.isFunctionLike(n)) {
        return;
      }
      if (ts.isReturnStatement(n) && n.expression !== undefined) {
        returnsValue = true;
      }
      ts.forEachChild(n, walk);
    })(node);
    const isAsync = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword) === true;
    const ret = node.type !== undefined ? node.type.getText(source) : returnsValue ? '' : isAsync ? 'Promise<void>' : 'void';
    return ret === '' || untypedParam ? '' : `${name}(${params}): ${ret}`;
  }
  if (m.kind === 'computed' && ts.isMethodDeclaration(node)) {
    return node.type === undefined ? '' : `readonly ${name}: ${node.type.getText(source)}`;
  }
  if (m.kind === 'data' && ts.isPropertyAssignment(node)) {
    const init = node.initializer;
    if (ts.isAsExpression(init)) {
      return `${name}: ${init.type.getText(source)}`;
    }
    if (init.kind === ts.SyntaxKind.TrueKeyword || init.kind === ts.SyntaxKind.FalseKeyword) {
      return `${name}: boolean`;
    }
    if (ts.isNumericLiteral(init) || (ts.isPrefixUnaryExpression(init) && ts.isNumericLiteral(init.operand))) {
      return `${name}: number`;
    }
    if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
      return `${name}: string`;
    }
  }
  return '';
}

const portLines = [];
const untyped = [];
for (const [name, entry] of [...port].sort((a, b) => a[0].localeCompare(b[0]))) {
  let type = declaredType(name);
  if (type === '') {
    untyped.push(name);
    type = `${name}: unknown /* TODO — give its type in spec.port */`;
  } else if (!type.startsWith(name) && !type.startsWith('readonly ' + name) && !type.startsWith('$')) {
    // spec.port gives a bare type
    type = `${entry.writes > 0 ? '' : 'readonly '}${name}: ${type}`;
  }
  if (propNames.has(name) && !type.startsWith('readonly')) {
    type = 'readonly ' + type;
  }
  portLines.push({name, type, entry});
}

// Watchers that touch the moving members (they stay in the shell and keep working through `this`).
const touchingWatchers = [];
if (watchBlock !== undefined) {
  for (const prop of watchBlock.initializer.properties) {
    const key = prop.name.getText(source).replace(/^['"]|['"]$/g, '');
    const root = key.split('.')[0];
    const {uses} = thisUses(prop);
    if (moving.has(root) || uses.some((u) => moving.has(u.name))) {
      touchingWatchers.push(`${key} (line ${lineOf(prop)})`);
    }
  }
}

if (command === 'report') {
  const by = (kind) => [...moving].filter((n) => members.get(n).kind === kind);
  console.log(`«${spec.name}»: ${by('data').length} data · ${by('computed').length} computed · ${by('method').length} methods`);
  console.log(`\nPORT — ${portLines.length} foreign members:`);
  for (const {name, type, entry} of portLines) {
    const how = [entry.reads > 0 ? `${entry.reads}r` : '', entry.calls > 0 ? `${entry.calls}c` : '', entry.writes > 0 ? `${entry.writes}W` : ''].filter(Boolean).join(' ');
    const kind = members.get(name)?.kind ?? (propNames.has(name) ? 'prop' : setupNames.has(name) ? 'setup' : INSTANCE_API.has(name) ? 'vue' : siblingMembers.has(name) ? siblingMembers.get(name).type.replace(/Controller$/, '').toLowerCase() + '›' : '?');
    console.log(`  ${entry.writes > 0 ? 'W' : ' '} ${kind.padEnd(8)} ${name.padEnd(38)} ${how.padEnd(10)} ← ${[...entry.from].slice(0, 4).join(', ')}${entry.from.size > 4 ? ', …' : ''}`);
    void type;
  }
  if (mirrorsUsed.size > 0) {
    console.log(`\nmodule mirrors read directly (no port): ${[...mirrorsUsed].join(', ')}`);
  }
  if (untyped.length > 0) {
    console.log(`\nNEEDS A TYPE in spec.port: ${untyped.join(', ')}`);
  }
  const aliased = [...moving].filter((n) => localOf(n) !== n);
  if (aliased.length > 0) {
    console.log(`\ndeclared under an alias (the name also occurs free in the moving code): ${aliased.map((n) => `${n} → ${localOf(n)}`).join(', ')}`);
  }
  if (touchingWatchers.length > 0) {
    console.log(`\nwatchers that touch these members (they stay in the shell): ${touchingWatchers.join(' · ')}`);
  }
  // Who ELSE in the shell uses the moving members (the inbound side).
  const inbound = new Map();
  for (const [name, m] of members) {
    if (moving.has(name)) {
      continue;
    }
    for (const u of thisUses(m.node).uses) {
      if (moving.has(u.name)) {
        inbound.set(u.name, (inbound.get(u.name) ?? new Set()).add(name));
      }
    }
  }
  console.log(`\nINBOUND — ${inbound.size} of the moving members are used by the rest of the shell's options:`);
  for (const [name, users] of [...inbound].sort((a, b) => b[1].size - a[1].size).slice(0, 40)) {
    console.log(`    ${name.padEnd(38)} ← ${users.size} (${[...users].slice(0, 3).join(', ')}${users.size > 3 ? ', …' : ''})`);
  }
  if (blockers.length > 0) {
    console.log(`\nBLOCKERS:\n  ${blockers.join('\n  ')}`);
  }
  process.exit(blockers.length > 0 ? 1 : 0);
}

if (command !== 'apply') {
  throw new Error(`unknown command «${command}»`);
}
if (blockers.length > 0) {
  console.error(`cannot apply:\n  ${blockers.join('\n  ')}`);
  process.exit(1);
}
if (untyped.length > 0) {
  console.error(`cannot apply — give these port members a type in spec.port: ${untyped.join(', ')}`);
  process.exit(1);
}

// ── rewrite the members ─────────────────────────────────────────────────────────────────────────────────────────────
const SHELL = 'shell';

/** The member's text with every `this.x` rewritten. `from`/`to` are positions in `script`. */
function rewritten(node, from, to) {
  const edits = [];
  for (const u of thisUses(node).uses) {
    const start = u.node.getStart(source);
    const end = u.node.getEnd();
    const mirror = mirrorOf(u.name);
    let text;
    if (moving.has(u.name)) {
      text = members.get(u.name).kind === 'method' ? localOf(u.name) : `${localOf(u.name)}.value`;
    } else if (mirror !== undefined) {
      text = mirror;
    } else {
      text = `${SHELL}.${u.name}`;
    }
    edits.push({start, end, text});
  }
  edits.sort((a, b) => b.start - a.start);
  let out = script.slice(from, to);
  for (const e of edits) {
    out = out.slice(0, e.start - from) + e.text + out.slice(e.end - from);
  }
  return out;
}

/** Leading comments of a member (its documentation travels with it). */
function leading(node) {
  const full = node.getFullStart();
  const start = node.getStart(source);
  return script.slice(full, start).replace(/^\n+/, '');
}

function redent(text, from, to) {
  return text.split('\n').map((line) => {
    if (line.trim() === '') {
      return '';
    }
    return line.startsWith(' '.repeat(from)) ? ' '.repeat(to) + line.slice(from) : line;
  }).join('\n');
}

const stateOut = [];
const derivedOut = [];
const verbsOut = [];
const exported = [];
for (const name of [...members.keys()].filter((n) => moving.has(n))) {
  const m = members.get(name);
  const node = m.node;
  const doc = leading(node);
  exported.push(name);
  if (m.kind === 'data') {
    const indent = 6;
    const init = ts.isShorthandPropertyAssignment(node) ? node.name.text : rewritten(node.initializer, node.initializer.getStart(source), node.initializer.getEnd());
    stateOut.push(redent(`${doc}${' '.repeat(indent)}const ${localOf(name)} = ref(${init});`, indent, 2));
  } else if (m.kind === 'computed') {
    const indent = 4;
    const type = node.type === undefined ? '' : `: ${node.type.getText(source)}`;
    const bodyText = rewritten(node.body, node.body.getStart(source), node.body.getEnd());
    derivedOut.push(redent(`${doc}${' '.repeat(indent)}const ${localOf(name)} = computed(()${type} => ${bodyText});`, indent, 2));
  } else if (ts.isShorthandPropertyAssignment(node)) {
    // `methods: {someImport}` — the member is the import; it is returned as it is.
  } else if (ts.isPropertyAssignment(node)) {
    const indent = 4;
    const init = rewritten(node.initializer, node.initializer.getStart(source), node.initializer.getEnd());
    verbsOut.push(redent(`${doc}${' '.repeat(indent)}const ${localOf(name)} = ${init};`, indent, 2));
  } else {
    const indent = 4;
    const isAsync = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword) === true;
    const typeParams = node.typeParameters === undefined ? '' : `<${node.typeParameters.map((t) => t.getText(source)).join(', ')}>`;
    const params = node.parameters.map((p) => rewritten(p, p.getStart(source), p.getEnd())).join(', ');
    const type = node.type === undefined ? '' : `: ${node.type.getText(source)}`;
    const bodyText = rewritten(node.body, node.body.getStart(source), node.body.getEnd());
    verbsOut.push(redent(`${doc}${' '.repeat(indent)}${isAsync ? 'async ' : ''}function ${localOf(name)}${typeParams}(${params})${type} ${bodyText}`, indent, 2));
  }
}

const Name = spec.name[0].toUpperCase() + spec.name.slice(1);
const portType = `${Name}Port`;
const factory = `create${Name}Controller`;

let bodyOut = '';
if (portLines.length > 0) {
  bodyOut += `/**\n * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith\n * hid behind \`this\`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).\n */\n`;
  bodyOut += `export type ${portType} = {\n${portLines.map(({type, entry}) => `  ${entry.writes > 0 ? '/** WRITTEN here. */ ' : ''}${type}${/[;,]$/.test(type) ? '' : ','}`).join('\n')}\n};\n\n`;
}
bodyOut += `export function ${factory}(${portLines.length === 0 ? '' : `${SHELL}: ${portType}`}) {\n`;
if (stateOut.length > 0) {
  bodyOut += `  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────\n${stateOut.join('\n')}\n\n`;
}
if (derivedOut.length > 0) {
  bodyOut += `  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────\n${derivedOut.join('\n\n')}\n\n`;
}
if (verbsOut.length > 0) {
  bodyOut += `  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────\n${verbsOut.join('\n\n')}\n\n`;
}
bodyOut += `  return {\n${exported.map((n) => (localOf(n) === n ? `    ${n},` : `    ${n}: ${localOf(n)},`)).join('\n')}\n  };\n}\n\nexport type ${Name}Controller = ReturnType<typeof ${factory}>;\n`;

// The module-level declarations the moved code reads go with it when NOTHING ELSE in the SFC reads them; otherwise the
// tool refuses (they belong in a shared module — move them first). Read by IDENTIFIER TOKENS, never by text: a name in
// a comment is not a use. Transitive: a declaration only a carried declaration reads is carried too.
const usesIdentifier = (text, id) => new RegExp(`(?<![\\w$.])${id.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);
const namesIn = (node, into = new Set()) => {
  (function walk(n) {
    if (ts.isIdentifier(n) && !isNamePosition(n)) {
      into.add(n.text);
    }
    ts.forEachChild(n, walk);
  })(node);
  return into;
};
const movedNames = new Set();
for (const name of moving) {
  namesIn(members.get(name).node, movedNames);
}
// candidates: what the moved code (or the generated port) names, and what those declarations name in turn
const candidates = new Map(); // id → statement
const queue = [...moduleLevel.keys()].filter((id) => movedNames.has(id) || usesIdentifier(bodyOut.slice(0, bodyOut.indexOf('export function ')), id));
while (queue.length > 0) {
  const id = queue.pop();
  if (candidates.has(id)) {
    continue;
  }
  const st = moduleLevel.get(id);
  candidates.set(id, st);
  for (const named of namesIn(st)) {
    if (moduleLevel.has(named) && !candidates.has(named)) {
      queue.push(named);
    }
  }
}
// who ELSE names them: every identifier of the script outside the moving members and the candidates' own statements
const candidateStatements = new Set(candidates.values());
const movingNodes = new Set([...moving].map((name) => members.get(name).node));
const restNames = new Set();
(function walk(n) {
  if (candidateStatements.has(n) || movingNodes.has(n) || ts.isImportDeclaration(n)) {
    return;
  }
  if (ts.isIdentifier(n) && !isNamePosition(n)) {
    restNames.add(n.text);
  }
  ts.forEachChild(n, walk);
})(source);
const templateText = sfc.slice(0, scriptStart);
const carried = [];
const shared = [];
for (const [id, st] of moduleLevel) {
  if (!candidates.has(id) || carried.some((c) => c.st === st)) {
    continue;
  }
  if (restNames.has(id) || usesIdentifier(templateText, id)) {
    // Read by both sides: it moves with the controller only when the spec says the controller OWNS it
    // (`"exports": ["NAME"]` — exported there, imported back by the SFC); anything else belongs in a shared module.
    if (spec.exports?.includes(id)) {
      carried.push({id, st, exported: true});
    } else {
      shared.push(id);
    }
  } else {
    carried.push({id, st, exported: false});
  }
}
if (shared.length > 0) {
  console.error(`cannot apply — module-level declarations of the SFC are read by BOTH the moving members and the rest: ${shared.join(', ')}\n` +
    '  move them into a module of their own first (and import them in the SFC), or list in spec.exports the ones this controller owns.');
  process.exit(1);
}
/** Where a module-level statement's OWN documentation starts: a comment a blank line away is the file's, and stays. */
function attachedStart(st) {
  const trivia = script.slice(st.getFullStart(), st.getStart(source));
  const gap = trivia.lastIndexOf('\n\n');
  return gap === -1 ? st.getFullStart() : st.getFullStart() + gap + 1;
}
const carriedText = carried.map(({st, exported}) => {
  const lead = script.slice(attachedStart(st), st.getStart(source)).replace(/^\n+/, '');
  return `${lead}${exported ? 'export ' : ''}${script.slice(st.getStart(source), st.getEnd())}`;
}).join('\n\n');
const exportedBack = carried.filter((c) => c.exported).map((c) => c.id);
const fullBody = (carriedText === '' ? '' : carriedText + '\n\n') + bodyOut;

// The controller's imports: the SFC's own, narrowed to what the moved code MENTIONS (a text match — it must not miss
// `...spread()` or `a.b`'s head) and then pruned by identifier tokens when the module is written.
const mentions = (text, id) => new RegExp(`(?<![\\w$])${id.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);
const importOut = [];
for (const decl of imports) {
  const clause = decl.importClause;
  if (clause === undefined) {
    continue;
  }
  const from = decl.moduleSpecifier.getText(source);
  const typeOnly = clause.isTypeOnly ? 'type ' : '';
  const names = [];
  let def;
  if (clause.name !== undefined && mentions(fullBody, clause.name.text)) {
    def = clause.name.text;
  }
  if (clause.namedBindings !== undefined) {
    if (ts.isNamespaceImport(clause.namedBindings)) {
      if (mentions(fullBody, clause.namedBindings.name.text)) {
        importOut.push(`import ${typeOnly}* as ${clause.namedBindings.name.text} from ${from};`);
      }
    } else {
      for (const el of clause.namedBindings.elements) {
        if (mentions(fullBody, el.name.text)) {
          names.push(el.getText(source));
        }
      }
    }
  }
  if (names.length > 0 && /\.vue['"]$/.test(from)) {
    // A `.ts` module cannot import a NAMED export of a `.vue` file: plain tsc (the production build's checker) sees
    // `*.vue` through the shim, which declares the default export only. vue-tsc would let it through — the build not.
    console.error(`cannot apply — the moving code names ${names.join(', ')} from ${from}: a type an SFC exports cannot be imported by a .ts module.\n` +
      '  Move the type into a .ts module next to the SFC (the SFC imports and re-exports it) and import it from there in the shell.');
    process.exit(1);
  }
  if (def !== undefined || names.length > 0) {
    importOut.push(`import ${typeOnly}${[def, names.length > 0 ? `{${names.join(', ')}}` : undefined].filter(Boolean).join(', ')} from ${from};`);
  }
}
for (const [from, types] of siblingImports) {
  importOut.push(`import type {${[...types].sort().join(', ')}} from '${from}';`);
}
const vueNeeds = ['ref', 'computed'].filter((n) => usesIdentifier(bodyOut, n) && !importOut.some((l) => new RegExp(`[{ ,]${n}[, }]`).test(l) && l.includes("'vue'")));
if (vueNeeds.length > 0) {
  const existing = importOut.findIndex((l) => l.endsWith("from 'vue';") && l.includes('{') && !l.startsWith('import type'));
  if (existing !== -1) {
    importOut[existing] = importOut[existing].replace('{', `{${vueNeeds.join(', ')}, `);
  } else {
    importOut.unshift(`import {${vueNeeds.join(', ')}} from 'vue';`);
  }
}

if (siblingImports.size > 0) {
  importOut.unshift(`import type {UnwrapRef} from 'vue';`);
}

const header = spec.header ?? `THE ${spec.name.toUpperCase()} CONTROLLER — taken out of ConsoleShell.vue (architecture v2).`;
const moduleText = `/*\n * @console-shared LIVE — console native stands on this file.\n *\n${header.split('\n').map((l) => (l === '' ? ' *' : ` * ${l}`)).join('\n')}\n */\n` +
  `${importOut.join('\n')}\n\n${fullBody}`;
fs.mkdirSync(path.dirname(spec.module), {recursive: true});
const prunedModule = pruneUnusedImports(moduleText).text;
fs.writeFileSync(spec.module, CRLF ? prunedModule.replace(/\n/g, '\r\n') : prunedModule);

// ── patch the SFC ───────────────────────────────────────────────────────────────────────────────────────────────────
const cuts = [];
for (const name of moving) {
  const node = members.get(name).node;
  let end = node.getEnd();
  if (script[end] === ',') {
    end++;
  }
  cuts.push({start: node.getFullStart(), end, text: ''});
}
for (const {st} of carried) {
  cuts.push({start: attachedStart(st), end: st.getEnd(), text: ''});
}
// setup(): construct the controller, spread it into what setup returns.
if (setupReturn === undefined || !ts.isObjectLiteralExpression(setupReturn.expression)) {
  throw new Error('setup() must end with `return {…}`');
}
const importPath = '@/' + spec.module.replace(/\\/g, '/').replace(/^src\//, '').replace(/\.ts$/, '');
const construct = `const ${spec.name} = ${factory}(${portLines.length === 0 ? '' : `shellPort<${portType}>()`});\n    `;
cuts.push({start: setupReturn.getStart(source), end: setupReturn.getStart(source), text: construct});
const retObj = setupReturn.expression;
cuts.push({start: retObj.getEnd() - 1, end: retObj.getEnd() - 1, text: `${retObj.properties.length > 0 ? ', ' : ''}...${spec.name}`});
// the import, after the last import of the script
const lastImport = imports[imports.length - 1];
const needsPortImport = portLines.length > 0 && !importedNames.has('shellPort');
cuts.push({
  start: lastImport.getEnd(), end: lastImport.getEnd(),
  text: `\nimport {${[factory, ...(portLines.length === 0 ? [] : [portType]), ...exportedBack].join(', ')}} from '${importPath}';` +
    (needsPortImport ? `\nimport {shellPort} from '@/client/console/shell/shellPort';` : ''),
});
// the conformance row: the shell really is what the port says (vue-tsc reads it)
if (portLines.length > 0) {
  const conform = members.get('shellPortsConform');
  if (conform === undefined) {
    throw new Error('the component needs a `shellPortsConform(): void {}` method (the ports are type-checked there)');
  }
  const bodyNode = conform.node.body;
  cuts.push({start: bodyNode.getEnd() - 1, end: bodyNode.getEnd() - 1, text: `  const ${spec.name}Port: ${portType} = this;\n      void ${spec.name}Port;\n    `});
}
cuts.sort((a, b) => b.start - a.start || b.end - a.end);
let patched = script;
for (const c of cuts) {
  patched = patched.slice(0, c.start) + c.text + patched.slice(c.end);
}
// A SERIES of applies (SHELL_EXTRACT_KEEP_IMPORTS=1) keeps the SFC's import list whole until its last step: a later
// domain's port may name a type only an earlier domain's code used. `prune <sfc>` then drops what nobody names.
const prunedShell = process.env.SHELL_EXTRACT_KEEP_IMPORTS === '1' ? {text: patched, dropped: []} : pruneUnusedImports(patched);
const out = sfc.slice(0, scriptStart) + prunedShell.text + sfc.slice(scriptEnd);
fs.writeFileSync(sfcPath, CRLF ? out.replace(/\n/g, '\r\n') : out);
console.log(`«${spec.name}»: ${exported.length} members → ${spec.module} (${prunedModule.split('\n').length} lines); port ${portLines.length}` +
  `${carried.length > 0 ? `; carried module-level: ${carried.map((c) => c.id).join(', ')}` : ''}`);
if (prunedShell.dropped.length > 0) {
  console.log(`imports the shell no longer names (dropped): ${prunedShell.dropped.length}`);
}
if (touchingWatchers.length > 0) {
  console.log(`watchers left in the shell that touch them: ${touchingWatchers.join(' · ')}`);
}
