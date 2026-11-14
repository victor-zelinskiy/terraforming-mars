#!/usr/bin/env node
/**
 * WHAT THE SOURCES DECLARE — the universe of the kernel's FLOWS, read off `src/client`.
 *
 * Every lifetime of the console is a scope with a kind and a label, opened through a handful of constructors
 * (`.claude/rules/console-flow.md`). This module lists the labels the sources write as LITERALS — the flows that exist —
 * in the very form the page's coverage keys name them (`src/client/console/kernel/flowCoverage.ts` `coverageScope`):
 *
 *   createFlowRun('x') · deriveFlowRun('x')                               → scene:x      (or its `kind:` option)
 *   useFlowScope('x'[, 'kind'])                                            → surface:x
 *   scopedState('x')                                                       → step:x
 *   owedAnswer('x')                                                        → step:owed:x
 *   beginAnimationHold('x') · registerAnimationHoldSupplier('x') · holdAnimationWhile('x') · holdForGsapAnimation('x')
 *                                                                          → scene:hold:x
 *   owePresentation({id: 'x'})                                             → story:owed:x
 *   <scope>.open('kind', 'x') · sessionChild(held, 'kind', 'x')            → kind:x
 *
 * A label built at run time (a template with a hole, a variable) is not a literal: it is counted as DYNAMIC and left
 * out of the universe — its flows are seen only when they run.
 *
 * Used by `scripts/monkey-report.mjs` («N % of the declared flows were opened; these never were») and runnable by
 * itself: `node scripts/flow-universe.mjs [--json]`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The same normalisation the page applies to a scope's id (`coverageScope`). */
export function coverageScope(id) {
  const plain = String(id).replace(/#[0-9a-z]*/gi, '').replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim();
  return plain.startsWith('claim:') ? plain.split('/')[0] : plain;
}

const Q = '[\'"`]';
const LABEL = '([^\'"`$\\\\]+)';
/** constructor → how its literal label becomes a scope id. `kindAfter`: the call may name its kind itself. */
const CONSTRUCTORS = [
  {re: new RegExp(`\\b(?:createFlowRun|deriveFlowRun)\\(\\s*${Q}${LABEL}${Q}`, 'g'), kind: 'scene', kindOption: true},
  {re: new RegExp(`\\buseFlowScope\\(\\s*${Q}${LABEL}${Q}(?:\\s*,\\s*${Q}([a-z]+)${Q})?`, 'g'), kind: 'surface', kindGroup: 2},
  {re: new RegExp(`\\bscopedState\\(\\s*${Q}${LABEL}${Q}`, 'g'), kind: 'step'},
  {re: new RegExp(`\\bowedAnswer\\(\\s*${Q}${LABEL}${Q}`, 'g'), kind: 'step', prefix: 'owed:'},
  {re: new RegExp(`\\b(?:beginAnimationHold|registerAnimationHoldSupplier|holdAnimationWhile|holdForGsapAnimation)\\(\\s*${Q}${LABEL}${Q}`, 'g'), kind: 'scene', prefix: 'hold:'},
  {re: new RegExp(`\\bowePresentation\\(\\s*\\{\\s*id:\\s*${Q}${LABEL}${Q}`, 'g'), kind: 'story', prefix: 'owed:'},
  {re: new RegExp(`\\.open\\(\\s*${Q}([a-z]+)${Q}\\s*,\\s*${Q}${LABEL}${Q}`, 'g'), kindGroup: 1, labelGroup: 2},
  {re: new RegExp(`\\bsessionChild\\(\\s*[^,]+,\\s*${Q}([a-z]+)${Q}\\s*,\\s*${Q}${LABEL}${Q}`, 'g'), kindGroup: 1, labelGroup: 2},
];
/** The same constructors with a label that is not a plain literal — counted, never listed. */
const DYNAMIC = /\b(?:createFlowRun|deriveFlowRun|useFlowScope|scopedState|owedAnswer|beginAnimationHold|registerAnimationHoldSupplier|holdAnimationWhile|holdForGsapAnimation)\(\s*(?:`[^`]*\$\{|[A-Za-z_$][\w$.]*\s*[,)])/g;

/** Comments name constructors freely — they are not declarations. */
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^\s*(?:\/\/|\*).*$/gm, '');
}

/** The declared flows of one source text: `[{id, line}]`. Pure. */
export function declaredFlowsIn(text) {
  const src = code(text);
  const out = [];
  for (const c of CONSTRUCTORS) {
    c.re.lastIndex = 0;
    let m;
    while ((m = c.re.exec(src)) !== null) {
      const label = m[c.labelGroup ?? 1];
      let kind = c.kindGroup !== undefined && m[c.kindGroup] !== undefined ? m[c.kindGroup] : c.kind;
      if (c.kindOption === true) {
        // `createFlowRun('x', {…, kind: 'story'})` — the option, within the call's own few lines.
        const tail = src.slice(m.index, m.index + 400);
        const own = /^[^;]*?\bkind:\s*['"`]([a-z]+)['"`]/.exec(tail);
        if (own !== null) {
          kind = own[1];
        }
      }
      if (kind === undefined || label === undefined) {
        continue;
      }
      out.push({id: coverageScope(`${kind}:${c.prefix ?? ''}${label}`), line: src.slice(0, m.index).split('\n').length});
    }
  }
  return out;
}

export function dynamicFlowsIn(text) {
  return (code(text).match(DYNAMIC) ?? []).length;
}

/** Every flow the client's sources declare: `{flows: {id → [file:line]}, dynamic}`. */
export function flowUniverse(root = ROOT) {
  const flows = {};
  let dynamic = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|vue)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        if (!/FlowRun\(|useFlowScope\(|scopedState\(|owedAnswer\(|AnimationHold|holdForGsapAnimation\(|owePresentation\(|\.open\(|sessionChild\(/.test(text)) {
          continue;
        }
        const file = path.relative(root, full).replace(/\\/g, '/');
        // The kernel's own definitions of these constructors are not declarations of a flow.
        if (file.startsWith('src/client/console/kernel/')) {
          continue;
        }
        dynamic += dynamicFlowsIn(text);
        for (const flow of declaredFlowsIn(text)) {
          (flows[flow.id] ??= []).push(`${file}:${flow.line}`);
        }
      }
    }
  };
  walk(path.join(root, 'src', 'client'));
  return {flows, dynamic};
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const universe = flowUniverse();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(universe, null, 1));
  } else {
    const ids = Object.keys(universe.flows).sort();
    const byKind = {};
    for (const id of ids) {
      const kind = id.split(':')[0];
      byKind[kind] = (byKind[kind] ?? 0) + 1;
    }
    console.log(`${ids.length} declared flow(s) — ${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(' · ')}; ${universe.dynamic} site(s) with a label built at run time`);
    for (const id of ids) {
      console.log(`  ${id}   ${universe.flows[id][0]}${universe.flows[id].length > 1 ? ` (+${universe.flows[id].length - 1})` : ''}`);
    }
  }
}
