/*
 * THE TEMPLATE COMPILER vue-loader IS HANDED — it makes the webpack build able to compile a VAPOR single-file component.
 *
 * Why this file exists (the Vue 3.6 pilot — docs/claude/vapor/ROADMAP.md §3.6):
 *
 *   `vue-loader` 17.4.2 is the latest there is (its last commit is from January 2024) and it knows nothing of Vapor.
 *   `@vue/compiler-sfc` 3.6 does: a `<script setup vapor>` block becomes `defineVaporComponent(…)`, and
 *   `compileTemplate({vapor: true})` picks `@vue/compiler-vapor`. The loader calls `compileTemplate` WITHOUT that flag.
 *
 *   · In a PRODUCTION build a `<script setup>` component's template is compiled INLINE by `compileScript`, which reads
 *     the flag off the descriptor itself — so the shipped bundle compiled Vapor components correctly even before this
 *     file.
 *   · In every OTHER build (the unit-test bundle `webpack.test.config.js`, `npm run dev:client`) the template goes
 *     through the loader's own template loader: a Vapor component got a virtual-DOM render function attached to a
 *     `defineVaporComponent` — a component that mounts nothing.
 *
 * `compileTemplate` takes its compiler from the loader's `compiler` option when one is given. So this module IS that
 * option: the DOM compiler for every component, the Vapor compiler for a component whose `<script>` or `<template>`
 * carries the `vapor` attribute — the same rule `@vue/compiler-sfc` applies when it parses the file
 * (`descriptor.vapor`). One rule, both build modes, no patched dependency.
 *
 * The cost: a compiler that is not the default one makes `compileTemplate` re-parse the template instead of reusing
 * the descriptor's AST (it cannot know the AST came from the same parser). One extra parse per component per build.
 *
 * When this file can go: when the build stops going through `vue-loader` (a loader that passes `vapor` itself, or
 * another bundler's Vue plugin). ROADMAP §3.6 keeps the decision.
 */
'use strict';

const fs = require('fs');
const dom = require('@vue/compiler-dom');
const vapor = require('@vue/compiler-vapor');
const {unitCompilesAsVapor, unitPolicyActive} = require('./unitVaporPolicy.cjs');

/** `<script … vapor>` / `<template vapor>` — the attribute as a whole word inside the opening tag of either block. */
const VAPOR_BLOCK = /<(?:script|template)\b[^>]*?\svapor(?=[\s=>/])[^>]*>/;

/** filename → {mtimeMs, vapor}: a watch build re-reads a file only when it changed. */
const seen = new Map();

function isVaporSfc(filename) {
  if (typeof filename !== 'string' || !filename.endsWith('.vue')) {
    return false;
  }
  // The UNIT bundle compiles a Vapor component its policy sends to the virtual DOM (the valve of
  // unitVaporPolicy.cjs, a `TM_UNIT_VAPOR=none` run) for the virtual DOM: the pre-loader took the attribute off the
  // source vue-loader saw, and this compiler reads the file itself.
  if (unitPolicyActive() && !unitCompilesAsVapor(filename)) {
    return false;
  }
  let stat;
  try {
    stat = fs.statSync(filename);
  } catch {
    return false;
  }
  const known = seen.get(filename);
  if (known !== undefined && known.mtimeMs === stat.mtimeMs) {
    return known.vapor;
  }
  const isVapor = VAPOR_BLOCK.test(fs.readFileSync(filename, 'utf8'));
  seen.set(filename, {mtimeMs: stat.mtimeMs, vapor: isVapor});
  return isVapor;
}

module.exports = {
  ...dom,
  // `compileTemplate` parses with the compiler it compiles with; both compilers share the DOM parser.
  parse: dom.parse,
  compile(source, options) {
    if (isVaporSfc(options && options.filename)) {
      // What `compileTemplate({vapor: true})` would have set beside the choice of the compiler.
      return vapor.compile(source, {...options, bindingMetadata: options.bindingMetadata ?? {}});
    }
    return dom.compile(source, options);
  },
  /** For the build's own guard (tests/console/vaporBuild.spec.ts). */
  isVaporSfc,
};
