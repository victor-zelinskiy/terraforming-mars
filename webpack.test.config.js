/*
 * Webpack config for the UNIT RUNNER (mochapack). It is the production client
 * config with ONE difference that is load-bearing: the test bundle is a SINGLE
 * CHUNK.
 *
 * WHY (this shipped as a silent «0 passing» for months — CONSOLE_BLUE_ACTION_PARITY
 * it. 16 and it. 26 both lost time to it):
 *
 * `webpack.config.js` splits `node_modules` into a fixed-name `vendors` cache
 * group with `chunks: 'all'`. A fixed NAME merges every matching module into the
 * SAME output chunk — including modules that are only reachable through a lazy
 * `import()` (markdown-it's deps via CardHelp.vue, gsap's via gsapMotionBridge,
 * chart.js's via VictoryPointChart). The `vendors` chunk therefore becomes a
 * child of BOTH the initial entrypoint AND an async chunk group, so
 * `chunk.isOnlyInitial()` is FALSE for it.
 *
 * mochapack hands mocha only the chunks that answer `isOnlyInitial()` (see
 * `mochapack/lib/webpack/util/getBuildStats.js`). `vendors.js` is skipped, while
 * `main.js` — which carries the runtime and mochapack's entry module — starts up
 * through `__webpack_require__.O(0, ['vendors'], …)`. That deferred startup never
 * resolves, so the entry module NEVER RUNS: no `describe` is ever registered,
 * mocha reports «0 passing», and the process exits 0. Because every spec of a
 * batch shares that one entry module, a single spec whose import graph reaches a
 * lazy chunk silences the WHOLE batch.
 *
 * The fix belongs here and not in a spec: the defect is a property of the
 * chunking, so stubbing one component only hides the next occurrence. The test
 * build therefore has NO async chunks at all (`dynamicImportMode: 'eager'`) and
 * NO split chunks, which leaves exactly one chunk that is only-initial. As a
 * bonus, `import()` resolves synchronously instead of asking JSDOM to fetch a
 * script it cannot fetch, so lazily-loaded code becomes testable.
 *
 * ⚠️ `LimitChunkCountPlugin({maxChunks: 1})` is NOT a substitute: merging the
 * async chunk INTO `main` makes `main` a member of the async chunk group, so
 * `isOnlyInitial()` goes false for it too and mocha then receives no files at
 * all. Measured — don't "simplify" this back.
 *
 * Guard: `npm run test:client` runs through `scripts/run-tests.mjs`, which fails
 * the run when fewer tests are COLLECTED than its `--min` floor — so a silent
 * zero can never be green again.
 */
const base = require('./webpack.config.js');

// The in-build type check is a separate gate (`npm run build:test` +
// `npm run lint:client`); running a full tsc inside every mochapack invocation
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
  module: {
    ...base.module,
    // No `import()` chunk may exist in a test build (see the header).
    parser: {javascript: {dynamicImportMode: 'eager'}},
  },
  optimization: {
    ...base.optimization,
    splitChunks: false,
    runtimeChunk: false,
  },
};
