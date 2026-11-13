// `node scripts/vapor/convert.mjs <component.vue> [--write] [--from <rev>] [--inventory <json>] [--quiet]`
// THE RECIPE BOOK, APPLIED MECHANICALLY — an Options-API component → `<script setup lang="ts">` (step A).
//
// docs/claude/vapor/RECIPES.md is written so that «two people — or a person and a codemod — produce the same file».
// This is the codemod. It reads the script through TypeScript's AST and the template through `@vue/compiler-dom`, and
// writes the script the book's § 1 describes, construct by construct:
//
//   R1  name / components / the three async-on-purpose globals      R9  hooks → onX (created → top level)
//   R2  props → defineProps (the SAME object)                       R10 $nextTick → nextTick
//   R3  emits → defineEmits (declared from the call sites if absent) R11 $refs → useTemplateRef · defineExpose
//   R4  data → one ref per field (typed off its cast)               R12 $el → a ref on the root
//   R5  computed → computed (the body keeps its shape)              R13 $slots / $attrs / inheritAttrs
//   R6  watch → watch, in the block's order, after the declarations R16 provide / inject
//   R7  methods → hoisted functions                                 R19 $t / v-i18n → imports
//   R8  setup() → the top of the script                             R24 a comment before / after the root
//   R26 vueRoot(this) → the app root's port
//
// and the house rules: a member that only hands an import to the template is deleted; a member whose body is one bare
// name is an alias; a body's local named like the member it reads takes the suffix `Now`; an import named like a
// member is aliased (`…Of`).
//
// WHAT IT DOES NOT DECIDE is printed as its REPORT (stderr, and `--report <file>`), one line per place:
//   REFUSE  — the construct has no mechanical conversion (a bare `this`, `$options`, a mixin, a render function, module
//             state, a value export, the `typedRefs` idiom…): the component is NOT written.
//   REVIEW  — converted, and a person / an agent must look: an injected value that may be a ref (R16's trap), a path
//             watcher that may need `?.`, a data field nothing reactive reads (the handle rule → `let`), a member that
//             was dropped, an import that was aliased.
// The output is then judged like any conversion: vue-tsc, eslint (`--fix` re-indents what moved), its specs, its e2e.
//
// `--from <rev>` converts the file AS IT WAS at <rev> (the corpus test: every already converted component has its
// Options form in history — the codemod's output is compared with what the wave wrote by hand).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require = createRequire(process.cwd() + '/package.json');
const ts = require('typescript');
const {parse: parseTemplate, NodeTypes} = require('@vue/compiler-dom');

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : (args[at + 1] ?? '');
};
const file = args.find((arg, i) => !arg.startsWith('--') && !['--from', '--inventory', '--report', '--out'].includes(args[i - 1]));
if (file === undefined) {
  console.error('usage: node scripts/vapor/convert.mjs <component.vue> [--write] [--from <rev>] [--inventory <json>] [--report <file>] [--out <file>]');
  process.exit(2);
}
const rel = path.relative(process.cwd(), path.resolve(file)).split(path.sep).join('/');
const source = (flag('--from') !== undefined ?
  execFileSync('git', ['show', `${flag('--from')}:${rel}`], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}) :
  fs.readFileSync(file, 'utf8')).replace(/\r\n/g, '\n');

const report = [];
const refuse = (what, node) => report.push(`REFUSE  ${what}${node !== undefined ? ` (script line ${lineOf(node)})` : ''}`);
const review = (what, node) => report.push(`REVIEW  ${what}${node !== undefined ? ` (script line ${lineOf(node)})` : ''}`);

// ───────────────────────────────────────────────────────────────── the SFC's blocks
const scriptMatch = /<script\b([^>]*)>([\s\S]*?)<\/script>/.exec(source);
if (scriptMatch === null || /\bsetup\b/.test(scriptMatch[1])) {
  console.error(`${rel}: ${scriptMatch === null ? 'no <script> block' : 'already <script setup>'}`);
  process.exit(3);
}
const script = scriptMatch[2];
const scriptStart = scriptMatch.index + scriptMatch[0].indexOf('>') + 1;
const tplOpen = source.indexOf('<template');
const tplClose = source.lastIndexOf('</template>');
const tplStart = tplOpen === -1 ? -1 : source.indexOf('>', tplOpen) + 1;
let template = tplOpen === -1 || tplClose === -1 ? '' : source.slice(tplStart, tplClose);

const sf = ts.createSourceFile('component.ts', script, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
function lineOf(node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

// A language service over the script alone: local renames and «what does this name resolve to here» need real scopes.
const service = ts.createLanguageService({
  getCompilationSettings: () => ({target: ts.ScriptTarget.ES2022, noResolve: true, noLib: true, allowNonTsExtensions: true}),
  getScriptFileNames: () => ['component.ts'],
  getScriptVersion: () => '1',
  getScriptSnapshot: (name) => (name === 'component.ts' ? ts.ScriptSnapshot.fromString(script) : undefined),
  getCurrentDirectory: () => '/',
  getDefaultLibFileName: () => 'lib.d.ts',
  fileExists: (name) => name === 'component.ts',
  readFile: (name) => (name === 'component.ts' ? script : undefined),
});
const program = service.getProgram();
const checker = program.getTypeChecker();
const psf = program.getSourceFile('component.ts');

// ───────────────────────────────────────────────────────────────── edits over the script's text
/** Replacements in the ORIGINAL script's coordinates; a text is read back with every edit inside its range applied. */
const edits = [];
function edit(start, end, text) {
  // An edit inside a wider one is the wider one's business; a wider one swallows what it contains. An INSERTION
  // (start === end) at the very edge of another edit is inside nothing — it stands beside it.
  const within = (outer, s, e) => outer.start !== outer.end && outer.start <= s && e <= outer.end && !(s === e && (s === outer.start || s === outer.end));
  if (edits.some((e) => within(e, start, end))) {
    return;
  }
  for (let i = edits.length - 1; i >= 0; i--) {
    if (within({start, end}, edits[i].start, edits[i].end)) {
      edits.splice(i, 1);
    }
  }
  edits.push({start, end, text});
}
function textOf(start, end) {
  const inside = edits.filter((e) => e.start >= start && e.end <= end).sort((a, b) => a.start - b.start || a.end - b.end);
  let out = '';
  let at = start;
  for (const e of inside) {
    if (e.start < at) {
      continue;
    }
    out += script.slice(at, e.start) + e.text;
    at = e.end;
  }
  return out + script.slice(at, end);
}
const nodeText = (node) => textOf(node.getStart(sf), node.end);

/** The line starts that stand INSIDE a multi-line template literal — their indentation is content, never re-indented. */
const literalLines = new Set();
(function walk(node) {
  if ((ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && script.slice(node.getStart(sf), node.end).includes('\n')) {
    for (let i = script.indexOf('\n', node.getStart(sf)); i !== -1 && i < node.end; i = script.indexOf('\n', i + 1)) {
      literalLines.add(i + 1);
    }
  }
  ts.forEachChild(node, walk);
})(sf);
const columnOf = (pos) => pos - (script.lastIndexOf('\n', pos - 1) + 1);
/** Take `by` columns of indentation off every line of [start, end) after its first. */
function dedent(start, end, by) {
  if (by <= 0) {
    return;
  }
  for (let i = script.indexOf('\n', start); i !== -1 && i < end; i = script.indexOf('\n', i + 1)) {
    const lineStart = i + 1;
    if (lineStart >= end || literalLines.has(lineStart)) {
      continue;
    }
    let n = 0;
    while (n < by && script[lineStart + n] === ' ') {
      n++;
    }
    if (n > 0) {
      edit(lineStart, lineStart + n, '');
    }
  }
}
/** The comments that stand right above a node (its leading trivia), re-indented to column 0; `''` when none. */
function leadOf(node) {
  const from = node.getFullStart();
  const to = node.getStart(sf);
  const trivia = script.slice(from, to);
  const first = trivia.search(/\/[/*]/);
  if (first === -1) {
    return '';
  }
  const start = from + first;
  dedent(start, to, columnOf(start));
  return textOf(start, to).replace(/[ \t]+$/, '').replace(/\n+$/, '') + '\n';
}

// ───────────────────────────────────────────────────────────────── the options object
let options;
let exportNode;
const moduleStatements = [];
for (const st of sf.statements) {
  if (ts.isExportAssignment(st)) {
    exportNode = st;
    const e = st.expression;
    options = ts.isCallExpression(e) && e.arguments.length > 0 && ts.isObjectLiteralExpression(e.arguments[0]) ? e.arguments[0] :
      ts.isObjectLiteralExpression(e) ? e : undefined;
  } else {
    moduleStatements.push(st);
  }
}
if (options === undefined) {
  console.error(`${rel}: no \`export default defineComponent({…})\` object`);
  process.exit(3);
}
const droppedStatements = new Set();
for (const st of moduleStatements) {
  if (ts.isImportDeclaration(st)) {
    continue;
  }
  if (ts.isExportDeclaration(st) && !st.isTypeOnly && st.exportClause !== undefined && ts.isNamedExports(st.exportClause) &&
    st.exportClause.elements.some((el) => !el.isTypeOnly)) {
    // `export {X};` — a re-export of a VALUE (R25): deleted when nothing imports it through the `.vue`
    const names = st.exportClause.elements.filter((el) => !el.isTypeOnly).map((el) => el.name.text);
    const base = path.basename(rel);
    const importers = [];
    const scan = (dir) => {
      for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir, {withFileTypes: true}) : []) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (/\.(?:ts|vue)$/.test(entry.name) && full.split(path.sep).join('/') !== rel) {
          const text = fs.readFileSync(full, 'utf8');
          if (new RegExp(`import\\s*(?:\\w+\\s*,\\s*)?\\{[^}]*\\b(?:${names.join('|')})\\b[^}]*\\}\\s*from\\s*'[^']*/${base.replace('.', '\\.')}'`).test(text)) {
            importers.push(full.split(path.sep).join('/'));
          }
        }
      }
    };
    scan('src');
    scan('tests');
    if (importers.length > 0) {
      refuse(`the value re-export \`${st.getText(sf)}\` is imported through the .vue by ${importers.join(', ')} — re-point them at the source module first (R25)`, st);
    } else {
      review(`DROPPED the value re-export \`${st.getText(sf)}\` — nothing imports it through the .vue (R25)`, st);
      droppedStatements.add(st);
    }
    continue;
  }
  const exported = ts.canHaveModifiers(st) && (ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const isType = ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st) || (ts.isExportDeclaration(st) && st.isTypeOnly);
  if (exported && !isType) {
    refuse('a VALUE export at module level — it moves to a sibling .ts and its importers are re-pointed (R25)', st);
  }
  // module STATE is what is WRITTEN (the inventory's own test): a `const` container nothing mutates is a table and
  // stays; a `defineAsyncComponent` wrapper carries identity (its resolved cache) and counts
  const moduleMutated = (name) => new RegExp(`\\b${name}\\b(?:\\.[\\w$]+|\\[[^\\]\\n]*\\])*\\.(?:set|add|delete|clear|push|pop|shift|unshift|splice|sort|reverse|fill)\\(|\\b${name}\\b(?:\\.[\\w$]+|\\[[^\\]\\n]*\\])+\\s*(?:=(?!=)|\\+\\+|--|[-+*/]=)`).test(script);
  const stateful = ts.isVariableStatement(st) && ((st.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    st.declarationList.declarations.some((d) => d.initializer !== undefined &&
      (/^(?:reactive\(|ref\(|shallowRef\(|defineAsyncComponent\()/.test(d.initializer.getText(sf)) ||
        (/^(?:new (?:Map|Set|WeakMap|WeakSet)\b|\[\]|\{\})/.test(d.initializer.getText(sf)) && !/^Readonly/.test(d.type?.getText(sf) ?? '') &&
          (!ts.isIdentifier(d.name) || moduleMutated(d.name.text) || /^(?:\[\]|\{\}|new (?:Map|Set|WeakMap|WeakSet)(?:<[^()]*>)?\(\))$/.test(d.initializer.getText(sf)))))));
  if (stateful) {
    refuse(`MODULE STATE (\`${st.getText(sf).split('\n')[0].slice(0, 60)}\`) — inside <script setup> it would be per instance: move it to a sibling .ts first (R25)`, st);
  }
}

const HOOK_OF = {beforeMount: 'onBeforeMount', mounted: 'onMounted', beforeUpdate: 'onBeforeUpdate', updated: 'onUpdated',
  beforeUnmount: 'onBeforeUnmount', unmounted: 'onUnmounted', errorCaptured: 'onErrorCaptured', activated: 'onActivated', deactivated: 'onDeactivated'};
const opt = {hooks: [], created: []};
for (const prop of options.properties) {
  if (ts.isSpreadAssignment(prop)) {
    refuse('a spread in the component options', prop);
    continue;
  }
  const key = prop.name.getText(sf);
  if (Object.hasOwn(HOOK_OF, key)) {
    opt.hooks.push({key, node: prop});
  } else if (key === 'created' || key === 'beforeCreate') {
    opt.created.push(prop);
  } else if (['name', 'components', 'props', 'emits', 'data', 'computed', 'methods', 'watch', 'setup', 'provide', 'inject', 'inheritAttrs', 'directives', 'expose'].includes(key)) {
    opt[key] = prop;
  } else {
    refuse(`the option «${key}» has no mechanical conversion${key === 'mixins' ? ' (R15)' : key === 'render' ? ' (R18)' : ''}`, prop);
  }
}
const initOf = (prop) => (prop !== undefined && ts.isPropertyAssignment(prop) ? prop.initializer : undefined);
const nameOfProp = (p) => (p.name === undefined ? undefined : ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name) ? p.name.text : p.name.getText(sf));

// ───────────────────────────────────────────────────────────────── what every `this.x` IS
/** name → {kind: 'prop' | 'data' | 'computed' | 'method' | 'setup' | 'inject', ref: boolean} */
const members = new Map();
const propsValue = initOf(opt.props);
if (propsValue !== undefined) {
  const names = ts.isArrayLiteralExpression(propsValue) ? propsValue.elements.map((el) => el.text) :
    ts.isObjectLiteralExpression(propsValue) ? propsValue.properties.map(nameOfProp) : [];
  for (const name of names.filter(Boolean)) {
    members.set(name, {kind: 'prop', ref: false});
  }
  if (!ts.isArrayLiteralExpression(propsValue) && !ts.isObjectLiteralExpression(propsValue)) {
    refuse('`props` is neither an object nor an array literal', opt.props);
  }
}

// data
const dataFn = opt.data === undefined ? undefined : ts.isMethodDeclaration(opt.data) ? opt.data : initOf(opt.data);
let dataObject;
let dataPreamble = [];
if (dataFn !== undefined) {
  if (ts.isArrowFunction(dataFn) && !ts.isBlock(dataFn.body)) {
    dataObject = ts.isParenthesizedExpression(dataFn.body) ? dataFn.body.expression : dataFn.body;
  } else if (dataFn.body !== undefined && ts.isBlock(dataFn.body)) {
    const ret = dataFn.body.statements.find(ts.isReturnStatement);
    dataPreamble = dataFn.body.statements.filter((st) => st !== ret);
    dataObject = ret?.expression !== undefined && ts.isParenthesizedExpression(ret.expression) ? ret.expression.expression : ret?.expression;
  }
  if (dataObject === undefined || !ts.isObjectLiteralExpression(dataObject)) {
    refuse('`data()` does not return an object literal (R4: `reactive(…)` + `toRefs` — by hand)', opt.data);
    dataObject = undefined;
  }
}
const dataFields = [];
for (const p of dataObject?.properties ?? []) {
  if (ts.isSpreadAssignment(p)) {
    refuse('a spread inside `data()`', p);
    continue;
  }
  const name = nameOfProp(p);
  dataFields.push({name, node: p, init: ts.isPropertyAssignment(p) ? p.initializer : undefined});
  members.set(name, {kind: 'data', ref: true});
}

// computed / methods
const computedProps = [];
const computedValue = initOf(opt.computed);
for (const p of computedValue !== undefined && ts.isObjectLiteralExpression(computedValue) ? computedValue.properties : []) {
  if (ts.isSpreadAssignment(p)) {
    refuse('a spread inside `computed` (a store helper?)', p);
    continue;
  }
  computedProps.push({name: nameOfProp(p), node: p});
  members.set(nameOfProp(p), {kind: 'computed', ref: true});
}
const methodProps = [];
const methodsValue = initOf(opt.methods);
for (const p of methodsValue !== undefined && ts.isObjectLiteralExpression(methodsValue) ? methodsValue.properties : []) {
  if (ts.isSpreadAssignment(p)) {
    refuse('a spread inside `methods`', p);
    continue;
  }
  methodProps.push({name: nameOfProp(p), node: p});
  members.set(nameOfProp(p), {kind: 'method', ref: false});
}

const setupHandOvers = [];
const setupGuessed = []; // returned keys whose ref-ness the initialiser does not say
let ownExpose; // the `expose({…})` statement of a setup() — the component's own contract (R8)
let setupContext = []; // what `setup(props, {…})` took of its context
// setup(): its returned keys are top-level consts; a key built by ref() / computed() is read through `.value`
const setupFn = opt.setup !== undefined && ts.isMethodDeclaration(opt.setup) ? opt.setup : undefined;
const setupReturn = setupFn?.body?.statements.find(ts.isReturnStatement);
const setupKeys = [];
if (opt.setup !== undefined) {
  if (setupFn === undefined || setupReturn?.expression === undefined || !ts.isObjectLiteralExpression(setupReturn.expression)) {
    refuse('`setup` is not a method returning an object literal', opt.setup);
  } else {
    if (setupFn.parameters.length > 1) {
      const ctx = setupFn.parameters[1].name;
      // `setup(props, {emit, expose, slots, attrs})` — each member of the context has its macro / composable
      const taken = ts.isObjectBindingPattern(ctx) ? ctx.elements.map((el) => (el.propertyName === undefined && el.dotDotDotToken === undefined ? el.name.getText(sf) : '?')) : ['?'];
      const calls = setupFn.body.statements.filter((st) => ts.isExpressionStatement(st) && ts.isCallExpression(st.expression) &&
        st.expression.expression.getText(sf) === 'expose' && st.expression.arguments.length === 1);
      const exposeOk = !taken.includes('expose') || (calls.length === 1 && (script.match(/\bexpose\(/g) ?? []).length === 1);
      if (taken.every((name) => ['emit', 'expose', 'slots', 'attrs'].includes(name)) && exposeOk) {
        if (taken.includes('expose')) {
          ownExpose = calls[0];
        }
        setupContext = taken;
      } else {
        refuse('`setup(props, context)` reads its context in a way the codemod does not know — by hand (R8)', setupFn);
      }
    }
    const isRefInit = (text) => /^(?:ref|shallowRef|computed|toRef|customRef|useTemplateRef|refAutoReset|refDebounced|refThrottled|useVModel)\s*[<(]/.test(text);
    const PLAIN = /^(?:useFlowScope|useConsoleInput|useConsoleSession|componentSessionScope|useWorkspaceBandGeometry|useConsoleNativeSurface|useAppRoot)\s*[<(]/;
    for (const p of setupReturn.expression.properties) {
      if (ts.isSpreadAssignment(p)) {
        refuse('a spread in what `setup()` returns', p);
        continue;
      }
      const name = nameOfProp(p);
      let init = ts.isPropertyAssignment(p) ? p.initializer.getText(sf) : undefined;
      if (init === undefined || init === name) {
        const decl = setupFn.body.statements.filter(ts.isVariableStatement).flatMap((st) => [...st.declarationList.declarations])
          .find((d) => ts.isIdentifier(d.name) && d.name.text === name);
        init = decl?.initializer?.getText(sf);
        // (a name taken by destructuring — `const {profile} = useConsoleViewport()` — or a function of the body is declared too)
        const bound = (n) => (ts.isIdentifier(n) ? [n.text] : n.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : bound(el.name))));
        const declaredInBody = setupFn.body.statements.some((st) => (ts.isVariableStatement(st) && st.declarationList.declarations.some((d) => bound(d.name).includes(name))) ||
          (ts.isFunctionDeclaration(st) && st.name?.text === name));
        setupKeys.push({name, node: p, declared: decl !== undefined || declaredInBody});
      } else {
        setupKeys.push({name, node: p, declared: false});
      }
      if ((init === undefined || init === name) && !setupKeys[setupKeys.length - 1].declared) {
        setupHandOvers.push(name); // decided below, once the module-level names are known
      }
      members.set(name, {kind: 'setup', ref: init !== undefined && isRefInit(init)});
      if (!(init !== undefined && (isRefInit(init) || PLAIN.test(init)))) {
        setupGuessed.push({name, node: p, init});
      }
    }
  }
}
// A key taken from a composable (`const {profile} = useConsoleViewport()`) cannot be read off its initialiser, and a
// wrong guess is SILENT where the value is only tested (`if (isTv)` is always true for a ref): one TypeScript program
// over the script — a virtual module beside the component, the project's own configuration — and the checker says
// which returned keys are refs.
if (setupKeys.length > 0 && setupReturn !== undefined) {
  const unresolved = new Set(setupGuessed.map((g) => g.name));
  try {
    const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(path.resolve('tsconfig.json'), ts.sys.readFile).config, ts.sys, process.cwd());
    const virtual = path.resolve(path.dirname(file), `__vapor_convert_${path.basename(file, '.vue')}.ts`);
    const compilerOptions = {...parsed.options, noEmit: true, incremental: false, composite: false, tsBuildInfoFile: undefined, skipLibCheck: true,
      noUnusedLocals: false, noUnusedParameters: false};
    const host = ts.createCompilerHost(compilerOptions, true);
    const same = (f) => path.resolve(f).toLowerCase() === virtual.toLowerCase();
    const base = {fileExists: host.fileExists.bind(host), readFile: host.readFile.bind(host), getSourceFile: host.getSourceFile.bind(host)};
    host.fileExists = (f) => same(f) || base.fileExists(f);
    host.readFile = (f) => (same(f) ? script : base.readFile(f));
    host.getSourceFile = (f, languageVersion, ...rest) => (same(f) ? ts.createSourceFile(f, script, languageVersion, true, ts.ScriptKind.TS) : base.getSourceFile(f, languageVersion, ...rest));
    const real = ts.createProgram([virtual, path.resolve('src', 'client', 'vue-shims.d.ts')], compilerOptions, host);
    const realChecker = real.getTypeChecker();
    const vsf = real.getSourceFile(virtual);
    const isRefType = (type) => (type.isUnion() ? type.types : [type]).some((t) => t.getProperties().some((prop) => String(prop.escapedName).startsWith('__@RefSymbol')));
    for (const key of setupKeys) {
      const token = ts.getTokenAtPosition(vsf, key.node.name.getStart(sf));
      const prop = token.parent;
      const type = realChecker.getTypeAtLocation(ts.isPropertyAssignment(prop) ? prop.initializer : token);
      const info = members.get(key.name);
      if ((type.flags & ts.TypeFlags.Any) !== 0 || info === undefined || info.kind !== 'setup') {
        continue;
      }
      info.ref = isRefType(type);
      unresolved.delete(key.name);
    }
  } catch (error) {
    review(`the types of what setup() returns could not be read (${String(error.message).slice(0, 120)})`);
  }
  for (const guess of setupGuessed) {
    if (unresolved.has(guess.name) && guess.init !== undefined && /^(?:use|ref)[A-Z]\w*\s*[<(]/.test(guess.init)) {
      review(`setup() returns «${guess.name}» = \`${guess.init.slice(0, 50)}\` and its type could not be read — if that is a ref, every script read is \`${guess.name}.value\` (the codemod read it as a plain value)`, guess.node);
    } else if (unresolved.has(guess.name) && guess.init === undefined) {
      review(`setup() returns «${guess.name}» (taken by destructuring?) and its type could not be read — check whether it is a ref`, guess.node);
    }
  }
}

// inject
const injects = [];
const injectValue = initOf(opt.inject);
if (injectValue !== undefined) {
  if (ts.isArrayLiteralExpression(injectValue)) {
    for (const el of injectValue.elements) {
      injects.push({name: el.text, key: `'${el.text}'`, fallback: 'undefined'});
    }
  } else if (ts.isObjectLiteralExpression(injectValue)) {
    for (const p of injectValue.properties) {
      const name = nameOfProp(p);
      const init = initOf(p);
      if (init !== undefined && ts.isObjectLiteralExpression(init)) {
        const from = init.properties.find((o) => nameOfProp(o) === 'from');
        const dflt = init.properties.find((o) => nameOfProp(o) === 'default');
        injects.push({name, key: from !== undefined ? initOf(from).getText(sf) : `'${name}'`, fallback: dflt !== undefined ? (initOf(dflt)?.getText(sf) ?? 'undefined') : 'undefined'});
      } else {
        injects.push({name, key: init !== undefined ? init.getText(sf) : `'${name}'`, fallback: 'undefined'});
      }
    }
  } else {
    refuse('`inject` is neither an array nor an object literal', opt.inject);
  }
  for (const entry of injects) {
    members.set(entry.name, {kind: 'inject', ref: false});
    review(`inject «${entry.name}»: the Options API UNWRAPPED a provided ref — if the provider hands a ref / a computed, every script read is \`${entry.name}.value\` and the type is \`Ref<…>\` (R16's trap)`, opt.inject);
  }
}

// ───────────────────────────────────────────────────────────────── the template
let ast;
try {
  ast = parseTemplate(template, {comments: true});
} catch (error) {
  refuse(`the template does not parse (${error.message})`);
}
const tpl = {names: new Set(), reactiveNames: new Set(), tags: new Set(), directives: new Set(), usesT: false, emits: new Set(), text: '', models: []};
if (ast !== undefined) {
  const expressions = [];
  const handlers = []; // `@event="…"` — run on an event, never read reactively
  (function walk(node) {
    if (node.type === NodeTypes.INTERPOLATION) {
      expressions.push(node.content.content ?? '');
    } else if (node.type === NodeTypes.ELEMENT) {
      tpl.tags.add(node.tag);
      for (const prop of node.props) {
        if (prop.type === NodeTypes.DIRECTIVE) {
          (prop.name === 'on' ? handlers : expressions).push(prop.exp?.content ?? '');
          if (prop.name === 'model') {
            tpl.models.push(prop.exp?.content ?? '');
          }
          if (prop.arg !== undefined && prop.arg.isStatic === false) {
            expressions.push(prop.arg.content ?? '');
          }
          if (!['if', 'else', 'else-if', 'for', 'show', 'model', 'on', 'bind', 'slot', 'html', 'text', 'once', 'memo', 'pre', 'cloak'].includes(prop.name)) {
            tpl.directives.add(prop.name);
          }
        }
      }
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  })(ast);
  for (const exp of [...expressions, ...handlers]) {
    for (const m of exp.matchAll(/(?:^|[^\w$.]|\.\.\.)([A-Za-z_$][\w$]*)/g)) {
      tpl.names.add(m[1]);
    }
    for (const m of exp.matchAll(/\$emit\(\s*['"]([^'"]+)['"]/g)) {
      tpl.emits.add(m[1]);
    }
  }
  for (const exp of expressions) {
    for (const m of exp.matchAll(/(?:^|[^\w$.]|\.\.\.)([A-Za-z_$][\w$]*)/g)) {
      tpl.reactiveNames.add(m[1]);
    }
  }
  tpl.text = [...expressions, ...handlers].join('\n');
  tpl.usesT = tpl.names.has('$t');
}

// ───────────────────────────────────────────────────────────────── names at module level, and their collisions
const moduleNames = new Map(); // name → the declaring identifier node
for (const st of moduleStatements) {
  if (ts.isImportDeclaration(st) && st.importClause !== undefined) {
    const clause = st.importClause;
    if (clause.name !== undefined) {
      moduleNames.set(clause.name.text, clause.name);
    }
    if (clause.namedBindings !== undefined && ts.isNamespaceImport(clause.namedBindings)) {
      moduleNames.set(clause.namedBindings.name.text, clause.namedBindings.name);
    } else if (clause.namedBindings !== undefined) {
      for (const el of clause.namedBindings.elements) {
        if (!el.isTypeOnly && !clause.isTypeOnly) {
          moduleNames.set(el.name.text, el.name);
        }
      }
    }
  } else if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) {
        moduleNames.set(d.name.text, d.name);
      }
    }
  } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) && st.name !== undefined) {
    moduleNames.set(st.name.text, st.name);
  }
}

/** Rename a declaration and every reference to it (the language service's own rename); `false` when it cannot. */
function rename(nameNode, to) {
  const locations = service.findRenameLocations('component.ts', nameNode.getStart(sf), false, false, {providePrefixAndSuffixTextForRename: true});
  if (locations === undefined || locations.length === 0) {
    return false;
  }
  for (const loc of locations) {
    edit(loc.textSpan.start, loc.textSpan.start + loc.textSpan.length, `${loc.prefixText ?? ''}${to}${loc.suffixText ?? ''}`);
  }
  return true;
}

/** A member whose body only hands over a module-level name: `x() { return x(…); }`, `X() { return X; }`, `{x}`, `x: x`. */
function forwardedName(p) {
  if (ts.isShorthandPropertyAssignment(p)) {
    return {name: p.name.text, bare: true};
  }
  const init = ts.isPropertyAssignment(p) ? p.initializer : undefined;
  if (init !== undefined && ts.isIdentifier(init)) {
    return {name: init.text, bare: true};
  }
  const fn = ts.isMethodDeclaration(p) ? p : init !== undefined && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? init : undefined;
  if (fn === undefined || fn.body === undefined) {
    return undefined;
  }
  const expr = ts.isBlock(fn.body) ? (fn.body.statements.length === 1 && ts.isReturnStatement(fn.body.statements[0]) ? fn.body.statements[0].expression : undefined) : fn.body;
  if (expr === undefined) {
    return undefined;
  }
  if (ts.isIdentifier(expr)) {
    return {name: expr.text, bare: true};
  }
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) &&
    expr.arguments.length === fn.parameters.length &&
    expr.arguments.every((a, i) => ts.isIdentifier(a) && ts.isIdentifier(fn.parameters[i].name) && a.text === fn.parameters[i].name.text)) {
    return {name: expr.expression.text, call: true};
  }
  return undefined;
}

const dropped = new Set(); // members that are simply deleted (the import is the template's binding)
for (const name of setupHandOvers) {
  if (moduleNames.has(name)) {
    dropped.add(name);
    members.delete(name);
  }
}
const aliases = new Map(); // member name → the module-level name it is a plain alias of
for (const {name, node} of [...computedProps, ...methodProps]) {
  const fwd = forwardedName(node);
  const isComputed = members.get(name).kind === 'computed';
  if (fwd !== undefined && moduleNames.has(fwd.name) && fwd.name === name && (fwd.bare === true || !isComputed)) {
    dropped.add(name); // the house rule: the import IS the template's binding
    members.delete(name);
  } else if (fwd !== undefined && fwd.bare === true && moduleNames.has(fwd.name) && (isComputed || !ts.isMethodDeclaration(node))) {
    aliases.set(name, fwd.name); // a VALUE handed over under another name → a plain alias
    members.set(name, {kind: 'alias', ref: false});
  }
}
const GLOBALS = new Set(['Math', 'Number', 'Date', 'JSON', 'Object', 'Array', 'String', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'console', 'Intl', 'Infinity']);
for (const {name} of [...computedProps, ...methodProps]) {
  if (GLOBALS.has(name) && members.has(name)) {
    dropped.add(name); // a member named like a global the template compiler allows was never read
    members.delete(name);
    review(`the member «${name}» is named like a global the template compiler allows — dropped (never read)`);
  }
}
// a data field that mirrors a module-level name: the same name → the import is the binding; another name and never
// written → a plain alias
const writes = new Set();
(function walk(node) {
  const target = ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment ? node.left :
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) ? node.operand : undefined;
  if (target !== undefined && ts.isPropertyAccessExpression(target) && target.expression.kind === ts.SyntaxKind.ThisKeyword) {
    writes.add(target.name.text);
  }
  ts.forEachChild(node, walk);
})(options);
for (const field of dataFields) {
  const init = field.init === undefined ? field.name : ts.isIdentifier(field.init) ? field.init.text : undefined;
  if (init !== undefined && moduleNames.has(init) && !writes.has(field.name)) {
    if (init === field.name) {
      dropped.add(field.name);
      members.delete(field.name);
    } else {
      aliases.set(field.name, init);
      members.set(field.name, {kind: 'alias', ref: false});
    }
  }
}
// an import / a module constant named like a member that STAYS: the module-level name steps aside (`…Of` / UPPER_SNAKE)
for (const [name, info] of members) {
  if (info.kind === 'prop' || !moduleNames.has(name)) {
    continue;
  }
  const decl = moduleNames.get(name);
  const isImport = ts.isImportSpecifier(decl.parent) || ts.isImportClause(decl.parent) || ts.isNamespaceImport(decl.parent);
  const to = isImport ? (name.endsWith('Of') ? `${name}Fn` : `${name}Of`) : name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
  if (isImport && ts.isImportSpecifier(decl.parent) && decl.parent.propertyName === undefined) {
    // `import {range}` → `import {range as rangeOf}` — the rename gives the prefix itself
  }
  if (rename(decl, to)) {
    moduleNames.delete(name);
    moduleNames.set(to, decl);
    review(`the ${isImport ? 'import' : 'module constant'} «${name}» is named like a member — it is now «${to}» (the member keeps the template's name)`);
  } else {
    refuse(`the module-level name «${name}» collides with a member and could not be renamed`, decl);
  }
}

// ───────────────────────────────────────────────────────────────── who reads a member from OUTSIDE the file
let inventoryEntry;
{
  let inventory;
  const given = flag('--inventory');
  try {
    if (given !== undefined && given !== '') {
      inventory = JSON.parse(fs.readFileSync(given, 'utf8'));
    } else {
      const tmp = path.join(os.tmpdir(), `vapor-inventory-${process.pid}.json`);
      execFileSync(process.execPath, [path.join('scripts', 'vapor', 'inventory.mjs'), '--json', tmp], {stdio: 'ignore'});
      inventory = JSON.parse(fs.readFileSync(tmp, 'utf8'));
      fs.unlinkSync(tmp);
    }
  } catch {
    review('the inventory could not be read — MUST EXPOSE was not written: print the sheet and add `defineExpose` by hand (R11)');
  }
  inventoryEntry = inventory?.components.find((c) => c.file === rel);
}
const exposed = (inventoryEntry?.expose ?? []).filter((name) => !name.startsWith('$'));
/** The unit specs that import this component — a member they name through `wrapper.vm` is read. */
const specText = (() => {
  const base = path.basename(rel);
  const found = [];
  const walkDir = (dir) => {
    for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir, {withFileTypes: true}) : []) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(full);
      } else if (entry.name.endsWith('.spec.ts')) {
        const text = fs.readFileSync(full, 'utf8');
        if (text.includes(`/${base}'`)) {
          found.push(text);
        }
      }
    }
  };
  walkDir(path.join('tests', 'client'));
  return found.join('\n');
})();

// ───────────────────────────────────────────────────────────────── the handle rule (R4): `ref` or `let`
// A data field nothing REACTIVE reads — not the template, not a computed, not a watcher's source, not a method any of
// those can reach, not a parent through a ref — and that is only stored (a timer id, a cancel function, a tween) is a
// plain `let`. Reads are followed through `this.method` references, so a field read by a method the template calls
// stays a ref.
const reads = new Map(); // member → the members its body names through `this`
const namesIn = (node) => {
  const found = new Set();
  (function walk(n) {
    if (ts.isPropertyAccessExpression(n) && n.expression.kind === ts.SyntaxKind.ThisKeyword) {
      found.add(n.name.text);
    }
    ts.forEachChild(n, walk);
  })(node);
  return found;
};
for (const {name, node} of [...computedProps, ...methodProps]) {
  reads.set(name, namesIn(node));
}
const reactiveRoots = new Set([...tpl.reactiveNames, ...computedProps.map((c) => c.name)]);
for (const p of initOf(opt.watch) !== undefined && ts.isObjectLiteralExpression(initOf(opt.watch)) ? initOf(opt.watch).properties : []) {
  if (!ts.isSpreadAssignment(p)) {
    reactiveRoots.add(nameOfProp(p).split('.')[0]);
  }
}
if (opt.provide !== undefined) {
  for (const name of namesIn(opt.provide)) {
    reactiveRoots.add(name);
  }
}
// `this.$watch(() => this.x, …)` sources, and whatever the hooks hand to a reactive API, are followed the cheap way:
// any member named inside an arrow that is an ARGUMENT of watch / computed / watchEffect counts as read reactively
(function walk(n) {
  if (ts.isCallExpression(n) && /(?:^|\.)(?:\$watch|watch|watchEffect|computed)$/.test(n.expression.getText(sf)) && n.arguments.length > 0) {
    for (const name of namesIn(n.arguments[0])) {
      reactiveRoots.add(name);
    }
  }
  ts.forEachChild(n, walk);
})(options);
const reactive = new Set();
const queue = [...reactiveRoots];
while (queue.length > 0) {
  const name = queue.pop();
  if (reactive.has(name)) {
    continue;
  }
  reactive.add(name);
  for (const next of reads.get(name) ?? []) {
    queue.push(next);
  }
}
/** How many times the script READS `this.<name>` (an occurrence that is not the target of a plain `=`). */
function readsOf(name) {
  let n = 0;
  (function walk(node) {
    if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword && node.name.text === name) {
      const p = node.parent;
      const plainWrite = ts.isBinaryExpression(p) && p.left === node && p.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      if (!plainWrite) {
        n++;
      }
    }
    ts.forEachChild(node, walk);
  })(options);
  return n;
}
const handles = new Set();
// …and the rule is for HANDLES — a function, a timer id, an observer, a tween, an element: a VALUE nothing reactive
// reads today (a boolean latch, a string) stays a ref. A registry (a Map / a Set) that is filled and never replaced is
// a plain `const`.
const HANDLE_TYPE = /=>|Observer\b|Tween\b|Timeline\b|Timeout\b|Element\b|Animation\b|AbortController\b|ReturnType<typeof set|gsap\./;
const registries = new Set();
for (const field of dataFields) {
  const text = field.init?.getText(sf) ?? '';
  const quiet = members.get(field.name)?.kind === 'data' && !reactive.has(field.name) && !exposed.includes(field.name) &&
    !new RegExp(`\\b${field.name}\\b`).test(specText);
  if (quiet && writes.has(field.name) && HANDLE_TYPE.test(text) && readsOf(field.name) > 0) {
    handles.add(field.name);
    members.set(field.name, {kind: 'let', ref: false});
  } else if (quiet && !writes.has(field.name) && /^(?:markRaw\()?new (?:Map|Set|WeakMap|WeakSet)\b/.test(text)) {
    registries.add(field.name);
    members.set(field.name, {kind: 'const', ref: false});
  }
}
// A field nothing ever WRITES — not the script, not the template (an assignment in a handler, a `v-model`), not a
// mutator call — and whose initialiser is a literal or a member of a module constant is a plain `const` (R4).
const constants = new Set();
const optionsText = options.getText(sf);
const mutated = (name) => {
  const path = `(?:\\.[\\w$]+|\\[[^\\]\\n]*\\])`;
  const write = new RegExp(`(?:this\\.)?\\b${name}\\b${path}+\\s*(?:=(?!=)|\\+\\+|--|[-+*/|&]=)|(?:this\\.)?\\b${name}\\b${path}*\\.(?:push|pop|shift|unshift|splice|sort|reverse|set|add|delete|clear|fill|copyWithin)\\(`);
  return write.test(optionsText.replace(new RegExp(`\\b${name}\\s*:`, 'g'), '')) || write.test(tpl.text) || new RegExp(`(?<![\\w$.])${name}\\b\\s*(?:=(?!=)|\\+\\+|--|[-+*/]=)`).test(tpl.text) ||
    tpl.models.some((m) => new RegExp(`^\\s*${name}\\b`).test(m));
};
const isConstantInit = (node) => {
  let n = node;
  while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n)) {
    n = n.expression;
  }
  if (ts.isStringLiteralLike(n) || ts.isNumericLiteral(n) || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand))) {
    return true;
  }
  if (ts.isArrayLiteralExpression(n) || ts.isObjectLiteralExpression(n)) {
    return !/\bthis\b/.test(n.getText(sf)) && !/\(/.test(n.getText(sf));
  }
  let head = n;
  while (ts.isPropertyAccessExpression(head)) {
    head = head.expression;
  }
  return n !== head && ts.isIdentifier(head) && moduleNames.has(head.text);
};
for (const field of dataFields) {
  if (members.get(field.name)?.kind === 'data' && field.init !== undefined && !writes.has(field.name) && !mutated(field.name) && isConstantInit(field.init) &&
    !new RegExp(`\\b${field.name}\\b`).test(specText)) {
    constants.add(field.name);
    members.set(field.name, {kind: 'const', ref: false});
  }
}
const autoExposed = [];
// A member NOTHING reads — not the template, not another member, not a watcher by name, not a parent through a ref,
// not a spec — is dropped and named (§ 1): as a top-level binding it would be an unused local.
{
  const everyRead = new Map(); // name → how many members OTHER than itself name it through `this`
  const count = (owner, node) => {
    for (const name of namesIn(node)) {
      if (name !== owner) {
        everyRead.set(name, (everyRead.get(name) ?? 0) + 1);
      }
    }
  };
  for (const {name, node} of [...computedProps, ...methodProps]) {
    count(name, node);
  }
  for (const node of [opt.data, opt.watch, opt.provide, opt.setup, opt.props, ...opt.created, ...opt.hooks.map((h) => h.node)].filter(Boolean)) {
    count(undefined, node);
  }
  const watchText = opt.watch?.getText(sf) ?? '';
  for (const {name} of [...computedProps, ...methodProps, ...dataFields]) {
    const info = members.get(name);
    if (info === undefined) {
      continue;
    }
    const readInside = tpl.names.has(name) || (everyRead.get(name) ?? 0) > 0 ||
      new RegExp(`['"\`]${name}['"\`]|\\b${name}\\s*[:(]`).test(watchText);
    if (readInside || exposed.includes(name)) {
      continue;
    }
    if (info.kind === 'data' || info.kind === 'let' || info.kind === 'const') {
      if (writes.has(name)) {
        review(`the data field «${name}» is WRITTEN and never read — drop it with its writes and name it in the commit (§ 1)`);
        continue;
      }
    }
    // Nothing in the file reads it. In the Options world every member was reachable through a parent's ref: where a
    // parent names a ref standing on this component (or a spec names the member) it is EXPOSED — the tool could not
    // follow the read (a surface handed to a helper, a member read a line below) — and only otherwise dropped.
    const outside = (inventoryEntry?.refLines ?? []).length > 0 || new RegExp(`\\b${name}\\b`).test(specText);
    if (outside) {
      autoExposed.push(name);
      review(`EXPOSED «${name}» — nothing in this file reads it, and a parent holds a ref on the component (or a spec names it): confirm on the sheet's parent lines, or drop it as dead (R11)`);
      continue;
    }
    dropped.add(name);
    members.delete(name);
    handles.delete(name);
    constants.delete(name);
    aliases.delete(name);
    review(`DROPPED «${name}» — nothing reads it (not the template, not the script, not a parent, not a spec): name it in the commit (§ 1)`);
  }
}

// ───────────────────────────────────────────────────────────────── `this.…` → the script-setup form
const need = {vue: new Set(), props: false, emit: false, slots: false, attrs: false, t: false, appRoot: false, rootRef: false};
const templateRefs = new Map(); // key → Set of types its casts named
const seenEmits = new Set();
function unionParts(text) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '{' || ch === '[' || ch === '<') {
      depth++;
    } else if (ch === ')' || ch === '}' || ch === ']' || (ch === '>' && text[i - 1] !== '=')) {
      depth--;
    }
    if (ch === '|' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur.trim());
  return parts.filter((part) => part !== '');
}
const typeWithout = (text, drop) => unionParts(text).filter((part) => !drop.includes(part)).join(' | ');
// The two «roots» a script may name, decided before anything is rewritten: the APP root's port (R26 — `root`) and the
// ref on the template's ROOT ELEMENT that `this.$el` becomes (R12 — `root` too, unless the port took the name: a ref
// key must never be the name of a non-ref binding).
const usesVueRoot = /\bvueRoot\(/.test(script);
const usesEl = /\bthis\.\$el\b/.test(script);
const rootTaken = members.has('root') || moduleNames.has('root');
const appRootName = rootTaken ? 'appRoot' : 'root';
let rootRefName = rootTaken || usesVueRoot ? 'rootEl' : 'root';
if (usesEl && ast !== undefined) {
  // a root that already carries a ref lends it
  const liveRoots = ast.children.filter((n) => n.type === NodeTypes.ELEMENT);
  const existing = liveRoots.length === 1 ? liveRoots[0].props.find((p) => p.type === NodeTypes.ATTRIBUTE && p.name === 'ref')?.value?.content : undefined;
  if (existing !== undefined && existing !== '') {
    rootRefName = members.has(existing) || moduleNames.has(existing) ? `${existing}El` : existing;
  }
}

/** Is the free name `name`, read at `node`, a LOCAL of the member (a parameter, a const of a body)? → its declaration. */
function localNamed(name, node) {
  const at = ts.getTokenAtPosition(psf, node.getStart(sf));
  let symbol;
  try {
    symbol = checker.resolveName(name, at, ts.SymbolFlags.Value, false);
  } catch {
    symbol = undefined;
  }
  const decl = symbol?.declarations?.[0];
  if (decl === undefined || decl.getSourceFile() !== psf) {
    return undefined;
  }
  // a declaration INSIDE the options object is a local of some member; one outside is module level (handled above)
  return decl.pos >= options.pos && decl.end <= options.end && decl.name !== undefined && ts.isIdentifier(decl.name) ? decl.name : undefined;
}
const renamedLocals = new Set();
/** The free name a rewrite is about to write must mean the top-level binding: a local of that name takes `Now`. */
function free(name, node) {
  const local = localNamed(name, node);
  if (local !== undefined && !renamedLocals.has(local.pos)) {
    renamedLocals.add(local.pos);
    if (!rename(local, `${name}Now`)) {
      refuse(`a local «${name}» shadows the member of that name and could not be renamed`, node);
    }
  }
  return name;
}

function rewriteThis(root) {
  (function walk(node) {
    // a plain `function` has a `this` of its own
    if ((ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) && node !== root) {
      let own = false;
      (function scan(n) {
        if (n.kind === ts.SyntaxKind.ThisKeyword) {
          own = true;
        }
        if (!own && !ts.isFunctionExpression(n) && !ts.isFunctionDeclaration(n) || n === node) {
          ts.forEachChild(n, scan);
        }
      })(node);
      if (own) {
        refuse('`this` inside a plain `function` — it is not the component there', node);
      }
      return;
    }
    if (ts.isTypeQueryNode(node) && /^this\.[\w$]+/.test(node.exprName.getText(sf))) {
      // `typeof this.x` in a type position: the member's own binding
      const name = /^this\.([\w$]+)/.exec(node.exprName.getText(sf))[1];
      const info = members.get(name);
      const to = info === undefined ? name : info.kind === 'prop' ? `props.${name}` : info.ref ? `${name}.value` : name;
      edit(node.exprName.getStart(sf), node.exprName.getStart(sf) + `this.${name}`.length, to);
      return;
    }
    if (node.kind === ts.SyntaxKind.ThisKeyword) {
      const parent = node.parent;
      if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
        rewriteMember(parent);
      } else if ((ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === 'vueRoot') ||
        (ts.isAsExpression(parent) && ts.isCallExpression(parent.parent) && ts.isIdentifier(parent.parent.expression) && parent.parent.expression.text === 'vueRoot')) {
        // R26 — `vueRoot(this).x` → `appRoot?.x`
        const call = ts.isCallExpression(parent) ? parent : parent.parent;
        need.appRoot = true;
        const access = call.parent;
        if (ts.isPropertyAccessExpression(access) && access.expression === call) {
          const assign = ts.isBinaryExpression(access.parent) && access.parent.left === access && access.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken ? access.parent : undefined;
          if (assign !== undefined && ts.isExpressionStatement(assign.parent)) {
            // a WRITE is guarded: with no root above the component there is nothing to write to (R26)
            const st = assign.parent;
            edit(call.getStart(sf), call.end, `if (${free(appRootName, call)} !== undefined) { ${appRootName}`);
            edit(st.end, st.end, ' }');
          } else if (assign !== undefined) {
            refuse('a WRITE to the app root inside an expression — guard it by hand (R26)', access);
          } else {
            edit(call.getStart(sf), access.name.getStart(sf), `${free(appRootName, call)}?.`);
            review(`a READ off the app root is \`T | undefined\` (no root outside the application) — give it its neutral answer (\`=== true\`, \`?? false\`) where a plain value is expected (R26)`, access);
          }
        } else {
          review('the app root handed on as a whole — `useAppRoot()` gives `AppRoot | undefined` (R26)', call);
          edit(call.getStart(sf), call.end, free(appRootName, call));
        }
      } else {
        refuse('a bare `this` (handed to a helper, aliased, destructured) — the instance has no successor', node);
      }
      return;
    }
    ts.forEachChild(node, walk);
  })(root);
}

/** Parentheses round a rewritten expression only where something reads THROUGH it (a member, a call, an operator). */
function wrap(node, text) {
  let p = node.parent;
  const through = ts.isPropertyAccessExpression(p) || ts.isElementAccessExpression(p) || ts.isNonNullExpression(p) || ts.isAsExpression(p) ||
    (ts.isCallExpression(p) && p.expression === node) || ts.isBinaryExpression(p) || ts.isPrefixUnaryExpression(p) || ts.isConditionalExpression(p) ||
    ts.isTemplateSpan(p) || ts.isSpreadElement(p) || ts.isTypeOfExpression(p) || ts.isAwaitExpression(p);
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && p.right === node) {
    return text;
  }
  return through ? `(${text})` : text;
}

// the widest expression that is still «this ref / this element, cast»: `(this.$refs.x ?? undefined) as T | undefined`
function castAround(node) {
  let cur = node;
  let type;
  for (;;) {
    const p = cur.parent;
    if (ts.isParenthesizedExpression(p)) {
      cur = p;
    } else if (ts.isBinaryExpression(p) && p.left === cur && p.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && /^(?:undefined|null)$/.test(p.right.getText(sf))) {
      cur = p;
    } else if (ts.isAsExpression(p) && p.expression === cur) {
      // `as unknown as T` — the last cast names the type
      type = p.type.getText(sf);
      cur = p;
    } else if (ts.isNonNullExpression(p)) {
      cur = p;
    } else {
      break;
    }
  }
  // never swallow the parentheses of a call's argument list or an `if (…)`: only the expression itself
  while (ts.isParenthesizedExpression(cur) && cur !== node && !ts.isAsExpression(cur.expression) && !ts.isBinaryExpression(cur.expression)) {
    cur = cur.expression;
  }
  return {node: cur, type};
}

// What each template ref was CAST to, read before anything is rewritten: the ref's `T` is decided once — the one cast,
// the intersection of several structural casts (each use named the member it needed), or the most frequent of
// several different ones (a read cast otherwise keeps a cast of its own).
const refCasts = new Map();
(function scanRefs(node) {
  if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword && node.name.text === '$refs' &&
    ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) {
    const key = node.parent.name.text;
    const list = refCasts.get(key) ?? [];
    const {type} = castAround(node.parent);
    const bare = type === undefined ? '' : typeWithout(type, ['undefined', 'null']);
    if (!['', 'unknown', 'any', 'never'].includes(bare)) {
      list.push(bare);
    }
    refCasts.set(key, list);
  }
  ts.forEachChild(node, scanRefs);
})(options);
const isStructural = (type) => /^\{[\s\S]*\}$/.test(type);
function refTypeOf(key) {
  const all = refCasts.get(key) ?? [];
  const distinct = [...new Set(all)];
  if (distinct.length <= 1) {
    return distinct[0];
  }
  if (distinct.every(isStructural)) {
    return distinct.join(' & ');
  }
  return distinct.map((type) => [type, all.filter((t) => t === type).length]).sort((x, y) => y[1] - x[1])[0][0];
}

function rewriteMember(access) {
  const name = access.name.text;
  const start = access.getStart(sf);
  if (name === '$refs') {
    const keyed = access.parent;
    if (!ts.isPropertyAccessExpression(keyed) || keyed.expression !== access) {
      refuse('`this.$refs` read as a whole or by a computed key (the `typedRefs` idiom / `$refs[name]`) — by hand (R11)', access);
      return;
    }
    const key = keyed.name.text;
    const {node, type} = castAround(keyed);
    need.vue.add('useTemplateRef');
    templateRefs.set(key, new Set(refTypeOf(key) === undefined ? [] : [refTypeOf(key)]));
    const refName = free(refConst(key), keyed);
    const whole = node.getText(sf);
    // absent, `this.$refs.x` was `undefined` (or what the code's own `?? null` made of it): the read keeps that value
    const absent = /\?\?\s*null\b/.test(whole) ? '' : ' ?? undefined';
    // read straight through `?.` the empty value needs no spelling: `x.value?.m()` is the whole of it
    const chained = (ts.isPropertyAccessExpression(node.parent) || ts.isCallExpression(node.parent) || ts.isElementAccessExpression(node.parent)) &&
      node.parent.expression === node && node.parent.questionDotToken !== undefined;
    if (type === undefined || type === 'unknown' || type === 'any') {
      edit(node.getStart(sf), node.end, `${refName}.value`);
      return;
    }
    const bare = typeWithout(type, ['undefined', 'null']);
    const optional = unionParts(type).some((part) => part === 'undefined' || part === 'null') || /\?\?\s*(?:undefined|null)/.test(whole);
    const decided = refTypeOf(key);
    const fits = bare === decided || (decided !== undefined && isStructural(bare) && decided.split(' & ').includes(bare));
    if (!fits) {
      // this read cast the ref to ANOTHER type than the one that types it: it keeps a cast of its own
      edit(node.getStart(sf), node.end, wrap(node, `${refName}.value${optional ? absent : ''} as ${bare === 'never' ? 'never' : `unknown as ${type}`}`));
    } else if (optional) {
      edit(node.getStart(sf), node.end, chained || absent === '' ? `${refName}.value` : wrap(node, `${refName}.value${absent}`));
    } else {
      edit(node.getStart(sf), node.end, wrap(node, `${refName}.value as ${bare}`));
    }
    return;
  }
  if (name === '$el') {
    const {node, type} = castAround(access);
    need.rootRef = true;
    need.vue.add('useTemplateRef');
    edit(node.getStart(sf), node.end, wrap(node, `${free(rootRefName, access)}.value as ${type !== undefined && type !== 'unknown' && type !== 'any' ? typeWithout(type, ['undefined', 'null']) : 'HTMLElement'}`));
    return;
  }
  // (a Map: a member may be named `valueOf` / `toString`, which a plain object would answer from its prototype)
  const simple = new Map(Object.entries({$emit: 'emit', $nextTick: 'nextTick', $t: '$t', $slots: 'slots', $attrs: 'attrs', $props: 'props', $watch: 'watch'})).get(name);
  if (simple !== undefined) {
    if (name === '$emit') {
      need.emit = true;
      const call = access.parent;
      if (ts.isCallExpression(call) && call.arguments.length > 0 && ts.isStringLiteralLike(call.arguments[0])) {
        seenEmits.add(call.arguments[0].text);
      }
    } else if (name === '$nextTick') {
      need.vue.add('nextTick');
    } else if (name === '$t') {
      need.t = true;
    } else if (name === '$slots') {
      need.slots = true;
      need.vue.add('useSlots');
    } else if (name === '$attrs') {
      need.attrs = true;
      need.vue.add('useAttrs');
    } else if (name === '$props') {
      need.props = true;
    } else if (name === '$watch') {
      need.vue.add('watch');
      const call = access.parent;
      if (ts.isCallExpression(call) && call.arguments.length > 0 && ts.isStringLiteralLike(call.arguments[0])) {
        review('`this.$watch` with a STRING source — write its getter (R6)', call);
      }
    }
    edit(start, access.end, free(simple, access));
    return;
  }
  if (name.startsWith('$')) {
    refuse(`\`this.${name}\` has no target (R14)`, access);
    return;
  }
  const info = members.get(name);
  if (info === undefined) {
    if (dropped.has(name)) {
      edit(start, access.end, name); // the import the dropped member forwarded
    } else {
      refuse(`\`this.${name}\` is no member of this component (a global property? a mixin?)`, access);
    }
    return;
  }
  if (info.kind === 'prop') {
    need.props = true;
    edit(start, access.end, `${free('props', access)}.${name}`);
  } else if (info.kind === 'alias' || info.kind === 'const' || info.kind === 'let') {
    edit(start, access.end, free(name, access));
  } else {
    edit(start, access.end, `${free(name, access)}${info.ref ? '.value' : ''}`);
  }
}
const refConstNames = new Map();
/** The const that holds a template ref: the key's own name, unless a member or a prop of that name stands (→ `…El`). */
function refConst(key) {
  if (!refConstNames.has(key)) {
    const clash = members.has(key) || moduleNames.has(key);
    refConstNames.set(key, clash ? `${key}El` : key);
    if (members.has(key) && members.get(key).kind !== 'prop') {
      refuse(`the template ref «${key}» is named like a member — the ref keeps the key's name, the member takes an internal one and its public name in defineExpose (R11): by hand`);
    }
  }
  return refConstNames.get(key);
}

// a `data()` local that only feeds the field of its own name IS that field from now on: later statements read the ref
for (const st of dataPreamble) {
  const decl = ts.isVariableStatement(st) && st.declarationList.declarations.length === 1 ? st.declarationList.declarations[0] : undefined;
  const field = decl !== undefined && ts.isIdentifier(decl.name) ? dataFields.find((f) => f.name === decl.name.text && (f.init === undefined || (ts.isIdentifier(f.init) && f.init.text === f.name))) : undefined;
  const info = field !== undefined ? members.get(field.name) : undefined;
  if (info !== undefined && info.ref && decl.initializer !== undefined) {
    rename(decl.name, `${field.name}.value`);
  }
}

// …and a local of the setup body that is NOT returned is hoisted to the top level with the rest: beside a prop, a
// member or a module-level name of the same name it takes the suffix `Now`.
if (setupFn?.body !== undefined) {
  const returned = new Set(setupKeys.map((k) => k.name));
  for (const st of setupFn.body.statements) {
    const names = ts.isVariableStatement(st) ? st.declarationList.declarations.map((d) => d.name).filter(ts.isIdentifier) :
      ts.isFunctionDeclaration(st) && st.name !== undefined ? [st.name] : [];
    for (const id of names) {
      if (!returned.has(id.text) && (members.has(id.text) || moduleNames.has(id.text))) {
        if (rename(id, `${id.text}Now`)) {
          review(`the setup() local «${id.text}» would stand beside a member / a prop / a module name of that name at the top level — it is «${id.text}Now» now`);
        } else {
          refuse(`the setup() local «${id.text}» collides with a member and could not be renamed`, id);
        }
      }
    }
  }
}

// every place a body can stand
if (propsValue !== undefined) {
  rewriteThis(propsValue);
}
for (const st of dataPreamble) {
  rewriteThis(st);
}
for (const field of dataFields) {
  if (field.init !== undefined) {
    rewriteThis(field.init);
  }
}
for (const {node} of [...computedProps, ...methodProps]) {
  rewriteThis(node);
}
if (setupFn !== undefined) {
  rewriteThis(setupFn);
}
for (const node of [...opt.created, ...opt.hooks.map((h) => h.node), opt.watch, opt.provide].filter(Boolean)) {
  rewriteThis(node);
}

// ───────────────────────────────────────────────────────────────── pieces of the new script
const out = [];
const blank = () => {
  if (out.length > 0 && out[out.length - 1] !== '') {
    out.push('');
  }
};
/** A function-like's text from its parameter list on: `(a: A): R { … }` — the member's own indentation taken off. */
function fnTail(fn, from) {
  dedent(from, fn.end, columnOf(fn.parent !== undefined && ts.isPropertyAssignment(fn.parent) ? fn.parent.getStart(sf) : fn.getStart(sf)));
  return textOf(from, fn.end);
}
const isAsync = (fn) => (ts.getModifiers(fn) ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
/** `(params): R => body` built from a method declaration (a computed's getter, a hook, a watcher's handler). */
function arrowOf(fn) {
  const paramsStart = fn.parameters.pos - 1; // the `(`
  const head = textOf(paramsStart, fn.body.getStart(sf)).replace(/\s+$/, '');
  dedent(fn.body.getStart(sf), fn.end, columnOf(fn.getStart(sf)));
  return `${isAsync(fn) ? 'async ' : ''}${head} => ${textOf(fn.body.getStart(sf), fn.end)}`;
}
/** A function EXPRESSION / an arrow kept as an expression (a property's initializer). */
function exprOf(node) {
  dedent(node.getStart(sf), node.end, columnOf(node.parent.getStart(sf)));
  return nodeText(node);
}

// R24 — a comment before / after the root moves into the script; R12 — the root gains its ref
let commentBlock = '';
if (ast !== undefined) {
  const roots = ast.children.filter((n) => n.type === NodeTypes.ELEMENT);
  const firstRoot = ast.children.findIndex((n) => n.type === NodeTypes.ELEMENT);
  const lastRoot = ast.children.findLastIndex((n) => n.type === NodeTypes.ELEMENT);
  const leading = ast.children.slice(0, Math.max(firstRoot, 0)).filter((n) => n.type === NodeTypes.COMMENT);
  const trailing = lastRoot === -1 ? [] : ast.children.slice(lastRoot + 1).filter((n) => n.type === NodeTypes.COMMENT);
  const between = firstRoot === -1 ? [] : ast.children.slice(firstRoot + 1, lastRoot).filter((n) => n.type === NodeTypes.COMMENT);
  // R24 — a comment BETWEEN two roots: INTO the root after it when that root is a native element (or a `<template>`
  // branch) holding elements, else into the script under a line naming the root
  const betweenBlocks = [];
  const INLINE = /^(?:span|em|strong|b|i|a|p|label|button|li|td|th|h[1-6]|small|option|textarea|pre|code)$/;
  for (const comment of [...between].sort((a, b) => b.loc.start.offset - a.loc.start.offset)) {
    const at = ast.children.indexOf(comment);
    const next = ast.children.slice(at + 1).find((n) => n.type === NodeTypes.ELEMENT);
    const isNative = next !== undefined && (next.tag === 'template' || (/^[a-z]/.test(next.tag) && !next.tag.includes('-') && !['component', 'slot', 'transition', 'transition-group', 'teleport', 'keep-alive'].includes(next.tag)));
    const first = next?.children.find((n) => !(n.type === NodeTypes.TEXT && n.content.trim() === ''));
    const holdsElements = next !== undefined && next.children.length > 0 && first !== undefined && (first.type === NodeTypes.ELEMENT || first.type === NodeTypes.COMMENT) &&
      !next.props.some((p) => p.type === NodeTypes.DIRECTIVE && (p.name === 'html' || p.name === 'text')) && !INLINE.test(next.tag) && !next.isSelfClosing;
    const text = template.slice(comment.loc.start.offset, comment.loc.end.offset);
    // cut the comment (with its own line)
    let from = comment.loc.start.offset;
    let to = comment.loc.end.offset;
    while (from > 0 && template[from - 1] === ' ') {
      from--;
    }
    if (template[to] === '\n') {
      to++;
    }
    if (isNative && holdsElements) {
      // …and stand it as the root's first child, at that child's indentation
      const openEnd = template.indexOf('>', next.loc.start.offset + next.loc.source.indexOf('>') - 0);
      const tagClose = next.loc.start.offset + next.loc.source.indexOf(first.loc.source);
      const lineStart = template.lastIndexOf('\n', tagClose - 1) + 1;
      const indent = template.slice(lineStart, tagClose).match(/^ */)[0];
      const ownIndent = (template.slice(template.lastIndexOf('\n', comment.loc.start.offset - 1) + 1, comment.loc.start.offset).match(/^ */) ?? [''])[0];
      const shifted = text.split('\n').map((line, i) => (i === 0 ? line : indent + line.slice(Math.min(ownIndent.length, line.match(/^ */)[0].length)))).join('\n');
      void openEnd;
      template = template.slice(0, from) + template.slice(to, lineStart) + `${indent}${shifted}\n` + template.slice(lineStart);
    } else {
      const lines = comment.content.replace(/^\n+|\s+$/g, '').split('\n');
      const ind = Math.min(...lines.filter((l) => l.trim() !== '').map((l) => l.match(/^ */)[0].length));
      const openTag = next === undefined ? '' : next.loc.source.slice(0, next.loc.source.indexOf('>') + 1).replace(/\s+/g, ' ');
      betweenBlocks.unshift(` * — before the root \`${openTag.length > 90 ? openTag.slice(0, 87) + '…' : openTag}\`:\n${lines.map((l) => (` * ${l.slice(Math.min(ind, l.length))}`).trimEnd()).join('\n')}`);
      template = template.slice(0, from) + template.slice(to);
    }
  }
  if (between.length > 0) {
    ast = parseTemplate(template, {comments: true});
  }
  const liveFirst = ast.children.findIndex((n) => n.type === NodeTypes.ELEMENT);
  const liveLast = ast.children.findLastIndex((n) => n.type === NodeTypes.ELEMENT);
  const leadingNow = ast.children.slice(0, Math.max(liveFirst, 0)).filter((n) => n.type === NodeTypes.COMMENT);
  const trailingNow = liveLast === -1 ? [] : ast.children.slice(liveLast + 1).filter((n) => n.type === NodeTypes.COMMENT);
  const asBlock = (nodes) => nodes.map((n) => {
    const lines = n.content.replace(/^\n+|\s+$/g, '').split('\n');
    const indent = Math.min(...lines.filter((l) => l.trim() !== '').map((l) => l.match(/^ */)[0].length));
    return lines.map((l) => (` * ${l.slice(Math.min(indent, l.length))}`).trimEnd()).join('\n');
  }).join('\n *\n');
  const parts = [];
  if (leadingNow.length > 0) {
    parts.push(`${asBlock(leadingNow)}\n *\n * (This comment opened the template; the template starts with its root now.)`);
  }
  if (betweenBlocks.length > 0) {
    parts.push(`${betweenBlocks.join('\n *\n')}\n *\n * (These comments stood between the template's roots; each names the root it stood before.)`);
  }
  if (trailingNow.length > 0) {
    parts.push(`${asBlock(trailingNow)}\n *\n * (This comment closed the template, after its root; the template ends with that root now.)`);
  }
  if (parts.length > 0) {
    commentBlock = `/*\n${parts.join('\n *\n')}\n */\n`;
    // cut them out of the template, back to front
    for (const n of [...leadingNow, ...trailingNow].sort((a, b) => b.loc.start.offset - a.loc.start.offset)) {
      let from = n.loc.start.offset;
      let to = n.loc.end.offset;
      while (from > 0 && template[from - 1] === ' ') {
        from--;
      }
      if (template[to] === '\n') {
        to++;
      }
      template = template.slice(0, from) + template.slice(to);
    }
    ast = parseTemplate(template, {comments: true});
  }
  if (need.rootRef) {
    const liveRoots = ast.children.filter((n) => n.type === NodeTypes.ELEMENT);
    const root = liveRoots[0];
    const native = root !== undefined && liveRoots.length === 1 && /^[a-z]/.test(root.tag) && !root.tag.includes('-') && !['template', 'component', 'slot', 'transition', 'teleport'].includes(root.tag);
    if (!native) {
      refuse('`this.$el` and the template has no single native root to stand a ref on (R12) — by hand');
    } else {
      const existing = root.props.find((p) => p.type === NodeTypes.ATTRIBUTE && p.name === 'ref');
      if (existing !== undefined) {
        // the root's own ref serves (its const was named when the names were decided)
        const key = existing.value?.content ?? '';
        if (!templateRefs.has(key)) {
          refConstNames.set(key, rootRefName);
          templateRefs.set(key, new Set(['HTMLElement']));
        }
        need.rootRef = false;
      } else {
        const at = root.loc.start.offset + 1 + root.tag.length;
        template = `${template.slice(0, at)} ref="${rootRefName}"${template.slice(at)}`;
      }
    }
  }
  if (roots.length === 0) {
    review('the template has no root element');
  }
}

// ── data
const dataLines = [];
// the types a `data(): T` annotation gave the fields (T — a type alias / an interface of this file)
const annotated = new Map();
if (dataFn?.type !== undefined && ts.isTypeReferenceNode(dataFn.type) && ts.isIdentifier(dataFn.type.typeName)) {
  const typeName = dataFn.type.typeName.text;
  const decl = moduleStatements.find((st) => (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) && st.name.text === typeName);
  const fieldsOf = decl === undefined ? [] : ts.isInterfaceDeclaration(decl) ? decl.members : ts.isTypeLiteralNode(decl.type) ? decl.type.members : [];
  for (const m of fieldsOf) {
    if (ts.isPropertySignature(m) && m.type !== undefined) {
      annotated.set(m.name.getText(sf), m.type.getText(sf) + (m.questionToken !== undefined ? ' | undefined' : ''));
    }
  }
  if (decl === undefined) {
    review(`\`data(): ${typeName}\` — the type is not declared in this file: give each ref the type its initialiser does not carry (R4)`, dataFn);
  }
}
/** A ref spells its type where the initialiser alone would not give it (R4). */
const typeFor = (name, value, cast) => cast ?? (annotated.has(name) && (/^(?:undefined|null|\[\]|\{\})$/.test(value) || annotated.get(name).includes('|')) ? annotated.get(name) : undefined);
function fieldLine(field, lead, initNode, declaredType) {
  let init = initNode;
  let type = declaredType;
  while (ts.isParenthesizedExpression(init)) {
    init = init.expression;
  }
  if (ts.isAsExpression(init)) {
    // `undefined as X | undefined` TYPES an empty value: the type moves to the ref's generic. A cast of a real
    // expression (`prefs().lang as LANGUAGE`) narrows it: it stays where it is.
    let inner = init.expression;
    while (ts.isAsExpression(inner) || ts.isParenthesizedExpression(inner)) {
      inner = inner.expression; // `x as unknown as T`
    }
    const empty = /^(?:undefined|null|\[\]|\{\}|''|""|0|false|true|new (?:Map|Set|WeakMap|WeakSet)(?:<[^()]*>)?\(\))$/.test(inner.getText(sf));
    if (empty) {
      type = init.type.getText(sf);
      init = inner;
    }
  }
  dedent(init.getStart(sf), init.end, columnOf((initNode === field.init ? field.node : initNode.parent).getStart(sf)));
  const value = nodeText(init);
  type = typeFor(field.name, value, type);
  if (handles.has(field.name)) {
    // the handle rule: nothing reactive reads it — a plain `let` at the field's place
    review(`the data field «${field.name}» is a HANDLE (nothing reactive reads it — R4): a plain \`let\`; make it a ref if a spec or a parent reads it`);
    return `${lead}let ${field.name}${type !== undefined ? `: ${type}` : ''}${value === 'undefined' && type !== undefined ? '' : ` = ${value}`};`;
  }
  if (constants.has(field.name) || registries.has(field.name)) {
    return `${lead}const ${field.name}${type !== undefined ? `: ${type}` : ''} = ${value};`;
  }
  need.vue.add('ref');
  return `${lead}const ${field.name} = ref${type !== undefined ? `<${type}>` : ''}(${value});`;
}
if (dataFn !== undefined && dataObject !== undefined) {
  const emitted = new Set();
  // statements before the `return`: a local that only FEEDS the field of its own name becomes that field's ref
  for (const st of dataPreamble) {
    const decl = ts.isVariableStatement(st) && st.declarationList.declarations.length === 1 ? st.declarationList.declarations[0] : undefined;
    const field = decl !== undefined && ts.isIdentifier(decl.name) ? dataFields.find((f) => f.name === decl.name.text && (f.init === undefined || (ts.isIdentifier(f.init) && f.init.text === f.name))) : undefined;
    if (field !== undefined && decl.initializer !== undefined && !dropped.has(field.name) && !aliases.has(field.name)) {
      dataLines.push(fieldLine(field, leadOf(st), decl.initializer, decl.type?.getText(sf)));
      emitted.add(field.name);
    } else {
      const lead = leadOf(st);
      dedent(st.getStart(sf), st.end, columnOf(st.getStart(sf)));
      dataLines.push(`${lead}${nodeText(st)}`);
      review('`data()` ran a statement before its `return` — it stands at the top level now; a guard that throws is REPORTED by Vue, not thrown through the parent\'s patch (R4)', st);
    }
  }
  for (const field of dataFields) {
    if (emitted.has(field.name) || dropped.has(field.name)) {
      continue;
    }
    const lead = leadOf(field.node);
    if (aliases.has(field.name)) {
      dataLines.push(`${lead}const ${field.name} = ${aliases.get(field.name)};`);
    } else if (field.init === undefined) {
      need.vue.add('ref');
      dataLines.push(`${lead}const ${field.name} = ref(${field.name});`);
      review(`the data field «${field.name}» is a shorthand of a local the codemod did not find`, field.node);
    } else {
      dataLines.push(fieldLine(field, lead, field.init, undefined));
    }
  }
}

// ── computed
const computedLines = [];
for (const {name, node} of computedProps) {
  const lead = leadOf(node);
  if (dropped.has(name)) {
    continue;
  }
  if (aliases.has(name)) {
    computedLines.push(`${lead}const ${name} = ${aliases.get(name)};`);
    continue;
  }
  need.vue.add('computed');
  const init = initOf(node);
  if (ts.isMethodDeclaration(node)) {
    computedLines.push(`${lead}const ${name} = computed(${arrowOf(node)});`);
  } else if (init !== undefined && ts.isObjectLiteralExpression(init)) {
    const parts = [];
    for (const half of init.properties) {
      const key = nameOfProp(half);
      if (ts.isMethodDeclaration(half)) {
        parts.push(`  ${key}: ${arrowOf(half).replace(/\n/g, '\n  ')},`);
      } else {
        parts.push(`  ${key}: ${nodeText(initOf(half))},`);
      }
    }
    computedLines.push(`${lead}const ${name} = computed({\n${parts.join('\n')}\n});`);
  } else if (init !== undefined && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
    computedLines.push(`${lead}const ${name} = computed(${exprOf(init)});`);
  } else {
    refuse(`the computed «${name}» has a shape the codemod does not know`, node);
  }
}

// ── methods
const methodLines = [];
for (const {name, node} of methodProps) {
  const lead = leadOf(node);
  if (dropped.has(name)) {
    continue;
  }
  if (aliases.has(name)) {
    methodLines.push(`${lead}const ${name} = ${aliases.get(name)};`);
    continue;
  }
  if (ts.isMethodDeclaration(node)) {
    methodLines.push(`${lead}${isAsync(node) ? 'async ' : ''}function${node.asteriskToken !== undefined ? '*' : ''} ${name}${fnTail(node, node.name.end)}`);
  } else if (ts.isShorthandPropertyAssignment(node)) {
    refuse(`the method «${name}» is a shorthand of something that is not module level`, node);
  } else {
    const init = initOf(node);
    methodLines.push(`${lead}const ${name} = ${exprOf(init)};`);
  }
}

// ── setup()
let ownExposeLead = '';
let ownExposeText;
const setupLines = [];
if (setupFn !== undefined && setupReturn !== undefined) {
  const body = setupFn.body.statements.filter((st) => st !== setupReturn);
  if (setupContext.includes('emit')) {
    need.emit = true;
  }
  if (setupContext.includes('slots')) {
    need.slots = true;
    need.vue.add('useSlots');
  }
  if (setupContext.includes('attrs')) {
    need.attrs = true;
    need.vue.add('useAttrs');
  }
  if (ownExpose !== undefined) {
    // the statement leaves the body (its comment travels to the defineExpose line)
    ownExposeLead = leadOf(ownExpose);
    dedent(ownExpose.expression.arguments[0].getStart(sf), ownExpose.expression.arguments[0].end, columnOf(ownExpose.getStart(sf)));
    ownExposeText = nodeText(ownExpose.expression.arguments[0]);
  }
  if (setupFn.parameters.length >= 1) {
    const param = setupFn.parameters[0].name.getText(sf);
    if (param !== 'props' && !param.startsWith('_')) {
      review(`\`setup(${param})\` named its props «${param}» — the script's binding is \`props\``, setupFn);
    }
    if (new RegExp(`\\b${param.replace(/\$/g, '\\$')}\\b`).test(setupFn.body.getText(sf))) {
      need.props = true;
    }
  }
  const bindingNames = (name) => (ts.isIdentifier(name) ? [name.text] : name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : bindingNames(el.name))));
  let prev;
  for (const st of body) {
    if (st === ownExpose) {
      continue;
    }
    // a blank line that stood between two statements stays
    const gap = prev === undefined ? '' : script.slice(prev.end, st.getStart(sf)).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    const lead = leadOf(st);
    dedent(st.getStart(sf), st.end, columnOf(st.getStart(sf)));
    setupLines.push({
      text: `${/\n[ \t]*\n/.test(gap) ? '\n' : ''}${lead}${nodeText(st)}`,
      // a declaration with no side effect of its own may go when nothing names what it declares
      names: ts.isVariableStatement(st) ? st.declarationList.declarations.flatMap((d) => bindingNames(d.name)) : [],
    });
    prev = st;
  }
  for (const key of setupKeys) {
    const init = ts.isPropertyAssignment(key.node) ? key.node.initializer : undefined;
    if (init !== undefined && !(ts.isIdentifier(init) && init.text === key.name)) {
      dedent(init.getStart(sf), init.end, columnOf(key.node.getStart(sf)));
      setupLines.push({text: `${leadOf(key.node)}const ${key.name} = ${nodeText(init)};`, names: [key.name]});
    } else if (!key.declared && !moduleNames.has(key.name)) {
      review(`setup() returns «${key.name}» and the codemod found no declaration of it`, key.node);
    }
  }
}

// ── provide
const provideLines = [];
if (opt.provide !== undefined) {
  const fn = ts.isMethodDeclaration(opt.provide) ? opt.provide : initOf(opt.provide);
  const ret = fn !== undefined && fn.body !== undefined && ts.isBlock(fn.body) ? fn.body.statements.find(ts.isReturnStatement)?.expression :
    fn !== undefined && ts.isObjectLiteralExpression(fn) ? fn : undefined;
  if (ret === undefined || !ts.isObjectLiteralExpression(ret) || (fn.body !== undefined && ts.isBlock(fn.body) && fn.body.statements.length > 1)) {
    refuse('`provide` is not a plain `return {…}` — by hand (R16)', opt.provide);
  } else {
    need.vue.add('provide');
    for (const p of ret.properties) {
      const key = ts.isComputedPropertyName(p.name) ? nodeText(p.name.expression) : `'${nameOfProp(p)}'`;
      provideLines.push(`provide(${key}, ${ts.isPropertyAssignment(p) ? nodeText(p.initializer) : nameOfProp(p)});`);
    }
    review('`provide` — what is handed down is the VALUE read once, as the Options API did; hand a ref / a computed where the children must follow it (R16)', opt.provide);
  }
}

// ── created / beforeCreate — their bodies, at the top level
const createdLines = [];
for (const node of opt.created) {
  const fn = ts.isMethodDeclaration(node) ? node : initOf(node);
  const body = fn?.body !== undefined && ts.isBlock(fn.body) ? fn.body.statements : [];
  if (isAsync(fn)) {
    review(`\`${nameOfProp(node)}\` is async — its body stands at the top level in an async IIFE`, node);
  }
  if (body.length > 0) {
    const lead = leadOf(node) + leadOf(body[0]);
    dedent(body[0].getStart(sf), body[body.length - 1].end, columnOf(body[0].getStart(sf)));
    const text = textOf(body[0].getStart(sf), body[body.length - 1].end);
    createdLines.push(isAsync(fn) ? `${lead}void (async () => {\n  ${text.replace(/\n/g, '\n  ')}\n})();` : `${lead}${text}`);
  }
}

// ── watch — in the block's order
const watchLines = [];
const watchValue = initOf(opt.watch);
function sourceOf(key, node) {
  const [head, ...rest] = key.split('.');
  const info = members.get(head);
  // the Options path getter tolerated a hole at every hop — every hop after the first is `?.`
  const tail = rest.length > 0 ? `.${rest.join('?.')}` : '';
  if (info === undefined) {
    if (dropped.has(head) || moduleNames.has(head)) {
      return `() => ${head}${tail}`;
    }
    refuse(`the watcher «${key}» watches something that is no member`, node);
    return `() => ${key}`;
  }
  if (info.kind === 'prop') {
    need.props = true;
    return `() => props.${head}${tail}`;
  }
  if (info.kind === 'alias') {
    return `() => ${aliases.get(head)}${tail}`;
  }
  return `() => ${head}${info.ref ? '.value' : ''}${tail}`;
}
function handlerOf(node) {
  // a method, a function expression / an arrow, or the NAME of a method
  if (ts.isMethodDeclaration(node)) {
    return arrowOf(node);
  }
  const init = ts.isPropertyAssignment(node) ? node.initializer : node;
  if (ts.isStringLiteralLike(init)) {
    return init.text;
  }
  if (ts.isFunctionExpression(init)) {
    const paramsStart = init.parameters.pos - 1;
    const head = textOf(paramsStart, init.body.getStart(sf)).replace(/\s+$/, '');
    dedent(init.body.getStart(sf), init.end, columnOf(node.getStart(sf)));
    return `${isAsync(init) ? 'async ' : ''}${head} => ${textOf(init.body.getStart(sf), init.end)}`;
  }
  return exprOf(init);
}
for (const p of watchValue !== undefined && ts.isObjectLiteralExpression(watchValue) ? watchValue.properties : []) {
  if (ts.isSpreadAssignment(p)) {
    refuse('a spread inside `watch`', p);
    continue;
  }
  need.vue.add('watch');
  const key = nameOfProp(p);
  const lead = leadOf(p);
  const init = initOf(p);
  if (init !== undefined && ts.isObjectLiteralExpression(init)) {
    const handler = init.properties.find((o) => nameOfProp(o) === 'handler');
    const others = init.properties.filter((o) => o !== handler);
    if (handler === undefined) {
      refuse(`the watcher «${key}» has no handler`, p);
      continue;
    }
    const optionsText = others.map((o) => nodeText(o)).join(', ');
    watchLines.push(`${lead}watch(${sourceOf(key, p)}, ${handlerOf(handler)}${optionsText !== '' ? `, {${optionsText}}` : ''});`);
  } else if (init !== undefined && ts.isArrayLiteralExpression(init)) {
    for (const el of init.elements) {
      watchLines.push(`${lead}watch(${sourceOf(key, p)}, ${handlerOf(el)});`);
    }
  } else {
    watchLines.push(`${lead}watch(${sourceOf(key, p)}, ${handlerOf(p)});`);
  }
}

// ── hooks, in the file's order
const hookLines = [];
for (const {key, node} of opt.hooks) {
  need.vue.add(HOOK_OF[key]);
  const lead = leadOf(node);
  const fn = ts.isMethodDeclaration(node) ? node : initOf(node);
  hookLines.push(`${lead}${HOOK_OF[key]}(${ts.isMethodDeclaration(fn) ? arrowOf(fn) : exprOf(fn)});`);
}

// ── defineExpose — what the parents read through a ref (the inventory's audit names it)
let exposeLine = '';
if (ownExposeText !== undefined) {
  // its own `expose({…})` is the contract — exactly that list, whatever a parent reads (R8)
  exposeLine = `${ownExposeLead}defineExpose(${ownExposeText});`;
} else if (exposed.length + autoExposed.length > 0) {
  exposeLine = `defineExpose({${[...exposed, ...autoExposed].join(', ')}});`;
  for (const name of exposed.filter((n) => !members.has(n) && !dropped.has(n))) {
    refuse(`MUST EXPOSE names «${name}», which is no member`);
  }
}
if (exposed.length + autoExposed.length === 0 && ownExposeText === undefined && (inventoryEntry?.refLines ?? []).length > 0) {
  const lines = inventoryEntry.refLines;
  review(`${lines.length} parent line(s) name a ref standing on this component and the tool followed none to a member — read them on the sheet, they decide defineExpose (first: ${lines[0].slice(0, 110)})`);
}

// ── the macros
const macroLines = [];
{
  const nameInit = initOf(opt.name);
  const inherit = initOf(opt.inheritAttrs);
  const parts = [nameInit !== undefined ? `name: ${nameInit.getText(sf)}` : undefined, inherit !== undefined ? `inheritAttrs: ${inherit.getText(sf)}` : undefined].filter(Boolean);
  if (parts.length > 0) {
    macroLines.push(`${opt.name !== undefined ? leadOf(opt.name) : ''}${opt.inheritAttrs !== undefined ? leadOf(opt.inheritAttrs) : ''}defineOptions({${parts.join(', ')}});`);
  }
  if (propsValue !== undefined) {
    dedent(propsValue.getStart(sf), propsValue.end, columnOf(opt.props.getStart(sf)));
    macroLines.push(`${leadOf(opt.props)}${need.props ? 'const props = ' : ''}defineProps(${nodeText(propsValue)});`);
  } else if (need.props) {
    refuse('the script reads `props` and the component declares none');
  }
  const emitsValue = initOf(opt.emits);
  if (emitsValue !== undefined) {
    dedent(emitsValue.getStart(sf), emitsValue.end, columnOf(opt.emits.getStart(sf)));
    macroLines.push(`${leadOf(opt.emits)}${need.emit ? 'const emit = ' : ''}defineEmits(${nodeText(emitsValue)});`);
  } else if (need.emit || tpl.emits.size > 0) {
    const names = [...new Set([...seenEmits, ...tpl.emits])].sort();
    macroLines.push(`${need.emit ? 'const emit = ' : ''}defineEmits([${names.map((n) => `'${n}'`).join(', ')}]);`);
    review(`the component declared no \`emits\` — declared from its call sites: ${names.join(', ')} (R3)`);
  }
  if (need.slots) {
    macroLines.push('const slots = useSlots();');
  }
  if (need.attrs) {
    macroLines.push('const attrs = useAttrs();');
  }
  for (const entry of injects) {
    need.vue.add('inject');
    macroLines.push(`const ${entry.name} = inject(${entry.key}, ${entry.fallback});`);
  }
}

// ── imports: what the Options API got from the app is imported now
const importLines = [];
const DIRECTIVES = {'i18n': 'vI18n', 'trim-whitespace': 'vTrimWhitespace', 'embed-zone': 'vEmbedZone', 'strip-action-prefix': 'vStripActionPrefix', 'strip-effect-prefix': 'vStripEffectPrefix'};
const ASYNC = {'premium-card-face': 'PremiumCardFace', 'PremiumCardFace': 'PremiumCardFace', 'action-target-card': 'ActionTargetCard', 'ActionTargetCard': 'ActionTargetCard', 'console-source-dock': 'ConsoleSourceDock', 'ConsoleSourceDock': 'ConsoleSourceDock'};
const directiveImports = [...tpl.directives].map((d) => {
  if (!Object.hasOwn(DIRECTIVES, d)) {
    refuse(`the template uses the directive v-${d}, which has no dual binding in directives/vDirectives.ts (R17)`);
    return undefined;
  }
  return DIRECTIVES[d];
}).filter(Boolean).sort();
const asyncImports = [...new Set([...tpl.tags].filter((t) => Object.hasOwn(ASYNC, t) && !moduleNames.has(ASYNC[t])).map((t) => ASYNC[t]))].sort();
if (tpl.usesT) {
  need.t = true;
}
if (moduleNames.has('$t')) {
  need.t = false; // the script already imports it (the hand-over member `methods: {$t}` is gone, the import is the binding)
}
// a registration under ANOTHER name (`components: {Card: CardFace}`) — the import takes the registered name
const componentsValue = initOf(opt.components);
for (const p of componentsValue !== undefined && ts.isObjectLiteralExpression(componentsValue) ? componentsValue.properties : []) {
  const init = initOf(p);
  const key = nameOfProp(p);
  const pascal = key.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  if (init !== undefined && ts.isIdentifier(init) && init.text !== key && init.text !== pascal) {
    const decl = moduleNames.get(init.text);
    if (moduleNames.has(pascal) || moduleNames.has(key)) {
      refuse(`the component is registered as «${key}» and the script already has a binding of that name (an enum? a helper?) — in <script setup> the template's <${key}> would resolve to THAT: alias the other import in the Options form first`, p);
    } else if (decl !== undefined && rename(decl, pascal)) {
      review(`the component registered as «${key}» was imported as «${init.text}» — the import is «${pascal}» now (R1)`, p);
    } else {
      refuse(`the component registered as «${key}» (${init.getText(sf)}) could not be re-imported under that name`, p);
    }
  } else if (init !== undefined && !ts.isIdentifier(init)) {
    refuse(`the component «${key}» is registered from an expression (an async component?) — by hand (R1)`, p);
  }
}

// ───────────────────────────────────────────────────────────────── assemble
let headComment = '';
let vueLead = '';
const moduleLines = [];
for (const st of moduleStatements) {
  if (droppedStatements.has(st)) {
    continue;
  }
  const lead = leadOf(st);
  if (ts.isImportDeclaration(st)) {
    const from = st.moduleSpecifier.text;
    let text = nodeText(st);
    if (from === 'vue') {
      vueLead += lead; // the import is rebuilt below; what stood above it (the file's header comment) stays
      continue;
    }
    if (from === '@/client/directives/i18n' && need.t) {
      if (!/\$t\b/.test(text)) {
        text = text.replace(/\{\s*/, '{$t, ');
      }
      need.t = false;
    }
    // a directive imported in its Options form (an object of hooks) is replaced by the dual binding
    const named = st.importClause?.namedBindings;
    if (named !== undefined && ts.isNamedImports(named) && named.elements.some((el) => directiveImports.includes(el.name.text)) && from !== '@/client/directives/vDirectives') {
      const keep = named.elements.filter((el) => !directiveImports.includes(el.name.text)).map((el) => el.getText(sf));
      if (keep.length === 0 && st.importClause.name === undefined) {
        continue;
      }
      text = text.replace(/\{[^}]*\}/, `{${keep.join(', ')}}`);
    }
    importLines.push(`${lead}${text}`);
  } else {
    moduleLines.push(`${lead}${nodeText(st)}`);
  }
}
// the header comment that stood above `export default`
headComment = leadOf(exportNode);

const refLines = [];
for (const [key, types] of templateRefs) {
  const list = [...types].filter((t) => t !== '');
  const casts = [...new Set(refCasts.get(key) ?? [])];
  if (casts.length > 1 && !casts.every(isStructural)) {
    review(`the template ref «${key}» was cast to ${casts.length} types (${casts.join(' · ')}) — the most frequent one types it, the other reads keep a cast of their own (R11)`);
  }
  refLines.push(`const ${refConst(key)} = useTemplateRef${list.length > 0 ? `<${list[0]}>` : ''}('${key}');`);
}
if (need.rootRef) {
  refLines.push(`const ${rootRefName} = useTemplateRef<HTMLElement>('${rootRefName}');`);
}

// the vue import: what the file had (minus defineComponent), plus what the script now calls
const vueNames = new Set();
for (const st of moduleStatements) {
  if (ts.isImportDeclaration(st) && st.moduleSpecifier.text === 'vue' && st.importClause?.namedBindings !== undefined && ts.isNamedImports(st.importClause.namedBindings)) {
    for (const el of st.importClause.namedBindings.elements) {
      vueNames.add(el.getText(sf));
    }
  }
}
vueNames.delete('defineComponent');
for (const name of need.vue) {
  vueNames.add(name);
}

const body = [];
const push = (lines) => {
  if (lines.length > 0) {
    if (body.length > 0) {
      body.push('');
    }
    body.push(...lines);
  }
};
push([...macroLines]);
const afterMacros = body.length;
function buildBody() {
  body.length = afterMacros;
  push([...(need.appRoot ? [`const ${appRootName} = useAppRoot();`] : []), ...setupLines.map((part) => part.text), ...refLines, ...dataLines]);
  push(computedLines);
  push(methodLines);
  push(provideLines);
  // the Options API created the watchers (the `immediate` ones fire) BEFORE it called `created()`
  push(watchLines);
  push(createdLines);
  push([...hookLines, ...(exposeLine !== '' ? [exposeLine] : [])]);
  return body.join('\n');
}
let bodyText = buildBody();
// A drop CASCADES (§ 1): a setup() declaration whose names nothing reads any more — only a dropped member did — goes
// with it. (Tested against the code with that one statement taken out; repeated until nothing more falls.)
for (let changed = true; changed;) {
  changed = false;
  for (let i = setupLines.length - 1; i >= 0; i--) {
    const part = setupLines[i];
    if (part.names.length === 0) {
      continue;
    }
    const others = setupLines.filter((_, j) => j !== i).map((x) => x.text).join('\n');
    const rest = `${bodyText.replace(part.text, '')}\n${others}`.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    const named = (name) => new RegExp(`(?:^|[^\\w$.]|\\.\\.\\.)${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'm').test(rest) || tpl.names.has(name) ||
      exposed.includes(name) || new RegExp(`\\b${name}\\b`).test(specText);
    if (!part.names.some(named)) {
      review(`DROPPED the setup() declaration of «${part.names.join(', ')}» — only a dropped member read it (the cascade of § 1)`);
      setupLines.splice(i, 1);
      bodyText = buildBody();
      changed = true;
    }
  }
}

// a local TYPE nothing names any more (it only annotated `data(): T`) is dropped — § 1
for (let i = moduleLines.length - 1; i >= 0; i--) {
  const m = /^(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\n)*(?:type|interface)\s+(\w+)\b/.exec(moduleLines[i]);
  if (m !== null && !new RegExp(`\\b${m[1]}\\b`).test(`${bodyText}\n${moduleLines.filter((_, j) => j !== i).join('\n')}`)) {
    review(`DROPPED the type «${m[1]}» — nothing names it any more: name it in the commit (§ 1)`);
    moduleLines.splice(i, 1);
  }
}
// R21 — `<component :is>` fed a STRING that names a component resolved through the `components:` registration
if (tpl.tags.has('component')) {
  const named = [...moduleNames.keys()].filter((name) => /^[A-Z]/.test(name) && new RegExp(`['"\`]${name}['"\`]`).test(`${bodyText}\n${moduleLines.join('\n')}`));
  if (named.length > 0) {
    review(`\`<component :is>\` may be fed a STRING naming ${named.join(', ')} — <script setup> registers nothing by name: the table maps to the imported components (R21)`);
  }
}
// prune: the vue names nothing calls, the imports nothing names any more
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const usageText = () => codeOnly(`${bodyText}\n${moduleLines.join('\n')}`);
const used = (name) => new RegExp(`(?:^|[^\\w$.]|\\.\\.\\.)${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'm').test(usageText()) || tpl.names.has(name);
const vueList = [...vueNames].filter((spec) => {
  const local = spec.split(/\s+as\s+/).pop().replace(/^type\s+/, '');
  return used(local);
}).sort((a, b) => a.replace(/^type\s+/, '').localeCompare(b.replace(/^type\s+/, '')));
const extraImports = [];
if (vueList.length > 0) {
  extraImports.push(`import {${vueList.join(', ')}} from 'vue';`);
}
if (need.t) {
  extraImports.push('import {$t} from \'@/client/directives/i18n\';');
}
if (directiveImports.length > 0) {
  extraImports.push(`import {${directiveImports.join(', ')}} from '@/client/directives/vDirectives';`);
}
if (asyncImports.length > 0) {
  extraImports.push(`import {${asyncImports.join(', ')}} from '@/client/components/asyncComponents';`);
}
if (need.appRoot) {
  extraImports.push('import {useAppRoot} from \'@/client/components/appRoot\';');
}
const tagNames = new Set([...tpl.tags].flatMap((t) => [t, t.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')]));
const keptImports = importLines.map((line) => {
  // drop the specifiers nothing names (a component the template renders counts; so does a name the template reads)
  const m = /^((?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\n)*)import\s+(type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:\*\s+as\s+(\w+)\s*)?from\s*('[^']+');?$/.exec(line.trim());
  if (m === null) {
    return line;
  }
  const [, lead, typeOnly, dflt, named, ns, from] = m;
  const live = (local) => used(local) || tagNames.has(local) || (/^v[A-Z]/.test(local) && tpl.directives.has(local.slice(1).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()));
  const keepDefault = dflt !== undefined && live(dflt) ? dflt : undefined;
  const keepNs = ns !== undefined && live(ns) ? ns : undefined;
  const keepNamed = (named ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '' && live(s.split(/\s+as\s+/).pop().replace(/^type\s+/, '')));
  if (keepDefault === undefined && keepNs === undefined && keepNamed.length === 0) {
    return undefined;
  }
  const clause = [keepDefault, keepNs !== undefined ? `* as ${keepNs}` : undefined, keepNamed.length > 0 ? `{${keepNamed.join(', ')}}` : undefined].filter(Boolean).join(', ');
  return `${lead}import ${typeOnly ?? ''}${clause} from ${from};`;
}).filter((line) => line !== undefined);

const scriptOut = [
  commentBlock.trimEnd(),
  vueLead + [...extraImports.slice(0, 1), ...keptImports, ...extraImports.slice(1)].join('\n'),
  moduleLines.join('\n'),
  `${headComment}${bodyText}`,
].filter((part) => part.trim() !== '').join('\n\n');

const refused = report.filter((line) => line.startsWith('REFUSE'));
const result = `${source.slice(0, tplStart)}${template}${source.slice(tplClose, scriptMatch.index)}<script setup lang="ts">\n${scriptOut}\n</script>${source.slice(scriptMatch.index + scriptMatch[0].length)}`;

if (!args.includes('--quiet') || refused.length > 0) {
  for (const line of report) {
    console.error(`${rel}: ${line}`);
  }
}
if (flag('--report') !== undefined) {
  fs.appendFileSync(flag('--report'), report.map((line) => `${rel}: ${line}`).join('\n') + (report.length > 0 ? '\n' : ''));
}
if (refused.length > 0) {
  console.error(`${rel}: NOT CONVERTED — ${refused.length} construct(s) the codemod refuses`);
  process.exit(1);
}
if (flag('--out') !== undefined) {
  fs.writeFileSync(flag('--out'), result);
} else if (args.includes('--write')) {
  fs.writeFileSync(file, result);
} else {
  process.stdout.write(result);
}
console.error(`${rel}: converted — ${report.length} place(s) to review`);
