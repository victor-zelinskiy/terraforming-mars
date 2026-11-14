// THE DIAGNOSTICS HUB bundle (docs/claude/diagnostics.md).
//
// Bundles src/server/diagnostics/hub (+ the shared src/common/diagnostics layer and the one piece of the Sentry SDK it
// uses — `@sentry/core`'s envelope serialiser) into ONE node-target file, build/electron/diagnostics-hub.js, which the
// Electron main process `require`s (electron/diagnosticsMain.ts).
//
// WHY A BUNDLE, like the embedded server beside it: the Electron lane compiles `electron/**` alone (no `src/`, no
// path aliases) and the packaged app ships NO node_modules except velopack's — so shared `src/` code and an npm
// dependency reach the main process only as a file of their own. electron-builder already packages build/electron/**.
//
// A source map is emitted (never shipped — electron-builder drops `*.map`): the release workflow uploads it, so a
// stack of the hub itself resolves to `src/server/diagnostics/…:line`.
const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  target: 'node',
  mode: 'production',
  devtool: 'source-map',
  entry: './src/server/diagnostics/hub/index.ts',
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
  output: {
    path: path.resolve(__dirname, 'build/electron'),
    filename: 'diagnostics-hub.js',
    library: {type: 'commonjs2'},
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  optimization: {
    // Readable stacks in the main process's log at a negligible size cost (as the embedded server's bundle).
    minimize: false,
    splitChunks: false,
  },
  performance: {hints: false},
};
