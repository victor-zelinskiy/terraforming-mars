/*
 * Webpack config for the UNIT RUNNER (`scripts/client-tests.mjs` — `npm run test:client`). It is the production
 * client config with ONE difference that is load-bearing: the test bundle is a SINGLE CHUNK.
 *
 * WHY (this shipped as a silent «0 passing» for months — CONSOLE_BLUE_ACTION_PARITY it. 16 and it. 26 both lost time
 * to it):
 *
 * `webpack.config.js` splits `node_modules` into a fixed-name `vendors` cache group with `chunks: 'all'`. A fixed NAME
 * merges every matching module into the SAME output chunk — including modules that are only reachable through a lazy
 * `import()` (gsap's via gsapMotionBridge, chart.js's via VictoryPointChart). The runner hands mocha the entry file;
 * with a second chunk beside it the entry starts up through `__webpack_require__.O(0, ['vendors'], …)`, a deferred
 * startup that never resolves in node — the entry module NEVER RUNS: no `describe` is ever registered, mocha reports
 * «0 passing», and the process exits 0. Because every spec of a batch shares that one entry, a single spec whose
 * import graph reaches a lazy chunk silences the WHOLE batch.
 *
 * The fix belongs here and not in a spec: the defect is a property of the chunking, so stubbing one component only
 * hides the next occurrence. The test build therefore has NO async chunks at all (`dynamicImportMode: 'eager'`) and
 * NO split chunks — exactly one chunk. As a bonus, `import()` resolves synchronously instead of asking JSDOM to fetch
 * a script it cannot fetch, so lazily-loaded code becomes testable.
 *
 * ⚠️ `LimitChunkCountPlugin({maxChunks: 1})` is NOT a substitute (measured under the previous runner: merging the
 * async chunk INTO `main` changes which chunk group the entry belongs to). Don't "simplify" this back.
 *
 * Guards, two of them: the runner itself refuses a build that is not ONE chunk, by name; and `npm run test:client`
 * goes through `scripts/run-tests.mjs`, which fails the run when fewer tests are COLLECTED than its `--min` floor —
 * a silent zero can never be green again.
 *
 * (History: until 2026-11-12 the runner was `mochapack` 2.1.5. It deep-required `webpack/lib/Watching`, which webpack
 * 5.112.0 moved, and `mocha/lib/cli/run-helpers`, which mocha 12 dropped — it pinned both tools a version behind.
 * The runner is ours now and uses only their public APIs; neither pin is needed.)
 */
const path = require('path');

// THE UNIT BUNDLE'S VAPOR POLICY (scripts/vapor/unitVaporPolicy.cjs): a component is compiled AS WRITTEN — a Vapor one
// meets its specs under the Vapor runtime — except an entry of the valve (tests/client/vaporUnit.json) and a
// `TM_UNIT_VAPOR=none` run, which are compiled for the virtual DOM. Raised BEFORE the base config loads: the template
// compiler it names reads the flag.
process.env.TM_VAPOR_POLICY = 'unit';

const base = require('./webpack.config.js');

// The in-build type check is a separate gate (`npm run build:test` +
// `npm run lint:client`); running a full tsc inside every test build
// only lengthens the feedback loop. Same for the progress/emoji logger plugins,
// which are pure noise in a test log.
const NOISY = new Set(['ForkTsCheckerWebpackPlugin', 'ProgressPlugin']);
const plugins = base.plugins.filter((plugin) => {
  if (plugin === null || plugin === undefined) return false;
  if (NOISY.has(plugin.constructor?.name)) return false;
  // The anonymous {apply(compiler)} build-start/-end logger.
  return typeof plugin.apply !== 'function' || plugin.constructor !== Object;
});

module.exports = {
  ...base,
  mode: 'development',
  plugins,
  // `@vue/test-utils`, VAPOR-AWARE (tests/client/testing/vaporTestUtils.ts): a spec's `mount(<a Vapor component>)`
  // stands it under a virtual-DOM host and returns a wrapper that speaks for the component. The real package keeps
  // its CJS build (the base config's alias) under the name the shim imports it by.
  resolve: {
    ...base.resolve,
    alias: {
      // (first, and the base's own prefix alias of the package dropped: webpack takes the FIRST alias that matches)
      '@vue/test-utils-real$': base.resolve.alias['@vue/test-utils'],
      '@vue/test-utils$': path.resolve(__dirname, 'tests/client/testing/vaporTestUtils.ts'),
      // `vue` itself, with the three calls a compiled Vapor template makes to create a component wrapped
      // (tests/client/testing/vueForTests.ts): the stubs of a mount and the registry `findComponent` reads.
      'vue-real$': base.resolve.alias['vue$'],
      'vue$': path.resolve(__dirname, 'tests/client/testing/vueForTests.ts'),
      ...Object.fromEntries(Object.entries(base.resolve.alias).filter(([name]) => name !== '@vue/test-utils' && name !== 'vue$')),
    },
  },
  module: {
    ...base.module,
    rules: [
      {test: /\.vue$/, enforce: 'pre', loader: path.resolve(__dirname, 'scripts/vapor/unitVaporLoader.cjs')},
      ...base.module.rules,
    ],
    // No `import()` chunk may exist in a test build (see the header).
    parser: {javascript: {dynamicImportMode: 'eager'}},
  },
  optimization: {
    ...base.optimization,
    splitChunks: false,
    runtimeChunk: false,
  },
};
