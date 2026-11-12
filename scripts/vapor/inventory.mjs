// `node scripts/vapor/inventory.mjs [--json <file>] [--component <path>] [--wave]` — WHAT EVERY COMPONENT IS MADE OF.
//
// The road to `createVaporApp(App)` (docs/claude/vapor/ROADMAP.md) converts every Options-API component to
// `<script setup>`. This tool reads each single-file component of the client with a real parser (the script through
// TypeScript's AST, the template through `@vue/compiler-dom`) and says, per component and in total:
//
//   · its FORM (options · script-setup · vapor) and which option blocks it has;
//   · every CONSTRUCT that has a recipe of its own (docs/claude/vapor/RECIPES.md): `this.$refs` / `$el` / `$emit` /
//     `$nextTick` / `$slots` / `$attrs` / `$watch` / `$forceUpdate` / `$options` / `$parent` / `$root`, a mixin, a render
//     function, a watcher with a path key / a string handler / options, a computed with a setter, `provide` / `inject`,
//     a custom directive, `v-model` on a component, a ref inside `v-for`, a dynamic `:ref`, `<keep-alive>`, …;
//   · what its PARENTS reach into it for through a template ref (the members a conversion must `defineExpose`);
//   · the constructs that have NO recipe yet (`UNKNOWN`) — the tool fails on one, so the recipe book is complete by
//     construction: a new construct in the client is a new row there before it is a surprise in a wave.
//
// `--component <path>`  the conversion sheet of ONE component: its constructs, each with its recipe's id, what it must
//                       expose, who mounts it. Read it before converting the component by hand or with the codemod.
// `--wave`              the worklist: every Options component with its weight, lightest first.
// `--json <file>`       the whole inventory, for other tools.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(process.cwd() + '/package.json');
const ts = require('typescript');
const {parse: parseTemplate, NodeTypes} = require('@vue/compiler-dom');

const ROOT = process.cwd();
const CLIENT = path.join(ROOT, 'src', 'client');
const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : (args[at + 1] ?? '');
};

/** Every construct the tool knows, with the id of its recipe (RECIPES.md §<id>). A construct not listed here is UNKNOWN. */
export const RECIPES = {
  // the option blocks
  'opt:name': 'R1', 'opt:components': 'R1', 'opt:props': 'R2', 'opt:emits': 'R3', 'opt:data': 'R4', 'opt:computed': 'R5',
  'opt:watch': 'R6', 'opt:methods': 'R7', 'opt:setup': 'R8', 'opt:mixins': 'R15', 'opt:inheritAttrs': 'R13',
  'opt:provide': 'R16', 'opt:inject': 'R16', 'opt:directives': 'R17', 'opt:expose': 'R11', 'opt:render': 'R18',
  // the hooks
  'hook:beforeCreate': 'R9', 'hook:created': 'R9', 'hook:beforeMount': 'R9', 'hook:mounted': 'R9', 'hook:beforeUpdate': 'R9',
  'hook:updated': 'R9', 'hook:beforeUnmount': 'R9', 'hook:unmounted': 'R9', 'hook:activated': 'R9', 'hook:deactivated': 'R9',
  'hook:errorCaptured': 'R9',
  // the instance
  'this:$emit': 'R3', 'this:$nextTick': 'R10', 'this:$refs': 'R11', 'this:$el': 'R12', 'this:$slots': 'R13', 'this:$attrs': 'R13',
  'this:$props': 'R2', 'this:$watch': 'R6', 'this:$forceUpdate': 'R14', 'this:$options': 'R14', 'this:$parent': 'R14',
  'this:$root': 'R14', 'this:$t': 'R19', 'this:$data': 'R14', 'this:$': 'R14',
  // watchers
  'watch:path-key': 'R6', 'watch:immediate': 'R6', 'watch:deep': 'R6', 'watch:flush': 'R6', 'watch:string-handler': 'R6',
  'watch:array': 'R6', 'computed:setter': 'R5', 'data:reads-this': 'R4', 'data:not-literal': 'R4', 'props:array': 'R2', 'emits:object': 'R3',
  // the template
  'tpl:$t': 'R19', 'tpl:v-i18n': 'R19', 'tpl:v-trim-whitespace': 'R19', 'tpl:custom-directive': 'R17', 'tpl:$emit': 'R3',
  'tpl:$refs': 'R11', 'tpl:$slots': 'R13', 'tpl:$attrs': 'R13', 'tpl:$props': 'R2', 'tpl:$el': 'R12', 'tpl:$parent': 'R14',
  'tpl:$root': 'R14', 'tpl:$event': 'R0', 'tpl:ref': 'R11', 'tpl:ref-dynamic': 'R11', 'tpl:ref-in-for': 'R11', 'tpl:ref-on-component': 'R11',
  'tpl:v-model-component': 'R20', 'tpl:v-model-native': 'R0', 'tpl:transition': 'R21', 'tpl:transition-group': 'R21',
  'tpl:teleport': 'R21', 'tpl:keep-alive': 'R22', 'tpl:component-is': 'R21', 'tpl:slot': 'R13', 'tpl:v-html': 'R0',
  'tpl:v-memo': 'R23', 'tpl:global-component': 'R1', 'tpl:leading-comment': 'R24', 'tpl:multi-root': 'R24',
  'tpl:v-once': 'R0', 'tpl:suspense': 'R22', 'tpl:key-remount': 'R0', 'tpl:trailing-comment': 'R24',
  // the script's MODULE level (outside the component)
  'script:module-code': 'R25', 'script:module-state': 'R25', 'script:type-export': 'R25', 'script:value-export': 'R25',
  // an already converted script (`<script setup>`): the same rows, read off the Composition API
  'setup:defineProps': 'R2', 'setup:defineEmits': 'R3', 'setup:ref': 'R4', 'setup:computed': 'R5', 'setup:watch': 'R6',
  'setup:function': 'R7', 'setup:composable': 'R8', 'setup:hook': 'R9', 'setup:nextTick': 'R10', 'setup:useTemplateRef': 'R11',
  'setup:defineExpose': 'R11', 'setup:useSlots': 'R13', 'setup:useAttrs': 'R13', 'setup:provide': 'R16', 'setup:inject': 'R16',
  'setup:directive-import': 'R17', 'setup:$t-import': 'R19', 'setup:defineOptions': 'R1',
};

const HOOKS = new Set(['beforeCreate', 'created', 'beforeMount', 'mounted', 'beforeUpdate', 'updated', 'beforeUnmount', 'unmounted',
  'activated', 'deactivated', 'errorCaptured', 'renderTracked', 'renderTriggered', 'serverPrefetch']);
const BUILT_IN_DIRECTIVES = new Set(['if', 'else', 'else-if', 'for', 'show', 'model', 'on', 'bind', 'slot', 'html', 'text', 'once', 'memo', 'pre', 'cloak']);
const BUILT_IN_TAGS = new Set(['transition', 'Transition', 'transition-group', 'TransitionGroup', 'teleport', 'Teleport', 'keep-alive',
  'KeepAlive', 'component', 'slot', 'template', 'suspense', 'Suspense']);
/** Registered on the app (`main.ts`) — a `<script setup>` component imports them. */
const GLOBAL_COMPONENTS = new Set(['action-target-card', 'ActionTargetCard', 'premium-card-face', 'PremiumCardFace', 'console-source-dock', 'ConsoleSourceDock']);

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (entry.name.endsWith('.vue')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const pascal = (tag) => tag.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');

function blocks(text) {
  const script = /<script\b([^>]*)>([\s\S]*?)<\/script>/.exec(text);
  const open = text.indexOf('<template');
  const close = text.lastIndexOf('</template>');
  const template = open === -1 || close === -1 || (script !== null && open > script.index && text.slice(0, script.index).indexOf('<template') === -1 && false) ?
    '' : text.slice(text.indexOf('>', open) + 1, close);
  return {attrs: script?.[1] ?? '', script: script?.[2] ?? '', template, templateFirst: open !== -1 && (script === null || open < script.index)};
}

function bump(map, key, by = 1) {
  map[key] = (map[key] ?? 0) + by;
}

/** The script of an Options component: its option blocks, its uses of the instance, the shapes of its watchers. */
function readScript(script, uses, detail) {
  const sf = ts.createSourceFile('c.ts', script, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  let options;
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) && !ts.isExportAssignment(st)) {
      const exported = ts.canHaveModifiers(st) && (ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const isType = ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st);
      // STATE at module level — a `let`, or a `const` holding a container that is written to — would become
      // PER-INSTANCE inside `<script setup>` (every top-level statement there is setup code).
      const stateful = ts.isVariableStatement(st) && ((st.declarationList.flags & ts.NodeFlags.Const) === 0 ||
        st.declarationList.declarations.some((d) => d.initializer !== undefined &&
          /^(?:new (?:Map|Set|WeakMap|WeakSet)\b|reactive\(|ref\(|shallowRef\(|\[\]|\{\})/.test(d.initializer.getText(sf))));
      bump(uses, exported ? (isType ? 'script:type-export' : 'script:value-export') : stateful ? 'script:module-state' : 'script:module-code');
      if (exported && !isType) {
        detail.valueExports.push(st.getText(sf).split('\n')[0].slice(0, 80));
      }
      if (stateful) {
        detail.moduleState.push(st.getText(sf).split('\n')[0].slice(0, 80));
      }
    }
    if (ts.isExportAssignment(st)) {
      const e = st.expression;
      if (ts.isCallExpression(e) && e.arguments.length > 0 && ts.isObjectLiteralExpression(e.arguments[0])) {
        options = e.arguments[0];
      } else if (ts.isObjectLiteralExpression(e)) {
        options = e;
      }
    }
  }
  if (options === undefined) {
    detail.unknown.push('script: no `export default defineComponent({…})` object');
    return;
  }
  const names = {props: [], data: [], computed: [], methods: [], setup: [], emits: []};
  for (const prop of options.properties) {
    if (ts.isSpreadAssignment(prop)) {
      detail.unknown.push('script: a spread in the component options');
      continue;
    }
    const key = prop.name.getText(sf);
    if (HOOKS.has(key)) {
      bump(uses, `hook:${key}`);
      continue;
    }
    bump(uses, `opt:${key}`);
    const value = ts.isPropertyAssignment(prop) ? prop.initializer : undefined;
    if (key === 'props') {
      if (value !== undefined && ts.isArrayLiteralExpression(value)) {
        bump(uses, 'props:array');
        names.props.push(...value.elements.map((el) => el.text));
      } else if (value !== undefined && ts.isObjectLiteralExpression(value)) {
        names.props.push(...value.properties.map((p) => p.name?.getText(sf)).filter(Boolean));
      }
    } else if (key === 'emits') {
      if (value !== undefined && ts.isObjectLiteralExpression(value)) {
        bump(uses, 'emits:object');
        names.emits.push(...value.properties.map((p) => p.name?.getText(sf).replace(/['"]/g, '')).filter(Boolean));
      } else if (value !== undefined && ts.isArrayLiteralExpression(value)) {
        names.emits.push(...value.elements.map((el) => el.text));
      }
    } else if (key === 'computed' && value !== undefined && ts.isObjectLiteralExpression(value)) {
      for (const c of value.properties) {
        if (ts.isSpreadAssignment(c)) {
          detail.unknown.push('computed: a spread (mapState-style)');
          continue;
        }
        names.computed.push(c.name.getText(sf));
        if (ts.isPropertyAssignment(c) && ts.isObjectLiteralExpression(c.initializer)) {
          bump(uses, 'computed:setter');
        }
      }
    } else if (key === 'methods' && value !== undefined && ts.isObjectLiteralExpression(value)) {
      for (const m of value.properties) {
        if (ts.isSpreadAssignment(m)) {
          detail.unknown.push('methods: a spread');
          continue;
        }
        names.methods.push(m.name.getText(sf));
      }
    } else if (key === 'data') {
      const body = ts.isMethodDeclaration(prop) ? prop.body : (value !== undefined && (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) ? value.body : undefined);
      if (body !== undefined) {
        let reads = false;
        (function walk(node) {
          if (node.kind === ts.SyntaxKind.ThisKeyword) {
            reads = true;
          }
          ts.forEachChild(node, walk);
        })(body);
        if (reads) {
          bump(uses, 'data:reads-this');
        }
        const returned = ts.isBlock(body) ? body.statements.find(ts.isReturnStatement)?.expression : body;
        const object = returned !== undefined && ts.isParenthesizedExpression(returned) ? returned.expression : returned;
        if (object !== undefined && ts.isObjectLiteralExpression(object)) {
          names.data.push(...object.properties.map((p) => (ts.isSpreadAssignment(p) ? '…' : p.name.getText(sf))));
        } else {
          bump(uses, 'data:not-literal');
        }
      }
    } else if (key === 'watch' && value !== undefined && ts.isObjectLiteralExpression(value)) {
      for (const w of value.properties) {
        if (ts.isSpreadAssignment(w)) {
          detail.unknown.push('watch: a spread');
          continue;
        }
        const wkey = ts.isStringLiteral(w.name) ? w.name.text : w.name.getText(sf);
        if (wkey.includes('.')) {
          bump(uses, 'watch:path-key');
        }
        const init = ts.isPropertyAssignment(w) ? w.initializer : undefined;
        if (init !== undefined && ts.isStringLiteral(init)) {
          bump(uses, 'watch:string-handler');
        } else if (init !== undefined && ts.isArrayLiteralExpression(init)) {
          bump(uses, 'watch:array');
        } else if (init !== undefined && ts.isObjectLiteralExpression(init)) {
          for (const o of init.properties) {
            const okey = o.name?.getText(sf);
            if (okey === 'immediate' || okey === 'deep' || okey === 'flush') {
              bump(uses, `watch:${okey}`);
            } else if (okey === 'handler' && ts.isPropertyAssignment(o) && ts.isStringLiteral(o.initializer)) {
              bump(uses, 'watch:string-handler');
            } else if (okey !== 'handler') {
              detail.unknown.push(`watch: option «${okey}»`);
            }
          }
        }
      }
    } else if (key === 'inject' && value !== undefined) {
      if (ts.isArrayLiteralExpression(value)) {
        detail.injects.push(...value.elements.map((el) => el.getText(sf).replace(/['"]/g, '')));
      } else if (ts.isObjectLiteralExpression(value)) {
        for (const entry of value.properties) {
          const from = ts.isPropertyAssignment(entry) && ts.isObjectLiteralExpression(entry.initializer) ?
            entry.initializer.properties.find((o) => o.name?.getText(sf) === 'from') : undefined;
          detail.injects.push((from !== undefined && ts.isPropertyAssignment(from) ? from.initializer.getText(sf) : entry.name.getText(sf)).replace(/['"]/g, ''));
        }
      }
    } else if (key === 'setup') {
      const body = ts.isMethodDeclaration(prop) ? prop.body : undefined;
      const returned = body?.statements.find(ts.isReturnStatement)?.expression;
      if (returned !== undefined && ts.isObjectLiteralExpression(returned)) {
        names.setup.push(...returned.properties.map((p) => (ts.isSpreadAssignment(p) ? '…' : p.name.getText(sf))));
      }
    } else if (!(`opt:${key}` in RECIPES)) {
      detail.unknown.push(`option «${key}»`);
    }
  }
  detail.names = names;
  // every `this.$x`
  (function walk(node) {
    if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword && node.name.text.startsWith('$')) {
      const key = `this:${node.name.text}`;
      bump(uses, key);
      if (!(key in RECIPES)) {
        detail.unknown.push(`instance member «${node.name.text}»`);
      }
      if (node.name.text === '$refs' && ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) {
        detail.ownRefs.add(node.parent.name.text);
      }
    }
    ts.forEachChild(node, walk);
  })(options);
}

/** The template: the constructs with a recipe of their own, and the refs it stands. */
function readTemplate(template, uses, detail) {
  let ast;
  try {
    ast = parseTemplate(template, {comments: true});
  } catch (error) {
    detail.unknown.push(`template: does not parse (${error.message})`);
    return;
  }
  const roots = ast.children.filter((n) => n.type === NodeTypes.ELEMENT);
  const first = ast.children.find((n) => n.type !== NodeTypes.TEXT || n.content.trim() !== '');
  if (first !== undefined && first.type === NodeTypes.COMMENT) {
    bump(uses, 'tpl:leading-comment');
  }
  // …and a comment AFTER the root is a second top-level node just the same (a fragment in a development build).
  const lastRoot = ast.children.findLastIndex((n) => n.type === NodeTypes.ELEMENT);
  if (lastRoot !== -1 && ast.children.slice(lastRoot + 1).some((n) => n.type === NodeTypes.COMMENT)) {
    bump(uses, 'tpl:trailing-comment');
  }
  if (roots.length > 1 && !roots.slice(1).every((n) => n.props.some((p) => p.type === NodeTypes.DIRECTIVE && (p.name === 'else' || p.name === 'else-if')))) {
    bump(uses, 'tpl:multi-root');
  }
  const expressions = [];
  (function walk(node, inFor) {
    if (node.type === NodeTypes.INTERPOLATION) {
      expressions.push(node.content.content ?? '');
      return;
    }
    if (node.type !== NodeTypes.ELEMENT) {
      for (const child of node.children ?? []) {
        walk(child, inFor);
      }
      return;
    }
    const tag = node.tag;
    const isComponent = !BUILT_IN_TAGS.has(tag) && (/[A-Z]/.test(tag.charAt(0)) || tag.includes('-'));
    const hasFor = node.props.some((p) => p.type === NodeTypes.DIRECTIVE && p.name === 'for');
    if (tag === 'transition' || tag === 'Transition') {
      bump(uses, 'tpl:transition');
    } else if (tag === 'transition-group' || tag === 'TransitionGroup') {
      bump(uses, 'tpl:transition-group');
    } else if (tag === 'teleport' || tag === 'Teleport') {
      bump(uses, 'tpl:teleport');
    } else if (tag === 'keep-alive' || tag === 'KeepAlive') {
      bump(uses, 'tpl:keep-alive');
    } else if (tag === 'suspense' || tag === 'Suspense') {
      bump(uses, 'tpl:suspense');
    } else if (tag === 'component') {
      bump(uses, 'tpl:component-is');
    } else if (tag === 'slot') {
      bump(uses, 'tpl:slot');
    } else if (GLOBAL_COMPONENTS.has(tag)) {
      bump(uses, 'tpl:global-component');
    }
    if (isComponent) {
      detail.children.add(pascal(tag));
    }
    for (const prop of node.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        if (prop.name === 'ref') {
          bump(uses, 'tpl:ref');
          detail.templateRefs.add(prop.value?.content ?? '');
          if (inFor || hasFor) {
            bump(uses, 'tpl:ref-in-for');
          }
          if (isComponent) {
            bump(uses, 'tpl:ref-on-component');
            detail.childRefs.push({ref: prop.value?.content ?? '', child: pascal(tag)});
          }
        }
        continue;
      }
      const exp = prop.exp?.content ?? '';
      expressions.push(exp);
      if (prop.name === 'bind' && prop.arg?.content === 'key' && !hasFor && node.tag !== 'template') {
        bump(uses, 'tpl:key-remount');
      }
      if (prop.name === 'bind' && prop.arg?.content === 'ref') {
        bump(uses, 'tpl:ref-dynamic');
        if (inFor || hasFor) {
          bump(uses, 'tpl:ref-in-for');
        }
      } else if (prop.name === 'model') {
        bump(uses, isComponent ? 'tpl:v-model-component' : 'tpl:v-model-native');
      } else if (prop.name === 'html') {
        bump(uses, 'tpl:v-html');
      } else if (prop.name === 'memo') {
        bump(uses, 'tpl:v-memo');
      } else if (prop.name === 'once') {
        bump(uses, 'tpl:v-once');
      } else if (prop.name === 'i18n') {
        bump(uses, 'tpl:v-i18n');
      } else if (prop.name === 'trim-whitespace') {
        bump(uses, 'tpl:v-trim-whitespace');
      } else if (!BUILT_IN_DIRECTIVES.has(prop.name)) {
        bump(uses, 'tpl:custom-directive');
        detail.directives.add(prop.name);
      }
    }
    for (const child of node.children) {
      walk(child, inFor || hasFor);
    }
  })(ast, false);
  for (const exp of expressions) {
    for (const m of exp.matchAll(/(?<![\w.])\$(\w+)\b/g)) {
      const key = `tpl:$${m[1]}`;
      bump(uses, key);
      if (!(key in RECIPES)) {
        detail.unknown.push(`template global «$${m[1]}»`);
      }
    }
  }
}

/** A `<script setup>` script: the constructs of the SAME recipes, read off the Composition API it calls. */
function readSetupScript(script, uses, detail) {
  const code = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const count = (key, pattern) => {
    const n = (code.match(pattern) ?? []).length;
    if (n > 0) {
      bump(uses, key, n);
    }
  };
  count('setup:defineOptions', /\bdefineOptions\(/g);
  count('setup:defineProps', /\bdefineProps[<(]/g);
  count('setup:defineEmits', /\bdefineEmits[<(]/g);
  count('setup:ref', /\b(?:ref|shallowRef|reactive)[<(]/g);
  count('setup:computed', /\bcomputed[<(]/g);
  count('setup:watch', /\bwatch(?:Effect)?\(/g);
  count('setup:function', /^(?:async )?function \w+/gm);
  count('setup:composable', /=\s*use(?!TemplateRef|Slots|Attrs)[A-Z]\w*\(/g);
  count('setup:hook', /\bon(?:BeforeMount|Mounted|BeforeUpdate|Updated|BeforeUnmount|Unmounted|ErrorCaptured|ScopeDispose)\(/g);
  count('setup:nextTick', /\bnextTick\(/g);
  count('setup:useTemplateRef', /\buseTemplateRef[<(]/g);
  count('setup:defineExpose', /\bdefineExpose\(/g);
  count('setup:useSlots', /\buseSlots\(/g);
  count('setup:useAttrs', /\buseAttrs\(/g);
  count('setup:provide', /\bprovide\(/g);
  count('setup:inject', /\binject[<(]/g);
  count('setup:$t-import', /import\s*\{[^}]*\$t\b[^}]*\}\s*from\s*'@\/client\/directives\/i18n'/g);
  for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const directives = m[1].split(',').map((name) => name.trim()).filter((name) => /^v[A-Z]/.test(name));
    if (directives.length > 0) {
      bump(uses, 'setup:directive-import', directives.length);
      if (m[2] !== '@/client/directives/vDirectives') {
        detail.stepB.push(`${directives.join(', ')} imported from ${m[2]} — the Options form; import from @/client/directives/vDirectives (R17)`);
      }
    }
  }
  for (const m of code.matchAll(/^export\s+(?!type\b|interface\b|default\b)(\w+)/gm)) {
    detail.unknown.push(`a value export (\`export ${m[1]} …\`) in <script setup> — move it to a sibling .ts (R25)`);
  }
}

function readComponent(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const {attrs, script, template} = blocks(text);
  const form = /\bvapor\b/.test(attrs) ? 'vapor' : /\bsetup\b/.test(attrs) ? 'script-setup' : 'options';
  const uses = {};
  const detail = {unknown: [], ownRefs: new Set(), childRefs: [], children: new Set(), directives: new Set(), names: undefined,
    valueExports: [], moduleState: [], injects: [], stepB: [], templateRefs: new Set()};
  if (form === 'options') {
    readScript(script, uses, detail);
  } else {
    readSetupScript(script, uses, detail);
  }
  readTemplate(template, uses, detail);
  // What stands between this component and step B (`vapor`) — every construct has a ✔ row; these are the «at B» notes.
  if (uses['tpl:leading-comment'] !== undefined || uses['tpl:trailing-comment'] !== undefined) {
    detail.stepB.push('a comment outside the root (before or after it) — move it into the script (R24)');
  }
  if (uses['tpl:v-memo'] !== undefined) {
    detail.stepB.push('`v-memo` — delete it at B (R23)');
  }
  if (uses['opt:render'] !== undefined) {
    detail.stepB.push('a render function — a rewrite, not a conversion (R18)');
  }
  if (uses['this:$'] !== undefined || uses['this:$options'] !== undefined || uses['this:$parent'] !== undefined || uses['this:$root'] !== undefined || uses['this:$forceUpdate'] !== undefined) {
    detail.stepB.push('instance internals / `$parent` / `$options` — redesign first (R14)');
  }
  if (form !== 'options' && (uses['tpl:$t'] !== undefined) && uses['setup:$t-import'] === undefined) {
    detail.stepB.push('`$t` in the template without its import (R19)');
  }
  return {
    file: rel(file), name: path.basename(file, '.vue'), form, lines: text.split('\n').length, scriptLines: script.split('\n').length, uses,
    unknown: detail.unknown, children: [...detail.children].sort(), childRefs: detail.childRefs, directives: [...detail.directives].sort(),
    names: detail.names, script, valueExports: detail.valueExports, moduleState: detail.moduleState, injects: detail.injects, stepB: detail.stepB,
    templateRefs: [...detail.templateRefs].sort(), ownRefs: [...detail.ownRefs].sort(),
  };
}

/** What each component's PARENTS reach into it for: `this.$refs.<ref>.<member>` / `(… as InstanceType<typeof X>).<member>`. */
function exposeLists(components) {
  const byName = new Map(components.map((c) => [c.name, c]));
  const reached = new Map();
  const note = (child, member, from) => {
    if (!byName.has(child)) {
      return;
    }
    const list = reached.get(child) ?? new Map();
    list.set(member, [...(list.get(member) ?? []), from]);
    reached.set(child, list);
  };
  const sources = [...components.map((c) => ({file: c.file, text: c.script, childRefs: c.childRefs})),
    ...tsFiles(CLIENT).map((file) => ({file: rel(file), text: fs.readFileSync(file, 'utf8'), childRefs: []}))];
  for (const source of sources) {
    for (const {ref, child} of source.childRefs) {
      if (ref === '') {
        continue;
      }
      const id = ref.replace(/[$]/g, '\\$');
      for (const m of source.text.matchAll(new RegExp(`\\$refs\\.${id}\\b(?:\\s+as\\s+[^)]+\\))?\\)?\\??\\.(\\$?\\w+)`, 'g'))) {
        note(child, m[1], source.file);
      }
    }
    for (const m of source.text.matchAll(/InstanceType<typeof (\w+)>/g)) {
      const child = m[1];
      // the variable the cast is assigned to, then its member reads
      // (…ends at the cast: `const x = (… as InstanceType<typeof C> | undefined);` — a declaration that goes on to CALL
      // a member holds that member's result, not the child.)
      const decl = new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*[^;\\n]*InstanceType<typeof ${child}>(?:\\s*\\|\\s*undefined)?\\)?;`, 'g');
      for (const d of source.text.matchAll(decl)) {
        for (const use of source.text.matchAll(new RegExp(`(?<![\\w.])${d[1]}\\??\\.(\\$?\\w+)`, 'g'))) {
          note(child, use[1], source.file);
        }
      }
      const direct = new RegExp(`InstanceType<typeof ${child}>(?:\\s*\\|\\s*undefined)?>?\\(?[^;\\n]*?\\)\\??\\.(\\$?\\w+)`, 'g');
      for (const use of source.text.matchAll(direct)) {
        note(child, use[1], source.file);
      }
    }
  }
  // A name that is not a member of the child was read off something ELSE (a value an exposed function returned).
  for (const [child, list] of reached) {
    const names = byName.get(child).names;
    if (names === undefined) {
      continue;
    }
    const members = new Set([...names.props, ...names.data, ...names.computed, ...names.methods, ...names.setup]);
    for (const member of [...list.keys()]) {
      if (!member.startsWith('$') && !members.has(member)) {
        list.delete(member);
      }
    }
    if (list.size === 0) {
      reached.delete(child);
    }
  }
  return reached;
}

function tsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tsFiles(full, out);
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const WEIGHT = {'this:$refs': 2, 'this:$el': 1, 'opt:mixins': 8, 'opt:render': 8, 'this:$parent': 8, 'this:$root': 8, 'this:$forceUpdate': 4,
  'this:$options': 4, 'this:$watch': 2, 'watch:path-key': 1, 'watch:string-handler': 1, 'computed:setter': 1, 'tpl:ref-in-for': 3,
  'tpl:ref-dynamic': 2, 'tpl:keep-alive': 4, 'tpl:custom-directive': 3, 'tpl:multi-root': 2, 'opt:provide': 2, 'opt:inject': 2};

function weightOf(component, exposed) {
  let weight = Math.round(component.scriptLines / 40);
  for (const [key, count] of Object.entries(component.uses)) {
    weight += (WEIGHT[key] ?? 0) * Math.min(count, 5);
  }
  return weight + (exposed?.size ?? 0);
}

const components = walkFiles(CLIENT).sort().map(readComponent);
const exposed = exposeLists(components);
const mountedBy = new Map();
for (const c of components) {
  for (const child of c.children) {
    mountedBy.set(child, [...(mountedBy.get(child) ?? []), c.name]);
  }
}

const one = flag('--component');
if (one !== undefined) {
  const target = components.find((c) => c.file === one.split(path.sep).join('/') || c.name === one.replace(/\.vue$/, ''));
  if (target === undefined) {
    console.error(`no component «${one}»`);
    process.exit(2);
  }
  console.log(`${target.file} — ${target.form}, ${target.lines} lines (script ${target.scriptLines})`);
  const rows = Object.entries(target.uses).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, count] of rows) {
    console.log(`  ${(RECIPES[key] ?? 'UNKNOWN').padEnd(7)} ${key.padEnd(26)} ×${count}`);
  }
  const reach = exposed.get(target.name);
  console.log(reach === undefined ? '  MUST EXPOSE (R11): nothing — no parent reaches it through a ref (write no `defineExpose`)' :
    `  MUST EXPOSE (R11): ${[...reach].map(([member, from]) => `${member} ← ${[...new Set(from)].map((f) => path.basename(f)).join(', ')}`).join(' · ')}`);
  console.log(`  mounted by: ${(mountedBy.get(target.name) ?? ['(nobody by tag — a lazy / dynamic mount)']).join(', ')}`);
  const specs = tsFiles(path.join(ROOT, 'tests', 'client')).filter((file) => file.endsWith('.spec.ts') &&
    new RegExp(`/${target.name}\\.vue'`).test(fs.readFileSync(file, 'utf8'))).map(rel);
  console.log(`  unit specs that import it (re-run them): ${specs.length === 0 ? 'none — it gets one in its conversion (RECIPES § 3)' : specs.join(', ')}`);
  if (target.templateRefs.length > 0) {
    const unread = target.form === 'options' ? target.templateRefs.filter((name) => !target.ownRefs.includes(name)) : [];
    console.log(`  template refs: ${target.templateRefs.join(', ')}${unread.length > 0 ? ` — never read in this script: ${unread.join(', ')} (a parent / a setup ref of that name may bind them)` : ''}`);
  }
  for (const key of target.injects) {
    const providers = components.filter((c) => c.name !== target.name && /\bprovide\b/.test(c.script) && c.script.includes(key)).map((c) => c.file);
    console.log(`  injects «${key}» (R16 — a provided REF arrives as the ref) ← ${providers.length === 0 ? 'no provider found by name: grep the key' : providers.join(', ')}`);
  }
  if (target.moduleState.length > 0) {
    console.log(`  MODULE STATE (R25 — move to a sibling .ts: inside <script setup> it would be PER INSTANCE): ${target.moduleState.join(' · ')}`);
  }
  const clash = target.templateRefs.filter((name) => target.names !== undefined &&
    [...target.names.props, ...target.names.data, ...target.names.computed, ...target.names.methods, ...target.names.setup].includes(name));
  if (clash.length > 0) {
    console.log(`  REF KEY = MEMBER NAME (R11 — one scope in <script setup>): ${clash.join(', ')} — the template ref keeps the name, the member takes another`);
  }
  if (target.valueExports.length > 0) {
    console.log(`  VALUE EXPORTS at module level (R25 — move to a sibling .ts): ${target.valueExports.join(' · ')}`);
  }
  console.log(`  STEP B (vapor): ${target.stepB.length === 0 ? 'no blocker on this sheet — every construct has a ✔ row (RECIPES § 0)' : target.stepB.join(' · ')}`);
  if (target.directives.length > 0) {
    console.log(`  custom directives: ${target.directives.join(', ')}`);
  }
  if (target.unknown.length > 0) {
    console.log(`  UNKNOWN: ${target.unknown.join(' · ')}`);
  }
  process.exit(0);
}

const totals = {};
const files = {};
for (const c of components) {
  for (const [key, count] of Object.entries(c.uses)) {
    bump(totals, key, count);
    bump(files, key);
  }
}
const forms = {options: 0, 'script-setup': 0, vapor: 0};
for (const c of components) {
  forms[c.form]++;
}
const unknown = components.flatMap((c) => c.unknown.map((u) => `${c.file}: ${u}`));
const unrecipied = Object.keys(totals).filter((key) => !(key in RECIPES));

if (args.includes('--wave')) {
  const rows = components.filter((c) => c.form === 'options')
    .map((c) => ({file: c.file, weight: weightOf(c, exposed.get(c.name)), lines: c.scriptLines, expose: exposed.get(c.name)?.size ?? 0,
      hard: Object.keys(c.uses).filter((key) => (WEIGHT[key] ?? 0) >= 3)}))
    .sort((a, b) => a.weight - b.weight || a.file.localeCompare(b.file));
  for (const row of rows) {
    console.log(`${String(row.weight).padStart(4)}  ${row.file}  (script ${row.lines}${row.expose > 0 ? `, exposes ${row.expose}` : ''}${row.hard.length > 0 ? `, ${row.hard.join(' ')}` : ''})`);
  }
  console.log(`\n${rows.length} Options components · weight ≤ 2: ${rows.filter((r) => r.weight <= 2).length} · 3–9: ${rows.filter((r) => r.weight > 2 && r.weight < 10).length} · ≥ 10: ${rows.filter((r) => r.weight >= 10).length}`);
} else {
  console.log(`components: ${components.length} — options ${forms.options} · script-setup ${forms['script-setup']} · vapor ${forms.vapor}`);
  console.log('construct'.padEnd(28) + 'recipe'.padEnd(8) + 'uses'.padStart(6) + 'files'.padStart(7));
  for (const key of Object.keys(totals).sort()) {
    console.log(key.padEnd(28) + (RECIPES[key] ?? 'UNKNOWN').padEnd(8) + String(totals[key]).padStart(6) + String(files[key]).padStart(7));
  }
  console.log(`\nreached through a parent's ref (must expose): ${exposed.size} components, ${[...exposed.values()].reduce((n, m) => n + m.size, 0)} members`);
}

const json = flag('--json');
if (json !== undefined && json !== '') {
  fs.writeFileSync(json, JSON.stringify({
    forms, totals, files,
    components: components.map(({script: _script, ...c}) => ({...c, expose: [...(exposed.get(c.name)?.keys() ?? [])].sort(), mountedBy: mountedBy.get(c.name) ?? []})),
  }, null, 1));
}
if (unknown.length > 0 || unrecipied.length > 0) {
  console.error(`\nNO RECIPE for ${unknown.length + unrecipied.length} construct(s) — add the row to RECIPES.md and to RECIPES here:`);
  for (const row of [...unrecipied.map((key) => `construct «${key}»`), ...unknown]) {
    console.error(`  ${row}`);
  }
  process.exit(1);
}
