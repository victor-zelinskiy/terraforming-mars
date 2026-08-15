// The pre-push guard's body (see .githooks/pre-push).
//
// Only `main` is guarded: it is the branch two clones share and the only branch
// release.yml ships from. Feature branches may be force-pushed and carry any
// version — nothing downstream reads them.
//
// Fail-open on anything it cannot determine, fail-closed on anything it can.

import {execFileSync} from 'node:child_process';
import {root, versionAtRef, remoteTagVersions, compareVersions, parseVersion} from './version.mjs';

const RELEASE_REF = 'refs/heads/main';
const ZERO = /^0+$/;

const remoteName = process.argv[2] ?? 'origin';

function refuse(lines) {
  // eslint-disable-next-line no-console
  console.error(['', '[pre-push] PUSH REFUSED', ...lines.map((l) => `  ${l}`), ''].join('\n'));
  process.exit(1);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Is this commit object present locally? */
function haveCommit(sha) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], {cwd: root, stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

function highest(versions) {
  const known = versions.filter((v) => parseVersion(v) !== undefined);
  return known.length === 0 ? undefined : known.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));
}

const input = await readStdin();

for (const line of input.split('\n')) {
  const [, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
  if (remoteRef !== RELEASE_REF || localSha === undefined) {
    continue;
  }

  if (ZERO.test(localSha)) {
    refuse([
      'this would DELETE main on the remote.',
      'If that is really the intent, push with --no-verify.',
    ]);
  }

  // A fast-forward push keeps the remote tip as an ancestor. Anything else rewrites
  // history the other clone has already built on. Judge this only when both objects
  // are actually here: `merge-base` cannot tell «not an ancestor» from «never
  // fetched», and reporting the second as the first sends the reader hunting for a
  // force push that never happened.
  if (remoteSha !== undefined && !ZERO.test(remoteSha) && haveCommit(remoteSha) && haveCommit(localSha)) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', remoteSha, localSha], {cwd: root, stdio: 'ignore'});
    } catch {
      refuse([
        `this is not a fast-forward: ${remoteSha.slice(0, 10)} would stop being reachable.`,
        'Force-pushing main deletes the commit the other clone is based on.',
        'Run `npm run push` — it rebases onto the remote instead of overwriting it.',
      ]);
    }
  }

  // The version must be strictly above everything already claimed — the committed
  // version on the remote tip, and every release tag.
  const version = versionAtRef(localSha);
  if (version === undefined) {
    continue; // cannot read it → cannot judge it
  }
  const ceiling = highest([
    remoteSha !== undefined && !ZERO.test(remoteSha) ? versionAtRef(remoteSha) : undefined,
    ...remoteTagVersions(remoteName),
  ]);
  if (ceiling !== undefined && compareVersions(version, ceiling) <= 0) {
    refuse([
      `version ${version} is already claimed (highest released/pushed: ${ceiling}).`,
      'release.yml packs the committed version, and vpk refuses a version it has already shipped,',
      'so this push would turn into a red CI a few minutes from now.',
      'Run `npm run push` — it re-derives the version against the remote and amends the tip.',
    ]);
  }
}
