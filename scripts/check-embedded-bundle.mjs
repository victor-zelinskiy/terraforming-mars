/**
 * THE EMBEDDED SERVER STARTS — a smoke check of `build/electron/embedded-server.js` (chained into `npm run
 * build:embedded` and `build:desktop`).
 *
 * WHY A RUN AND NOT A READ. The desktop app forks this bundle as a utilityProcess (electron/embeddedServer.ts); a
 * bundle that compiles clean and dies on load does not fail anything visible — the app silently DOWNGRADES to remote
 * mode, and the symptom is «games cannot be created», nowhere near the cause. That happened once (webpack 5.110's
 * `new X_namespaceFn()(...)` miscompile, 2026-10), and the guard that stood here then grepped the bundle for that one
 * pattern. Any bundler can fail in a new way, so the guard now asks the only question that matters: does the bundle,
 * run under plain Node with the embedded environment, reach `ready`?
 *
 * It runs AS PACKAGED: a COPY of the bundle in a throwaway directory, where no `node_modules` can be reached (the
 * packaged app ships none — a bundle run beside the repository's own `node_modules` resolved a top-level `require('pg')`
 * and passed while the packaged app died on it, 2026-11-15). The throwaway root holds the database, the port is
 * ephemeral, LAN advertising off and the bind local — nothing outside this machine sees it — and it is killed the
 * moment it answers. 60 s to start, or it fails.
 *
 * Run: node scripts/check-embedded-bundle.mjs
 */
import {spawn} from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = path.join(ROOT, 'build', 'electron', 'embedded-server.js');

if (!fs.existsSync(BUNDLE)) {
  console.error(`[embedded-check] ${path.relative(ROOT, BUNDLE)} is missing — run \`npm run build:embedded\``);
  process.exit(1);
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-embedded-check-'));
const copy = path.join(home, 'embedded-server.js');
fs.copyFileSync(BUNDLE, copy);
const child = spawn(process.execPath, [copy], {
  cwd: home,
  env: {
    ...process.env,
    TM_EMBEDDED_ROOT: home,
    TM_EMBEDDED_PORT: '0',
    TM_EMBEDDED_BIND: 'local',
    TM_LAN_VISIBLE: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
// Its exit, watched from the spawn on: a bundle that dies on load has exited before anybody asks.
const exited = new Promise((resolve) => child.once('exit', resolve));

let output = '';
const verdict = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve('it did not answer `ready` within 60 s'), 60_000);
  const read = (chunk) => {
    output += chunk;
    if (/\[embedded\] \{"type":"ready"/.test(output)) {
      clearTimeout(timer);
      resolve(undefined);
    } else if (/\[embedded\] \{"type":"fatal"/.test(output)) {
      clearTimeout(timer);
      resolve('it reported a fatal startup error');
    }
  };
  child.stdout.on('data', read);
  child.stderr.on('data', read);
  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve(`it exited (code ${code}) before answering \`ready\``);
  });
});

child.kill();
await exited;
fs.rmSync(home, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});

if (verdict !== undefined) {
  console.error(`[embedded-check] ✖ the embedded server bundle does not start: ${verdict}\n${output.slice(-4000)}`);
  process.exit(1);
}
console.log('[embedded-check] ✓ the embedded server bundle starts and answers `ready`');
