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

A scheduled cloud agent (a Claude Code routine, 05:30 UTC) works the queue. **It writes verdicts; it changes no
product code.** Per run:

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
   - Do **not** close the issue (a working session closes it with the fix) — except `triage:infra` that did not recur
     in the last run.
3. **End with a digest** — the routine's final message: `N triaged: a real · b noise · c harness · d flake · e infra;
   M left`, then one line per `triage:real`.

**Never:** push to `main`, open a pull request with product changes, edit a baseline
(`tests/client/bottle/monkeyBaseline.json`, `tests/e2e/monkeyBaseline.json`, `LAYOUT_BLIND`) — a baseline row is a
decision of a working session, made after a real browser said «not there».

## 4. What the agent needs (the owner's side)

- The routine clones `victor-zelinskiy/terraforming-mars` and must be able to **comment on and label issues** and to
  **download run artifacts**: a GitHub token in the routine's environment (`GH_TOKEN`) with, for this one repository,
  `Issues: read and write`, `Actions: read`, `Contents: read`, `Metadata: read`.
- Nothing else: no access to the box, to Sentry, or to the release.
