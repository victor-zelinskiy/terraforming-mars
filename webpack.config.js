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
        // BND-1 (docs/PERFORMANCE_AUDIT.md): carve the two heavy lazy-only libs into
        // their OWN async chunks so the single fixed-name `vendors` group below
        // can't merge them into the eager bundle. chart.js (endgame VP chart) and
        // markdown-it (card-help popup) are now dynamic-import()ed by their sole
        // consumers, so `chunks: 'async'` + a higher priority keeps them out of
        // the login/menu/board startup parse. Their small deps stay in vendors.
        chartjs: {
          test: /[\\/]node_modules[\\/]chart\.js[\\/]/,
          name: 'chartjs',
          chunks: 'async',
          priority: 20,
          enforce: true,
        },
        markdownit: {
          test: /[\\/]node_modules[\\/]markdown-it[\\/]/,
          name: 'markdownit',
          chunks: 'async',
          priority: 20,
          enforce: true,
        },
        vendors: {
          // Exclude the two lazy-only libs so this `chunks: 'all'` catch-all
          // can't hoist them (async-only though they are) into the INITIAL
          // vendors bundle — that hoist is exactly the BND-1 bug. With them
          // excluded, only the chartjs/markdownit async groups above match them.
          test: /[\\/]node_modules[\\/](?!chart\.js[\\/]|markdown-it[\\/])/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};
