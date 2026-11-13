/*
 * WHICH RUNTIME A UNIT SPEC MEETS (docs/claude/vapor/ROADMAP.md § 4a · B6).
 *
 * A `<script setup vapor>` component is the SAME script and the SAME template as its `<script setup>` form — the
 * attribute only picks the compiler and the runtime. The product (and every e2e spec) runs what the attribute says,
 * and so does the UNIT bundle: a converted component is compiled AS WRITTEN and its specs prove the runtime that
 * ships. `@vue/test-utils` is a virtual-DOM tool, and what it cannot do over a Vapor tree — mount a Vapor root, stub
 * the children of a Vapor parent, find a component inside one — the suite's own layer does for every spec
 * (tests/client/testing/vaporTestUtils.ts; measured on the whole client flipped, 2026-11-13: 9850 of 9860 tests green
 * under the true runtime, the ten left being facts about the PRODUCT, not about the tool).
 *
 * THE VALVE — `tests/client/vaporUnit.json` § `virtualDomInUnit`: `{"<file>": "<the reason>"}`. A component listed
 * there is compiled for the VIRTUAL DOM in the unit bundle (its attribute is dropped before `vue-loader` sees the
 * file): its specs keep proving its LOGIC while a named, open piece of product work stands between them and the true
 * runtime. EMPTY is the norm; an entry is debt with its reason written down, the guard
 * (tests/console/vaporUnitPolicy.spec.ts) holds the count under a ceiling that only falls, and the switch to
 * `createVaporApp` takes an empty list.
 *
 * `TM_UNIT_VAPOR` overrides it for one run:
 *   · `all`  — every component as written, the valve IGNORED (`npm run test:client:vapor[:one]`): which entries are
 *              still needed;
 *   · `none` — nothing of `src/client` as Vapor (`npm run test:client:vdom:one -- <spec>`): «is this red about the
 *              runtime at all?».
 * A file OUTSIDE `src/client` (the capability fixtures, the layer's own) is always compiled as written.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LIST_FILE = path.join(ROOT, 'tests', 'client', 'vaporUnit.json');
const SRC_CLIENT = path.join(ROOT, 'src', 'client') + path.sep;

let valve;
function virtualDomInUnit() {
  if (valve === undefined) {
    const raw = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
    valve = new Set(Object.keys(raw.virtualDomInUnit ?? {}).map((file) => path.resolve(ROOT, file).toLowerCase()));
  }
  return valve;
}

/** Does the UNIT bundle compile this file's `vapor` attribute as written? */
function unitCompilesAsVapor(filename) {
  const file = path.resolve(String(filename).split('?')[0]);
  if (!file.toLowerCase().startsWith(SRC_CLIENT.toLowerCase())) {
    return true;
  }
  const mode = process.env.TM_UNIT_VAPOR;
  if (mode === 'all') {
    return true;
  }
  if (mode === 'none') {
    return false;
  }
  return !virtualDomInUnit().has(file.toLowerCase());
}

/** Is the policy in force at all? Only inside the unit bundle (`webpack.test.config.js` raises the flag). */
function unitPolicyActive() {
  return process.env.TM_VAPOR_POLICY === 'unit';
}

module.exports = {unitCompilesAsVapor, unitPolicyActive, LIST_FILE};
