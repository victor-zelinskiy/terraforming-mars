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
| `Freeze gate` (`freeze-gate.yml`) — the bottle | 23:17 nightly: seeds `fz0 fz1 fz3` + the seed of the day `d<date>` | a NEW cause class · a stall never cured · a run with no verdict |
| `Playwright E2E` (`playwright-e2e.yml`) — the whole suite | 00:47 nightly | a FAILED test · a FLAKY test (one issue per test) |
| `Monkey` (`monkey.yml`) — the real-browser monkey | 03:13 nightly (plain, the seed of the day) · Sunday 07:13 / 10:13 / 13:13 / 16:13 / 19:13: `cpu4` · `net400` · `reload` · `duo` · `hidden` | a NEW cause class · a stall never cured · a run with no verdict |
| `CI` (`main.yml`) · `Release Electron App` (`release.yml`) | every push — watched by `CI findings` (`ci-findings.yml`, a `workflow_run` AFTER the run ended; a cancelled run is not a finding) | a RED run: one issue per failed JOB |
| `Sentry findings` (`sentry-findings.yml`) — what REAL sessions reported (the box, a player's machine) | 04:41 nightly, before the morning triage | one issue per unresolved Sentry issue seen in the last 26 h (= one cause class): kind `field`, source `sentry` |
| `Land ci-fix` (`land-ci-fix.yml`) | when a pull request from a `claude/ci-fix-*` branch appears, when `CI` of its head commit ends, and every half hour (the sweep) | nothing — it starts the fix's proof, lands the fix or refuses it in writing (§ 3b) |

**GITHUB'S SCHEDULER IS LATE, AND MAY SKIP** (the first night, 2026-11-17/18: a half-hourly sweep added at 15:55 UTC fired for the first time at 23:27 — once; the gate's 23:30 had not come by 00:15, and the night's set was started by hand). A cron is never on the hour or the half hour (the scheduler is at its latest there), and **a night whose runs did not start is a fact to CHECK, not to assume**: `gh run list --event schedule --limit 10`. A night that keeps being skipped is started by something that has a clock of its own.

**The release is never stalled by them.** A scheduled run commits nothing (so it starts no release and cancels none),
shares no concurrency group with `CI` / the release, and takes at most 8 – 10 runners at a time (`max-parallel`) — the
account's concurrent-job limit is the one resource they share (measured 2026-11-17: two 16-shard passes dispatched by
hand delayed a release's start by 4 minutes; at night nobody pushes).

### 1a. Sentry is one more source of the same queue

The game sends what failed to Sentry (`docs/claude/diagnostics.md`) — and nobody reads Sentry at night: on 2026-11-18
a defect of the owner's own game stood there until the owner said so. `Sentry findings` asks Sentry once a night
(`node scripts/diag.mjs issues --since 26h --json`, the read-only secret `SENTRY_READ_TOKEN` as `SENTRY_AUTH_TOKEN`)
and files through the ONE filer (`findings.mjs from-sentry`):

- **One GitHub issue per Sentry issue**, keyed by its short id (`sentry|issue|TERRAFORMING-MARS-T` — one Sentry issue
  IS one cause class, the diagnostics' own grouping). It is touched every night it keeps happening («Seen N times»)
  and reopened as a `regression` when it returns.
- **Only `unresolved` ones.** A class closed with `npm run diag -- resolve <class>` (resolved in the release that
  carries the fix) is not filed again by events of OLDER builds still running on the box — Sentry reopens it only
  for an event of that release or a later one, and then it is a regression here too. **Closing a `src:sentry` issue
  therefore has two halves: the fix in `main`, and `diag resolve` in the release that carries it** — an issue closed
  on GitHub alone comes back the next night.
- **The repository is public, the sessions are not.** The finding carries the Sentry issue's title (a cause class is
  structure, and it is scrubbed all the same: addresses, e-mails, query values, home directories), its counts, its
  dates and the link into Sentry (a login is asked). Never an event, a breadcrumb, a save, a name.
- **Triage (`src:sentry`):** the agent's sandbox has no Sentry access — it reads the class off the title
  (`[family] shape (structural words)` → the row of `src/common/diagnostics/shapes.ts` → the print site), the code
  there, and `docs/claude/console/freeze-zero/PLAN.md` § 4 (is the class known? was it «left to the net»?). A field
  defect has no re-run that proves a fix (no `ci-proof`), so the lane never lands one by itself: the verdict is
  `triage:real` + `for:session`, with the suspected cause — or `triage:noise` for a line that is no defect (then the
  fix is the line's tier in `shapes.ts`, a working session's). The session reads the evidence
  (`npm run diag -- issue <short id>`, the skill `diagnose-report`).
- **A flood is one finding**, as everywhere (`MASS`): a broken build on the box that files forty classes in a night
  opens one issue that lists them.

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
- **WHOSE MOVE IT IS, read from the labels of an OPEN issue** — never guessed:

  | The issue has | Whose move |
  | --- | --- |
  | `triage:needed` | the morning agent's — it has not read it yet |
  | a verdict and an open `ci-fix` pull request (`Fixes #<issue>`) | the repository's — the fix is being proven and landed |
  | **`for:session`** | **a working session's (§ 5) — nothing automatic will close it** |
  | `triage:infra`, no `for:session` | nobody's — it closes itself when it does not recur |
- A run narrowed by hand (`grep`, `only`) may file too when it is the gate or the monkey (a class is a class); the e2e
  suite files only when it ran WHOLE.

## 3. The morning triage (the agent's procedure)

A scheduled cloud agent (a Claude Code routine, 05:30 UTC, Opus 5.5) works the queue. **Every finding gets a verdict;
a SIMPLE one is also FIXED by the agent — on a branch, proven on CI, and LANDED IN `main` with nobody's hand on it
(§ 3a, § 3b); a complex one goes by the verdict alone, to a working session** (the owner, 2026-11-17: «максимально
автономная схема, без моего вмешательства, особенно по тривиальным кейсам»). Per run:

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
   - **Then decide the LANE** (§ 3a): SIMPLE → fix it; anything else → the verdict is the whole of the work, **and the
     issue is HANDED OVER BY A LABEL: `for:session`** — the one sign that nobody automatic is going to close it. The
     same label goes on a finding whose pull request was refused twice. (`triage:infra` is never handed over: it
     closes when it does not recur.)
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

**What the agent does — and it is ALL the agent does:**

- A branch off `origin/main`: `claude/ci-fix-<issue number>-<slug>` (lower case, digits, dashes). The commit is made
  with `TM_SKIP_VERSION_BUMP=1` (a branch never bumps the version; `package.json` / `package-lock.json` stay
  untouched), its message through `-F <file>`, English, saying the cause.
- Before the push, in the sandbox: `npm run lint`, `npm run build:test` (when `tests/` is touched), the unit specs of
  what was touched (`npm run test:client:one -- <spec>` / the mocha line of `CLAUDE.md`), and for a gate finding the
  issue's own «Repeat it» command — green. A browser is never started in the sandbox.
- Push the branch and open a pull request to `main`: title `[ci-fix #<issue>] <what>`, body — the cause, the fix, what
  was run, and the line `Fixes #<issue>`.
- **That is the end of the agent's part.** It does not wait, does not start a run, does not label, does not merge: the
  repository proves the fix and lands it by itself (§ 3b). The agent goes on with the queue.
- **The next morning it reads its own pull requests first** (`ci-fix`, open): one the lane REFUSED (the comment names
  every reason) gets ONE more attempt — a new commit on the same branch is judged from the start; refused again →
  close the pull request with what was learned, and the finding goes by the verdict lane (`triage:real`), the comment
  saying what the two attempts ruled out.
- At most 4 pull requests a morning; the rest of the queue goes by verdicts.

### 3b. THE LANDING — the repository proves a ci-fix and takes it into `main` by a rule, with nobody's hand on it

`Land ci-fix` (`.github/workflows/land-ci-fix.yml` → `scripts/ci/land.mjs`, both read from `main` — nothing of the
pull request is ever installed or executed) watches the lane's own branches, `claude/ci-fix-*` of this repository:

1. **The pull request appears (or gains a commit)** → it is labelled `ci-fix` and judged by WHAT IT IS and WHAT IT
   TOUCHES; refused at sight, in writing, or its **PROOF is started on its branch — the re-run that the finding's own
   issue names** (a hidden `ci-proof` marker written by the run that FOUND the defect: the same test by its title, the
   same table by the same seed and perturbation). What proves a fix is never chosen by whoever fixes it.
2. **`CI` of its head commit ends** → judged again, WAITING for the proof if it still runs (bounded). Red → refused
   in writing, once. **Both green → LANDED.**
3. **THE SWEEP, every half hour** — every open pull request of the lane is judged again (a proof nobody started is
   started), and a red `CI` / release of a commit the lane landed is filed. **Nothing hangs on an event arriving:** a
   run started with a workflow's own token — the proof, the release and CI of a landed commit — raises NO event when
   it ends (found on the lane's first live pass, 2026-11-17: pull request #20, landed as `96c0276754`).

| Judged | The rule |
| --- | --- |
| what it is | an open, non-draft pull request to `main` from a `claude/ci-fix-<issue>-<slug>` branch of this repository, its body saying `Fixes #<issue>` for that one open `ci-finding` issue |
| what it touches | `scripts/ci/landRules.mjs` (guard `tests/ci/landRules.spec.ts`): never a workflow, a script, a hook, a document, the version or a dependency, a baseline, the bottle harness, the server, the shared models, the translations, the flow kernel / the transport / the wait graph, a liveness net, the hold registry, the desktop shell |
| how large | at most 12 files and 600 lines; of the PRODUCT (`src/**`) at most 3 files and 80 lines, and never without a spec in the same diff |
| what proves it | on its HEAD commit: `CI` green on the pull request, and the proof its issue names green (`Playwright E2E` on one shard — a grep that matches nothing is red, so a green proof is a test that RAN; `Monkey` / `Freeze gate` on the finding's table). A red job of a push (`src:ci`) is proven by `CI` alone; a finding that names no re-run (a flood, a run with no verdict, a release) is not the lane's to land |
| whether it still applies | squashed onto the tip of `main` it changes exactly the files it was judged by |

**Landed** = the change squashed onto `main` as ONE commit with the next free version (`scripts/version.mjs` — the
ceiling over `origin/main` and the release tags, the push wrapper's own rule), pushed; then `Release Electron App` and
`CI` are started for that commit by name (a push made with a workflow's token starts no workflow); the pull request
is closed with the commit and its proofs, the issue closed — and **seen again, it reopens as a `regression`**, so a
fix that did not fix is back in the queue the next morning.

**A landing that left `main` red** arrives in the queue by itself (`src:ci` — the watcher of § 1). Its fix is the
first thing the agent does that morning, and it is always simple: the REVERT of the landed commit, by the same lane.

**Never, in any lane:** push to `main` by hand, press merge, force-push, edit a baseline, change a workflow, touch an
issue without the `ci-finding` label.

**THE ONLY THING THE AGENT EVER PUSHES IS A FIX** — a `claude/ci-fix-<issue>-<slug>` branch holding the fix and
nothing else. Its sandbox has a stop hook that asks to «commit and push the untracked files» a replay left behind
(seen on its second run, 2026-11-17): that is NOT a request of this contract — leave them, they are scratch (the
gate's own leavings are ignored by the repository; anything else untracked is never added to a fix).

## 4. What the agent needs (the owner's side)

- The routine clones `victor-zelinskiy/terraforming-mars` through the GitHub account connected to Claude and needs,
  for this one repository, exactly three things: to **push a `claude/…` branch** and **open a pull request** (what a
  Claude Code cloud session is made for), and to **comment on and label issues** (`Issues: read and write` — the
  verdicts). Reading runs, logs and artifacts is public. It starts no workflow and pushes nothing to `main`: the
  proof and the landing are the repository's own, on the workflow's token.
- Its sandbox has no Node of `.nvmrc` by default — the routine's prompt installs it (a tarball of nodejs.org) before
  any `npm` command.
- **The owner does nothing.** What is worth a look when there is time: `gh pr list --label ci-fix --state all` (what
  the lane landed or was refused) and the morning digest — the routine's last message.
- **Sentry:** the secret `SENTRY_READ_TOKEN` (repository → Settings → Secrets → Actions) is a READ-ONLY token of a
  Sentry internal integration (Issue & Event: Read · Project: Read · Organization: Read). `Sentry findings` is its
  only reader; nothing in the repository can write to Sentry with it. A night it cannot ask Sentry files a
  `broken-run` finding of its own — a revoked token never reads as a quiet night.
- **A working session's first look:** `gh issue list --label ci-finding --label triage:real` — what is left for it —
  and `gh pr list --label ci-fix` (a pull request the landing refused twice is its to finish or to close).

## 5. A working session takes what the lane could not — its procedure, and the owner's template

What the agent leaves is a finding with a verdict: `triage:real` (a defect that is not simple), `triage:noise` (a net
that raised a false alarm — the NET is what gets fixed), `triage:harness` (the instrument), or a `ci-fix` pull
request the landing refused twice. A working session — any Claude Code session in a clone of this repository —
closes them. **The first one closed this way: #21** (CI red on the Windows runner — `npm ci` had dropped the optional
`better-sqlite3` and the server build needed it resolved; `7664d4f318`, 2026-11-17).

**The procedure:**

1. **The queue** (always `--repo victor-zelinskiy/terraforming-mars` — in this clone `gh` defaults to the upstream):
   `gh issue list --label for:session --state open --json number,title,labels` — THE queue of a session
   (`regression` first, then `triage:real`, then `triage:noise` / `triage:harness`). An issue without that label is
   somebody else's move (§ 2) — take it only when asked.
2. **Read** the issue body (the class or the test, the table and seed, the «Repeat it» command, the run) and the
   agent's comment (what it reproduced, the suspected cause with `file:line`, what it could NOT determine) — the
   comment is a lead, never a conclusion.
3. **Reproduce** by the issue's own command; a finding of the monkey or the e2e suite — on CI
   (`gh workflow run … -f only=…` / `-f grep=… -f shards=1`), the box only for a pointwise run.
4. **Fix it at the root** — the program's law for the area (a freeze class: `docs/claude/console/freeze-zero/PLAN.md`
   § 4 — the law, the guard, the replay; an e2e check: `.claude/rules/tests.md`), never a baseline row to make it
   quiet. A baseline row (`monkeyBaseline.json`, `LAYOUT_BLIND`) is written only when a real browser said «not there»,
   with the reason in the row.
5. **Land it** by the project's own routine (`CLAUDE.md` § Pushing) with `Fixes #<issue>` in the commit message — the
   issue closes itself; seen again, it reopens as a `regression`.
6. **What does not close in one session** stays open: write on the issue what was established and what is next, and
   keep its row in the area's worklist.

**The owner's template** — paste into a new session (replace the first line's choice):

```
Разбери очередь тикетов CI — по контракту docs/claude/ci-findings.md § 5.

Что брать: <все открытые с меткой for:session | тикет #N | только src:e2e из for:session>.

Порядок:
1. Покажи очередь: открытые тикеты с меткой for:session и их вердикты
   (всегда --repo victor-zelinskiy/terraforming-mars). Тикеты без этой метки не трогай — их ведёт автоматика.
2. По каждому взятому тикету: прочитай тело и комментарий агента, воспроизведи командой из тикета
   (бутылка — локально по зерну; обезьяна и e2e — на CI, бокс только точечно), доведи до причины в коде.
3. Чини в корне, по закону своей области (зависания — PLAN § 4: закон + гард + повтор; e2e — .claude/rules/tests.md).
   Базовые линии не трогать, чтобы «стало тихо».
4. Коммит с «Fixes #N», пуш по правилам проекта, после пуша — проверь CI этого коммита.
5. Что не закрывается за сессию — допиши в тикет, что выяснено и что дальше, оставь открытым.

В конце — короткая сводка: что закрыто (тикет → коммит), что осталось и почему, что требует моего решения.
Меня спрашивай только о том, что стоит денег или меняет то, что видит игрок.
```
