// Bump package.json (and package-lock.json) to the next free version.
//
// Wired into the pre-commit hook (.githooks/pre-commit): every commit bumps, so the
// committed `version` is unique + monotonic per commit and is the SINGLE SOURCE OF
// TRUTH for the shipped version — both the Heroku server (reads committed
// package.json at build) AND the desktop release (release.yml packs the committed
// version). That is what makes the Diagnostics «Client / Server version» rows
// directly comparable: equal version ⇔ same build.
//
// The number comes from scripts/version.mjs, which takes the ceiling over
// origin/main and the release tags rather than just incrementing the local file —
// see the header there for why «my base + 1» breaks once two clones share main.
// Offline by design: only local refs are consulted, so a commit never waits on the
// network. The push wrapper (scripts/sync-push.mjs) re-derives the number against
// the REMOTE once the rebase has fixed the commit's final position.
//
// Fast + dependency-free (no `npm version` overhead / lifecycle scripts). No-ops
// (exit 0) on any trouble so a commit is never blocked.

import {nextVersion, writeVersion} from './version.mjs';

const next = nextVersion();
if (next === undefined) {
  process.exit(0); // unparseable/missing version — never block the commit
}
if (!writeVersion(next)) {
  process.exit(0);
}

// eslint-disable-next-line no-console
console.log(`[bump-version] → ${next}`);
