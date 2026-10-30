const path = require('path');
const webpack = require('webpack');

// Makes the .vue file format parseable.
const {VueLoaderPlugin} = require('vue-loader');
// Compresses resources for smaller download.
const CompressionPlugin = require('compression-webpack-plugin');
// Speeds up typescript type checking into a separate process.
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
// Enables the tsconfig-paths behavior in webpack. tsconfig-paths is responsible for the
// import mapping that often begins with @.
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const zlib = require('zlib');

// Desktop (Electron) renderer build. Emits to a SEPARATE dir with an app://
// publicPath so it never clobbers the browser build/ (publicPath '/'). The
// browser production build is byte-identical when DESKTOP_BUILD is unset.
// See docs/ELECTRON_MIGRATION_PLAN.md §9 / Phase 2A.
const DESKTOP_BUILD = process.env.DESKTOP_BUILD === '1';

// Skip the in-build type check when the caller already type-checks separately.
// CI runs `lint:client` (vue-tsc) as its own step, so re-running a full tsc via
// fork-ts-checker inside the webpack build just doubles the type-check time on
// the critical path. Local dev (dev:client, plain `npm run build`) keeps it on.
const SKIP_TS_CHECK = process.env.SKIP_TS_CHECK === '1';

const plugins = [
  ...(SKIP_TS_CHECK ? [] : [new ForkTsCheckerWebpackPlugin({
    typescript: {
      configOverwrite: {
        exclude: [
          'tests/**/*.ts',
          // `screenshots/` is GITIGNORED scratch (stand specs, mocks, probes a session leaves behind) that the root
          // tsconfig's `**/*.ts` still pulls into this checker — a stale mock from a finished session failed the
          // PRODUCT build with four errors in files nobody ships (2026-10-21). The product's gate is `lint:client`.
          'screenshots/**/*.ts',
          'tmp/**/*.ts',
          // THE E2E HARNESS'S CONFIG IS TEST INFRASTRUCTURE, NOT PRODUCT — it imports the e2e tree (`TIMING_SPECS`), and
          // the Docker build context has no `tests/` (`.dockerignore`), so checking it here broke the image build
          // (2026-10-30, TS2307 `./tests/e2e/timingSpecs`). Its own gate is `tests/e2e/tsconfig.json` (`build:test`).
          'playwright.config.ts',
        ],
      },
    },
  })]),
  new VueLoaderPlugin(),
  new webpack.DefinePlugin({
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  }),
  {
    apply: (compiler) => {
      compiler.hooks.compile.tap('BuildStartPlugin', () => {
        console.log('🚀 Webpack Build Started...');
      });

      compiler.hooks.done.tap('BuildEndPlugin', () => {
        // Pushes the log to the very end of the execution queue
        process.nextTick(() => {
          console.log('✅ Webpack Build Finished!');
        });
      });
    },
  },
];

if (process.env.NODE_ENV === 'production') {
  plugins.push(new CompressionPlugin());
  plugins.push(new CompressionPlugin({
    algorithm: 'brotliCompress',
    filename: '[path][base].br',
    compressionOptions: {params: {[zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY}},
  }));
}

if (process.env.NODE_ENV === 'development') {
  // Reports progress on the commandline during compilation.
  plugins.push(new webpack.ProgressPlugin());
}

module.exports = {
  devtool: 'source-map',
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: {
    main: './src/client/main.ts',
    sw: './src/client/sw.ts',
  },
  resolve: {
    plugins: [new TsconfigPathsPlugin()],
    extensions: ['.ts', '.vue', '.js'],
    alias: {
      'vue$': 'vue/dist/vue.esm-bundler.js',
      // Force CJS build of test-utils so webpack doesn't choke on its ESM export map.
      '@vue/test-utils': path.resolve(__dirname, 'node_modules/@vue/test-utils/dist/vue-test-utils.cjs.js'),
    },
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          appendTsSuffixTo: [/\.vue$/],
          transpileOnly: true,
          compilerOptions: {module: 'esnext', removeComments: false}
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', {loader: 'css-loader', options: {url: false}}],
      },
      {
        test: /\.less$/,
        use: ['style-loader', {loader: 'css-loader', options: {url: false}}, 'less-loader'],
      },
    ],
  },
  plugins,
  output: {
    path: DESKTOP_BUILD ? path.resolve(__dirname, 'build-desktop') : path.resolve(__dirname, 'build'),
    hashFunction: 'xxhash64',
    publicPath: DESKTOP_BUILD ? 'app://bundle/' : '/',
    chunkFilename: 'chunks/[name].js',
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // BND-1 (docs/PERFORMANCE_AUDIT.md): carve the heavy lazy-only lib into
        // its OWN async chunk so the single fixed-name `vendors` group below
        // can't merge it into the eager bundle. chart.js (endgame VP chart) is
        // dynamic-import()ed by its sole consumer, so `chunks: 'async'` + a higher
        // priority keeps it out of the login/menu/board startup parse. Its small
        // deps stay in vendors. (markdown-it had the same group until 2026-10-22 —
        // its only consumer, CardHelp.vue, was deleted and the package dropped.)
        chartjs: {
          test: /[\\/]node_modules[\\/]chart\.js[\\/]/,
          name: 'chartjs',
          chunks: 'async',
          priority: 20,
          enforce: true,
        },
        vendors: {
          // Exclude the lazy-only lib so this `chunks: 'all'` catch-all can't
          // hoist it (async-only though it is) into the INITIAL vendors bundle —
          // that hoist is exactly the BND-1 bug. With it excluded, only the
          // chartjs async group above matches it.
          test: /[\\/]node_modules[\\/](?!chart\.js[\\/])/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};
