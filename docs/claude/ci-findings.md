# CI findings — one queue for every workflow

> The owner, 2026-11-17: CI carries the load (the laptop is spared, the box is for pointwise runs), the workflows run
> by themselves at night, and **what they find is filed and triaged by ONE mechanism — the workflows differ only in how
> often they run.** This is that mechanism: who files, what an issue is, and how the morning agent works the queue.

## 1. The shape

```
a workflow run ──► findings (one JSON shape) ──► scripts/ci/findings.mjs file ──► GitHub issues, label `ci-finding`
                                                                                      │
                                                    the morning triage agent ◄────────┘  verdict = a label + a comment
                                                                                      │
                                                    a working session ◄───────────────┘  the fix (a law, a guard, a replay)
```

| Workflow | When (UTC) | What it files |
| --- | --- | --- |
| `Freeze gate` (`freeze-gate.yml`) — the bottle | 23:30 nightly: seeds `fz0 fz1 fz3` + the seed of the day `d<date>` | a NEW cause class · a stall never cured · a run with no verdict |
| `Playwright E2E` (`playwright-e2e.yml`) — the whole suite | 00:30 nightly | a FAILED test · a FLAKY test (one issue per test) |
| `Monkey` (`monkey.yml`) — the real-browser monkey | 03:00 nightly (plain, the seed of the day) · Sunday 07 / 10 / 13 / 16: `cpu4` · `net400` · `reload` · `duo` | a NEW cause class · a stall never cured · a run with no verdict |
| `CI` (`main.yml`) · `Release Electron App` (`release.yml`) | every push — watched by `CI findings` (`ci-findings.yml`, a `workflow_run` AFTER the run ended; a cancelled run is not a finding) | a RED run: one issue per failed JOB |

**The release is never stalled by them.** A scheduled run commits nothing (so it starts no release and cancels none),
shares no concurrency group with `CI` / the release, and takes at most 8 – 10 runners at a time (`max-parallel`) — the
account's concurrent-job limit is the one resource they share (measured 2026-11-17: two 16-shard passes dispatched by
hand delayed a release's start by 4 minutes; at night nobody pushes).

## 2. A finding, and its issue

`scripts/ci/findings.mjs` — `from-monkey <monkey-report.json>` · `from-playwright <merged-report.json>` · `broken` →
a findings file `{source, context, run, findings: [{key, kind, title, body}]}`; `file <findings.json>…` turns it into
issues (needs `GH_TOKEN`, `issues: write`).

- **ONE ISSUE PER KEY, FOR GOOD.** The key is stable: `freeze-gate|class|<cause class>` · `monkey|class|<cause class>` ·
  `monkey|walk|<table>` (a walk the harness itself failed) · `e2e|test|<spec>|<title>|<project>` ·
  `ci|job|<workflow>|<job>` · `<source>|broken-run|<context>`. It rides the issue's body as a hidden marker.
- **A FLOOD IS ONE ISSUE.** More than 25 findings from one run are one cause (a broken build reads as 571 red tests):
  they are filed as ONE issue that lists them (`<source>|flood|<context>`), never a hundred issues a night.
- **RED WITH NOTHING NAMED IS SAID TOO** (`broken-run`): a gate that died before its report, a shard that vanished, a
  suite with no merged report — a red night with nothing filed would read as a quiet one.
- **Seen again → the same issue is TOUCHED** — a counter and «last seen» in its body, never a comment a night.
- **Closed and seen again → REOPENED**, labelled `regression`, back to `triage:needed`.
- **Labels:** `ci-finding` · `src:<source>` · `kind:new-class | never-cured | failed | flaky | broken-run` ·
  `triage:needed` (no verdict yet).
- A run narrowed by hand (`grep`, `only`) may file too when it is the gate or the monkey (a class is a class); the e2e
  suite files only when it ran WHOLE.

## 3. The morning triage (the agent's procedure)

A scheduled cloud agent (a Claude Code routine, 05:30 UTC, Opus 5.5) works the queue. **Every finding gets a verdict;
a SIMPLE one is also FIXED by the agent — on a branch, proven on CI, handed over as a pull request (§ 3a); a complex
one goes by the verdict alone, to a working session** (the owner, 2026-11-17). Per run:

1. `gh issue list --label ci-finding --label triage:needed --state open --json number,title,labels,body` — the queue.
   Nothing there → say so in one line and stop.
2. For each issue (oldest first; at most 12 a run — say how many are left):
   - **Read** its body: the class or the test, the first table / the error, the «Repeat it» command, the run's link.
   - **Reproduce where it is cheap and deterministic:**
     - `src:freeze-gate` — the bottle replays by its seed on any machine: `npm ci && npm run make:static && npm run
       make:cards`, then the issue's own command (`npm run gate:freeze -- --seed <seed> --only '^<table>$'
       --skip-replays`). To cut the walk down: `TM_BOTTLE_MONKEY=1 TM_BOTTLE_MONKEY_SEED=<seed>
       TM_BOTTLE_MONKEY_ONLY='^<table>$' TM_BOTTLE_MONKEY_SHRINK='<class regex>' NODE_ENV=development node
       scripts/client-tests.mts tests/client/bottle/monkey.bottle.ts` → `.e2e-remote/bottle-monkey/shrunk/<table>.txt`.
     - `src:monkey` · `src:e2e` — a real browser: do NOT try to run it. Read the run's artifacts instead
       (`gh run download <run id> -n monkey-report-<id>-1`, the failed walk's `monkey-walk.txt`; for e2e the «Fix
       brief» on the run's summary page and `playwright-report-<id>-1`).
   - **Read the code** the class names (the line's tag → `src/common/diagnostics/shapes.ts` → the print site), and the
     worklist: `docs/claude/console/freeze-zero/PLAN.md` § 4 (is the class already there, open or closed?).
   - **Give ONE verdict** — replace `triage:needed` with exactly one of:

     | Label | Means |
     | --- | --- |
     | `triage:real` | a defect of the game / the console: a wait nobody ends, a wrong owner, a loop |
     | `triage:noise` | a FALSE ALARM of a net: the line is a defect by its tier, the thing it names is honest (a bound on the wrong clock, a wait that has an owner) — the net is what needs the fix |
     | `triage:harness` | the instrument's own: the bottle has no layout (a wait for a measured end), a spec's own race |
     | `triage:flake` | an e2e test that fails by timing, not by product (name the flake class of `.claude/rules/tests.md`) |
     | `triage:infra` | the runner / a dependency / the network — not the code |

   - **Comment** (one comment, in English, ≤ 25 lines): the verdict and WHY in two sentences · what you reproduced or
     read (the shrunk steps when you have them) · the suspected cause with `file:line` · what a fix would have to be
     (the law, not the patch) · what you could NOT determine. Never guess a cause you did not read.
   - **Then decide the LANE** (§ 3a): SIMPLE → fix it; anything else → the verdict is the whole of the work.
   - Do **not** close the issue (the merge of its fix closes it) — except `triage:infra` that did not recur in the
     last run.
3. **End with a digest** — the routine's final message: `N triaged: a real · b noise · c harness · d flake · e infra;
   F fixed (pull requests); M left`, then one line per pull request and one per `triage:real` left to a session.

### 3a. THE FIX LANE — what the agent fixes itself

**SIMPLE is one of three, and only when the cause was READ, not guessed:**

1. **A wrong e2e check** — the spec or its driver breaks the canon of `.claude/rules/tests.md` § «КАК ПИСАТЬ
   E2E-ПРОВЕРКУ» (a wait on time, a one-shot read of a transient, geometry read in motion, a selector the product no
   longer has), or asserts what the product never promised. The fix lives in `tests/e2e/**` alone.
2. **Not a bug** — the test's expectation is stale against a DELIBERATE product change (the commit that made it is
   named in the pull request). The fix is the expectation, in `tests/**` alone.
3. **A trivial bug** — a local product defect: one cause, at most ~40 changed lines in at most 3 product files, with a
   unit spec that is RED before the fix and green after it.

**NEVER simple, whatever the size** (the verdict lane — a working session decides): game rules and anything
server-authoritative (`src/server/**` beyond a log line or a typo), saves and serialization, the transport
(`src/client/console/transport/**`), the flow kernel (`src/client/console/kernel/**`), the liveness nets / the wait
graph / the hold registry, a diagnostic line's tier or shape, a motion's timing, RU copy, a dependency, a workflow —
and **every baseline** (`tests/client/bottle/monkeyBaseline.json`, `tests/e2e/monkeyBaseline.json`, `LAYOUT_BLIND`,
any `*Baseline.json` ratchet): a baseline row is a decision of a working session, made after a real browser said
«not there». A finding of the monkey or the gate (`kind:new-class`) is simple only as case 3.

**How a fix is made and proven:**

- A branch off `origin/main`: `claude/ci-fix-<issue number>-<slug>`. ONE commit, `TM_SKIP_VERSION_BUMP=1` (a branch
  never bumps the version; `package.json` / `package-lock.json` stay untouched), the message through `-F <file>`,
  English, saying the cause.
- Before the push, in the sandbox: `npm run lint`, `npm run build:test` (when `tests/` is touched), the unit specs of
  what was touched (`npm run test:client:one -- <spec>` / the mocha line of `CLAUDE.md`), and for a gate finding the
  issue's own «Repeat it» command — green.
- Push the branch, open a pull request to `main` labelled `ci-fix`: title `[ci-fix #<issue>] <what>`, body — the
  cause, the fix, what was run, and `Fixes #<issue>`.
- **RE-RUN THE TEST ON CI, on the branch** — the laptop and the box are not there, and a browser is never started in
  the sandbox: `gh workflow run "Playwright E2E" --ref <branch> -f grep="<the test's title>" -f shards=4
  -f burnin_depth=0` (the monkey: `gh workflow run Monkey --ref <branch> -f seed=<seed> -f shards=1
  -f only='^<table>$'`; the gate: `gh workflow run "Freeze gate" --ref <branch> -f seeds=<seed> -f only='^<table>$'`).
  Wait for it (bounded: 40 minutes), and write the run's link and its result into the pull request.
- Green → the issue gets `fix:proposed` beside its verdict label. Red → ONE more attempt; red again → close the pull
  request with what was learned, and the finding goes by the verdict lane (`triage:real`), the comment saying what the
  two attempts ruled out.
- **The agent never merges and never pushes to `main`.** Every push to `main` is a RELEASE with its own version bump
  (`npm run push`), so a pull request is LANDED by a working session — or on the owner's word — through that path;
  GitHub's merge button would ship a version a release already claimed.
- At most 4 pull requests a morning; the rest of the queue goes by verdicts.

**Never, in any lane:** push to `main`, merge, force-push, edit a baseline, change a workflow, touch an issue without
the `ci-finding` label.

## 4. What the agent needs (the owner's side)

- The routine clones `victor-zelinskiy/terraforming-mars` through the GitHub account connected to Claude, and must be
  able, for this one repository, to: **comment on and label issues** (`Issues: read and write`), **download run
  artifacts and dispatch a workflow on its branch** (`Actions: read and write`), **push a `claude/…` branch**
  (`Contents: read and write`) and **open a pull request** (`Pull requests: read and write`).
- Nothing else: no push to `main`, no access to the box, to Sentry, or to the release.
- **A working session's first look** (and the owner's): `gh pr list --label ci-fix` — the fixes waiting to be landed;
  `gh issue list --label ci-finding --label triage:real` — what is left for a session.
