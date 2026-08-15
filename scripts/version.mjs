// The single rule for «what version may this commit claim», shared by the
// pre-commit bump, the push wrapper and the pre-push guard.
//
// The version is load-bearing twice over: release.yml packs the COMMITTED
// package.json version as Velopack's `packVersion`, and Diagnostics compares it
// between client and server («equal version ⇔ same build»). So it must be unique
// and monotonic across everything that has ever been claimed.
//
// It used to be «my base + 1», computed at commit time. That holds only while ONE
// clone writes to main. With two clones the number is decided before the commit's
// final position in main is known: both commit off the same base, both produce the
// same number, git drops the identical bump as already-applied during the rebase
// (and the pre-commit hook deliberately stays silent mid-rebase), and the surviving
// tip carries a version vpk has already published — «There is a release in channel
// linux which is equal or greater to the current version».
//
// Hence: never derive the version from the local base alone. Take the CEILING over
// every source that could already have claimed a number — origin/main's committed
// version and the release tags — and go one above it.
//
// Everything here is fail-open: versioning must never block a commit for a reason
// as trivial as a missing ref or an unreachable remote.

import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');
const lockPath = join(root, 'package-lock.json');

/** Run git for its stdout. Returns undefined instead of throwing. */
export function git(args) {
  try {
    return execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
  } catch {
    return undefined;
  }
}

export function parseVersion(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(version ?? '');
  if (m === null) {
    return undefined;
  }
  return {major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), suffix: m[4]};
}

/** Numeric, not lexicographic — a string compare puts 1.2.99 above 1.2.372. */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa === undefined || pb === undefined) {
    return 0;
  }
  return pa.major - pb.major || pa.minor - pb.minor || pa.patch - pb.patch;
}

export function bumpPatch(version) {
  const p = parseVersion(version);
  if (p === undefined) {
    return undefined;
  }
  return `${p.major}.${p.minor}.${p.patch + 1}${p.suffix}`;
}

function highest(versions) {
  const known = versions.filter((v) => parseVersion(v) !== undefined);
  if (known.length === 0) {
    return undefined;
  }
  return known.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));
}

export function readVersion() {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return undefined;
  }
}

/** The package.json version at any commit-ish (a ref, a sha). */
export function versionAtRef(ref) {
  const raw = git(['show', `${ref}:package.json`]);
  if (raw === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(raw).version;
  } catch {
    return undefined;
  }
}

function tagVersionsFrom(lines) {
  return lines
    .map((line) => line.trim().split(/\s+/).pop() ?? '')
    // An annotated tag also shows up peeled as `refs/tags/v1.2.3^{}`.
    .map((ref) => ref.replace(/\^\{\}$/, ''))
    .filter((ref) => ref.startsWith('refs/tags/v'))
    .map((ref) => ref.slice('refs/tags/v'.length))
    .filter((v) => parseVersion(v) !== undefined);
}

/** Local tags only — the pre-commit path must stay instant and offline-safe. */
export function localTagVersions() {
  const out = git(['tag', '-l', 'v*']);
  if (out === undefined || out === '') {
    return [];
  }
  return tagVersionsFrom(out.split('\n').map((t) => `x refs/tags/${t.trim()}`));
}

/**
 * Authoritative tag list straight from the remote. Immune to a stale local tag —
 * `git fetch --tags` here refuses v1.0.0 with «would clobber existing tag», so the
 * local tag namespace cannot be trusted for a release decision.
 */
export function remoteTagVersions(remote = 'origin') {
  const out = git(['ls-remote', '--tags', remote, 'v*']);
  if (out === undefined || out === '') {
    return [];
  }
  return tagVersionsFrom(out.split('\n'));
}

/**
 * The highest version already claimed by somebody else: origin/main's committed
 * version plus the release tags. A version is safe to push only if it is STRICTLY
 * above this.
 */
export function ceilingVersion({remote = 'origin', branch = 'main', useNetwork = false} = {}) {
  return highest([
    versionAtRef(`${remote}/${branch}`),
    ...localTagVersions(),
    ...(useNetwork ? remoteTagVersions(remote) : []),
  ]);
}

/** True when `version` is strictly above everything already claimed. */
export function isVersionFree(version, options) {
  const ceiling = ceilingVersion(options);
  return ceiling === undefined || compareVersions(version, ceiling) > 0;
}

/**
 * The number the next commit should carry: one above the highest of the local file
 * and the ceiling. Taking the local file into account too keeps versions unique per
 * commit within a clone (what Diagnostics leans on); taking the ceiling into account
 * is what makes two clones stop colliding.
 */
export function nextVersion(options) {
  const top = highest([readVersion(), ceilingVersion(options)]);
  return top === undefined ? undefined : bumpPatch(top);
}

/** Preserve each file's trailing-newline convention (2-space indent, as committed). */
function writeJson(path, obj, raw) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
}

/** Write `version` into package.json and keep package-lock's two fields in lockstep. */
export function writeVersion(version) {
  try {
    const raw = readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    pkg.version = version;
    writeJson(pkgPath, pkg, raw);
  } catch {
    return false; // no/broken package.json — never block the caller
  }
  try {
    if (existsSync(lockPath)) {
      const raw = readFileSync(lockPath, 'utf8');
      const lock = JSON.parse(raw);
      if (lock.version !== undefined) {
        lock.version = version;
      }
      if (lock.packages?.[''] !== undefined && lock.packages[''].version !== undefined) {
        lock.packages[''].version = version;
      }
      writeJson(lockPath, lock, raw);
    }
  } catch {
    // A lockfile hiccup must not block anything; package.json is the source of truth.
  }
  return true;
}

export const VERSION_FILES = ['package.json', 'package-lock.json'];
