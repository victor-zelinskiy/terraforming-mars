#!/usr/bin/env node
/*
 * THE CONVERSION AUDIT — two things a mechanical Options → `<script setup>` conversion gets SILENTLY wrong
 * (docs/claude/vapor/RECIPES.md § R25 · § R12). Nothing compiles against either, no unit spec of a single mount shows
 * either, and each shipped once in V3 wave 4 before it was seen:
 *
 *  A. HIDDEN MODULE STATE. In `<script setup>` every top-level statement is INSTANCE code. A table that stood at
 *     MODULE level of the Options form — one for the whole client — and that the script WRITES through (`x.a = …`,
 *     `x[k].n++`, `x.list.push(…)`, also through a one-step alias `const s = x[k]; s.n = …`) is now one per instance:
 *     a baseline two mounts no longer share, a scene context a re-mount forgets. Such a table lives in a sibling `.ts`.
 *     A table that IS per-instance on purpose (it was a `setup()` key, or a `data()` registry) is an ALLOWED row
 *     with its reason.
 *
 *  B. A DEFERRED ELEMENT CAST. `(root.value as HTMLElement)` is the unguarded form of `this.$el` — right while the
 *     component stands. After an unmount `this.$el` was the detached element; the template ref is `null`, and the cast
 *     throws. A cast of a template ref to an element type inside a callback that can run later (a `nextTick`, a
 *     promise, an observer, a returned getter, code after an `await`) is that throw waiting for a leave.
 *
 * Usage: node scripts/vapor/audit.mjs [--json]      exit 1 when either list is not empty.
 * Guard: tests/console/vaporConversionAudit.spec.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve('src/client');
const JSON_OUT = process.argv.includes('--json');

/** Tables a `<script setup>` script writes through that are per-instance ON PURPOSE — each with its reason. */
const INSTANCE_TABLES = {
  'src/client/components/cardAnnotations/CardAnnotationsLayer.vue': {
    fx: 'the layer\'s own effect handles — a key of its Options `setup()`, per instance before the conversion too',
  },
  'src/client/components/console/ConsoleStrategyRail.vue': {
    ledgers: 'the rail\'s own before/after ledgers — stashed on the instance in the Options form, one per rail by design',
  },
};

const MUTATORS = new Set(['push', 'pop', 'splice', 'shift', 'unshift', 'set', 'add', 'delete', 'clear', 'sort', 'reverse', 'fill', 'copyWithin']);
/** Callees whose callback argument runs LATER (and may run after the unmount). */
const DEFERRED = /^(?:nextTick|setTimeout|setInterval|requestAnimationFrame|queueMicrotask|then|catch|finally|delayedCall|whenPainted)$/;
const ELEMENT_TYPE = /^(?:HTML\w*Element|SVG\w*Element|Element)$/;

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
    } else if (entry.name.endsWith('.vue')) {
      files.push(p);
    }
  }
})(ROOT);

const rootOf = (node) => {
  let n = node;
  while (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isNonNullExpression(n) || ts.isParenthesizedExpression(n) || ts.isAsExpression(n)) {
    n = n.expression;
  }
  return ts.isIdentifier(n) ? n.text : undefined;
};
const isFunction = (node) => ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);

const tables = [];
const casts = [];
let scanned = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const m = /<script setup[^>]*>([\s\S]*?)<\/script>/.exec(text);
  if (m === null) {
    continue;
  }
  scanned++;
  const script = m[1];
  const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
  const sf = ts.createSourceFile('x.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lineOf = (node) => text.slice(0, m.index).split('\n').length + sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;

  // ── A. top-level literal tables the script writes through
  const own = new Map();
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) {
      continue;
    }
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.initializer === undefined) {
        continue;
      }
      let init = d.initializer;
      while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init) || ts.isSatisfiesExpression(init)) {
        init = init.expression;
      }
      if ((ts.isObjectLiteralExpression(init) && init.properties.length > 0) || (ts.isArrayLiteralExpression(init) && init.elements.length > 0)) {
        own.set(d.name.text, {node: d, writes: []});
      }
    }
  }
  if (own.size > 0) {
    const aliases = new Map();
    (function scan(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined && !own.has(node.name.text)) {
        const from = rootOf(node.initializer);
        if (from !== undefined && own.has(from) && (ts.isPropertyAccessExpression(node.initializer) || ts.isElementAccessExpression(node.initializer))) {
          aliases.set(node.name.text, from);
        }
      }
      const tableOf = (target) => {
        if (!ts.isPropertyAccessExpression(target) && !ts.isElementAccessExpression(target)) {
          return undefined;
        }
        const name = rootOf(target);
        return name === undefined ? undefined : own.has(name) ? name : aliases.get(name);
      };
      let hit;
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        hit = tableOf(node.left);
      } else if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)) {
        hit = tableOf(node.operand);
      } else if (ts.isDeleteExpression(node)) {
        hit = tableOf(node.expression);
      } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && MUTATORS.has(node.expression.name.text)) {
        hit = tableOf(node.expression);
      }
      if (hit !== undefined) {
        own.get(hit).writes.push(lineOf(node));
      }
      ts.forEachChild(node, scan);
    })(sf);
    for (const [name, table] of own) {
      if (table.writes.length > 0 && INSTANCE_TABLES[rel]?.[name] === undefined) {
        tables.push({file: rel, line: lineOf(table.node), name, writes: [...new Set(table.writes)].slice(0, 6)});
      }
    }
  }
  for (const name of Object.keys(INSTANCE_TABLES[rel] ?? {})) {
    if (!own.has(name) || own.get(name).writes.length === 0) {
      tables.push({file: rel, line: 0, name, writes: [], stale: true});
    }
  }

  // ── B. a template ref cast to an element inside a callback that runs later
  const refs = new Set([...script.matchAll(/\bconst (\w+) = useTemplateRef\b/g)].map((x) => x[1]));
  if (refs.size > 0) {
    // functions handed BY NAME to a deferred callee (`nextTick(fit)`, `.then(measure)`, `new ResizeObserver(fit)`)
    const deferredNames = new Set();
    (function collect(node) {
      if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.arguments !== undefined) {
        const callee = node.expression;
        const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
        if (DEFERRED.test(name) || (ts.isNewExpression(node) && /Observer$/.test(name))) {
          for (const arg of node.arguments) {
            if (ts.isIdentifier(arg)) {
              deferredNames.add(arg.text);
            }
          }
        }
      }
      ts.forEachChild(node, collect);
    })(sf);
    (function scan(node, why, afterAwait) {
      let by = why;
      let awaited = afterAwait;
      if (isFunction(node)) {
        awaited = {seen: false};
        const parent = node.parent;
        if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && (parent.arguments ?? []).includes(node)) {
          const callee = parent.expression;
          const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
          if (DEFERRED.test(name) || (ts.isNewExpression(parent) && /Observer$/.test(name))) {
            by = name;
          }
        } else if (ts.isFunctionDeclaration(node) && node.name !== undefined && deferredNames.has(node.name.text)) {
          by = `${node.name.text}() handed to a deferred call`;
        }
      }
      if (ts.isAwaitExpression(node) && awaited !== undefined) {
        ts.forEachChild(node, (child) => scan(child, by, awaited));
        awaited.seen = true;
        return;
      }
      if (ts.isAsExpression(node) && ELEMENT_TYPE.test(node.type.getText(sf)) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'value' && ts.isIdentifier(node.expression.expression) && refs.has(node.expression.expression.text)) {
        const reason = by ?? (awaited?.seen === true ? 'code after an `await`' : undefined);
        if (reason !== undefined) {
          casts.push({file: rel, line: lineOf(node), code: node.getText(sf), inside: reason});
        }
      }
      ts.forEachChild(node, (child) => scan(child, by, awaited));
    })(sf, undefined, undefined);
  }
}

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({scanned, tables, casts}, null, 1) + '\n');
} else {
  console.log(`conversion audit — ${scanned} <script setup> components`);
  console.log(`A. top-level tables WRITTEN through (per instance now — move to a sibling .ts, or allow with a reason): ${tables.length}`);
  for (const t of tables) {
    console.log(t.stale ? `   ${t.file}  «${t.name}» — an ALLOWED row that is no longer needed: remove it` : `   ${t.file}:${t.line}  «${t.name}» — written at line(s) ${t.writes.join(', ')}`);
  }
  console.log(`B. a template ref cast to an element inside a callback that runs later (guard it — R12): ${casts.length}`);
  for (const c of casts) {
    console.log(`   ${c.file}:${c.line}  ${c.code}  — inside ${c.inside}`);
  }
}
process.exit(tables.length + casts.length > 0 ? 1 : 0);
