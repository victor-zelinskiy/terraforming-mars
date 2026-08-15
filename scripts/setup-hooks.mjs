// Point git at the version-controlled .githooks/ dir (per-commit version bump +
// the pre-push guard) and put `git pull` on rebase. Invoked by the `prepare` npm
// script, so `npm install` wires it up automatically — no husky / extra dependency.
//
// This is what makes the two-clone workflow self-distributing: a hook committed to
// .githooks/ is live in the other clone after its next install, with nothing to
// configure by hand. `pull.rebase` is repo-local and keeps merge commits out of a
// history that is linear by design and carries one release tag per commit.
//
// Deliberately fail-open + silent when there's no git (Heroku dyno build, a
// tarball checkout, CI that doesn't commit): `git config` there is a harmless
// no-op / error we swallow. Never fail an install over a dev-only convenience.

import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

try {
  // No-op outside a git work tree (throws → caught).
  execSync('git rev-parse --is-inside-work-tree', {cwd: root, stdio: 'ignore'});
  execSync('git config core.hooksPath .githooks', {cwd: root, stdio: 'ignore'});
  execSync('git config pull.rebase true', {cwd: root, stdio: 'ignore'});
  // eslint-disable-next-line no-console
  console.log('[setup-hooks] git core.hooksPath -> .githooks (version bump + push guard), pull.rebase -> true');
} catch {
  // Not a git repo / git unavailable — nothing to wire up.
}
