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
  'this:$root': 'R14', 'this:$t': 'R19', 'this:$data': 'R14', 'this:$': 'R14', 'this:vueRoot': 'R26',
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
  'tpl:inter-root-comment': 'R24', 'tpl:component-is-string': 'R21', 'tpl:row-compare': 'R27',
  // the script's MODULE level (outside the component)
  'script:module-code': 'R25', 'script:module-state': 'R25', 'script:type-export': 'R25', 'script:value-export': 'R25',
  // an already converted script (`<script setup>`): the same rows, read off the Composition API
  'setup:defineProps': 'R2', 'setup:defineEmits': 'R3', 'setup:ref': 'R4', 'setup:computed': 'R5', 'setup:watch': 'R6',
  'setup:function': 'R7', 'setup:composable': 'R8', 'setup:hook': 'R9', 'setup:nextTick': 'R10', 'setup:useTemplateRef': 'R11',
  'setup:defineExpose': 'R11', 'setup:useSlots': 'R13', 'setup:useAttrs': 'R13', 'setup:provide': 'R16', 'setup:inject': 'R16',
  'setup:directive-import': 'R17', 'setup:$t-import': 'R19', 'setup:defineOptions': 'R1', 'setup:useAppRoot': 'R26',
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
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

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
      const exported = (ts.canHaveModifiers(st) && (ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) || ts.isExportDeclaration(st);
      const isType = ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st) ||
        (ts.isExportDeclaration(st) && (st.isTypeOnly || (st.exportClause !== undefined && ts.isNamedExports(st.exportClause) && st.exportClause.elements.every((el) => el.isTypeOnly))));
      // STATE at module level — a `let`, or a `const` holding a container that is written to — would become
      // PER-INSTANCE inside `<script setup>` (every top-level statement there is setup code).
      const mutatedIn = (name) => new RegExp(`\\b${name}\\b(?:\\.[\\w$]+|\\[[^\\]\\n]*\\])*\\.(?:set|add|delete|clear|push|pop|shift|unshift|splice|sort|reverse|fill)\\(|\\b${name}\\b(?:\\.[\\w$]+|\\[[^\\]\\n]*\\])+\\s*(?:=(?!=)|\\+\\+|--|[-+*/]=)`).test(script);
      const stateful = ts.isVariableStatement(st) && ((st.declarationList.flags & ts.NodeFlags.Const) === 0 ||
        st.declarationList.declarations.some((d) => d.initializer !== undefined &&
          (/^(?:reactive\(|ref\(|shallowRef\(|defineAsyncComponent\()/.test(d.initializer.getText(sf)) ||
            (/^(?:new (?:Map|Set|WeakMap|WeakSet)\b|\[|\{)/.test(d.initializer.getText(sf)) &&
              !/^Readonly/.test(d.type?.getText(sf) ?? '') && (!ts.isIdentifier(d.name) || mutatedIn(d.name.text) || /^(?:\[\]|\{\}|new (?:Map|Set|WeakMap|WeakSet)(?:<[^()]*>)?\(\))$/.test(d.initializer.getText(sf)))))));
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
    // `vueRoot(this)` IS the app root reached through the instance (`components/vueRoot.ts` reads `$root`) — a row of its
    // own, because it HAS a conversion: the app root's port (R26).
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'vueRoot') {
      bump(uses, 'this:vueRoot');
    }
    ts.forEachChild(node, walk);
  })(options);
  // The `typedRefs` idiom — a member that returns `this.$refs` under a cast: `this.<alias>.<ref>` is a ref read too.
  detail.refAliases = [...script.matchAll(/(\w+)\s*\(\s*\)\s*(?::[^{;]+)?\{\s*return\s+this\.\$refs\b/g)].map((m) => m[1]);
  for (const alias of detail.refAliases) {
    for (const m of script.matchAll(new RegExp(`\\bthis\\.${alias}\\.(\\w+)`, 'g'))) {
      detail.ownRefs.add(m[1]);
    }
  }
  // `<component :is>` fed a STRING resolved through the `components:` registration; `<script setup>` registers nothing
  // by name, so the string becomes the imported component itself (R21).
  const imported = [...script.matchAll(/^import\s+(\w+)\s+from\s+'[^']+\.vue';?$/gm)].map((m) => m[1]);
  const body = script.replace(/^import\b.*$/gm, '').replace(/\bname:\s*'[^']*'/g, '');
  const named = imported.filter((name) => new RegExp(`['"\`](?:${name}|${kebab(name)})['"\`]`).test(body));
  if (named.length > 0) {
    detail.isStrings = named;
  }
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
  // …and one BETWEEN two roots (the branches of a root `v-if` chain, the roots of a multi-root template): a development
  // build folds it into the branch after it, which becomes a fragment.
  const firstRoot = ast.children.findIndex((n) => n.type === NodeTypes.ELEMENT);
  const between = firstRoot === -1 ? 0 : ast.children.slice(firstRoot + 1, lastRoot).filter((n) => n.type === NodeTypes.COMMENT).length;
  if (between > 0) {
    bump(uses, 'tpl:inter-root-comment', between);
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
          } else if (tag === 'component') {
            // a ref on `<component :is>`: the child is whichever component stands there — every one this file imports
            detail.childRefs.push({ref: prop.value?.content ?? '', child: '*'});
          }
        }
        continue;
      }
      const exp = prop.exp?.content ?? '';
      expressions.push(exp);
      // a surface of the shell's registry: `:ref="surfaces.bind.<name>"` — read by NAME from the controllers
      const surface = prop.name === 'bind' && prop.arg?.content === 'ref' ? /^surfaces\.bind\.(\w+)$/.exec(exp.trim()) : null;
      if (surface !== null && (isComponent || tag === 'component')) {
        detail.childRefs.push({ref: `@surface:${surface[1]}`, child: isComponent ? pascal(tag) : '*'});
      }
      if (prop.name === 'bind' && prop.arg?.content === 'key' && !hasFor && node.tag !== 'template') {
        bump(uses, 'tpl:key-remount');
      }
      // a row's class compared with something: the shape the Vapor compiler may lift into a synchronous SELECTOR
      // (R27 — the precise reader is `selector-audit.mjs`, which compiles; this is the sheet's pointer to it)
      if (prop.name === 'bind' && prop.arg?.content === 'class' && (inFor || hasFor) && /[!=]==/.test(exp)) {
        bump(uses, 'tpl:row-compare');
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

/** The keys of a script's `defineExpose({…})` — `undefined` when it has none. */
function exposeKeysOf(code) {
  const at = code.indexOf('defineExpose(');
  if (at === -1) {
    return undefined;
  }
  const open = code.indexOf('{', at);
  const close = open === -1 ? -1 : matchingClose(code, open);
  if (open === -1 || close === -1) {
    return [];
  }
  // top-level keys only: `a, b: c, d() {…}` — cut what stands inside nested brackets first
  let depth = 0;
  let flat = '';
  for (const ch of code.slice(open + 1, close)) {
    if (ch === '(' || ch === '{' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
    } else if (depth === 0) {
      flat += ch;
    }
  }
  return flat.split(',').map((part) => part.split(':')[0].trim()).filter((key) => /^\w+$/.test(key));
}

/** The index of the bracket that closes the one at `open` (`-1` when the text ends first). */
function matchingClose(text, open) {
  const pairs = {'{': '}', '(': ')', '[': ']'};
  const closer = pairs[text[open]];
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === text[open]) {
      depth++;
    } else if (text[i] === closer && --depth === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * A parent's read of a member its child does NOT expose and never did (the child's own `expose()` list is the
 * contract; the read has always been `undefined`). A conversion keeps that: waking the read is a fix of the PARENT.
 */
const UNEXPOSED_READS = {
  ConsoleScrollArea: {
    overflowing: 'ConsoleCardRulesPanel reads `overflowing` through the ref; the scroll area exposes five functions and not this ref, so the read is `undefined` and that panel\'s re-fit on a re-ask never runs',
  },
};

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
  count('setup:useAppRoot', /\buseAppRoot\(/g);
  // what the script declares at its top level — the members a parent's ref could name (the filter of MUST EXPOSE)
  const declared = [...code.matchAll(/^(?:const|let|var|function|async function)\s+(\w+)/gm)].map((m) => m[1]);
  const destructured = [...code.matchAll(/^(?:const|let)\s+\{([^}]+)\}\s*=/gm)].flatMap((m) => m[1].split(',').map((part) => part.split(':').pop().trim()));
  const exposedKeys = exposeKeysOf(code) ?? [];
  detail.names = {props: [], data: [], computed: [], methods: [], setup: [...declared, ...destructured, ...exposedKeys]};
  detail.exposes = exposeKeysOf(code);
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
  if (form === 'options' && uses['tpl:component-is'] !== undefined && detail.isStrings !== undefined) {
    bump(uses, 'tpl:component-is-string');
  }
  // What stands between this component and step B (`vapor`) — every construct has a ✔ row; these are the «at B» notes.
  if (uses['tpl:leading-comment'] !== undefined || uses['tpl:trailing-comment'] !== undefined || uses['tpl:inter-root-comment'] !== undefined) {
    detail.stepB.push('a comment outside the root (before, after or between the roots) — move it into the script (R24)');
  }
  if (uses['this:vueRoot'] !== undefined) {
    detail.stepB.push('`vueRoot(this)` — the app root through the instance: `useAppRoot()` (R26)');
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
    refAliases: detail.refAliases ?? [], isStrings: detail.isStrings ?? [], exposes: detail.exposes, template,
    // where the two blocks start in the FILE — a line of the script is printed as a line of the file
    scriptLine: script === '' ? 0 : text.slice(0, text.indexOf(script)).split('\n').length - 1,
    templateLine: template === '' ? 0 : text.slice(0, text.indexOf(template)).split('\n').length - 1,
  };
}

/**
 * What stands right after a ref's name: the MEMBER read off it, through whatever may stand between the two —
 * `[i]`, `?? undefined`, a closing parenthesis, a cast (`as {handleIntent?: (i: X) => boolean} | undefined`), `!`.
 * `member` is `undefined` when the expression ends there (the ref is HELD — a local, a return value, an argument).
 */
function chainAfter(text, from) {
  let i = from;
  for (;;) {
    const rest = text.slice(i, i + 400);
    let m;
    if ((m = /^\s+/.exec(rest)) !== null || (m = /^\[[^\]\n]*\]/.exec(rest)) !== null || (m = /^\?\?\s*(?:undefined|null)\b/.exec(rest)) !== null ||
      (m = /^\.value\b/.exec(rest)) !== null || (m = /^\)/.exec(rest)) !== null || (m = /^!(?!=)/.exec(rest)) !== null) {
      i += m[0].length;
      continue;
    }
    if ((m = /^as\s+/.exec(rest)) !== null) {
      // the cast's type runs to the bracket that closes the parenthesis round the cast, or to the statement's end
      i += m[0].length;
      let depth = 0;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(' || ch === '{' || ch === '[' || ch === '<') {
          depth++;
        } else if (ch === '>' && text[i - 1] === '=') {
          continue; // the arrow of a function type
        } else if (ch === ')' || ch === '}' || ch === ']' || ch === '>') {
          if (depth === 0) {
            break;
          }
          depth--;
        } else if ((ch === ';' || ch === ',' || ch === '\n') && depth === 0) {
          break;
        }
      }
      continue;
    }
    m = /^\??\.(\$?[A-Za-z_]\w*)/.exec(rest);
    return m !== null ? {member: m[1]} : {member: undefined};
  }
}

/** Where the block that encloses `from` ends (the first `}` that closes more than was opened after `from`). */
function blockEnd(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{') {
      depth++;
    } else if (text[i] === '}' && --depth < 0) {
      return i;
    }
  }
  return text.length;
}

/** The function a `return` at `lineStart` belongs to: a method / computed of the options, a `function`, a `const x = computed(`. */
function enclosingFunction(text, lineStart) {
  const indent = /^[ \t]*/.exec(text.slice(lineStart))[0].length;
  const lines = text.slice(0, lineStart).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === '' || /^[ \t]*/.exec(line)[0].length >= indent) {
      continue;
    }
    const m = /^\s*(?:async\s+)?(?:function\s+)?(\w+)\s*\([^)]*\)\s*(?::[^{]+)?\{\s*$/.exec(line) ?? /^\s*const\s+(\w+)\s*=\s*computed\(/.exec(line);
    return m !== null && !['if', 'for', 'while', 'switch', 'catch'].includes(m[1]) ? m[1] : undefined;
  }
  return undefined;
}

/**
 * Every member read off the ref that stands at `text[start…end)`: directly, off a LOCAL that holds it
 * (`const picker = (this.$refs.language ?? undefined) as {…} | undefined; picker?.handleIntent?.(…)`), or off the
 * member that RETURNS it (`sheetEl() { return this.$refs.sheet as …; }` … `this.sheetEl()?.heroEl()`).
 */
function followRef(text, start, end, note, depth = 0) {
  const chain = chainAfter(text, end);
  if (chain.member !== undefined) {
    note(chain.member);
    return;
  }
  if (depth > 2) {
    return;
  }
  const lineStart = text.lastIndexOf('\n', start) + 1;
  const head = text.slice(lineStart, start);
  const local = /(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*[(\s]*(?:await\s+)?(?:this\.)?$/.exec(head);
  if (local !== null) {
    const block = text.slice(end, blockEnd(text, end));
    for (const use of block.matchAll(new RegExp(`(?<![\\w.$])${local[1]}\\b`, 'g'))) {
      followRef(block, use.index, use.index + local[1].length, note, depth + 1);
    }
    return;
  }
  if (/\breturn\s+[(\s]*(?:this\.)?$/.test(head)) {
    const fn = enclosingFunction(text, lineStart);
    if (fn !== undefined) {
      for (const use of text.matchAll(new RegExp(`(?<![\\w$])(?:this\\.)?${fn}\\b(?:\\(\\s*\\))?`, 'g'))) {
        followRef(text, use.index, use.index + use[0].length, note, depth + 1);
      }
    }
  }
}

/**
 * What each component's PARENTS reach into it for through a ref. THREE answers, and the third is the complete one:
 * `reached` — the members the tool could FOLLOW (`this.$refs.<ref>…<member>` through a cast, a `?? undefined`, a local,
 * the `typedRefs` idiom, a member that returns the ref, `surfaces.at('<name>')`, `InstanceType<typeof X>`);
 * `holds` — which parents stand a ref on it at all; `touches` — EVERY line that names that ref. A read the tool cannot
 * follow is still one of those lines: the sheet prints them, and the converter reads them.
 */
function exposeLists(components) {
  const byName = new Map(components.map((c) => [c.name, c]));
  const reached = new Map();
  const holds = new Map();
  const touches = new Map();
  const note = (child, member, from) => {
    if (!byName.has(child)) {
      return;
    }
    const list = reached.get(child) ?? new Map();
    list.set(member, [...(list.get(member) ?? []), from]);
    reached.set(child, list);
  };
  const modules = tsFiles(CLIENT).map((file) => ({file: rel(file), text: fs.readFileSync(file, 'utf8'), childRefs: []}));
  const sources = [...components.map((c) => ({file: c.file, text: c.script, childRefs: c.childRefs, component: c})), ...modules];
  const touch = (child, file, text, index, offset) => {
    if (!byName.has(child)) {
      return;
    }
    const line = text.slice(0, index).split('\n').length;
    const row = `${file}:${line + offset}  ${text.split('\n')[line - 1].trim().slice(0, 150)}`;
    const rows = touches.get(child) ?? new Set();
    rows.add(row);
    touches.set(child, rows);
  };
  for (const source of sources) {
    for (const {ref, child} of source.childRefs) {
      if (ref === '') {
        continue;
      }
      // a ref on `<component :is>` may hold any component this file imports
      const children = child === '*' ? [...source.text.matchAll(/^import\s+(\w+)\s+from\s+'[^']+\.vue';?$/gm)].map((m) => m[1]) : [child];
      for (const name of children) {
        const held = holds.get(name) ?? new Set();
        held.add(`${path.basename(source.file)} ref="${ref.replace('@surface:', 'surfaces.bind.')}"`);
        holds.set(name, held);
      }
      // every place the ref is named, and the text it is named in
      const reads = [];
      if (ref.startsWith('@surface:')) {
        // the shell's surface registry: read by NAME from the controllers — `surfaces.at<T>('<name>')`
        // (the WHOLE expression, from the registry's own name on — `const panel = shell.surfaces.at<…>('x');` is then
        // seen as a local that holds the surface, and its member reads are followed)
        const at = new RegExp(`[\\w$]+(?:\\.[\\w$]+)*\\.at(?:<[^\\n]*?>)?\\(\\s*'${ref.slice(9)}'\\s*\\)`, 'g');
        for (const where of [...modules, {file: source.file, text: source.text, offset: source.component?.scriptLine}]) {
          for (const m of where.text.matchAll(at)) {
            reads.push({file: where.file, text: where.text, start: m.index, end: m.index + m[0].length, offset: where.offset ?? 0});
          }
        }
      } else {
        const id = ref.replace(/[$]/g, '\\$');
        const aliases = source.component?.refAliases ?? [];
        const forms = [`\\$refs\\.${id}\\b`, ...aliases.map((alias) => `\\b${alias}\\.${id}\\b`)];
        // a `<script setup>` parent: the ref's variable — `const v = useTemplateRef<…>('<ref>')`, or a `ref()` of that name
        for (const m of source.text.matchAll(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*useTemplateRef\\b[^\\n]*?\\(\\s*'${id}'\\s*\\)`, 'g'))) {
          forms.push(`(?<![\\w.$])${m[1]}\\.value\\b`);
        }
        if (new RegExp(`^(?:const|let)\\s+${id}\\s*=\\s*(?:shallowRef|ref)\\b`, 'm').test(source.text)) {
          forms.push(`(?<![\\w.$])${id}\\.value\\b`);
        }
        // a COMPUTED key (`this.$refs[name]`, `this.$refs[ref as 'a' | 'b']`) may mean any ref of this parent: the
        // read is followed for every child it stands a ref on (a name that is no member of a child is dropped below)
        forms.push('\\$refs\\[[^\\]\\n]+\\]');
        const pattern = new RegExp(forms.join('|'), 'g');
        for (const m of source.text.matchAll(pattern)) {
          reads.push({file: source.file, text: source.text, start: m.index, end: m.index + m[0].length, offset: source.component?.scriptLine ?? 0});
        }
        const template = source.component?.template ?? '';
        for (const m of template.matchAll(new RegExp(`\\$refs\\.${id}\\b`, 'g'))) {
          reads.push({file: source.file, text: template, start: m.index, end: m.index + m[0].length, offset: source.component?.templateLine ?? 0});
        }
      }
      for (const read of reads) {
        for (const name of children) {
          touch(name, read.file, read.text, read.start, read.offset);
          followRef(read.text, read.start, read.end, (member) => note(name, member, read.file));
        }
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
  // A member a parent reads and the child has NEVER exposed: the read is `undefined` today, and exposing it in a
  // conversion would change the parent's behaviour. Declared here, with the reason; the sheet says it.
  for (const [child, names] of Object.entries(UNEXPOSED_READS)) {
    for (const name of Object.keys(names)) {
      reached.get(child)?.delete(name);
    }
    if (reached.get(child)?.size === 0) {
      reached.delete(child);
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
  return {reached, holds, touches};
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
const {reached: exposed, holds: refHolds, touches: refTouches} = exposeLists(components);
/** A CONVERTED component that does not expose a member its parents read through a ref: the read is `undefined` at run time. */
const exposeGaps = components.filter((c) => c.form !== 'options').flatMap((c) => {
  const need = [...(exposed.get(c.name)?.keys() ?? [])].filter((member) => !member.startsWith('$'));
  const missing = need.filter((member) => !(c.exposes ?? []).includes(member));
  return missing.length === 0 ? [] : [`${c.file}: parents read ${missing.map((m) => `\`${m}\``).join(', ')} through a ref — not in its defineExpose (R11)`];
});
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
  const held = [...(refHolds.get(target.name) ?? [])];
  const lines = [...(refTouches.get(target.name) ?? [])];
  console.log(reach !== undefined ?
    `  MUST EXPOSE (R11): ${[...reach].map(([member, from]) => `${member} ← ${[...new Set(from)].map((f) => path.basename(f)).join(', ')}`).join(' · ')}` :
    held.length === 0 ? '  MUST EXPOSE (R11): nothing — no parent stands a ref on it (write no `defineExpose`)' :
      lines.length === 0 ? `  MUST EXPOSE (R11): nothing — a ref is held and never read (${held.join(', ')})` :
        '  MUST EXPOSE (R11): nothing the tool could follow — READ the lines below, they decide');
  if (lines.length > 0) {
    console.log('  every line that names a ref standing on it (the list above is what the tool followed; these lines WIN):');
    for (const line of lines) {
      console.log(`    ${line}`);
    }
  }
  if (target.form !== 'options' && target.exposes !== undefined) {
    console.log(`  exposes today: ${target.exposes.join(', ')}`);
  }
  const ownExpose = target.form === 'options' ? /\bexpose\(\s*\{([^}]*)\}/.exec(target.script) : null;
  if (ownExpose !== null) {
    console.log(`  ITS OWN \`expose({…})\` IS THE CONTRACT (R11): ${ownExpose[1].split(',').map((part) => part.split(':')[0].trim()).filter(Boolean).join(', ')} — \`defineExpose\` holds exactly these`);
  }
  for (const [name, why] of Object.entries(UNEXPOSED_READS[target.name] ?? {})) {
    console.log(`  NOT exposed, though a parent reads it: ${name} — ${why}`);
  }
  console.log(`  mounted by: ${(mountedBy.get(target.name) ?? ['(nobody by tag — a lazy / dynamic mount)']).join(', ')}`);
  const specTexts = tsFiles(path.join(ROOT, 'tests', 'client')).filter((file) => file.endsWith('.spec.ts')).map((file) => ({file: rel(file), text: fs.readFileSync(file, 'utf8')}));
  const specs = specTexts.filter(({text}) => new RegExp(`/${target.name}\\.vue'`).test(text)).map(({file}) => file);
  console.log(`  unit specs that import it (re-run them): ${specs.length === 0 ? 'none — it gets one in its conversion (RECIPES § 3)' : specs.join(', ')}`);
  // …and the specs of its PARENTS that stub it or find it by name: they mount it too
  const naming = specTexts.filter(({file, text}) => !specs.includes(file) && new RegExp(`\\b${target.name}\\b`).test(text)).map(({file}) => file);
  if (naming.length > 0) {
    console.log(`  specs that NAME it (a parent's — they stub it or find it; re-run them too): ${naming.join(', ')}`);
  }
  // SOURCE GUARDS — server-runner specs that read the component's TEXT (`fs.readFileSync('…/X.vue')`, then a slice by
  // its Options form: a member's 4-space indent, `this.x`, a `watch` key). Nothing compiles against that text: a
  // conversion turns each one red (or — worse — blind), and the unit runner never sees them.
  const guards = tsFiles(path.join(ROOT, 'tests')).filter((file) => file.endsWith('.ts') && !rel(file).startsWith('tests/client/') && !rel(file).startsWith('tests/e2e/'))
    .filter((file) => new RegExp(`\\b${target.name}\\.vue\\b`).test(fs.readFileSync(file, 'utf8'))).map((file) => rel(file));
  if (guards.length > 0) {
    console.log(`  SOURCE GUARDS that read its text (server runner — run each, re-point the lines that read THIS component): ${guards.join(', ')}`);
  }
  if (target.isStrings.length > 0 && target.uses['tpl:component-is'] !== undefined) {
    console.log(`  \`<component :is>\` may be fed a STRING naming ${target.isStrings.join(', ')} (R21 — the string becomes the imported component)`);
  }
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
  // (an Options component only: in a converted one the const of that name IS the template ref)
  const clash = target.templateRefs.filter((name) => target.form === 'options' && target.names !== undefined &&
    [...target.names.data, ...target.names.computed, ...target.names.methods].includes(name));
  const propKeys = target.templateRefs.filter((name) => target.form === 'options' && target.names !== undefined && target.names.props.includes(name));
  if (propKeys.length > 0) {
    console.log(`  REF KEY = A PROP'S NAME (R11): ${propKeys.join(', ')} — the prop keeps its name, the ref's const takes another (\`${propKeys[0]}El\`)`);
  }
  const setupKeys = target.templateRefs.filter((name) => target.form === 'options' && target.names !== undefined && target.names.setup.includes(name));
  if (setupKeys.length > 0) {
    console.log(`  a setup() ref BINDS the template ref of its name (R8 — it stays a \`ref()\`, already the script-setup form): ${setupKeys.join(', ')}`);
  }
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
    components: components.map(({script: _script, template: _template, ...c}) => ({...c, expose: [...(exposed.get(c.name)?.keys() ?? [])].sort(),
      refLines: [...(refTouches.get(c.name) ?? [])], mountedBy: mountedBy.get(c.name) ?? []})),
  }, null, 1));
}
if (exposeGaps.length > 0) {
  console.error(`\nA CONVERTED COMPONENT HIDES WHAT A PARENT READS (${exposeGaps.length}) — add the member to its defineExpose:`);
  for (const row of exposeGaps) {
    console.error(`  ${row}`);
  }
  process.exitCode = 1;
}
if (unknown.length > 0 || unrecipied.length > 0) {
  console.error(`\nNO RECIPE for ${unknown.length + unrecipied.length} construct(s) — add the row to RECIPES.md and to RECIPES here:`);
  for (const row of [...unrecipied.map((key) => `construct «${key}»`), ...unknown]) {
    console.error(`  ${row}`);
  }
  process.exit(1);
}
