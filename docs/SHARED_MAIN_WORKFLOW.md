# Two clones, one `main`

Two agents work in two separate local clones of this fork and both push to `main`.
That is a supported setup, not an accident — but it invalidates one assumption the
release pipeline was originally built on, so the tooling compensates for it.

**The whole workflow is one command:**

```bash
npm run push
```

It asserts a clean tree, fetches, rebases onto `origin/main`, re-derives the release
version against the remote, amends the tip and pushes — retrying when the other clone
lands first. There is nothing else to remember, and no checklist to follow by hand.

Setup is automatic: `npm install` runs `prepare` → `scripts/setup-hooks.mjs`, which
points git at `.githooks/` and sets `pull.rebase true`. A hook committed here is live
in the other clone after its next install.

---

## The assumption that broke

`release.yml` packs the **committed `package.json` version** as Velopack's
`packVersion`, and Diagnostics compares that same string between client and server
(«equal version ⇔ same build»). So the number must be unique and monotonic across
everything ever released.

It used to be produced by the `pre-commit` hook as *my base + 1*. That is correct
only while **one** clone writes to `main`, because it decides the number before the
commit's final position in `main` is known. With two clones:

1. both commit off base `X` (version `1.2.370`) → both hooks produce **`1.2.371`**;
2. clone A pushes first; CI releases `1.2.371` and tags `v1.2.371`;
3. clone B rebases. Git sees an **identical** `370 → 371` edit on both sides and drops
   it as already applied — and the `pre-commit` hook deliberately stays silent during
   a rebase («replaying old commits must not re-bump»), so nothing re-derives it;
4. B's tip is pushed still claiming `1.2.371`, and `vpk pack` fails:
   *There is a release in channel linux which is equal or greater to the current
   version 1.2.371.*

The failure surfaces minutes later, in CI, on another machine, worded in terms of
release channels — about as far from the cause as it gets. It happened on
2026-08-15 (`c474cd17`), fixed by `795bae28`.

Deriving the version from history position instead (`git rev-list --count`) does not
work here: the count is ~14 400 against a version of `1.2.372`, and an upstream sync
would move it in jumps.

## The rule that replaced it

`scripts/version.mjs` is the single source of the rule. A version is legal only if it
is **strictly above the ceiling** — the highest number anyone else already claimed:
`origin/main`'s committed version, plus every release tag. Nothing derives from the
local base alone.

It is applied at three points:

| Where | What it does | Sources |
| --- | --- | --- |
| `.githooks/pre-commit` → `scripts/bump-version.mjs` | bumps every commit, keeping versions unique per commit within a clone | local refs only — a commit never waits on the network |
| `scripts/sync-push.mjs` (`npm run push`) | **re-derives after the rebase**, when the commit's position is finally fixed, and amends the tip | `origin/main` + `git ls-remote --tags` |
| `.githooks/pre-push` → `scripts/check-push.mjs` | refuses the push if the version is already claimed, or if it is not a fast-forward | the sha git is actually pushing to + remote tags |

The push step is what closes the hole; the guard is the backstop that keeps a manual
`git push` safe and turns a red CI into an instant local refusal.

## Deliberate non-behaviours

- **`npm run push` never resolves a content conflict.** It aborts the rebase and hands
  it back. `-X ours` / `-X theirs` is precisely how the other clone's work disappears
  without a trace; that decision needs a reader.
- **It never stashes.** A dirty tree is refused with a message to commit first.
- **It never force-pushes**, and the guard refuses one on `main` even by hand: the
  remote tip is the other clone's base, and rewriting it deletes work they have
  already built on. `--no-verify` is the deliberate override.
- **The guard only covers `main`.** Feature branches may be force-pushed and carry any
  version — nothing downstream reads them.
- **Every version helper fails open.** Versioning must never block a commit over a
  missing ref or an unreachable remote. The guard is the exception in one direction:
  when it *can* determine a violation, it fails closed.

## What is still irreducible

Two writers on one branch means a rebase, and a rebase means git may merge two edits
to the same file textually while nobody has checked the result makes sense. That
cannot be automated safely, so `npm run push` prints the files **both** sides changed
(`⚠ both sides changed: …`) instead of pretending the clean rebase settled it.
`ConsoleShell.vue` is the usual candidate.
