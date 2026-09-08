# E2E Architecture Rework

*Drafted 2026-09-08, the day a CI report with 16 failures cost a full working day of
archaeology. The goal of this plan is that such a day cannot recur: any red is
reproducible locally in one command, no spec waits on a guess, and the suite is fast
enough to run before pushing instead of discovering its verdict on CI.*

---

## The measured baseline (2026-09-08)

Every number below was measured in this repo, not estimated:

| Fact | Value | Consequence |
| --- | --- | --- |
| Fixed `waitForTimeout` calls | **2213**, totalling **2767 s** of literal sleep | Both slow AND flaky: too short under CI load, wasted locally |
| Specs asserting mid-animation states | **57 files** | Headless compositor pauses rAF on quiet screens → sampling dies exactly when the bug fires |
| Specs building their own game config through UI/API | **80 files** | Every create-screen change breaks dozens of specs not about creation |
| `seed` in `ApiCreateGame` | `Math.random()` at line 123 — client value **ignored** | No e2e game is reproducible; specs walk generations hoping for a state |
| Full suite locally, workers=1 | ~37 tests in 32.5 min → **≈5–6 h extrapolated** | Effectively unrunnable before push; CI is the first full run |
| Server + DB sharing | One server, one `./db/game.db` (grew to 895 MB) | Concurrent runs contaminate each other (measured today); list-shaped specs polluted by accumulation |
| Workers > 1 on one shared server | 4K-profile starvation at workers=3 (documented in `playwright.config.ts`) | Locked to workers=1 |
| CI | 4 shards × workers=1, `retries=2` | Retries mask flakes as green; nobody measures flake frequency |
| CI artifacts | Trace film = 76 % of artifact weight | Reports slow to fetch, expensive to keep |
| Of 16 CI failures | 4 product bugs, **9 stale specs**, 3 flake classes | Half the cost was specs rotted by UI reworks, not bugs |

Three structural roots, named once: **(1) games are not reproducible**, **(2) state is
arranged through the UI instead of declared**, **(3) waiting is guessing** (fixed
sleeps + assertions about animation middles). Everything below attacks one of these
or the two meta-problems around them: nothing enforces the cure, and nothing
measures the disease.

## Target properties (definition of done)

1. **Any red is reproducible locally in one command** — the failure artifact names the
   seed/fixture; a repro script boots the same game.
2. **A spec never waits on a guess** — readiness is a product contract (named holds,
   intent counters), not a `waitForTimeout`.
3. **Specs are isolated** — server + DB per worker; parallel locally and on CI;
   contamination structurally impossible.
4. **Reaching a state costs O(state), not O(game)** — fixture boot; the UI is driven
   only for the journey under test.
5. **A UI grammar change costs one driver/witness change**, and a canary spec goes
   red first, naming the driver — not 40 specs at once.
6. **Flake is a measured number with a threshold**, not an anecdote found in a
   monthly report.
7. **Full suite locally under ~1 h; smoke tier under 10 min** for pre-push.

---

## Implementation status

- **Phase 0 — DONE (2026-09-08)**: the ratchet lives in `e2eDriverGuard.spec.ts` § ④
  over `tests/console/e2eRatchetBaseline.json` (regenerate: `npm run e2e:baseline`;
  frozen at 874 `waitForTimeout` / 42 `requestAnimationFrame`); the flake ledger is
  `scripts/e2e-flake-ledger.mjs`, wired into the report job (cache-persisted, last
  50 runs, threshold 3-of-20 fails the job); the burn-in job runs specs touched in
  the last `burnin_depth` commits ×3. The `count()===0` witness rule stays a review
  law in `.claude/rules/tests.md` — 208 existing sites are mostly legitimate `v-if`
  absence checks, mechanically indistinguishable from the parked-surface trap.
- **Phase 1 — DONE (2026-09-08)**: `ApiCreateGame` honours `seed` (float [0,1),
  validated; `NewGameConfig.seed` already existed); determinism is spec-guarded in
  `tests/routes/ApiCreateGame.spec.ts` (same seed ⇒ same deal, card for card);
  `soloGameConfig()` defaults `seed: specSeed()` (hash of the test's title path);
  `createGameWithCards` annotates `seed=… player=…` into the report.
- **Phase 3 — DONE (2026-09-08)**: `tests/e2e/consoleTest.ts` is the one test
  object (guard ⑤ bans the bare '@playwright/test' import in specs; all 193
  rewired) — a worker-scoped fixture boots `node build/src/server/server.js` on
  `8100+workerIndex` with `TM_DB_FOLDER` in a temp dir and points `baseURL` at
  it; `webServer` is gone from the config. Absolute URLs removed from specs
  (campaign helpers read the per-worker `TM_E2E_BASE_URL`). The 4K-starvation
  re-measure PASSED: 16 tests incl. two 4K profiles at workers=4 in 3.2 min.
  Time-balanced shards: `scripts/e2e-shard-plan.mjs` (greedy bins from a JSON
  report → `tests/e2e/shardPlan.json`) + `scripts/e2e-shard-files.mjs`
  (round-robins unplanned files, skips deleted) consumed by the CI run step
  with a `--shard` fallback.
- **Phase 4 — DONE (2026-09-08)**: loopback-gated `POST /api/dev/load-game`
  (`ApiDevLoadGame.ts` — id remap via the Cloner's structural walk, then
  `Game.deserialize`, whose resume block re-primes the live prompt; schema
  drift = the deserializer's own message in the 400). Generated fixtures
  (`npm run e2e:fixtures`): `solo-actions`, `solo-pre-endgame`,
  `two-player-pre-endgame` — built by answering the REAL start flow
  (initialCards → corporationPlay → corporationPay) then arranging with the
  unit suite's setters. Guard `tests/console/e2eFixturesLoad.spec.ts` loads
  each against the current engine and demands a resumed prompt. Driver
  `bootFixture()`; harness `fixtureTable()`. First migration: the endgame
  2p journey — **26.9 s from fixture vs ~4 min of API-driving**. Worklist:
  the 4-seat endgame test, `console-social-heating`'s bot walk (needs an
  automa fixture), the overview/MA/score-explorer/trophy family (all on
  `createTable` today).
- **Phase 5 — DONE (2026-09-08)**: witnesses `workspaceOpen`/`crumbText`/
  `placementState` in the driver (one reader per «where does the player
  stand»); the canary `aaa-driver-canary.spec.ts` (~19 s, sorts first)
  exercises fixture boot · echo · settle · witnesses · wheel · reload, so a
  grammar rework goes red there naming the driver; the guard floor demands
  every load-bearing export; the LAYER CHECKLIST is law in
  `.claude/rules/tests.md`. Worklist: the 57 animation-middle specs migrate
  to terminal states + unit motion guards by attrition under the ratchet.
- **Phase 2 — CORE DONE (2026-09-08)**: `inputEcho.ts` counts every recognized key
  event at the bridge with its outcome; `window.__conReady` (`e2eReadiness.ts`,
  installed by ConsoleShell — dependency-graph-safe) aggregates input echo + named
  hold labels + `transportDiagFacts()` + workspace depth + `notificationsSettled`;
  the driver gained `settle()` (timeout names the open holds), the echo inside
  `press()` (soft — degrades to the old behaviour where the probe is absent) and
  `cinematicBeat(page, ms, why)`. The SLEEP MIGRATION WAVES remain open — the
  ratchet holds the line at 874 while waves convert directories and lower it.

## Phase 0 — Ratchets and the flake ledger (~0.5 day) · *do this first*

Stops the bleeding before the cure lands: new code cannot reintroduce the disease
while the old code is being migrated. The mechanism is the repo's own idiom —
**guard tests are the worklist** (CLAUDE.md invariant 11), extending the existing
`tests/console/e2eDriverGuard.spec.ts` (mocha runner, seconds to run).

- **Ratchet guards** with a committed JSON baseline (counts may fall, never grow):
  - `page.waitForTimeout(` count ≤ 2213 (lowered per migration wave in Phase 2);
  - raw `page.reload(` banned (drivers `reloadConsole`/`reloadMenu` only);
  - `requestAnimationFrame` banned in e2e probes (MutationObserver + `setInterval` —
    the compositor-pause law, already in `.claude/rules/tests.md`);
  - `count() === 0` as a disappearance witness banned for `v-show`-parked surfaces
    (visibility, never count).
- **Flake ledger on CI**: emit the Playwright JSON report as an artifact; a small
  script lists every test with status `flaky` (= passed on retry) and appends to a
  rolling ledger. `retries=2` stays, but each rescue is now *counted*. Threshold
  policy: the same test flaky ≥3 times in the last 20 runs → a named issue +
  quarantine annotation. A quarantined spec carries a date; a guard fails when a
  quarantine exceeds its max age (quarantine must not become a graveyard).
- **Burn-in for changed specs**: a CI job runs `--repeat-each=3` on e2e files touched
  by the PR/push. Cheap (only the diff) and catches a new flake at birth, not in
  next month's report.
- Confirm the artifact diet (trace `on-first-retry` only, screenshots on failure) —
  see the artifact-size note; the CLI `--trace` flag overrides the config object,
  so the diet lives in `playwright.config.ts` only.

## Phase 1 — Determinism: a real seed (~0.5–1 day)

- `ApiCreateGame` accepts an optional `seed` (float `[0,1)` — the engine's native
  format) in the create payload; absent → `Math.random()` as today. One line plus
  plumbing; the game model echoes the seed back.
- **The driver defaults the seed to a stable hash of the spec title** — every spec
  gets reproducible deals *without authoring anything*, and two specs never share a
  seed by accident.
- On failure, the driver attaches the seed (and the game id) to the report — **any
  red names its seed**, and a `repro` note in the error text gives the local
  command.
- Formalize the existing testmode levers (guaranteed cards, deal sizes) as driver
  API rather than per-spec copy-paste.
- Honesty note: a seed makes *replay* exact at the same commit. It does not make a
  scenario stable against card-pool evolution — that is Phase 4's job (fixtures).
  Both are needed; they solve different problems.

## Phase 2 — The readiness contract: `settle()` instead of sleeping (~1.5–2 days)

The product already tracks everything a driver guesses about — named animation
holds (`presentation/animationHold.ts`), transport holds (`gameTransport.ts`),
presentation queue, the one input dispatch funnel (`consoleActionModel.ts`). E2E
just cannot see it. Expose it once:

- **`window.__conReady`** — one aggregator (read-only, assembled from existing
  modules): `{intents: {accepted, refused, lastRefusal}, holds: [names…],
  transportInFlight, presentationQueueDepth, gameStateVersion, promptId,
  wsStackDepth}`. The intent counters increment at the ONE dispatch funnel — a
  swallowed press (the `submitting` re-arm class, disabled wheel slots) becomes a
  *named refusal* instead of a silent timeout.
- **Driver `press()` v2**: synthetic key → wait for `accepted`++ (or fail printing
  `lastRefusal`) → optional settle. The real input path is still exercised — only
  the *echo* is new.
- **Driver `settle(page)`**: counters stable + holds empty + transport idle, with a
  timeout error that prints the OPEN HOLD NAMES. The product's own law — *every
  hold is bounded and names itself* — finally pays into e2e diagnostics.
- **Sleep migration in waves**: mechanical `waitForTimeout` → `settle`/targeted
  waits, a directory at a time; the Phase-0 ratchet is lowered after each wave, so
  progress is locked in. The rare honest sleep (asserting a cinematic's middle)
  goes through a named `cinematicBeat()` helper on an allowlist.

## Phase 3 — Isolation and parallelism (~1 day) · *the whole speed unlock*

- **Server-per-worker**: a worker-scoped Playwright fixture spawns the server on
  `PORT = 8100 + workerIndex` (env already honoured) with `TM_DB_FOLDER` pointing
  at a per-worker temp dir (one-line change in `SQLite.ts:33`, default `./db`
  unchanged). Readiness poll, teardown kill. `baseURL` per worker.
- Consequences, all structural: the contamination class is **dead** (today's
  corrupted verification run cannot recur), the 895 MB accumulation is dead (fresh
  DB per run), list-shaped specs (`console-campaigns-list`) stop seeing history,
  and the two-clones-one-port trap is gone.
- **Local: workers=4** → full suite ≈ ¼ wall time. Re-measure the 4K starvation at
  this topology first — it was observed at workers=3 *sharing one server*; a
  server per worker changes the contention profile. If 4K profiles still starve,
  give them a serial project rather than capping the whole suite.
- **CI: balanced shards** — dump per-spec durations (JSON reporter artifact), a
  script splits spec files into N buckets by *time*, the matrix consumes bucket
  lists. Today's sharding is by count, so the wall time is the unluckiest shard.
  Optionally workers=2 per shard after the starvation re-measure.

## Phase 4 — Fixture boot: state is declared, not clicked (~2–3 days) · *biggest single lever*

The user-visible epic of slow-and-fragile lives here: the bot spec walks up to 16
generations (7.6 min) to see one track move; endgame specs replay half a game to
reach their subject; 80 specs build configs by hand.

- **A loopback-gated dev endpoint** `POST /api/dev/load-game`, body =
  `SerializedGame` — riding the SAME `GameLoader` deserialize path real saves use
  (no parallel rules engine, architecturally honest). Precedent already in-tree:
  `ApiAdminRollback*`, `ApiCampaignDev` (loopback gate + dev tooling).
- **Fixtures are GENERATED, never hand-written**: `tests/e2e/fixtures/generate.ts`
  plays seeded server-side games with the real engine (the mocha `testGame`
  toolbox) to named milestones — `midgame-colonies`, `pre-endgame`,
  `bot-hydro-late`, `hand-of-15`, … — and dumps `SerializedGame` JSON. An npm
  script regenerates them; a **guard spec loads every fixture through the current
  deserializer**, so serialization drift is a named failure in seconds, not a
  mystery e2e red.
- **Driver `bootFixture(page, name)`** creates the game via the endpoint and opens
  the console already standing in the state. The UI journey is driven only where
  the journey IS the subject (start flow, draft, placement grammar).
- Migrate the mega-specs first (endgame family, `console-social-heating`, hydro
  late-track, score explorer, MA/trophies): each is minutes → tens of seconds, and
  — the robustness half — **a UI path a spec does not test can no longer break
  it**, which is most of what "stale specs" meant today.

## Phase 5 — Witness library, canary, and layer policy (~1.5 days + standing policy)

Nine of today's sixteen failures were stale specs — the cost of UI reworks paid in
tests. Two mechanisms make a rework cost one file instead of forty:

- **Witness library in the driver**: `workspaceOpen(kind)`, `crumbText()`,
  `placementState()`, `handCountFromServer()`… — the common surfaces get one
  witness each, server-truth-based where possible (the "derive from the server
  model, not the UI" law). A rework updates the witness; specs read on.
- **A canary spec** (`aaa-driver-canary.spec.ts`, first alphabetically) exercises
  every driver primitive and witness once against a fixture game, in ~1 min. A
  grammar change goes red THERE first, with the driver file named in the failure —
  the difference between "update one driver" and today's archaeology.
- **Layer policy** (recorded in `.claude/rules/tests.md`):
  - An e2e asserts *journeys and integration seams*. A pure decision it checks
    must ALSO have a mocha guard; then the e2e assertion is loosened to the
    journey. (Today's example: the notification `sign` classifier is a pure
    function with unit specs; the e2e now asserts "the gain is in the card",
    not the exact sign of a non-reproducible turn.)
  - The 57 animation-middle specs migrate to: terminal states in e2e + motion
    contracts unit-tested (the travel-not-step metric; perceptual trace frames
    for the few genuinely cinematic claims).
  - Trivial cases don't get e2e at all (existing law).
  - New-spec checklist: *could this red have been a mocha red?*

## Speed arithmetic (the separate "faster" goal)

| Lever | Effect |
| --- | --- |
| Sleep → settle (Phase 2) | −~46 min of literal sleep suite-wide, and each remaining wait ends the moment the state arrives |
| Fixture boot (Phase 4) | The mega-spec tail collapses: 7.6 min → ~1.5 min each across ~15 specs; tens of minutes aggregate |
| Workers=4 + server-per-worker (Phase 3) | Local wall ÷ ~3.5 |
| Balanced shards (Phase 3) | CI wall = average shard, not unluckiest shard |
| **End state** | **Local full ≈ 45–75 min; smoke tier ≈ 8–10 min; CI shard ≈ 15–25 min** |

The smoke tier is a tagged ~25-spec subset (boot, one placement, one workspace
flow, one payment, canary) intended for pre-push; the full suite runs on CI and
nightly with `--repeat-each` sampling for the ledger.

## Sequencing

`0 → 1 → 2 → 3 → 4 → 5`, each phase ships alone and pays alone. 0 before
everything (enforcement first, so migration progress can't erode); 1 before 4
(fixtures are generated from seeded games); 2 before mass sleep-migration by
definition; 3 is independent and can run in parallel with 2. Total ≈ **7–9 working
days**, spreadable.

## What deliberately NOT to do

- **No mocking the server inside e2e** — the client↔server seam is the product;
  fixtures go through the real deserializer, requests through the real transport.
- **No bypassing the real input path** — the driver still sends keys; the readiness
  echo is observation, not a second input channel.
- **No mass rewrite of 193 spec files** — the hot set migrates deliberately
  (Phase 4/5); the rest improves by attrition under the ratchets.
- **No new screenshot-pixel assertion families** — the existing capture probes
  stay; geometry is asserted from the DOM at the resolutions that clip.

## Mapping the original 5-point plan

| Original point | Phase | Verdict |
| --- | --- | --- |
| 1. Real `seed` | Phase 1 | Right, cheapest, first product change |
| 2. Server "state X" hook | Phase 4 | Right, but as *serialized fixtures through the real loader*, not ad-hoc mutators |
| 3. `data-armed` / intent counter | Phase 2 | Right; generalize to the full readiness contract (holds are already named) |
| 4. 2213 sleeps → one `settle` | Phase 2 | Right; needs the ratchet (Phase 0) to stick |
| 5. `--repeat-each` in pipeline | Phase 0 | Right; pair with the flake LEDGER, else rescues stay invisible |

The five are necessary and correctly ranked, but not sufficient. Missing were the
three things that make the cure *permanent and fast*: **isolation/parallelism**
(Phase 3 — the entire speed goal and the contamination class live there),
**enforcement ratchets** (Phase 0 — without them the 2213 sleeps grow back), and
the **witness/canary layer** (Phase 5 — the stale-spec half of the epic, 9 of 16,
which none of the five points touched).
