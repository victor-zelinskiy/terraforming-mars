// Sync package.json's `version` to the release scheme WITHOUT hand-editing it.
//
// Why this exists: the SHIPPED version is computed in CI (.github/workflows/release.yml
// → `VELO_VERSION: 1.1.${github.run_number}` → `npm version ... --no-git-tag-version`),
// so the committed package.json `version` never reaches a release — it's a cosmetic
// dev placeholder that silently drifts (e.g. a diagnostic bump to 1.0.8 while the tags
// were at v1.1.256). This script re-anchors it to the latest `v1.1.N` git tag so a local
// build / an at-a-glance check always reflects the real release line.
//
// Anchor = the highest existing `v1.1.N` tag (the latest RELEASE), not a guessed "+1":
// it's a verifiable fact, and it self-corrects after every release. CI still overrides
// the exact patch with its run number, so an off-by-one locally is irrelevant.
//
// No-ops silently outside a git repo / with no matching tag (keeps the current value),
// so it's safe to wire into build scripts. Run manually via `npm run version:sync`.

import {execSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');

function latestReleaseVersion() {
  let tags;
  try {
    // Newest-first, semver-aware. Includes only annotated + lightweight tags.
    tags = execSync('git tag --sort=-v:refname', {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
  } catch {
    return undefined; // not a git repo / git unavailable
  }
  for (const line of tags.split('\n')) {
    const m = line.trim().match(/^v(1\.1\.\d+)$/);
    if (m !== null) {
      return m[1];
    }
  }
  return undefined; // no v1.1.N tag yet
}

const target = latestReleaseVersion();
if (target === undefined) {
  // Nothing to anchor to — leave package.json untouched.
  process.exit(0);
}

const raw = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);
if (pkg.version === target) {
  process.exit(0); // already in sync
}

const previous = pkg.version;
pkg.version = target;
// Preserve the file's trailing newline convention.
const trailing = raw.endsWith('\n') ? '\n' : '';
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + trailing);
// eslint-disable-next-line no-console
console.log(`[sync-version] package.json ${previous} → ${target} (latest release tag)`);
