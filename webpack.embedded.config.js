// EMBEDDED game-server bundle (docs/EMBEDDED_SERVER.md §5).
//
// Bundles src/server/embedded/embeddedServerMain.ts (+ the whole server library
// it requires) into ONE node-target file, so the packaged desktop app ships the
// embedded server WITHOUT any server node_modules. Output lands in
// build/electron/, which electron-builder already packages; the file is
// asar-UNPACKED (electron-builder.yml) because utilityProcess.fork needs a real
// on-disk script.
//
// WARNING - `webpack` is pinned EXACTLY in package.json (no caret). 5.110.x
// mis-parenthesises a deferred CJS namespace inlined into a `new` expression:
// it emits `new X_namespaceFn()(...)`, which constructs the WRAPPER instead of
// the class. That compiles clean and dies on load ("is not a constructor"), so
// the embedded server never starts and the desktop app silently downgrades to
// remote mode - the symptom is "games cannot be created", nowhere near here.
// `scripts/check-embedded-bundle.mjs` (chained into `build:embedded`) fails the
// build if a future bump brings it back. 5.109.2 good; 5.110.2 bad.
//
// Externals: the two optional DB drivers (never loaded — the embedded server
// forces LOCAL_FS_DB, and Database.getInstance requires backends lazily) and
// ws's optional native accelerators.
const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  target: 'node',
  mode: 'production',
  devtool: false,
  entry: './src/server/embedded/embeddedServerMain.ts',
  resolve: {
    plugins: [new TsconfigPathsPlugin()],
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          compilerOptions: {module: 'esnext', removeComments: false},
        },
      },
    ],
  },
  externals: {
    'pg': 'commonjs pg',
    'pg-native': 'commonjs pg-native',
    'better-sqlite3': 'commonjs better-sqlite3',
    'bufferutil': 'commonjs bufferutil',
    'utf-8-validate': 'commonjs utf-8-validate',
  },
  output: {
    path: path.resolve(__dirname, 'build/electron'),
    filename: 'embedded-server.js',
    // Keep Node semantics: __dirname must be the runtime dir, not '/'.
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  optimization: {
    // One file, no chunk juggling; minimization off keeps server stack traces
    // readable in the embedded-server log at a negligible size cost.
    minimize: false,
    splitChunks: false,
  },
  performance: {hints: false},
};
