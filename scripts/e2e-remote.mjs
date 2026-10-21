#!/usr/bin/env node
/**
 * RUN E2E ON THE STEAM MACHINE — `npm run e2e:remote -- <task> [playwright args…]`.
 *
 * WHY: the laptop runs several agents, builds and watchers at once, and every
 * 4K e2e timing taken on it is a verdict about the LOAD, not the product
 * (PL-149 was SwiftShader; «holds hitting their 8 s ceilings» was the box).
 * The Steam Machine on the LAN is quiet, wired, and renders through the same
 * AMD/RADV Vulkan stack the shipped SteamOS build runs on. So the WHOLE run
 * moves there — the runner, the per-worker game servers and the browsers all
 * on one host over its own loopback; the laptop only syncs a build in and
 * pulls the results out. Nothing of the run crosses the network.
 *
 * WHAT IT DOES, in order:
 *   1. preflight — the host answers; the game is not running there; no
 *      DO_NOT_DISTURB marker (`~/tm-e2e/DO_NOT_DISTURB`);
 *   2. sync — a MANIFEST diff (size + mtime) of the laptop's tree against the
 *      mirror `~/tm-e2e/repo`, then ONE tar stream of only what changed:
 *      the sources the specs import and the STALE check reads (`src/`),
 *      `tests/`, `assets/`, the package files, and the BUILD of the task's
 *      snapshot (`.e2e-<task>/build` when it exists, else `build/`) minus the
 *      source maps (190 MB nobody opens in a run). Extraneous files under
 *      those roots are deleted on the mirror; `node_modules` is never touched
 *      — it is re-installed only when `package-lock.json` changed;
 *   3. run — under ONE lock (`flock`; a second session waits, and says so) and
 *      a sleep inhibitor, inside the `e2e` distrobox (Ubuntu 24.04 — the only
 *      place Playwright's Chromium has its libraries; SteamOS's root is
 *      read-only): `TM_E2E_GPU=1 npx playwright test <args>`, output streamed;
 *   4. results — `test-results/` and `playwright-report/` into
 *      `.e2e-remote/<task>/`, the run's new `screenshots/**` files into the
 *      laptop's `screenshots/` (the same paths a local run writes).
 *
 * The exit code is Playwright's. A host that cannot be reached exits 2, the
 * lock not obtained in 30 min exits 3, the game running there exits 4 — each
 * says so in one line. THE RULE FOR AN AGENT: never fall back to a local run
 * silently on 2/3/4 — ask the owner (memory `e2e-only-on-steam-machine`).
 *
 * Env: TM_E2E_REMOTE_HOST (ssh alias, default `steam-machine`),
 * TM_E2E_ROOT (an explicit build root), every TM_E2E_* flag except the
 * local-only ones is forwarded (TM_E2E_GPU defaults to 1 — that is the point).
 * Default workers: 2 (the box has 12 threads and renders 4K; 1 for a storyboard
 * or a timing claim, as `tests.md` says).
 */
import {spawnSync} from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = process.env.TM_E2E_REMOTE_HOST ?? 'steam-machine';
const REMOTE_HOME = '/home/deck/tm-e2e';
const REMOTE_REPO = `${REMOTE_HOME}/repo`;
const REMOTE_NODE = `${REMOTE_HOME}/node/bin`;
const CONTAINER = 'e2e';
const LOCK_WAIT_S = 1800;

/**
 * On Windows prefer GIT's ssh over the built-in one: both read ~/.ssh/config, but Win32-OpenSSH
 * delivers a file-backed stdin at ~2 MB/s (measured 2026-10-21: 40 MB in 18–22 s) while Git's
 * MSYS ssh does 42–64 MB/s (0.6–0.9 s) — a build sync is 80+ MB, so that is 100 s against 2.
 */
const SSH = (() => {
  if (process.platform !== 'win32') {
    return 'ssh';
  }
  const candidates = ['C:\\Program Files\\Git\\usr\\bin\\ssh.exe'];
  const gitExec = spawnSync('git', ['--exec-path'], {encoding: 'utf8'});
  if (gitExec.status === 0) {
    // <git>/mingw64/libexec/git-core → <git>/usr/bin/ssh.exe
    candidates.push(path.resolve(gitExec.stdout.trim(), '..', '..', '..', 'usr', 'bin', 'ssh.exe'));
  }
  candidates.push('C:\\Windows\\System32\\OpenSSH\\ssh.exe');
  return candidates.find((c) => fs.existsSync(c)) ?? 'ssh';
})();
const TAR = process.platform === 'win32' && fs.existsSync('C:\\Windows\\System32\\tar.exe') ?
  'C:\\Windows\\System32\\tar.exe' : 'tar';
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];

const argv = process.argv.slice(2);
const task = (argv[0] ?? '').trim();
if (!/^[a-z0-9][a-z0-9-]*$/i.test(task)) {
  console.error('usage: npm run e2e:remote -- <task> [playwright args…]   (letters, digits, dashes — your task\'s name)');
  process.exit(2);
}
const pwArgs = argv.slice(1);
if (!pwArgs.some((a) => a.startsWith('--workers'))) {
  pwArgs.push('--workers=2');
}

const log = (msg) => console.log(`[e2e:remote] ${msg}`);
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** One ssh round trip; stdin is a string (or nothing); stdout captured. */
function ssh(cmd, {input, inherit = false} = {}) {
  const res = spawnSync(SSH, [...SSH_OPTS, HOST, cmd], {
    input,
    encoding: inherit ? undefined : 'utf8',
    stdio: inherit ? ['pipe', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
  if (res.error) {
    throw res.error;
  }
  return res;
}

function unreachable(res, what) {
  log(`cannot reach ${HOST} (${what}: ssh exit ${res.status}${res.stderr ? ` — ${String(res.stderr).trim().split('\n').pop()}` : ''})`);
  log('the e2e runs ONLY on the Steam Machine — do not fall back to a local run silently; ask the owner');
  process.exit(2);
}

// ─── 1. preflight ────────────────────────────────────────────────────────────
// `[T]erraforming…` — a pattern that does not match the shell carrying this very command line (pgrep -f reads argv).
const pre = ssh(`test -d ${REMOTE_REPO} && echo REPO-OK; test -f ${REMOTE_HOME}/DO_NOT_DISTURB && echo DND; pgrep -f '[T]erraformingMars.AppImage' >/dev/null && echo GAME-RUNNING; pgrep -f '[p]laywright test' >/dev/null && echo RUN-IN-PROGRESS; true`);
if (res255(pre)) {
  unreachable(pre, 'preflight');
}
const flags = new Set(String(pre.stdout).trim().split(/\s+/));
if (!flags.has('REPO-OK')) {
  log(`${HOST} has no mirror at ${REMOTE_REPO} — the one-time setup is missing (docs/claude/e2e-remote.md)`);
  process.exit(2);
}
if (flags.has('DND')) {
  log(`${HOST} carries ${REMOTE_HOME}/DO_NOT_DISTURB — the owner asked for quiet; ask before running`);
  process.exit(4);
}
if (flags.has('GAME-RUNNING')) {
  log(`the game is RUNNING on ${HOST} — refusing to load it with an e2e run; ask the owner`);
  process.exit(4);
}
if (flags.has('RUN-IN-PROGRESS')) {
  log(`another e2e run is in progress on ${HOST} — this one will wait for the lock (up to ${LOCK_WAIT_S / 60} min)`);
}

function res255(res) {
  return res.status === 255 || res.status === null;
}

// ─── 2. sync ─────────────────────────────────────────────────────────────────
const buildRoot = process.env.TM_E2E_ROOT ? path.resolve(ROOT, process.env.TM_E2E_ROOT) :
  fs.existsSync(path.join(ROOT, `.e2e-${task}`, 'build')) ? path.join(ROOT, `.e2e-${task}`) : ROOT;
const serverEntry = path.join(buildRoot, 'build', 'src', 'server', 'server.js');
if (!fs.existsSync(serverEntry) || !fs.existsSync(path.join(buildRoot, 'build', 'main.js'))) {
  log(`no complete build/ under ${path.relative(ROOT, buildRoot) || '.'} — run \`npm run build\` (and \`npm run e2e:snapshot ${task}\`) first`);
  process.exit(2);
}
log(`build root: ${path.relative(ROOT, buildRoot) || '.'}${buildRoot === ROOT ? ' (the SHARED build/ — a neighbour\'s rebuild mid-sync is theirs; `npm run e2e:snapshot ' + task + '` gives you a private one)' : ''}`);

/** [mirror-relative path, absolute local path] for every file to mirror. */
function* walk(dir, relBase, skip) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (skip(rel, entry)) {
      continue;
    }
    if (entry.isDirectory()) {
      yield* walk(full, rel, skip);
    } else if (entry.isFile()) {
      yield [rel, full];
    }
  }
}
const STATIC_ROOTS = ['assets', 'src', 'tests', 'package.json', 'package-lock.json', 'tsconfig.json', 'playwright.config.ts'];
const staticSkip = (rel, entry) => entry.name === 'node_modules' || rel.startsWith('tests/e2e/__screenshots__') || /\.tsbuildinfo$/.test(entry.name);
const buildSkip = (rel, entry) => rel === 'build/tests' || /\.map(\.gz|\.br)?$/.test(entry.name);

const files = {}; // rel -> [size, mtimeSec]
const localOf = {}; // rel -> absolute
for (const root of STATIC_ROOTS) {
  const abs = path.join(ROOT, root);
  if (!fs.existsSync(abs)) {
    continue;
  }
  const entries = fs.statSync(abs).isDirectory() ? walk(abs, root, staticSkip) : [[root, abs]];
  for (const [rel, full] of entries) {
    const st = fs.statSync(full);
    files[rel] = [st.size, Math.floor(st.mtimeMs / 1000)];
    localOf[rel] = full;
  }
}
for (const [rel, full] of walk(path.join(buildRoot, 'build'), 'build', buildSkip)) {
  const st = fs.statSync(full);
  files[rel] = [st.size, Math.floor(st.mtimeMs / 1000)];
  localOf[rel] = full;
}

const COMPARE_PY = `
import json, os, sys
m = json.load(sys.stdin)
base = os.path.expanduser('~/tm-e2e/repo')
files = m['files']
send = []
for rel, (size, mt) in files.items():
    p = os.path.join(base, rel)
    try:
        st = os.stat(p)
    except FileNotFoundError:
        send.append(rel); continue
    if st.st_size != size or int(st.st_mtime) != mt:
        send.append(rel)
deleted = 0
for root in m['roots']:
    rp = os.path.join(base, root)
    if os.path.isfile(rp):
        if root not in files:
            os.remove(rp); deleted += 1
        continue
    for d, _, fs_ in os.walk(rp):
        for f in fs_:
            full = os.path.join(d, f)
            rel = os.path.relpath(full, base).replace(os.sep, '/')
            if rel not in files:
                os.remove(full); deleted += 1
lock_sha = ''
try:
    lock_sha = open(os.path.join(base, 'node_modules', '.tm-lock-sha')).read().strip()
except Exception:
    pass
print(json.dumps({'send': send, 'deleted': deleted, 'lock_sha': lock_sha}))
`;
const t0 = Date.now();
const cmp = ssh(`python3 -c ${shq(COMPARE_PY)}`, {input: JSON.stringify({roots: [...STATIC_ROOTS, 'build'], files})});
if (res255(cmp)) {
  unreachable(cmp, 'manifest');
}
if (cmp.status !== 0) {
  log(`manifest compare failed on ${HOST}:\n${cmp.stderr}`);
  process.exit(2);
}
const verdict = JSON.parse(String(cmp.stdout));
const send = verdict.send;
const sendBytes = send.reduce((n, rel) => n + files[rel][0], 0);
log(`mirror: ${Object.keys(files).length} files checked, ${send.length} to send (${(sendBytes / 1048576).toFixed(1)} MB), ${verdict.deleted} removed — ${Date.now() - t0} ms`);

if (send.length > 0) {
  // ONE archive in a temp file, two cwds (the static roots live under the repo, the build under its
  // root — the second group is APPENDED with `-r`), then ssh reads it as its stdin FROM A FILE
  // DESCRIPTOR: a tar→ssh pipe from Node died with `write EOF` on Windows OpenSSH mid-stream, while
  // a file-backed stdin delivered every byte (measured 2026-10-21).
  const t1 = Date.now();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-e2e-remote-'));
  const archive = path.join(tmpDir, 'sync.tar');
  const groups = [
    {cwd: ROOT, rels: send.filter((r) => !r.startsWith('build/'))},
    {cwd: buildRoot, rels: send.filter((r) => r.startsWith('build/'))},
  ].filter((g) => g.rels.length > 0);
  for (const [i, g] of groups.entries()) {
    const list = path.join(tmpDir, `list-${i}.txt`);
    fs.writeFileSync(list, g.rels.join('\n') + '\n');
    const tar = spawnSync(TAR, [i === 0 ? '-cf' : '-rf', archive, '-T', list], {cwd: g.cwd, stdio: ['ignore', 'inherit', 'inherit']});
    if (tar.status !== 0) {
      log(`local tar failed (exit ${tar.status}) on group ${i}`);
      process.exit(2);
    }
  }
  const fd = fs.openSync(archive, 'r');
  const remote = spawnSync(SSH, [...SSH_OPTS, '-C', HOST, `tar -xf - -C ${REMOTE_REPO}`], {stdio: [fd, 'inherit', 'inherit']});
  fs.closeSync(fd);
  fs.rmSync(tmpDir, {recursive: true, force: true});
  if (res255(remote)) {
    unreachable(remote, 'sync');
  }
  if (remote.status !== 0) {
    log(`remote tar failed (exit ${remote.status})`);
    process.exit(2);
  }
  log(`sent in ${Date.now() - t1} ms`);
}

// ─── 3. run ──────────────────────────────────────────────────────────────────
const head = (() => {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {cwd: ROOT, encoding: 'utf8'});
  return r.status === 0 ? r.stdout.trim() : '';
})();
const lockShaLocal = (() => {
  const r = spawnSync(process.execPath, ['-e', 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex").slice(0,16))', path.join(ROOT, 'package-lock.json')], {encoding: 'utf8'});
  return r.stdout.trim();
})();
const LOCAL_ONLY = new Set(['TM_E2E_ROOT', 'TM_E2E_SHARED_SERVER', 'TM_E2E_PORT_BASE', 'TM_E2E_STALL_LOG', 'TM_E2E_REMOTE_HOST', 'TM_E2E_BASE_URL']);
const env = {TM_E2E_GPU: '1'};
for (const [k, v] of Object.entries(process.env)) {
  if (k.startsWith('TM_E2E_') && !LOCAL_ONLY.has(k)) {
    env[k] = v;
  }
}
env.TM_E2E_HOST = HOST;
if (head) {
  env.TM_E2E_HEAD = head;
}
const envLine = Object.entries(env).map(([k, v]) => `${k}=${shq(v)}`).join(' ');

// The inner script runs INSIDE the container (distrobox re-parses its command
// through a shell, so the real command lives in a file and is parsed once).
// PER-RUN FILE NAMES: the scripts are written BEFORE the lock is taken, and bash reads a script
// while it runs — a second session overwriting `~/tm-e2e/inner.sh` under a first session's live
// run is a corrupted run (seen 2026-10-21: the queued run's scripts replaced the running one's).
const runId = `${task}-${Date.now().toString(36)}-${process.pid}`;
const innerPath = `${REMOTE_HOME}/runs/${runId}.inner.sh`;
const outerPath = `${REMOTE_HOME}/runs/${runId}.outer.sh`;
const inner = `#!/bin/bash
set -o pipefail
export PATH=${REMOTE_NODE}:$PATH
cd ${REMOTE_REPO}
if [ "$(cat node_modules/.tm-lock-sha 2>/dev/null)" != ${shq(lockShaLocal)} ]; then
  echo "[e2e:remote] package-lock.json changed — npm ci on the Steam Machine (a few minutes, once)"
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund 2>&1 | tail -3 || exit 2
  npx playwright install chromium --with-deps 2>&1 | tail -2 || exit 2
  echo ${shq(lockShaLocal)} > node_modules/.tm-lock-sha
fi
touch .run-start
rm -f .last-exit
echo "[e2e:remote] $(node --version) · playwright $(npx playwright --version | sed 's/Version //') · $(nproc) threads · load $(cut -d' ' -f1-3 /proc/loadavg)"
env ${envLine} npx playwright test ${pwArgs.map(shq).join(' ')}
code=$?
echo $code > .last-exit
exit $code
`;
// The outer script runs on the SteamOS host: the lock, the sleep inhibitor, the container.
const outer = `#!/bin/bash
mkdir -p ${REMOTE_HOME}/runs
cat > ${innerPath} <<'TM_INNER'
${inner}TM_INNER
trap 'rm -f ${innerPath} ${outerPath}' EXIT
exec 9>${REMOTE_HOME}/lock
if ! flock -n 9; then
  echo "[e2e:remote] the Steam Machine is BUSY (another run holds the lock) — waiting up to ${LOCK_WAIT_S / 60} min…"
  flock -w ${LOCK_WAIT_S} 9 || { echo "[e2e:remote] gave up waiting for the lock"; exit 3; }
fi
if pgrep -f '[T]erraformingMars.AppImage' >/dev/null; then echo "[e2e:remote] the game started on the Steam Machine while we waited — refusing"; exit 4; fi
echo "[e2e:remote] lock taken — running ${shq(task)} on $(cat /etc/hostname 2>/dev/null)"
# The sleep inhibitor is best-effort: over ssh polkit answers «Interactive authentication required»
# unless the owner adds a rule, and the Gaming Mode idle sleep is a Steam setting anyway (Never).
INHIBIT=""
if systemd-inhibit --what=sleep:idle --who=tm-e2e --why=probe --mode=block true 2>/dev/null; then
  INHIBIT="systemd-inhibit --what=sleep:idle --who=tm-e2e --why=${shq(`e2e ${task}`)} --mode=block"
else
  echo "[e2e:remote] (no sleep inhibitor over ssh — the Steam Machine's idle sleep must be set to Never)"
fi
$INHIBIT distrobox enter ${CONTAINER} -- bash ${innerPath}
`;
log(`running: playwright test ${pwArgs.join(' ')}  (${envLine})`);
const run = ssh(`mkdir -p ${REMOTE_HOME}/runs && cat > ${outerPath} && bash ${outerPath}`, {input: outer, inherit: true});
if (res255(run)) {
  unreachable(run, 'run');
}
if (run.status === 3 || run.status === 4) {
  log('the run did not start — ask the owner before running anywhere else');
  process.exit(run.status);
}

// ─── 4. results ──────────────────────────────────────────────────────────────
const outDir = path.join(ROOT, '.e2e-remote', task);
fs.rmSync(outDir, {recursive: true, force: true});
fs.mkdirSync(outDir, {recursive: true});
const pull = spawnSync(SSH, [...SSH_OPTS, '-C', HOST,
  `cd ${REMOTE_REPO} && { ls .last-exit 2>/dev/null; ls -d test-results playwright-report 2>/dev/null; find screenshots -type f -newer .run-start 2>/dev/null; } | tar -cf - -T - 2>/dev/null`],
{stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 4 * 1024 * 1024 * 1024});
let exitCode = run.status ?? 1;
if (pull.status === 0 && pull.stdout.length > 0) {
  const x = spawnSync(TAR, ['-xf', '-', '-C', outDir], {input: pull.stdout, stdio: ['pipe', 'inherit', 'inherit']});
  if (x.status !== 0) {
    log('could not unpack the results');
  }
  // Playwright's OWN exit code, written by the inner script after the run — without it the run
  // never reached Playwright (the output above says why), which is a setup failure, not a red.
  const lastExit = path.join(outDir, '.last-exit');
  if (fs.existsSync(lastExit)) {
    exitCode = Number(fs.readFileSync(lastExit, 'utf8').trim());
  } else {
    log('Playwright never started on the Steam Machine (see the output above) — a setup failure, not a test verdict');
    exitCode = 2;
  }
  const shots = path.join(outDir, 'screenshots');
  if (fs.existsSync(shots)) {
    fs.cpSync(shots, path.join(ROOT, 'screenshots'), {recursive: true});
    const n = [...walk(shots, '', () => false)].length;
    log(`${n} screenshot file(s) placed under screenshots/ (same paths as a local run)`);
  }
  log(`results: ${path.relative(ROOT, outDir)}/{test-results,playwright-report} (annotation host=${HOST})`);
} else {
  log('no results came back — Playwright never started on the Steam Machine (see the output above)');
  exitCode = 2;
}
const exclude = path.join(ROOT, '.git', 'info', 'exclude');
if (fs.existsSync(path.dirname(exclude))) {
  const current = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
  if (!current.split(/\r?\n/).includes('.e2e-remote/')) {
    fs.appendFileSync(exclude, `${current.endsWith('\n') || current === '' ? '' : '\n'}.e2e-remote/\n`);
  }
}
process.exit(exitCode);
