// Launch the LOCALLY PACKED desktop app (the `--dir` output of npm run pack:dir:*),
// inheriting this process's env — which is how TM_LOCAL_BUILD=1 reaches it.
//
// Why a script and not a plain path: the packed app is `app.isPackaged`, so unlike
// `npm run electron:run` it goes through the real packaged code paths (asar, app://,
// the update gate). Without TM_LOCAL_BUILD the gate would call the build outdated and
// Velopack would replace it with a published release — see electron/updatePolicy.ts
// `isLocalBuild`. The exe name comes from electron-builder.yml `productName`, and the
// dir layout differs per platform, so resolving it here keeps package.json portable.
//
// Usage: npm run electron:run:packed [-- --tm-windowed --tm-devtools]
// Any extra args are forwarded to the app (the `--tm-*` launch-options bridge).

import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-desktop');
const PRODUCT = 'Terraforming Mars'; // electron-builder.yml productName

const candidates = process.platform === 'win32' ?
  [join(out, 'win-unpacked', `${PRODUCT}.exe`)] :
  [join(out, 'linux-unpacked', 'terraforming-mars'), join(out, 'linux-unpacked', PRODUCT)];

const exe = candidates.find((p) => existsSync(p));
if (exe === undefined) {
  console.error(
    `[run-packed] no packed app in ${out}\n` +
    '            build it first: npm run pack:dir:win   (or pack:dir:linux)');
  process.exit(1);
}

console.log(`[run-packed] ${exe} (TM_LOCAL_BUILD=${process.env.TM_LOCAL_BUILD ?? ''})`);
const child = spawn(exe, process.argv.slice(2), {stdio: 'inherit', env: process.env});
child.on('exit', (code) => process.exit(code ?? 0));
