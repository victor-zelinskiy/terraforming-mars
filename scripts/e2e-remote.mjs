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
 *      mirror, then a tar of only what changed. TWO destinations, because the
 *      sources are one tree for every session of this clone while the BUILD is
 *      per task: `~/tm-e2e/repo/` gets `src/` (the specs import from it and the
 *      STALE check reads its mtimes), `tests/`, `assets/` and the package files;
 *      `~/tm-e2e/builds/<task>/build/` gets the task's snapshot
 *      (`.e2e-<task>/build` when it exists, else `build/`) minus the source maps
 *      (190 MB nobody opens in a run). A shared build was the first defect two
 *      sessions met there (2026-10-21): the mirror held whichever build synced
 *      last, and a run served a neighbour's STALE one — the 2026-09-30 class the
 *      laptop's snapshots exist for. Extraneous files under the synced roots are
 *      deleted; `node_modules` is never touched — re-installed only when
 *      `package-lock.json` changed;
 *   3. run — in ONE of K SLOTS (`~/tm-e2e/slots/<i>`, `flock` each; K = 2 —
 *      the box has 12 threads and 15 GB, two runs of two 4K workers leave
 *      headroom; `TM_E2E_SLOTS` overrides) so two sessions run SIDE BY SIDE,
 *      or — `--exclusive` — holding ALL slots, for a timing / storyboard claim
 *      whose numbers a neighbour's run would contaminate (the owner's call
 *      2026-10-21: one run at a time was too strict for a dedicated box; one
 *      run at a time for a TIMING is the whole point of the box). A run with
 *      no slot in 30 min gives up (exit 3) and says so. Inside the `e2e`
 *      distrobox (Ubuntu 24.04 — the only place Playwright's Chromium has its
 *      libraries; SteamOS's root is read-only): `TM_E2E_GPU=1
 *      TM_E2E_ROOT=../builds/<task> npx playwright test <args>` with the
 *      task's own output + report dirs, output streamed; the results are
 *      packed into `results.tar` BEFORE the slot is released;
 *   4. results — `test-results/` and `playwright-report/` into
 *      `.e2e-remote/<task>/`, the run's new `screenshots/**` files into the
 *      laptop's `screenshots/` (the same paths a local run writes).
 *
 * The exit code is Playwright's. A host that cannot be reached exits 2, no
 * slot obtained in 30 min exits 3, the game running there exits 4 — each
 * says so in one line. THE RULE FOR AN AGENT: never fall back to a local run
 * silently on 2/3/4 — ask the owner (memory `e2e-only-on-steam-machine`).
 *
 * Env: TM_E2E_REMOTE_HOST (ssh alias, default `steam-machine`),
 * TM_E2E_ROOT (an explicit build root), TM_E2E_SLOTS (the box's slot count),
 * every TM_E2E_* flag except the local-only ones is forwarded (TM_E2E_GPU
 * defaults to 1 — that is the point). Default workers: 2 per run (two runs
 * share the box). A storyboard / timing claim: `--exclusive --workers=1`.
 */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = process.env.TM_E2E_REMOTE_HOST ?? 'steam-machine';
const REMOTE_HOME = '/home/deck/tm-e2e';
const REMOTE_REPO = `${REMOTE_HOME}/repo`;
const REMOTE_BUILDS = `${REMOTE_HOME}/builds`;
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
// `--exclusive` is the wrapper's own flag (never Playwright's): the run holds every slot of the box.
const exclusive = argv.includes('--exclusive');
const pwArgs = argv.slice(1).filter((a) => a !== '--exclusive');
if (!pwArgs.some((a) => a.startsWith('--workers'))) {
  pwArgs.push('--workers=2');
}
const SLOTS = Math.max(1, Number(process.env.TM_E2E_SLOTS ?? 2) || 2);
/** This task's own build + output + report dirs on the host — never shared with another session's run. */
const TASK_DIR = `${REMOTE_BUILDS}/${task}`;

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
// `TM_E2E_BESIDE_GAME=1` — the OWNER's explicit, per-case word that an e2e may run beside their game (it
// costs the game frames); never an agent's own decision — the rule stays «exit 4 → ask».
const besideGame = process.env.TM_E2E_BESIDE_GAME === '1';
if (flags.has('GAME-RUNNING')) {
  if (!besideGame) {
    log(`the game is RUNNING on ${HOST} — refusing to load it with an e2e run; ask the owner`);
    process.exit(4);
  }
  log(`the game is RUNNING on ${HOST} — running beside it on the owner's word (TM_E2E_BESIDE_GAME=1); not a timing`);
}
if (flags.has('RUN-IN-PROGRESS')) {
  log(`another e2e run is in progress on ${HOST} — ${exclusive ? `this EXCLUSIVE run waits for the box to empty (up to ${LOCK_WAIT_S / 60} min)` : `this one takes a free slot of ${SLOTS}, or waits for one (up to ${LOCK_WAIT_S / 60} min)`}`);
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
/**
 * WHAT IS SHARED AND WHAT IS THE TASK'S. Shared (`~/tm-e2e/repo`): `assets/` (956 MB, identical for every
 * session of this clone) and the package files `npm ci` installs `node_modules` from. The TASK's
 * (`~/tm-e2e/builds/<task>`): `src/` (the specs import from it, the STALE check reads it), `tests/`, the
 * config files and the BUILD — because a running run re-reads its sources whenever Playwright restarts a
 * worker (it does so after every failure), and a neighbour's sync into a SHARED `tests/` mid-run poisoned
 * a 338-spec baseline with one broken harness file (2026-10-22 04:00: 607 reds in 14 minutes). The run's
 * cwd is the task dir: `assets` and `node_modules` stand beside it as links to the mirror.
 */
const SHARED_ROOTS = ['assets', 'package.json', 'package-lock.json'];
const TASK_ROOTS = ['src', 'tests', 'package.json', 'package-lock.json', 'tsconfig.json', 'playwright.config.ts'];
const staticSkip = (rel, entry) => entry.name === 'node_modules' || rel.startsWith('tests/e2e/__screenshots__') || /\.tsbuildinfo$/.test(entry.name);
const buildSkip = (rel, entry) => rel === 'build/tests' || /\.map(\.gz|\.br)?$/.test(entry.name);

/** A sync SET: one destination on the host, the local cwd its paths are relative to, and its manifest. */
function manifest(cwd, roots, skip) {
  const files = {}; // rel -> [size, mtimeSec]
  for (const root of roots) {
    const abs = path.join(cwd, root);
    if (!fs.existsSync(abs)) {
      continue;
    }
    const entries = fs.statSync(abs).isDirectory() ? walk(abs, root, skip) : [[root, abs]];
    for (const [rel, full] of entries) {
      const st = fs.statSync(full);
      files[rel] = [st.size, Math.floor(st.mtimeMs / 1000)];
    }
  }
  return files;
}
const SETS = [
  {base: REMOTE_REPO, cwd: ROOT, roots: SHARED_ROOTS, files: manifest(ROOT, SHARED_ROOTS, staticSkip)},
  {base: TASK_DIR, cwd: ROOT, roots: TASK_ROOTS, files: manifest(ROOT, TASK_ROOTS, staticSkip)},
  {base: TASK_DIR, cwd: buildRoot, roots: ['build'], files: manifest(buildRoot, ['build'], buildSkip)},
];

const COMPARE_PY = `
import json, os, sys
m = json.load(sys.stdin)
out = []
deleted = 0
for s in m['sets']:
    base = os.path.expanduser(s['base'])
    os.makedirs(base, exist_ok=True)
    files = s['files']
    send = []
    for rel, (size, mt) in files.items():
        p = os.path.join(base, rel)
        try:
            st = os.stat(p)
        except FileNotFoundError:
            send.append(rel); continue
        if st.st_size != size or int(st.st_mtime) != mt:
            send.append(rel)
    for root in s['roots']:
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
    out.append(send)
print(json.dumps({'send': out, 'deleted': deleted}))
`;
const t0 = Date.now();
const cmp = ssh(`python3 -c ${shq(COMPARE_PY)}`, {input: JSON.stringify({sets: SETS.map((s) => ({base: s.base, roots: s.roots, files: s.files}))})});
if (res255(cmp)) {
  unreachable(cmp, 'manifest');
}
if (cmp.status !== 0) {
  log(`manifest compare failed on ${HOST}:\n${cmp.stderr}`);
  process.exit(2);
}
const verdict = JSON.parse(String(cmp.stdout));
const checked = SETS.reduce((n, s) => n + Object.keys(s.files).length, 0);
const toSend = SETS.map((s, i) => ({...s, send: verdict.send[i]}));
const sendCount = toSend.reduce((n, s) => n + s.send.length, 0);
const sendBytes = toSend.reduce((n, s) => n + s.send.reduce((m, rel) => m + s.files[rel][0], 0), 0);
log(`mirror: ${checked} files checked, ${sendCount} to send (${(sendBytes / 1048576).toFixed(1)} MB), ${verdict.deleted} removed — ${Date.now() - t0} ms`);
if (process.env.TM_E2E_SYNC_VERBOSE === '1') {
  for (const s of toSend) {
    for (const rel of s.send.slice(0, 40)) {
      log(`  → ${s.base}/${rel}`);
    }
  }
}

// One archive per destination, in a temp file, handed to ssh as its stdin FROM A FILE DESCRIPTOR: a
// tar→ssh pipe from Node died with `write EOF` on Windows OpenSSH mid-stream, while a file-backed
// stdin delivered every byte (measured 2026-10-21).
const t1 = Date.now();
for (const s of toSend) {
  if (s.send.length === 0) {
    continue;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-e2e-remote-'));
  const archive = path.join(tmpDir, 'sync.tar');
  const list = path.join(tmpDir, 'list.txt');
  fs.writeFileSync(list, s.send.join('\n') + '\n');
  const tar = spawnSync(TAR, ['-cf', archive, '-T', list], {cwd: s.cwd, stdio: ['ignore', 'inherit', 'inherit']});
  if (tar.status !== 0) {
    log(`local tar failed (exit ${tar.status}) for ${s.base}`);
    process.exit(2);
  }
  const fd = fs.openSync(archive, 'r');
  const remote = spawnSync(SSH, [...SSH_OPTS, '-C', HOST, `tar -xf - -C ${s.base}`], {stdio: [fd, 'inherit', 'inherit']});
  fs.closeSync(fd);
  fs.rmSync(tmpDir, {recursive: true, force: true});
  if (res255(remote)) {
    unreachable(remote, 'sync');
  }
  if (remote.status !== 0) {
    log(`remote tar failed (exit ${remote.status}) for ${s.base}`);
    process.exit(2);
  }
}
if (sendCount > 0) {
  log(`sent in ${Date.now() - t1} ms`);
}

// ─── 3. run ──────────────────────────────────────────────────────────────────
const head = (() => {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {cwd: ROOT, encoding: 'utf8'});
  return r.status === 0 ? r.stdout.trim() : '';
})();
/**
 * The DEPENDENCY hash of package-lock.json: the root `version` (top level and `packages[""]`) is
 * dropped first, because the pre-commit `bump-version` hook rewrites it on EVERY commit of EVERY
 * session — hashed raw, the lock «changed» several times an hour and each change was a 2-minute
 * `npm ci` on the Steam Machine for nothing.
 */
const lockShaLocal = (() => {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  delete lock.version;
  if (lock.packages && lock.packages['']) {
    delete lock.packages[''].version;
  }
  return createHash('sha256').update(JSON.stringify(lock)).digest('hex').slice(0, 16);
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
# The run's markers FIRST: a failure anywhere below leaves no \`.last-exit\` (= «Playwright never started»)
# and no stale screenshots newer than the marker — a failed \`npm ci\` once reported exit 0 with the
# previous run's twelve frames.
touch ${TASK_DIR}/.run-start
rm -f ${TASK_DIR}/.last-exit
# \`npm ci\` runs in the SHARED mirror (its node_modules is what every task links); the run itself in the task dir.
if [ "$(cat node_modules/.tm-lock-sha 2>/dev/null)" != ${shq(lockShaLocal)} ]; then
  echo "[e2e:remote] package-lock.json changed — npm ci on the Steam Machine (a few minutes, once)"
  # npm's own exit code decides (never a pipeline's under pipefail — a filter's early exit would read a
  # successful install as failed); the log is then filtered to the lines that say WHY (\`code EUSAGE\`,
  # «not in sync», «Missing: webpack@… from lock file») or how much («added N packages»).
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund > /tmp/tm-e2e-npm-ci.log 2>&1
  NPM_RC=$?
  grep -E "error code|sync|Missing|added|packages in" /tmp/tm-e2e-npm-ci.log | head -8
  if [ "$NPM_RC" -eq 0 ]; then
    # The browser that matches the installed Playwright (1.64 → Chromium 156, the engine Electron 45 ships).
    # No \`--with-deps\`: it reaches for sudo, which has no terminal over ssh; the container's libraries were
    # installed once at setup (docs/claude/e2e-remote.md).
    npx playwright install chromium 2>&1 | tail -2
    echo ${shq(lockShaLocal)} > node_modules/.tm-lock-sha
  else
    # A neighbour's half-done dependency bump (package.json ahead of its lock) must not block every
    # session's e2e: run on the previous install, say so loudly, and retry the install next run.
    echo "[e2e:remote] ⚠ DEPENDENCIES ON THE STEAM MACHINE ARE STALE — npm ci failed (package.json and package-lock.json out of sync on the laptop? the bump's author runs \\\`npm install\\\`); running on the PREVIOUS install"
  fi
fi
echo "[e2e:remote] $(node --version) · playwright $(npx playwright --version | sed 's/Version //') · $(nproc) threads · load $(cut -d' ' -f1-3 /proc/loadavg)"
# The run's cwd is the TASK dir: its own src / tests / config / build, assets + node_modules linked beside them
# — so the harness's REPO_ROOT (= the config's dir) IS the task dir and TM_E2E_ROOT stays '.'.
cd ${TASK_DIR}
env ${envLine} TM_E2E_SLOT="$1" TM_E2E_OUTPUT_DIR=${TASK_DIR}/test-results TM_E2E_REPORT_DIR=${TASK_DIR}/playwright-report TM_E2E_TIMINGS=${TASK_DIR}/test-results/timings.jsonl npx playwright test ${pwArgs.map(shq).join(' ')}
code=$?
echo $code > ${TASK_DIR}/.last-exit
exit $code
`;
// The outer script runs on the SteamOS host: the lock, the sleep inhibitor, the container.
const outer = `#!/bin/bash
mkdir -p ${REMOTE_HOME}/runs
cat > ${innerPath} <<'TM_INNER'
${inner}TM_INNER
trap 'rm -f ${innerPath} ${outerPath}' EXIT
# THE SLOTS: K lock files, one flock each (fds 10…). A SHARED run takes the first free one, polling
# every 2 s up to the deadline; an EXCLUSIVE run takes ALL of them in order (holding the first while
# waiting for the rest is what keeps a timing run from starving behind a stream of shared ones).
mkdir -p ${REMOTE_HOME}/slots
SLOTS=${SLOTS}
DEADLINE=$((SECONDS + ${LOCK_WAIT_S}))
SLOT=""
EXCL=${exclusive ? '1' : '0'}
# A changed lock means \`npm ci\` in the SHARED mirror — it deletes the node_modules every running
# task links, so the install may only happen with the box EMPTY: such a run goes exclusive whatever
# was asked (seen 2026-10-22: a shared install beside a neighbour's run would have cut its workers off).
if [ "$(cat ${REMOTE_REPO}/node_modules/.tm-lock-sha 2>/dev/null)" != ${shq(lockShaLocal)} ]; then
  echo "[e2e:remote] the lock changed — the install needs the whole box: this run goes EXCLUSIVE"
  EXCL=1
fi
if [ "$EXCL" = 1 ]; then
  for i in $(seq 0 $((SLOTS - 1))); do
    eval "exec $((10 + i))>${REMOTE_HOME}/slots/$i"
    if ! flock -n $((10 + i)); then
      echo "[e2e:remote] EXCLUSIVE run — waiting for slot $i of $SLOTS to free (up to $(( (DEADLINE - SECONDS) / 60 )) min)…"
      flock -w $((DEADLINE - SECONDS)) $((10 + i)) || { echo "[e2e:remote] gave up waiting for the box"; exit 3; }
    fi
  done
  SLOT="exclusive"
else
  while [ -z "$SLOT" ]; do
    for i in $(seq 0 $((SLOTS - 1))); do
      eval "exec $((10 + i))>${REMOTE_HOME}/slots/$i"
      if flock -n $((10 + i)); then SLOT="slot $((i + 1))/$SLOTS"; break; fi
      eval "exec $((10 + i))>&-"
    done
    if [ -z "$SLOT" ]; then
      [ -z "$WAITED" ] && echo "[e2e:remote] every slot of $SLOTS is BUSY — waiting for one (up to $(( (DEADLINE - SECONDS) / 60 )) min)…"
      WAITED=1
      [ $SECONDS -ge $DEADLINE ] && { echo "[e2e:remote] gave up waiting for a slot"; exit 3; }
      sleep 2
    fi
  done
fi
if ! ${besideGame ? 'true' : 'false'} && pgrep -f '[T]erraformingMars.AppImage' >/dev/null; then echo "[e2e:remote] the game started on the Steam Machine while we waited — refusing"; exit 4; fi
echo "[e2e:remote] $SLOT — running ${shq(task)} on $(cat /etc/hostname 2>/dev/null) · load $(cut -d' ' -f1-3 /proc/loadavg)"
# The task's serve root: its own build beside LINKS to what the server reads relative to its cwd
# (the laptop's \`e2e:snapshot\` does the same with junctions) — and to \`node_modules\`, which Node
# resolves UPWARD from the server's real path: on the laptop the snapshot sits inside the repo, here
# the task dir stands beside the mirror (the first run of this layout: «worker server exited with 1»).
# Old tasks' builds go after 14 idle days.
mkdir -p ${TASK_DIR} && ln -sfn ../../repo/assets ${TASK_DIR}/assets && ln -sfn ../../repo/node_modules ${TASK_DIR}/node_modules
# A task dir from the earlier layout linked \`tests\` to the mirror; the sync now writes the task's own copy there.
[ -L ${TASK_DIR}/tests ] && rm -f ${TASK_DIR}/tests
find ${REMOTE_BUILDS} -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null
# The sleep inhibitor is best-effort: over ssh polkit answers «Interactive authentication required»
# unless the owner adds a rule, and the Gaming Mode idle sleep is a Steam setting anyway (Never).
INHIBIT=""
if systemd-inhibit --what=sleep:idle --who=tm-e2e --why=probe --mode=block true 2>/dev/null; then
  INHIBIT="systemd-inhibit --what=sleep:idle --who=tm-e2e --why=${shq(`e2e ${task}`)} --mode=block"
else
  echo "[e2e:remote] (no sleep inhibitor over ssh — the Steam Machine's idle sleep must be set to Never)"
fi
$INHIBIT distrobox enter ${CONTAINER} -- bash ${innerPath} "$SLOT"
code=$?
# Pack the results WHILE STILL HOLDING THE SLOT — a waiting run starts the moment it is released.
rm -f ${TASK_DIR}/results.tar
( cd ${TASK_DIR} && tar -cf results.tar --ignore-failed-read test-results playwright-report .last-exit 2>/dev/null )
( cd ${TASK_DIR} && find screenshots -type f -newer .run-start 2>/dev/null | tar -rf results.tar -T - 2>/dev/null )
exit $code
`;
log(`running${exclusive ? ' EXCLUSIVE' : ''}: playwright test ${pwArgs.join(' ')}  (${envLine})`);
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
try {
  fs.rmSync(outDir, {recursive: true, force: true});
} catch (err) {
  // Windows: a shell standing INSIDE the directory locks it (EBUSY) — extract over it rather than lose the run.
  log(`could not clear ${path.relative(ROOT, outDir)} (${err.code ?? err.message}) — extracting over it`);
}
fs.mkdirSync(outDir, {recursive: true});
// The archive was packed under the lock (outer.sh); here it is only fetched and removed.
const pull = spawnSync(SSH, [...SSH_OPTS, '-C', HOST, `cat ${TASK_DIR}/results.tar 2>/dev/null && rm -f ${TASK_DIR}/results.tar`],
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
