// `npm run push` — the one command for landing work on the shared main.
//
// Two clones of this repo write to the same branch, so a push can be rejected at any
// moment; that is normal, not an incident. Everything the situation needs is done
// here so it does not have to live in a checklist someone has to remember:
//
//   clean-tree assert → fetch → rebase → re-derive the version against the REMOTE
//   → amend the tip → push, retrying when the other clone slips in first.
//
// The version step is the point of the whole script. The pre-commit hook decides a
// number before the commit's final position in main is known; only here — after the
// rebase, with origin's actual state in hand — is that position final. See the
// header of scripts/version.mjs for the failure this prevents.
//
// What it deliberately does NOT do: resolve a content conflict. It aborts the rebase
// and hands it back, because picking `-X ours` / `-X theirs` for you is exactly how
// the other clone's work disappears quietly.

import {execFileSync} from 'node:child_process';
import {
  git, root, readVersion, ceilingVersion, bumpPatch, isVersionFree, writeVersion, VERSION_FILES,
} from './version.mjs';

const REMOTE = 'origin';
const MAX_ATTEMPTS = 3;

// eslint-disable-next-line no-console
const say = (message) => console.log(`[sync-push] ${message}`);

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(`[sync-push] ${message}`);
  process.exit(1);
}

/** Run git with its output visible; returns false instead of throwing. */
function run(args, env) {
  try {
    execFileSync('git', args, {cwd: root, stdio: 'inherit', env: {...process.env, ...env}});
    return true;
  } catch {
    return false;
  }
}

function counts(branch) {
  const raw = git(['rev-list', '--left-right', '--count', `${REMOTE}/${branch}...HEAD`]);
  const [behind, ahead] = (raw ?? '').split(/\s+/).map(Number);
  return {behind: behind || 0, ahead: ahead || 0};
}

function changedFiles(range) {
  const raw = git(['diff', '--name-only', range]);
  return raw === undefined || raw === '' ? [] : raw.split('\n').map((f) => f.trim()).filter(Boolean);
}

/**
 * Files that BOTH sides touched. git merged them textually and said nothing; whether
 * the result still makes sense is the one thing no script can decide, so name them.
 */
function reportOverlap(base, branch) {
  const incoming = new Set(changedFiles(`${base}..${REMOTE}/${branch}`));
  const overlap = changedFiles(`${REMOTE}/${branch}..HEAD`).filter((f) => incoming.has(f));
  if (overlap.length > 0) {
    say(`⚠ both sides changed: ${overlap.join(', ')}`);
    say('  the rebase merged these textually — check the result still makes sense');
  }
}

/** Make sure the tip claims a version nobody has released or committed yet. */
function ensureFreeVersion(branch) {
  const options = {remote: REMOTE, branch, useNetwork: true};
  const current = readVersion();
  if (current === undefined || isVersionFree(current, options)) {
    return;
  }
  const ceiling = ceilingVersion(options);
  const next = bumpPatch(ceiling);
  if (next === undefined || !writeVersion(next)) {
    fail(`version ${current} is already taken and could not be bumped — fix package.json by hand`);
  }
  if (!run(['add', ...VERSION_FILES]) ||
      !run(['commit', '--amend', '--no-edit'], {TM_SKIP_VERSION_BUMP: '1'})) {
    fail('could not amend the version into the tip commit');
  }
  say(`version ${current} was already claimed (ceiling ${ceiling}) → ${next}, tip amended`);
}

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch === undefined) {
  fail('not a git work tree');
}
if (branch === 'HEAD') {
  fail('detached HEAD — check out a branch first');
}

const dirty = git(['status', '--porcelain']);
if (dirty !== '') {
  fail('working tree is not clean — commit your work first (never stash: the tree may hold work that is not yours)');
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  if (!run(['fetch', REMOTE])) {
    fail(`could not fetch ${REMOTE}`);
  }

  const before = counts(branch);
  if (before.behind > 0) {
    const base = git(['merge-base', 'HEAD', `${REMOTE}/${branch}`]);
    say(`${before.behind} commit(s) arrived from the other clone — rebasing`);
    if (!run(['rebase', `${REMOTE}/${branch}`])) {
      run(['rebase', '--abort']);
      fail('rebase hit a conflict and was aborted — resolve it by hand (never -X ours/-X theirs), then run npm run push again');
    }
    reportOverlap(base, branch);
  }

  const after = counts(branch);
  if (after.ahead === 0) {
    say('nothing to push — up to date with the remote');
    process.exit(0);
  }

  ensureFreeVersion(branch);

  if (run(['push', REMOTE, branch])) {
    say(`pushed ${after.ahead} commit(s) as version ${readVersion()}`);
    process.exit(0);
  }
  say(`push rejected (the other clone got there first) — retrying, attempt ${attempt + 1}/${MAX_ATTEMPTS}`);
}

fail(`gave up after ${MAX_ATTEMPTS} attempts — the other clone is pushing continuously; try again in a moment`);
