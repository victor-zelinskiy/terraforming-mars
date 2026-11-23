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
| `Playwright E2E` — THE WEEKLY HUNT (`tests.md` law 10) | Saturday 06:17: the whole suite ×3, no retry, 20 shards (10 at once) | a test red in SOME repeats: a FLAKY test with its rate («2 of 3 repeats red»), proven by the hunt (`repeat_each=20`); red in every repeat: a FAILED test |
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
- **Only the sessions' environments — `box` and `production`, never `development`.** The diagnostics' own probe
  (`scripts/diag-probe.mjs`, `npm run diag -- selftest`) sends SAMPLES of real stalls to `development` with
  `head=probe`; their titles cannot be told from a player's. The first real filing (2026-11-18) opened six issues and
  five were the probe's samples — the workflow now asks Sentry one environment at a time. The probe's connection
  checks and a session's summary, which DO arrive from the box, are dropped by their own fixed words.
- **Only `unresolved` ones.** A class closed with `npm run diag -- resolve <class>` (resolved in the release that
  carries the fix) is not filed again by events of OLDER builds still running on the box — Sentry reopens it only
  for an event of that release or a later one, and then it is a regression here too. **Closing a `src:sentry` issue
  therefore has two halves: the fix in `main`, and `diag resolve` in the release that carries it** — and the second
  half is the repository's own (§ 1b): whoever closes the issue here has closed it there.
- **The repository is public, the sessions are not.** The finding carries the Sentry issue's title (a cause class is
  structure, and it is scrubbed all the same: addresses, e-mails, query values, home directories), its counts, its
  dates and the link into Sentry (a login is asked). Never an event, a breadcrumb, a save, a name.
- **The evidence comes to the reader, scrubbed — the reader does not go to Sentry.** The triage agent writes public
  comments and reads public issues; a Sentry token in its sandbox would put the sessions' data one quoted line away
  from a public page, and something to steal within reach of whoever writes an issue (the owner asked on 2026-11-18;
  this is the answer). So the filing step — the one place that holds the token — attaches the latest event's
  STRUCTURAL tags to the issue (`diag.mjs issues --json --structure`: a white list — the cause class, the build and
  its commit, the runtime, the screen and the section, the outcome and the cure; never `seat_ref`, `run`, a user).
- **Triage (`src:sentry`):** the agent's sandbox has no Sentry access — it reads the class off the title
  (`[family] shape (structural words)` → the row of `src/common/diagnostics/shapes.ts` → the print site), the code
  there, and `docs/claude/console/freeze-zero/PLAN.md` § 4 (is the class known? was it «left to the net»?). A field
  defect has no re-run that proves a fix (no `ci-proof`), so the lane never lands one by itself: the verdict is
  `triage:real` + `for:session`, with the suspected cause — or `triage:noise` for a line that is no defect (then the
  fix is the line's tier in `shapes.ts`, a working session's). The session reads the evidence
  (`npm run diag -- issue <short id>`, the skill `diagnose-report`).
- **A flood is one finding**, as everywhere (`MASS`): a broken build on the box that files forty classes in a night
  opens one issue that lists them.

### 1b. Who closes an issue in Sentry — nobody's memory

On 2026-11-18 the project held 25 unresolved issues: 24 were the diagnostics' own probes, one had been fixed four days
earlier. Nothing closed an issue there but a session remembering `diag resolve` (the owner: «продолжают висеть тикеты,
которые уже не актуальны — тут бы тоже автоматизировать»). Three things close one now, and each is a rule:

| What it is | Who closes it | How |
| --- | --- | --- |
| **The tool's own** — the probe's reports and its «must not arrive» error, the connection checks, the sessions' ledger (`tm-session`: a record, read by `diag trend`), a probe's SAMPLE of a real cause | `Sentry housekeeping` › `tidy`, every night at 04:17 UTC (before the filing reads the collector) — `npm run diag -- tidy [--dry]` | archived FOREVER: the probe lands in the same issues tomorrow and they stay out of the stream |
| **A finding closed on GitHub** (by a session, by the triage agent, by the owner) | `Sentry housekeeping` › `closed` (on `issues: closed`) | `completed` → `diag resolve <short id>` in the version `main` carries — an event of that version or a later one reopens it as a regression; any other reason → `diag archive <short id>` (until it escalates). A comment on the issue says what Sentry was told |
| **What no session reports any more** | the collector itself — the project's AUTO-RESOLVE age, **14 days** (`npm run diag -- autoresolve [<days> \| off]`; set 2026-11-18) | resolved by age; the next event reopens it as a regression |

…and the other direction: **what Sentry no longer holds open is closed HERE** — `Sentry findings`, before it files,
asks the state of every open `src:sentry` issue (`findings.mjs sentry-open` → `diag status <ids> --json` →
`findings.mjs sentry-settled`): resolved by a session's `diag resolve` → closed as completed; resolved by age, archived
or gone → closed as not planned, each with one comment that says which. Nothing is lost on either side: an event of a
closed class reopens it in Sentry, the nightly filing reads it as unresolved again and reopens the issue as a
`regression`.

- **THE PROBE'S EVENTS ARE FILED APART.** An issue is its fingerprint, so a probe's sample of a class and a player's
  stall of the SAME class were one issue: archive the sample and the player's stall is archived with it. A probe's
  event (`head: 'probe'`) carries one more part in its fingerprint and the tag `probe_issue: own`
  (`sentryEvent.ts` `probeApart`); `tidy` archives forever ONLY an issue no session's event can land in, and judges by
  the `head` of EVERY event of an issue, never the latest. An issue of a session's class that holds nothing but
  samples (sent before the probe was filed apart) is RESOLVED instead — a player's stall of that class brings it back.
- **The two halves never chase each other:** an issue closed by this repository's own workflow (`sentry-settled`)
  starts no workflow (GitHub's rule for its token), so only a close by a person or the agent tells Sentry.
- **ONE holder of a write token.** `Sentry housekeeping` reads the secret `SENTRY_WRITE_TOKEN`; the filing keeps its
  read-only `SENTRY_READ_TOKEN`. The workflow runs the repository's own tool on `main` and takes one thing from the
  event — an issue's NUMBER; whose Sentry issue that is, is read from the issue itself and trusted only when the
  Actions bot wrote it and it carries `src:sentry` (`findings.mjs sentry-id-of` — the repository is public: anybody
  may open an issue with any marker in it). Its log is public too: the tool's output goes to a file and only its
  structural lines are printed (a title of a player's report carries the player's words).
- **The token is asked what it may do before anything is asked of it** (`diag access --need … --any …` — its scopes
  as the collector names them, nothing of the account): one made with the wrong permissions fails the night it is
  made, by name, not on the first finding somebody closes.
- **Without the secret nothing breaks:** both jobs say «not set» as a notice and end green; the direction
  Sentry → GitHub and the auto-resolve work on the read token alone. A night the housekeeping could not do its work
  (a revoked token, the API) files a `broken-run` finding of its own.

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
- **THE ENGINE FUZZ FILES BY SEED** (`src:engine-fuzz`, key `engine-fuzz|class|<class>`, `.github/workflows/engine-fuzz.yml`
  — nightly, a fresh range of seeds every night, the reload check on): random legal games on the real engine, each
  answer judged by the server's invariants and every save loaded and held against the live table
  (`tests/fuzz/engineFuzz.ts`). A class `tests/fuzz/engineFuzzBaseline.json` does not hold is one finding, with the
  seed that replays the whole game on a laptop (`TM_FUZZ_REPLAY=<seed> npm run fuzz:engine`); its proof is that seed
  played again. No browser and no client: a finding here is the ENGINE's.
- **THE ONE-OWNER LAW HAS A KIND OF ITS OWN** (`owner-law`, key `<source>|owner-law|<verdict>`): the gate is red by
  it when a press, a surface or the bar parts from the function's word (`monkey-report.ownerLawBroken`). It is no
  cause class — the report's «new classes» never hold it — and its first red was filed as «nothing named» (#84). The
  finding names the verdict, the tables that walked it and the facts the function was asked with, and proves by the
  gate on the first table and the run's seed.
- **THE BEAT LAW HAS ONE TOO** (`beat-law`, key `<source>|beat-law|<kind>:<beat>` — `monkey-report.beatLawBroken`,
  FREEZE ZERO stage 3): a frame in a transient beat stood with NOTHING IN FLIGHT under it for the doors' bar (250 ms)
  — a stall, or a pause written as a net's timer / a controller's clock instead of a `span` or a ceiling wait. The
  finding names the beat, the longest standing and the tables; it proves by the gate on the first table and the seed.
- **Labels:** `ci-finding` · `src:<source>` · `kind:new-class | never-cured | failed | flaky | broken-run | owner-law | beat-law` ·
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
| what proves it | on its HEAD commit: `CI` green on the pull request, and the proof its issue names green (`Playwright E2E` on one shard — a grep that matches nothing is red, so a green proof is a test that RAN; a FLAKY test by RATE — the hunt, `repeat_each=20 retries=0` (`tests.md` law 10); `Monkey` / `Freeze gate` on the finding's table). A red job of a push (`src:ci`) is proven by `CI` alone; a finding that names no re-run (a flood, a run with no verdict, a release) is not the lane's to land |
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
- **Sentry, the write half (§ 1b):** the secret `SENTRY_WRITE_TOKEN` — a token of a Sentry internal integration with
  Issue & Event: Read & Write · Release: Admin (`diag resolve` creates the release when the collector has not heard
  of the version yet) · Project: Read · Organization: Read. `Sentry housekeeping` is its only reader. Until it exists
  a closed finding is closed in Sentry by hand (`npm run diag -- resolve <short id>`), as before.
- **A working session's first look:** `gh issue list --label for:session --state open` — what is left for it (§ 5) —
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
   somebody else's move (§ 2) — take it only when asked. Beside it: `gh pr list --label ci-fix --state open` — a pull
   request the landing refused twice is a session's too.
2. **Read** the issue body (the class or the test, the table and seed, the «Repeat it» command, the run) and the
   agent's comment (what it reproduced, the suspected cause with `file:line`, what it could NOT determine) — the
   comment is a lead, never a conclusion.
3. **Reproduce** by the issue's own command, on the machine it belongs to:
   - the bottle — ONE table by its seed on the laptop (`TM_BOTTLE_MONKEY=1 TM_BOTTLE_MONKEY_SEED=… TM_BOTTLE_MONKEY_ONLY='^table$'
     npm run test:client:one -- tests/client/bottle/monkey.bottle.ts`; add `TM_BOTTLE_MONKEY_SHRINK='<class regex>'`
     to cut the walk down to the steps that make the class); a whole gate — only on CI (`gh workflow run "Freeze gate"
     -f seeds=… -f only=…`);
   - the monkey and the e2e suite — on CI (`gh workflow run Monkey … -f only=… -f shards=1 -f repeat=8`,
     `gh workflow run "Playwright E2E" -f grep=… -f shards=…`), the box only for a pointwise run. The laptop runs no
     Playwright browser and no whole suite.
4. **EVIDENCE FIRST.** If the line cannot say WHOSE wait it was or WHICH verb did it, the first commit is the
   evidence — the line carries the fact (who covered the board, which gate held the drain, which verb took the frame)
   — and the same command is run again. A law written before the line can say it is a guess; three of the nine
   findings of 2026-11-19 were closed by what the line said the second time, and one guess was withdrawn.
5. **Fix it at the root** — the program's law for the area (a freeze class: `docs/claude/console/freeze-zero/PLAN.md`
   § 4 — the law, the guard, the replay; an e2e check: `.claude/rules/tests.md`):
   - `triage:noise` means THE NET is fixed — the judge's clock (a bound over a motion is read on the frames the page
     painted), its bound (the node carries the bound the wait keeps), what it knows (a gate, a hold, the player's own
     look) — never the game, and never a row to make it quiet;
   - a baseline row (`monkeyBaseline.json`, `LAYOUT_BLIND`) is written only when a real browser said «not there»,
     with the reason in the row; a ratchet (the architecture's debt ledger, module state, glow, the liveness rungs)
     does not grow;
   - **what the player SEES is decided as a UI/UX architect, from the player's experience** (the owner, 2026-11-19):
     write the scene through the player's eyes — what they are doing, what they wait for, what appears and why — and
     decide by the project's own principles (`CLAUDE.md`: a workspace is one flow, physical causality, nothing
     happens on screen without the player's press or a visible cause while it is the player who is waited for). The
     decision and its reason go into the commit. The owner is asked only about what costs money.
6. **Land it** by the project's own routine (`CLAUDE.md` § Pushing) with `Fixes #<issue>` in the commit message — the
   issue closes itself (a `src:sentry` finding closed this way is resolved in the collector by § 1b); seen again, it
   reopens as a `regression`.
7. **PROVE IT, and say so on the issue:** the issue's own command on the fixed commit, repeated (`-f repeat=8` for a
   walk; the gate's own job for a bottle class; the spec for an e2e check) — a comment with the run and what it
   read. A proof that is red reopens the issue. A fix whose class could be either a real defect or the net's false
   alarm is not closed on the reading alone.
8. **While a stage's confirming pass runs** (a branch `fz/stage<N>-exit` exists — `PLAN.md` § 4, the row «THE
   MATRIX»): never push to that branch; a fix that changes what the monkey's cells NAME — a diagnostics line or its
   tier, a judge, a net — is said in the summary, because the cells already run are queued again. A fix of the game
   alone, of tests, of docs lands in `main` as usual.
9. **What does not close in one session** stays open: write on the issue what was established and what is next, and
   keep its row in the area's worklist.

**The owner's template** — paste into a new session (replace the first line's choice):

```
Разбери очередь тикетов CI — по контракту docs/claude/ci-findings.md § 5. Цель — чтобы каждый взятый тикет был
починен в корне и закрыт с доказательством.

Что брать: <все открытые с меткой for:session | тикет #N | только src:e2e из for:session>.

Порядок:
1. Покажи очередь: открытые тикеты с меткой for:session с их вердиктами и открытые PR с меткой ci-fix
   (всегда --repo victor-zelinskiy/terraforming-mars). Тикеты без метки for:session не трогай — их ведёт автоматика.
2. По каждому взятому тикету: прочитай тело и комментарий агента (это наводка, не вывод), воспроизведи командой
   из тикета. Бутылка — один стол по зерну локально, целый гейт — только на CI; обезьяна и e2e — на CI, бокс только
   точечно; Playwright и полные наборы на ноуте не запускать.
3. Сначала улика, потом закон: если строка не говорит, чьё это ожидание или какой глагол это сделал, — первым
   коммитом добавь факт в строку и повтори прогон. Закон, написанный до этого, — догадка.
4. Чини в корне, по закону своей области (зависания — PLAN § 4: закон + гард + повтор; e2e — .claude/rules/tests.md).
   Вердикт triage:noise = чинится СЕТЬ (её часы, граница, знание), а не игра. Базовые линии и храповики не трогать,
   чтобы «стало тихо».
5. Коммит с «Fixes #N», пуш по правилам проекта, проверь CI этого коммита. Затем ДОКАЗАТЕЛЬСТВО: команда из тикета
   на исправленном коммите с повтором (обезьяна — repeat=8) — и комментарий в тикет со ссылкой на прогон и тем, что
   он показал. Красное доказательство — тикет открыть снова.
6. Если существует ветка fz/stage<N>-exit — идёт подтверждающий проход этапа: в неё не пушить; про правку, которая
   меняет то, что называют ячейки обезьяны (строка диагностики, её уровень, судья, сеть), — скажи в сводке.
7. Что не закрывается за сессию — допиши в тикет, что выяснено и что дальше, оставь открытым.

То, что меняет видимое игроку, решай сам — как UI/UX-архитектор, глазами игрока, по принципам CLAUDE.md, — и объясни
решение в коммите. Меня спрашивай только о том, что стоит денег.

В конце — короткая сводка: что закрыто (тикет → коммит → доказательный прогон), что осталось и почему.
```
