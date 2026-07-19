// Bump the PATCH of package.json (and package-lock.json) by 1.
//
// Wired into the pre-commit hook (.githooks/pre-commit): every commit bumps the
// version, so the committed `version` is unique + monotonic per commit and is
// the SINGLE SOURCE OF TRUTH for the shipped version — both the Heroku server
// (reads committed package.json at build) AND the desktop release (release.yml
// packs the committed version). That is what makes the Diagnostics «Client /
// Server version» rows directly comparable: equal version ⇔ same build.
//
// Fast + dependency-free (no `npm version` overhead / lifecycle scripts). Edits
// the JSON in place, preserving 2-space indent + trailing newline. No-ops (exit
// 0) if package.json is missing/unparseable so a commit is never blocked.

import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');
const lockPath = join(root, 'package-lock.json');

function bumpPatch(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(version ?? '');
  if (m === null) {
    return undefined;
  }
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}${m[4]}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Preserve the file's trailing-newline convention.
function writeJson(path, obj, raw) {
  const trailing = raw.endsWith('\n') ? '\n' : '';
  writeFileSync(path, JSON.stringify(obj, null, 2) + trailing);
}

let next;
try {
  const raw = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  next = bumpPatch(pkg.version);
  if (next === undefined) {
    process.exit(0); // unparseable version — never block the commit
  }
  pkg.version = next;
  writeJson(pkgPath, pkg, raw);
} catch {
  process.exit(0); // no/broken package.json — never block the commit
}

// Keep package-lock.json's two version fields in lockstep so `npm ci` stays happy.
try {
  if (existsSync(lockPath)) {
    const raw = readFileSync(lockPath, 'utf8');
    const lock = readJson(lockPath);
    if (lock.version !== undefined) {
      lock.version = next;
    }
    if (lock.packages !== undefined && lock.packages[''] !== undefined && lock.packages[''].version !== undefined) {
      lock.packages[''].version = next;
    }
    writeJson(lockPath, lock, raw);
  }
} catch {
  // A lockfile hiccup must not block the commit; package.json is the source of truth.
}

// eslint-disable-next-line no-console
console.log(`[bump-version] → ${next}`);
