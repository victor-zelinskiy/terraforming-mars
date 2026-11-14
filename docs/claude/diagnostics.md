# DIAGNOSTICS — the in-game journal, «Сообщить о проблеме», and what reaches the developer

**What it is for.** A player never sees a browser console: they have a premium «Сообщить о проблеме» that ends in a
short code, and — if they want — a journal of errors with the full text. The developer, with one setting on, sees errors
and stalls of the screen IN the game and opens the full text by holding X. Whatever fails on any player's machine or on
the owner's box arrives in Sentry in a shape an agent can read with one command.

Human guides (Russian, with 4K screenshots): `docs/DIAGNOSTICS_GUIDE_DEVELOPER.md` · `docs/DIAGNOSTICS_GUIDE_PLAYERS_QA.md`.
The rule that loads with these files: `.claude/rules/diagnostics.md`. The agent's triage skill: `.claude/skills/diagnose-report/`.

---

## 1. The one picture

```
 THE PAGE (renderer)                         THE MAIN PROCESS (Electron)                    THE GAME SERVER (utilityProcess)
 ───────────────────                         ───────────────────────────                    ───────────────────────────────
 console.warn / console.error ┐              console.warn / console.error ┐                 uncaughtException ┐
 window 'error'               ├ interceptor  uncaughtException            ├ diagnosticsMain unhandledRejection ├ serverDiagnostics
 'unhandledrejection'         │ (first       unhandledRejection           │ (the hub's HOST) a 500 with an error│ (a facade: one sink)
 Vue errorHandler             ┘  module)     child-process-gone, the hang ┘                 a thrown input    ┘
        │                                    watch's lines                       │                    │ parentPort {type:'diag'}
        ▼                                                │                       │                    ▼
  DiagJournal (page)  ── desktop:diag-line ─────────────►│◄──────────────────────┴────────────────────┘
  classified · coalesced · episodes                      ▼
        │                                     ┌──────────────────────┐   POLICY kind · consent · budgets
        │◄── desktop:diag-event (push) ───────│  THE HUB             │── SCRUB  ids → fingerprints, names, paths, IPs
        ▼                                     │  mirror of the run   │── ENVELOPE → the collector (Sentry, EU)
  the journal state (reactive)                │  (every runtime)     │      └ no network → the disk OUTBOX
   ├ the developer's notice (hold X)          └──────────────────────┘
   ├ the diagnostics surface ── desktop:diag ───────────►  report → the PACKAGE (a folder + the same files as attachments)
   └ the field recorder (unchanged contract)               selftest → one event per runtime, each answered
                                              crashReporter ── minidumps ─────────────────► the collector's minidump endpoint
```

Three layers, one model:

| layer | where | what |
| --- | --- | --- |
| **shared, pure** | `src/common/diagnostics/` | `DiagnosticModel` (the record), `classify` (tag → kind), `shapes` (a stall line → its shape and tier), `cause` (a stall → its CAUSE CLASS), `journal` (lines → records, episodes), `stackFrames` (a V8 stack parsed), `privacy` (the scrub), `protocol` (page ↔ hub), `debugIds` |
| **the page** | `src/client/diagnostics/`, `src/client/components/console/diagnostics/`, `src/styles/console_diagnostics.less` | the interceptor, the journal's reactive face, the transport seam, the surface's controller and view-model, the notice, the components |
| **the hub** | `src/server/diagnostics/hub/` (a plain Node module, bundled to `build/electron/diagnostics-hub.js` by `webpack.diagnostics.config.js`) + its host `electron/diagnosticsMain.ts` | the mirror, the session's ledger, the policy, the scrub, the sender with its outbox, the report package, the connection check |
| **the server** | `src/server/diagnostics/serverDiagnostics.ts` | a facade with one sink; embedded → posts to the main process |

**No SDK runs in the page.** The hub is the one sender; it uses only `@sentry/core`'s envelope serialiser. Nothing
installs a second set of global handlers beside the game's own interceptor (guard: `diagnosticsClassification.spec` § the
page runs no SDK).

---

## 2. The record — `DiagEntry`

One console line (or one episode) = one record: `kind` · `family` (the tag) · `level` · `runtime` (`page | main | server`)
· `title` · **`text` — verbatim what the console received, an `Error` as its whole stack** · `stack` · `count` ·
`episode?` · `screen?` (what the screen was doing: the field recorder's heartbeat reduced) · **`cause?`** (a stall /
integrity record's cause class, tier and dimensions — § 2.4) · **`evidence?`** (what stood when a defect was named —
§ 2.5) · `build` · `delivery?`.

### 2.1 Every tagged line has a class
`classify.ts` is the ONE table: tag → `error | stall | integrity | perf | note`. The journal's filters, the notice and
the hub's policy all decide by the kind. **A new `console.warn('[new-tag] …')` is a new row** — the guard
`tests/console/diagnosticsClassification.spec.ts` reads `src/client` and `electron` and fails with the LIST of tags that
have no row; a site whose first argument is not a literal is declared in the spec's `INDIRECT` table.

An untagged `console.error` is an `error` of the family `console`; an untagged `console.warn` a `note`.

### 2.2 Five rules of the journal (`journal.ts`)
1. **ONE THROW — ONE RECORD.** A repeat inside `DIAG_COALESCE_MS` (30 s) grows `count`. «The same» is the CAUSE CLASS
   for a stall / integrity line (never its wording), the stack for an exception.
2. **A LIVENESS STALL IS AN EPISODE.** The arbiter prints `[liveness] stall …` once per rung (≥ 2 s apart) and
   `[liveness] recovered after Ns`. The lines between are ONE record: `episode.state` = `open → healed` (with the
   arbiter's own duration) or `unhealed`; **`episode.outcome` says how it ended for the player** — `healed` ·
   `unhealed` (no line for `DIAG_EPISODE_SILENCE_MS`: the ladder was spent and the page lived on) · `reload` (the page
   was replaced under it) · `quit` (the app was closed under it); **`episode.cure`** — who cured it (the releases of
   the last rung that did something) and what was different after (§ 2.5). The renderer's STOP is an episode of the
   main process's journal by the same rules (`the page stopped answering` → `answers again` / `the renderer is
   restarted`).
   **The arbiter's line has three readers** — `readLivenessLine` (here), `buildStallDigest` (the console export) and the
   e2e harness's `livenessGuard`; the classification spec pins the line's fixed words in the supervisor's source, so
   changing the wording moves all of them in one diff. (`shapeOf` — § 2.4 — is its fourth: it reads `task:` · `top:` ·
   `holder:`.)
3. **WHAT A NET SAYS INSIDE AN EPISODE IS THE EPISODE'S.** While the arbiter's episode is open, every other stall line
   of the same runtime (a story a rung degraded, a beat it tore down, a finding of the wait graph) is a line of that
   record, counted in `episode.nets` by its own class — one incident is one record, found in one step.
4. **AN ECHO IS A LINE OF WHAT IT ANSWERS.** A door's result after the finding that asked for it (`[wait-graph] cure …`),
   the trace's file name after the stop it traced: the shape's row names what it is the echo of (`echoOf`), and the
   line is folded into the newest such record (within `DIAG_ECHO_MS`) instead of filing a second one.
5. **BOUNDED.** `DIAG_JOURNAL_MAX` records, `DIAG_TEXT_MAX` characters each (head + newest tail).

### 2.3 Nothing is lost, nothing is told twice
- **The interceptor is the FIRST module of the page** (`diagnosticsBoot.ts`, the first import of `main.ts`): the boot and
  the main menu are recorded (the field recorder used to be installed only when the console was entered).
- **An `Error` keeps its stack** (`formatConsoleArg`) — in the journal and in the field recorder's lines.
- **One exception = one printed line + one record**: `reportDiagnosticError(line, err)` prints through the ORIGINAL
  console (DevTools, the console export and the e2e harness read the line they always read) and records directly; the
  wrapper does not record that print again. Vue's `errorHandler` and the two window listeners go through it.
- **The journal survives the page**: every record goes to the hub as it is made (`desktop:diag-line`, one-way — a page
  about to be killed cannot wait for an answer); the next page ADOPTS the hub's mirror (earlier pages, the main process,
  the server). With no hub (a browser) the mirror is the tab's session storage.
- **The field recorder's contract is untouched** (`POST /api/field-log`, its ring, its spec): it subscribes to the
  interceptor instead of wrapping the console itself.

### 2.4 The CAUSE of a stall — shape, class, tier (`shapes.ts`, `cause.ts`)
A stall is a wait nobody ended, and a net's line names it. It is filed under WHAT HELD, never under how the line is
worded (`docs/claude/console/freeze-zero/PLAN.md` § 2 is the design):

| | what | example |
| --- | --- | --- |
| **shape** | what the line IS, matched on its fixed words — a row of `DIAG_SHAPES` | `wait-graph/ceiling`, `liveness/stall`, `flow/bound-wait` |
| **cause class** | the shape + the line's STRUCTURAL words (a workspace kind, a phase, a hold's label, a wait's id without its run number, an admission block). Never a duration, a counter, a prompt id, a card | `liveness/stall/unserved/handpick/hand:committed/block:reveal` |
| **tier** | what the line is FOR: `defect` (an EVENT) · `planned` (an honest wait reached the ceiling it DECLARED — counted, never an event; the row or the wait says why) · `info` (evidence around an event: a net's own echo) | |
| **dimensions** | what a reader slices by and what must NOT split a class: the source card, the holder, the outcome, who cured it, how long it stood — an event's TAGS | `source=Ganymede Colony`, `outcome=healed`, `cure=presentation-ledger` |

`causeOf(line)` is a PURE function of the line's text — so the page, the hub (the main process's and the server's own
lines), the e2e harvest (`tests/e2e/causeHarvest.ts`) and the monkey's report (`scripts/monkey-report.mjs`) compute
ONE key: a field case finds its reproducing spec by it, and a red spec its field cases (`npm run diag -- class <key>`).

**The arbiter names the holder.** Its line carries `task:` (the router's task kind), `top:` (the deepest frame on
stage, `kind:phase`) and `holder:` — ONE word by ONE precedence (`supervisor/stallEvidence.ts` `stallHolder`):
`stranded[+claim:<host>:<stage>]` → `dead-frame:<kind>` → `beat` → `awaiting:<from>` → `block:<name>` →
`claim:<host>:<stage>` → `hold:<label>` → `deaf` → `none`. Class: `liveness/stall/<reason>/<task>/<top>/<holder>`.

**A NEW LINE IS A NEW ROW.** `tests/console/diagnosticsShapes.spec.ts` renders the first argument of every
`console.warn` / `console.error` of a stall / integrity family and fails with the LIST of sites no row matches (a line
whose distinguishing word is interpolated, or printed through a helper, is declared there with its sample); a row no
site prints is dead and fails too. A reworded line cannot silently change class.

**A wait declares that its ceiling is its honest end** — `CeilingWaitSpec.planned: '<why>'` (`ceilingWait.ts`): the
line says `(planned: …)` and its tier is `planned`. Declaring it is a decision to defend in review (a wait for
something only the PLAYER decides the time of), never a way to silence a line.

### 2.5 What stood — the evidence (`DiagEvidence`)
A `defect` record of the page carries what stood when it was named: the question with who may serve it and who does;
the holders with their ages (the one the class names first); the kernel's flow tree with every wait; the wait table;
the wait graph's nodes and standing findings; the kernel's last records (the machines' transitions among them); what
the pad's funnel last saw. Taken ONCE per record by the provider the console's supervisor registers with the
interceptor (`setDiagEvidenceProvider` — the interceptor still imports nothing of the console), bounded
(`DIAG_EVIDENCE_*`), never on a healthy second (D30).

**A net that ACTS takes it BEFORE it acts** — `const stood = captureDiagEvidence(); …act…; withDiagEvidence(stood, () =>
console.warn(line))`: read after, the evidence would describe the cure (the arbiter reads the holder, the claim and
the evidence before its rung runs). The cure of an episode takes one more snapshot; `episode.cure.changed` is the
difference — the scopes that ended (by the run's own id), the holders that let go, a question that moved on.

---

## 3. What is sent by itself — the hub's policy (`hub.ts` `autoDecision`)

| kind · tier | when | as |
| --- | --- | --- |
| `error` | when the record is born | an EXCEPTION with frames + debug ids — grouped by its stack |
| `integrity` · `defect` | when the record is born | a MESSAGE, fingerprint = its cause class |
| `stall` · `defect` — an episode (the arbiter's, the renderer's stop) | `EPISODE_SETTLE_MS` after it ENDS (it is then known whether the page was reloaded or the app closed under it, and a stop's trace is written), or once it has stood 30 s | ONE message: its FIRST line is the class's — «the screen stood still (reason · asked … · where · held by …)» —, its second how THIS episode ended («cured after N s by … / NOT cured — …», also `extra.ending`); fingerprint = its cause class |
| `stall` · `defect` — any other | `STALL_SETTLE_MS` after it is born (what its own tick still says of it is a line of the same event) | a message, fingerprint = its cause class |
| `stall` / `integrity` · `planned` / `info` | never | COUNTED in the session's ledger (§ 3.3); the trail of the next event |
| `perf`, `note` | never | counted in the ledger; they ride the next event as its breadcrumbs (the journal's last 30 records) |

**One cause — one issue.** The fingerprint of a stall is `['tm-cause', <cause class>]`: the same cause across
sessions, players, releases and rewordings of its line is ONE issue; the outcome, the cure, the card and the duration
are TAGS of its events (`outcome` · `cure` · `source` · `stood` · `holder` · `where` · `task` · `reason` · `cause` ·
`shape` · `tier`), so a class is sliced without opening an event.

Budgets (one loop must not spend the quota, and NOISE NEVER SPENDS A DEFECT'S BUDGET): 40 events per app run · 2 per
DEFECT (a cause class; for an exception its own frame) · 200 per device per day (kept on disk). There is no budget per
family any more: a planned wait is not an event at all, so it cannot evict the same family's `dead-end`. What the
budget keeps back is still counted (§ 3.3). On the box (`environment: box`) an automatic event carries the console's
dump, scrubbed, at most once in 10 minutes. An app that is closing sends nothing: what waited for its settle is parked
in the outbox and leaves at the next launch.

**A renderer's stop arrives with its trace** — `hang_trace.json`, scrubbed: always on the box (≤ 24 MB), from a
player's device within `DAILY_FILES_MAX` files a day (≤ 8 MB). **A defect on a hosting device — an episode and a
single finding alike — names where the game's save stood when it was born** — `contexts.save` = the game's FINGERPRINT + the number of its newest save (never the save:
it is the table's keys and names). The server keeps every save (`db/files/history/<game>-<n>.json`), so `npm run diag
-- save <g#…> <n>` fetches that very file from a machine the agent can read.

**Tags of every event** (what an agent filters by): `kind` · `family` · `runtime` (`page | main | server`) · `app_mode`
(`host | remote | web`) · `screen` · `section` · `profile` · `prompt_type` · `locale` · `seat_ref` (a fingerprint) · `head` ·
`run` (the app run — every event of one run, and its session, are found by it) · `episode` · `selftest`; a stall /
integrity event adds the cause's (above); a report adds `report_code` · `report_category` · `entry_kind`; the collector
derives `os` / `os.name` from the context. Contexts: `screen`, `cause`, `episode` (state, outcome, steps, `cured_by`,
`changed`, `nets`), `evidence` (the question, the holders), `save`, `os`, `device`, `host_runtime` (Electron and its
version — never a context named `runtime`: the collector would derive a `runtime` tag from it and overwrite ours),
`app`. Extra: `text` (the net's own lines), `ending`, `flow_tree`, `waits`, `wait_graph`, `flow_trace` — **a long
list leaves in PARTS** (`flow_tree`, `flow_tree_2`, …; `extraLists`): the collector keeps ~16 KB of ONE `extra` value
and drops the rest in silence, while the whole `extra` may be far larger; `diag` joins the parts back (`partsOf`).
**The issue's TITLE is the class's, never an occurrence's**: the collector titles an issue by the first line of its
newest event's message, so that line is built from the class alone (`classTitle`: `[family] shape (part · part)`; the
arbiter's sentence is made of the class's own parts) and the occurrence's words are the second line.
**Where the player is, is not said**: `sdk.settings.infer_ip = never` keeps the sender's address out, and the event
brings `user.geo = {region: 'not collected'}` — without it the collector still derives a CITY from the connection
(measured with `scripts/diag-probe.mjs`).

### 3.1 Whether anything is sent at all (`hubConfig.ts`)
**Only a packaged release BUILT with a destination sends.** The DSN is baked into `settings.json` (`sentryDsn`) by
`make:json` from the Actions SECRET `TM_SENTRY_DSN` (§ 12); a local build, a fork's build, a development run have none. A
test run never sends (`NODE_ENV=test`, `TM_E2E_HOST`, `PLAYWRIGHT_TEST_BASE_URL`, `TM_DIAG_OFF=1`) — spec'd.
`TM_DIAG_DSN` is the developer's door for proving the pipeline from a local build.

**Environment** = a fact of the MACHINE: `<userData>/diagnostics.json` `{"environment": "box"}` → `box`; every other
release is `production`; `TM_DIAG_ENV` overrides. **Release** = `terraforming-mars@<package.json version>`.

### 3.2 Privacy (`privacy.ts`) — what never leaves by itself
An automatic event is scrubbed AFTER it is built, before it is handed to the transport:
- a participant id / a game id (`p…` / `g…` / `s…` + 8–16 hex) → a FINGERPRINT `p#<10 hex of SHA-256>` — two events of
  one seat still correlate; nobody can enter the table with what was sent (`npm run diag -- box resolve` maps one back on
  a machine the agent can read);
- every name at the table and of this device's profiles (the page tells the hub — `diagnosticsContext.ts`), the OS
  account, the host name → `<player>`;
- IPv4 → `<ip>` (loopback stays), an e-mail → `<email>`, `C:\Users\<name>\` / `/home/<name>/` → `<user>`.

**The consent («Автоотчёты об ошибках») is kept by the HUB** (`<userData>/diagnostics/state.json`), not by the page: it
governs the main process's own events and the crash uploader before any page exists. Off → nothing automatic is sent,
what was queued by itself is taken back, the crash uploader stops. **A stall is never shown to a player** (the owner,
2026-11-07) — the notice is the developer's opt-in.

An explicit report is the player's own press on a surface that listed what leaves: it carries the full package
unscrubbed.

### 3.3 The session's ledger — «are freezes fewer?» has a denominator (`sessionLedger.ts`)
Events cannot answer it: a class is sent a few times per run, a planned wait never, and a net that fires inside an
episode is a line of that episode. So the hub COUNTS every record it mirrors — by cause class and tier (records,
lines, events actually sent), every episode with its outcome, how long it stood and who cured it, long frames by the
screen they were printed on, the renderer's stops — beside the run's PLAY TIME (the page's own minute: `{kind:
'pulse', inGame}` on the journal's existing tick; a silence longer than three minutes is not play).

The ledger is written to `<userData>/diagnostics/session.json` as it changes (a run that ends in a native stop cannot
send its own) and leaves as ONE event of kind `session` at the NEXT launch (fingerprint `['tm-session']`, `extra.ledger`
— a run nobody played and nothing failed in sends none). `npm run diag -- trend` reads them: stalls per hour of play
and per session by release, the outcomes' shares, the time-to-cure, the top classes with their trend, and the fires of
EVERY net — the evidence a net's retirement needs (`docs/claude/console/architecture-v2/PLAN.md` § 6).

---

## 4. The report package — one layout, on the device and in Sentry

`<userData>/diagnostics/reports/TM-XXXXXX/` and the report event's attachments are the SAME files:

| file | what | budget |
| --- | --- | --- |
| `report.json` | the code, the category, the player's words, release / environment / app mode, the context (seat id, names), the record it was opened from, `seatRef`, `saveGameId`, the list of parts | — |
| `journal.json` | the page's journal, every record with its full text | 2 MB |
| `field_record.json` | the field recorder's ring (lines + heartbeats) | 1 MB |
| `console_export.txt` | the renderer's whole console with its digests (ERRORS · STALLS · SCREEN) | 5 MB (the END is kept) |
| `screen.jpg` | the frame BEFORE the menu covered it (≤ 1920 px wide) | 2 MB |
| `save.json` | the game's save — only when THIS device hosts the game; found by the SEAT (a page never knows its game's id) | 6 MB |
| `hang_trace.json` | the newest Chromium trace of a renderer stop of the last 30 min | 2 MB |
| `log_<name>.txt` | tails: `embedded-server` (+ `.prev`), `main` (+ `.prev`), `wrapper` | 256 KB each |

The event: `message` «Отчёт игрока TM-XXXXXX · <category> — <words>», `level: info`, `tags.kind = report`, fingerprint
`['report', code]` (every report is its own issue — a new issue is what mails the owner). The player's words ride that
event (its message and `extra.comment`) — not a second «User Feedback» item, which the collector files as an issue of
its own. If the collector refuses the whole envelope, the light parts are sent and the rest
stays in the folder. With no network the envelope waits in `<userData>/diagnostics/outbox/` (a report always gets a
place there; it is flushed on the next delivery, every minute, and at the next launch).

**The code** — `TM-` + six characters of `ACDEFGHJKMNPQRTUVWXY34679` (no look-alikes), made on the device.

---

## 5. The surface — one flow, one card

`ConsoleDiagnostics.vue` is the THIRD member of the system overlay (`.con-sys--diag` on the shared `.con-sys` chassis —
`docs/claude/console/system-surface.md` § 10). Its controller is `diagnosticsSurface.ts`; the component is a template.

```
ДИАГНОСТИКА                              browse — the journal under its filters (ВСЕ · ОШИБКИ · ЗАВИСАНИЯ · ПРОЧЕЕ), СИСТЕМА past the seam
ДИАГНОСТИКА › ЗАПИСЬ                     one record: the message, our frames / a library's, the screen, the full text
ДИАГНОСТИКА › ОТЧЁТ                      what happened (five fixed plates)
ДИАГНОСТИКА › ОТЧЁТ › <КАТЕГОРИЯ>        what will be sent · a word from the player · the commit plate
ДИАГНОСТИКА › ОТЧЁТ › … › ОТПРАВКА       past the commit: a BEAT — the pad absorbed, never a destination of B
ДИАГНОСТИКА › ОТЧЁТ › … › ГОТОВО         the code; a finished flow LEAVES (A / B close the overlay)
ДИАГНОСТИКА › ПРОВЕРКА СВЯЗИ             one test event per runtime, each answered
```

Laws (each measured by `tests/e2e/console-diagnostics.spec.ts` on the TV profile):
- **The card never moves.** `.con-diag` has a fixed height; every step is laid into the same cell; the tab band stays
  mounted on every step. Across cursor moves, filter changes and every step the card's box and the cell's box are equal.
- **The crumb only gains a tail**; B is one logical level; `sending` is a beat (B = none, a second A sends nothing).
- **A step change is one phrase**: what stood lets go on the spot, the new step surfaces a beat later in the same cell
  (opacity + a hair of rise; opacity alone under reduced motion).
- **The beat has a minimum** (`REPORT_MIN_BEAT_MS`) and ONE panel: the code is revealed in the cells that waited for it.
- **A refusal speaks**: the commit plate's reason stands in an always-reserved line; a hub that does not answer ends in
  «Не удалось собрать отчёт» with the draft kept.
- **Mono is the game's own** (`@con-font-mono` — JetBrains Mono, shipped): the same glyphs on SteamOS and Windows.
  Long lines wrap; nothing scrolls sideways. Copy is an action (X), through the main process's clipboard.

**Doors.** The system menu's «Сообщить о проблеме» and «Диагностика» plates (B returns to the list); the main menu's
«Сообщить о проблеме»; the developer's key **F12** (the main process pushes `open-journal`; **Shift+F12** is Chrome
DevTools); hold X on the developer's notice. The three doors from outside the overlay's owner go through
`diagnosticsOverlayBridge.ts`.

**The frame of a report** is asked for BEFORE the overlay covers the game (`hold-screen` on the Menu press / before a
direct open) and dropped when the surface closes without a report.

### 5.1 The developer's notice (`diagnosticsNotice.ts`, `ConsoleDevNotice.vue`)
Off by default («Настройки» → ДИАГНОСТИКА → «Уведомления разработчика»: выкл. · Ошибки · Ошибки и зависания). NOT a card
of the game's feed — that feed is blocked by exactly what a stall is made of. Its own state, its own app-level layer
(bottom-left corner of the central opening, on `--con-stage-l/-b`; it covers no hull member, no hint, no feed card), its
own gate at the pad's funnel (`GamepadLayer.onIntent`, before the shell). A PLATE (the newest record; an episode updates
in place) folds into a CHIP (counts not opened yet) after `NOTICE_PLATE_MS`. Hold X = the record in full; a tap is
replayed to the screen below; a card of the game's feed standing on screen takes the gesture first.

### 5.2 Settings
The settings category ДИАГНОСТИКА holds the two SETTINGS (`autoReports` — only where a hub exists; `devNotices`). The hub's
status is asked AT BOOT (D26), so the consent row is there for a player who opens the settings first. The
read-only readout that used to stand there is the surface's СИСТЕМА tab (`buildDiagnosticsReadout` is still its one
implementation), with a «Отчёты» group in front and «Проверка связи» on A.

---

## 6. The release — maps and debug ids (`.github/workflows/release.yml`, job `build`)

1. `build:desktop` with `TM_SENTRY_DSN` (an Actions secret — § 12) → `settings.json` carries the DSN.
2. **Stamp** — `sentry-cli sourcemaps inject build-desktop build/electron` — ALWAYS (no credentials): every shipped
   script gets a debug id and its map the same id. Each runtime reads its own registry (`debugIdsOf`) and the hub puts
   the ids of a stack's files into the event (`debug_meta.images`).
3. **Upload** — only where `SENTRY_AUTH_TOKEN` exists; `continue-on-error` (a failed upload never fails a release).
   Creates and finalises the release `terraforming-mars@<version>`.

Maps are emitted for all four lanes (the client, `tsc` main, the hub's bundle, the embedded server's bundle) and are
never shipped (`electron-builder.yml` drops `*.map`). The desktop build no longer pre-compresses its assets (the
`app://` handler never served the `.gz` / `.br` copies; they would be stale after the stamp).

The packaged app needs no `node_modules` for any of this: the hub (with the one piece of `@sentry/core` it uses) is a
bundle under `build/electron/`, which the allowlist already packs.

---

## 7. The seams (what is NOT built, and where it plugs in)

| future | the seam | proven by |
| --- | --- | --- |
| a HOSTED server (Heroku) | `serverDiagnostics.ts` has ONE sink — a hosted server installs a sink that feeds a hub of its own (`createDiagnosticsHub` with a host that has no screen / no console dump: those `HubHost` members answer `undefined` and the report simply has no such part) | `diagnosticsHub.spec` runs the hub with a fake host; `HubHost`'s optional parts are typed as «may answer undefined» |
| a WEB page | `diagnosticsTransport.ts` returns one of {desktop, none}; a third object (the same protocol over HTTP to the server's hub) changes nothing above it | `diagnosticsClient.spec` drives the surface with a transport of its own; the e2e drives it through `window.__tmDiagTransport` |
| the REPLICA (no hidden information on the client) | `app_mode` is a tag of every event and what decides the save part: `host` attaches the save, anything else does not; a replica would attach its public snapshot under another part name | `diagnosticsHub.spec` § a thin client attaches no save |

---

## 8. Files on a device

| path (under `<userData>` = `%AppData%\terraforming-mars` · `~/.config/terraforming-mars`) | what |
| --- | --- |
| `diagnostics.json` | `{"environment": "box"}` — the machine's label (hand-placed on the owner's box) |
| `diagnostics/state.json` | the consent, the day's counters (events, files) |
| `diagnostics/session.json` | the run's ledger (§ 3.3) — sent by the next launch |
| `diagnostics/outbox/*.env.gz` | envelopes waiting for the network |
| `diagnostics/reports/TM-XXXXXX/` | report packages (the newest 20) |
| `logs/main.log`, `logs/main.prev.log` | the main process's log — on every platform (a packaged Windows build had none) |
| `embedded/embedded-server.log`, `…prev.log` | the game server's log; the previous run is kept (it used to be truncated at launch) |

---

## 9. Checks

```bash
npx mocha --import=tsx --require tests/testing/setup.ts \
  tests/common/diagnostics/diagnosticsCore.spec.ts tests/common/diagnostics/diagnosticsCause.spec.ts \
  tests/server/diagnostics/diagnosticsHub.spec.ts tests/console/diagnosticsClassification.spec.ts \
  tests/console/diagnosticsShapes.spec.ts tests/console/stallEvidence.spec.ts \
  tests/electron/diagnosticsHubConform.spec.ts tests/console/fieldRecorder.spec.ts
npm run test:client:one -- tests/client/diagnostics/diagnosticsClient.spec.ts
npm run e2e:remote -- <task> tests/e2e/console-diagnostics.spec.ts tests/e2e/console-system-menu.spec.ts tests/e2e/console-options-settings.spec.ts
```

`electron/diagnosticsHost.ts` repeats `hubTypes.ts` by hand (the Electron lane compiles without `src/`);
`diagnosticsHubConform.spec` proves the two assignable both ways and textually equal.

### 9.1 What it costs — measured on the box, 2026-11-14

Against the build of `main` it was added to (the V4 final, `createVaporApp`), both runs `--exclusive --workers=1`:

| | before | after |
| --- | --- | --- |
| the TIMING set (`console-scene-transition` + `console-smoothness`, 13 tests) — total | 132.6 s | 132.7 s |
| …the presses' own settle | 37.8 s | 37.8 s |
| the Parliament's entry, its two long tasks (5 runs × 2 profiles, median) | 190 ms + 61 ms | 190 ms + 61 ms |
| `main.js` (the initial chunk) | 2 948 420 B · 497.5 KB br | 2 987 642 B · 509.1 KB br (+1.3 %) |
| `vendors.js` | 541 097 B | 541 095 B |

The surface, the report and the notice are lazy chunks (fetched 9 s after the app settles, or at first use); the page
runs no SDK; what the initial chunk gained is the interceptor, the journal and the classifier.

⚠ **Take the baseline from the SAME runtime.** The first comparison used a snapshot built BEFORE the V4 switch and
«found» +32 ms in the Parliament's first long task (156 → 188 ms, stable over five runs) — the cost of V4 itself, not
of diagnostics; `vendors.js` 40 KB larger on the «before» side is what gave it away. A baseline is the commit the
work stands on, built the same way.

### 9.2 Proving a RELEASE on the box with no hand on a pad

The released AppImage, in a scratch folder, with its OWN data folder (the owner's installation and saves are not
touched), headless inside the `e2e` distrobox — the app runs the connection check and sends one probe report by
itself, prints both answers and quits:

```bash
# ── on the box (`ssh steam-machine`) ──
mkdir -p ~/tm-e2e/diag-accept/cfg/terraforming-mars && cd ~/tm-e2e/diag-accept
cp ~/.config/terraforming-mars/diagnostics.json cfg/terraforming-mars/     # the box's label: {"environment": "box"}
curl -sL -o TM.AppImage https://github.com/victor-zelinskiy/terraforming-mars/releases/download/v<version>/TerraformingMars.AppImage
chmod +x TM.AppImage
distrobox enter e2e -- bash -lc 'cd ~/tm-e2e/diag-accept && XDG_CONFIG_HOME=$PWD/cfg TM_DIAG_PROBE=1 TM_ELECTRON_WINDOWED=1 \
  timeout 240 xvfb-run -a -s "-screen 0 1920x1080x24" ./TM.AppImage --appimage-extract-and-run --no-sandbox > probe.log 2>&1'
grep 'diagnostics\]' probe.log

# ── on the laptop ──
npm run diag -- selftest --since 30m          # page · main · server — env box, the release, RESOLVED
npm run diag -- report <the code it printed>   # the package, with screen.jpg
```

First run, release 1.2.3242 (2026-11-14): «sending as box · terraforming-mars@1.2.3242», the three events delivered in
145 ms and RESOLVED to sources in Sentry, the report `TM-3VXNY6` accepted with its frame. Second run, release
1.2.3243: **NO NETWORK** first (the same command with `--host-resolver-rules="MAP *.sentry.io ~NOTFOUND"` after
`--no-sandbox`) — every row «no connection (net::ERR_NAME_NOT_RESOLVED)», the report `TM-RNTXKH` answered `queued`,
four envelopes in `diagnostics/outbox/`; then an ordinary launch — the outbox emptied by itself (`TM-RNTXKH` is in
Sentry with its nine attachments), a new report `TM-K3AQQX` sent, the process ended through the guarded door in 21 s
with nothing left behind. The package carries both `*.symbols.json`, both files of the mono face and the hub's
bundle, and no source map. ⚠ It files a real report
under `environment: box` — the owner gets the «new report» e-mail; say so. Afterwards: no `terraforming-mars`
process left (`pgrep -f "usr/bin/[t]erraforming-mars"`), `rm -rf /tmp/appimage_extracted_*`.

---

## 10. Журнал решений (decision journal)

| # | Решение | Варианты | Почему |
| --- | --- | --- | --- |
| D1 | **SDK только в main; в странице SDK нет** — рендерер шлёт структурированные записи хабу | `@sentry/electron` (main + renderer + utility) — ориентир прошлой сессии; `@sentry/browser` в странице | `@sentry/electron` тянет `@sentry/node` с OpenTelemetry (десятки пакетов) в приложение, которое не возит `node_modules`; его renderer-часть требует preload-модуль, а песочный preload собирается голым `tsc`; рендерерные SDK опираются на глобальные обработчики (дубль нашего перехватчика) и на внутренности Vue. Один отправитель = одно место для согласия, вычистки и бюджетов; нулевая цена для загрузки страницы |
| D2 | **Из SDK взят только `@sentry/core`** (сериализация конверта); событие, очередь и политика — свои | `ServerRuntimeClient` (в 11.x из core убран), `makeOfflineTransport` | Нужен известный ответ «доставлено / в очереди» для экрана отчёта, место в очереди для явного отчёта и возврат очереди при отзыве согласия — готовый офлайн-транспорт этого не даёт; бандл хаба 100 КБ |
| D3 | **Хаб — обычный Node-модуль в `src/server/diagnostics/hub`, в main приходит бандлом** (как встроенный сервер) | код в `electron/` (линия без `src/` и алиасов), allowlist `node_modules/@sentry/**` | Общий слой `src/common/diagnostics` нужен и странице, и хабу, и серверу; тот же хаб запустит хостинг-сервер (шов R6). Типы хоста продублированы в `electron/diagnosticsHost.ts` и проверяются спеком |
| D4 | **Нативные краши — штатный `crashReporter` Electron → minidump-эндпоинт Sentry** | минидампы через `@sentry/electron` | Тот же результат без SDK; согласие — `setUploadToServer` |
| D5 | **Debug ID штампуются в CI `sentry-cli sourcemaps inject` после сборки, всегда; загрузка — только с токеном** | `@sentry/webpack-plugin` | Один механизм на все четыре линии (включая `tsc`-вывод main, который не проходит через webpack); локальные и e2e-сборки не меняются |
| D6 | **Отчёт — этапы ОДНОЙ поверхности «Диагностика»**, а не этапы карточки системного меню | этапы внутри `.con-sys--menu` (ориентир) | Карточка меню узкая (30 rem) и фиксированной формы; отчёту нужны две колонки и панель кода. Грамматика та же: один корень крошки, хвост только растёт, B — один уровень; из меню — отдельная плашка, B возвращает в список |
| D7 | **Сводка «Диагностика» переехала из настроек на вкладку СИСТЕМА; категория настроек стала строками** | новая категория «Отчёты» | Категория имеет либо строки, либо readout; две настройки диагностики естественно живут в категории «Диагностика», а сводка — рядом с журналом, который она объясняет |
| D8 | **Плашка разработчика — свой слой и свой шлюз ввода в `GamepadLayer`**, вне оболочки | карточка очереди уведомлений (`pushWarning`) | Очередь блокируется ровно тем, из чего состоит зависание; оболочка в зависании может не отвечать |
| D9 | **Плашка уступает удержание X любой карточке событий на экране** | уступать только карточке с деталью | Одно простое правило без правки маршрутизатора оболочки; когда экран висит, карточек нет — жест у плашки |
| D10 | **Сохранение ищется по id места**, а не по id партии | передавать id партии со страницы | Страница id партии не знает (и не должна); текущая партия — самый свежий файл, поиск ограничен 40 новейшими |
| D11 | **Каждый отчёт — отдельная проблема в Sentry** (fingerprint = код) | все отчёты в одной проблеме | Письмо владельцу приходит на НОВУЮ проблему; код находится поиском по тегу `report_code` |
| D12 | **Свой моноширинный шрифт (JetBrains Mono, OFL, 39 КБ, два сабсета)** | системный `monospace` | На SteamOS и Windows системные моно разные; стек должен читаться одинаково |
| D13 | **Согласие хранит хаб (файл данных приложения), а не страница** | `localStorage` страницы | События main-процесса и краш-репортер должны подчиняться согласию до появления страницы |
| D14 | **Канала связи для игроков нет** (решение владельца 2026-11-14): финальный этап говорит «отчёт уже у разработчика», код — для справки | — | Добавится одним значением: `DIAG_CONTACT` (см. § 11) |
| D15 | **Desktop-сборка больше не делает `.gz` / `.br`** | оставить | `app://` их никогда не отдавал; после штампа debug id они были бы устаревшими; минус минуты Brotli-11 на критическом пути релиза |
| D16 | **`[boot-warmup]`** — проглоченная ошибка рендера прогрева теперь заметка журнала | оставить молчаливой | «Ни один сигнал не теряется»; не ошибка и не отправляется |
| D17 | **`BugReportDialog.vue` удалён**; кнопка «Report a bug» старого диалога настроек (достижим со страницы `/cards` и старого стартового экрана) открывает наш отчёт | оставить ссылку на GitHub / Discord оригинального проекта | Апстрим не может исправить ошибку форка, а предлагаемый для вставки текст содержал id игрока |
| D18 | **Событие несёт `user.geo = {region: 'not collected'}` и `sdk.settings.infer_ip = never`** | только `scrubIPAddresses` проекта | Проба показала: IP Sentry не хранил, но ГОРОД по адресу соединения выводил и хранил; заранее заполненный `geo` это отключает |
| D19 | **Контекст рантайма хоста называется `host_runtime`** | контекст `runtime` | Sentry выводит из контекста `runtime` одноимённый тег и затирал наш (`page · main · server`) — найдено пробой |
| D20 | **Слова игрока едут в самом событии отчёта**, отдельного элемента «User Feedback» нет | `feedback`-элемент, привязанный к событию | Sentry заводит на него отдельную проблему: два письма на один отчёт — найдено пробой |
| D21 | **`scripts/diag-probe.mjs`** — хаб под голым Node с настоящей отправкой (окружение `development`) | проверять только на релизе | Приём конвертов, вид событий, вычистку и вложения можно доказать до релиза и без окна; так найдены D18–D20 |
| D23 | **В Sentry добавлено правило оповещения «TM diagnostics — a new player report or stall (below high priority)»** (workflow `1493012`: новая проблема с уровнем ≤ warning → письмо) рядом со штатным «high priority issues» | поднять уровень события отчёта до `error` | Штатное правило шлёт письмо только о проблемах ВЫСОКОГО приоритета (уровень error); отчёт игрока — `info`, зависание — `warning`, письма о них не было бы. Два правила не пересекаются по уровню — одно письмо на проблему. Проверено пробой: `lastTriggered` обоих правил |
| D24 | **Символы кадров на устройстве** (`main.js.symbols.json`, `vendors.js.symbols.json` — список исходников, имена, mappings без текста исходников; 2 + 0.9 МБ, в установщике ~1 МБ) и свой декодер VLQ | показывать минифицированные кадры; возить полные карты (в 4 раза больше) | «Кадры нашего кода читаются» — на экране игры, а не только в Sentry: разработчик за игрой видит `src/…/file.ts:412`. Грузятся только при открытии записи |
| D25 | **`TM_DIAG_PROBE=1`** — приложение само проходит «проверку связи» и шлёт пробный отчёт через настоящие каналы, печатает ответы в лог и выходит; `window.__conDiagnostics` — крючок страницы для этого | проверять только руками с геймпада | Склейка main-процесса (IPC, utilityProcess, пакет отчёта) проверяется одной командой на любой машине — так найден сбой клонирования реактивного объекта ещё до релиза |
| D22 | **Плашка разработчика — три короткие строки шириной 19 rem в левом нижнем углу центрального проёма; над открытым workspace — сразу чип** | широкая однострочная плашка | Первая версия задевала шкалу и карты в доке (кадр 4K); свободен только этот угол, а над workspace свободных углов нет |
| D26 | **Статус хаба страница спрашивает ПРИ ЗАГРУЗКЕ** (`installDiagnosticsJournal` → `refreshDiagnosticsHubStatus`) и принимает его push `status` (`acceptDiagnosticsPush`) | спрашивать при открытии поверхности диагностики (так было) | Строка «Автоотчёты об ошибках» в настройках рисуется только когда хаб назвал выбор игрока. Игрок, который идёт в настройки ПЕРВЫМ делом, строки не находил — отказ от автоотправки был невидим, пока не откроешь «Диагностику». Нашёл стенд «две двери» (`console-diagnostics.spec` — снимок 18); push `status` страница молча выбрасывала |
| D27 | **Карточка настроек шире: 55 rem (база) и 66 rem (ТВ)** | ужать отступы вкладок; обрезать полосу | В игре у настроек ШЕСТЬ категорий («ПАРТИЯ»), и шестая — «ДИАГНОСТИКА», единственный дом отказа от автоотчётов — уходила под значок правого бампера и за край карточки («ДИА[RB]СТИ…», на обоих профилях; дефект старше этой задачи, но стоит на её пути). Отступы — это зона попадания; обрезка — потеря слова. Доказательство: обе e2e-спеки меряют полосу — каждая вкладка между двумя значками |
| D28 | **Веб-сервер отдаёт `main.js.symbols.json` / `vendors.js.symbols.json` и оба файла JetBrains Mono** (`ServeAsset.ts` — белый список, `requestProcessor.ts`) | оставить это только Electron (`app://` отдаёт по расширению) | На сервере (бокс в e2e, будущий хостинг — шов R6) запись читалась бы системным моноширинным шрифтом, а кадры — только через полный `.map` (8 МБ). Спека маршрутов `ServeAsset.spec` |
| D29 | **Чтение кадров проверяется на записи, рождённой ВНУТРИ бандла** (запись «проверки связи» страницы, семья `selftest`) | проверять на ошибке, брошенной стендом | У ошибки из `page.evaluate` нет ни одного кадра бандла — читать нечего; запись проверки связи рождается в `diagnosticsSurface.ts`, и e2e требует первой строкой `src/client/diagnostics/diagnosticsSurface.ts:<строка>` |
| D30 | **Размер окна читается один раз при загрузке и заново только по `resize`** — снимок экрана у записи его не спрашивает | читать `window.innerWidth` на каждой записи (так было) | Чтение `innerWidth` заставляет браузер довести раскладку до актуальной, а строка печатается где угодно — в том числе посреди тяжёлого монтирования. Замер разницы не показал (§ 9.1), но диагностика не имеет права стоить кадру, который описывает, — закрыто конструкцией и строкой юнит-спеки |
| D31 | **Колонка главного меню держит полный набор плиток приложения — измерено, а не прикинуто** (e2e: 11 плиток на минимальной высоте, 9 повседневных — с обеими строками внутри) | убрать пункт «Сообщить о проблеме» из меню в нижнюю панель; ужимать плитки по счётчику | На ТВ колонка вмещает 8 плиток в полный рост; на боксе с новым пунктом их 9. Плитки уже уступают место вместе (flex-shrink до `min-height`) — менять вёрстку не понадобилось, но это было допущение, пока его не померили на боксе |
| D32 | **Проба выходит через `beginShutdown`** (зависимость `quit` у `installDiagnosticsMain`), а не голым `app.quit()` | `app.quit()` (так было) | Первая же проба релиза на боксе оставила процесс жить после «quit — event loop done»: на Steam Machine нативное завершение Chromium может не закончиться, и только общая дверь выхода взводит сторожа, который добивает процесс (`electron/shutdown.ts`). Правило проекта — «никогда голый `app.quit()`» — действует и для инструмента разработчика |
| D33 | **Отказ Sentry по лимиту — не «нет сети»**: хаб читает `429` и заголовок `X-Sentry-Rate-Limits` (отдельно события и отдельно вложения), отчёт получает `waits: 'limit'` / `filesRefused`, статус — `limitedWhat` + слово самого Sentry (`usage_exceeded`, `key_quota` …) | один исход «в очереди» с текстом про сеть (так было) | Исчерпанная квота бесплатного плана выглядела для игрока как «проверьте интернет», а отчёт без вложений (квота файлов отдельная) — как обычный «отправлен». Теперь экран говорит правду: «служба приёма переполнена, ваш интернет ни при чём», «отчёт у разработчика — без файлов», вкладка СИСТЕМА и проверка связи — то же. Высоты строк не меняются: меняются слова в местах, которые уже стоят |
| D34 | **Ключ отправки — из СЕКРЕТА GitHub, в репозитории его нет (гард), смена — три команды** (`npm run diag -- key` · `key rotate` · `key retire`) | переменная Actions + ключ в документе (так было); собственный прокси с учётом по адресам | Ключ внутри розданной игры публичен по природе — его нельзя спрятать, можно только не класть туда, где его найдёт поиск по репозиторию или открытый лог сборки, следить за квотой и уметь заменить за минуты. Прокси (свой сервис с настоящим ключом и лимитами по адресам) — единственная полная защита от намеренной заливки; это отдельная инфраструктура и решение владельца (§ 12) |
| D35 | **Класс причины — ЧИСТАЯ ФУНКЦИЯ СТРОКИ** (таблица форм `shapes.ts` + структурные слова строки); супервизор печатает слова, из которых класс собирается (`task:` · `top:` · `holder:`) | структурный объект рядом со строкой как единственный источник; хэш дерева флоу | Ключ обязан совпасть у четырёх читателей — страницы, хаба (строки main-процесса и сервера), e2e-харвеста и отчёта обезьяны, — а у трёх из них есть только текст консоли. Функция текста — одна реализация на всех; гард `diagnosticsShapes.spec` привязывает каждое место печати к форме, поэтому переписанная строка не может молча сменить класс. Дерево флоу — УЛИКА: оно зависит от тайминга и раздробило бы класс |
| D36 | **Исход, вылечившая сетка, карта и длительность — ИЗМЕРЕНИЯ (теги), а не часть ключа** (прежний отпечаток нёс `healed` / `unhealed`) | оставить исход в ключе | Одна причина в одной сессии лечится, в другой кончается перезагрузкой; с исходом в ключе худшие случаи дефекта лежали бы отдельно от него самого |
| D37 | **Улики снимает ПРОВАЙДЕР, который супервизор консоли регистрирует у перехватчика** (один раз на запись дефекта); действующая сетка снимает их ДО действия и передаёт со строкой (`withDiagEvidence`) | каждое место печати собирает улики само; снимать на каждой строке | Перехватчик работает до появления приложения и не должен знать консоль; один провайдер = одна ограниченная форма; на здоровой секунде не платится ничего (D30). Снимок после лечения описывал бы лечение, а не причину |
| D38 | **Плановое ожидание — не событие, а счётчик в книге сессии**; уровень (`defect` · `planned` · `info`) объявляет строка таблицы форм или само ожидание (`CeilingWaitSpec.planned`) | семплировать; оставить событием с малым бюджетом | 5–8 плановых потолков за партию вытесняли из бюджета семейства (8) настоящий `dead-end` и за неделю съели бы месячную квоту при нескольких игроках. Счётчик сохраняет частоту — больше плановому ожиданию сказать нечего. Бюджет стал «на класс причины», семейного больше нет |
| D39 | **Эхо сетки — строка записи, на которую оно отвечает; сказанное внутри эпизода арбитра — строка эпизода** (`echoOf` в таблице форм; `episode.nets`) | каждая строка — своя запись и своё событие | Один инцидент давал три проблемы в Sentry (эпизод арбитра + «история деградирована арбитром» + «такт снят арбитром»). Теперь одно событие несёт всё, а книга сессии всё равно считает каждую сработавшую сетку по её классу |
| D40 | **Событие зависания уходит не сразу**: находка — через `STALL_SETTLE_MS` (эхо того же тика — её строки), эпизод — через `EPISODE_SETTLE_MS` после конца | отправлять в момент рождения (так было) | За это время становится известно, чем эпизод кончился ДЛЯ ИГРОКА (страницу перезагрузили → `reload`, игру закрыли → `quit`), а у остановки рендерера записан трейс. Закрывающееся приложение ничего не шлёт: ждущее событие кладётся в очередь на диске и уходит при следующем запуске |
| D41 | **Знаменатель «стало меньше?» — собственное событие сессии** (одно на запуск, отправляет СЛЕДУЮЩИЙ запуск) | release health Sentry (сессии); продукт метрик | Хаб — единственный отправитель и уже хранит состояние дня на диске; одно событие несёт время игры, счёт каждой сетки и исходы эпизодов — ровно те числа, из которых состоит планка программы, — и стоит одного события квоты на сессию. В release health нет места своему счётчику и нет времени игры. Запуск, кончившийся нативной остановкой, сам о себе не расскажет — поэтому отправляет следующий |
| D42 | **Сохранение едет ССЫЛКОЙ** (отпечаток партии + номер сохранения в момент начала эпизода), а не файлом | вкладывать сохранение в автоматическое событие | Сохранение — это ключи и имена стола: закон 6 запрещает их в автоматической отправке, а вычищенное сохранение не загружается. Сервер хранит КАЖДОЕ сохранение партии (`history/<партия>-<n>.json`), так что ссылка остаётся верной, и `npm run diag -- save` забирает ровно тот файл с машины, которую агент может читать (бокс) |
| D43 | **Трейс остановки рендерера едет с её событием** — вычищенный; на боксе всегда, у игрока в пределах `DAILY_FILES_MAX` файлов в день | только с явным отчётом (так было) | При нативной остановке страница не исполнялась: ни одна сетка страницы ничего не скажет, и отчёт никто не нажмёт (геймпад мёртв). Трейс Chromium — единственная улика тех секунд |
| D44 | **В Sentry добавлено правило «TM diagnostics — a resolved issue came back (regression)»** (workflow `1494371`: условие `regression_event` → письмо), рядом с правилом о новых проблемах (D23) | смотреть регрессы только командой | Класс, закрытый «исправлено в релизе» (`npm run diag -- resolve`), при возврате должен быть виден СРАЗУ: Sentry сам помечает такую проблему регрессом, правило превращает это в письмо; `npm run diag -- issues --regressed` показывает то же из командной строки. Создано через API одним запросом по образцу правила D23 |
| D45 | **Шесть поправок после проверки на настоящем коллекторе** (2026-11-14): длинные списки улик уходят ЧАСТЯМИ (`flow_tree`, `flow_tree_2`, …); первая строка сообщения — слова КЛАССА, исход случая — вторая строка и `extra.ending`; ссылку на сохранение несёт ЛЮБОЙ дефект, не только эпизод (одно чтение файла на всплеск); эпизод не берёт измерения свёрнутой в него строки (кроме `trace`); свёрнутые эхо считаются строками записи в учёте сессии; `resolve` по умолчанию закрывает в версии ЭТОГО чекаута | оставить как было | Замерено пробой: коллектор молча режет одно значение `extra` на ~16 КБ (дошло 69 строк дерева из 90, 70 строк трассы из 80); заголовок проблемы читался как исход ПОСЛЕДНЕГО случая («cured…» у класса, где были и перезагрузки); находка, вылеченная дверью за свой же тик, приходила без пути назад к столу; эпизод арбитра получал тег `by: the liveness arbiter` — автора свёрнутой строки; срабатывание двери не попадало в счёт сетей |
| D46 | **Чужой релиз `terraforming-mars@45.3.1` заархивирован в Sentry**, а `resolve --next` перестал быть умолчанием | оставить `--next` | Ранняя проба без упаковки отправила версию Electron; число больше любого `1.2.x`, коллектор считал этот релиз «последним», и класс, закрытый «в следующем релизе», не мог вернуться регрессом никогда. Умолчание теперь — версия чекаута (команда запускается ПОСЛЕ коммита исправления), релиз создаётся в коллекторе, если о нём ещё не слышали |

## 11. Как позже добавить канал связи
Одно значение — константа `DIAG_CONTACT` в `src/common/diagnostics/protocol.ts` (сейчас `''`). Пока оно пустое, строки
о контакте нет нигде (ни на этапе «ГОТОВО», ни в гайде); с непустым значением этап «ГОТОВО» печатает его под кодом
(`[data-diag-contact]`), а в гайд игроков добавляется одна строка. `DISCORD_INVITE` из `src/common/constants.ts` — сообщество
оригинального проекта, его не использовать.

## 12. The client key — public by nature, so: findable nowhere else, watched, replaceable

A DSN inside a shipped application can be read by anyone who unpacks it; no build step makes it a secret. What a
stranger can do with it is ONE thing — send events — and what that costs is the plan's quota (5 000 events and 1 GB of
attachments a month on the free plan). So the key is defended by four things, in this order:

1. **It is in no file of the repository and in no public log.** The release reads it from the Actions SECRET
   `TM_SENTRY_DSN` and from nowhere else (masked in the build log of this public repository; the variable of the same
   name was deleted on 2026-11-14 and no workflow reads one). Guard: `diagnosticsClassification.spec` § the client key
   — a real DSN anywhere under `docs`, `.github`, `.claude`, `electron`, `scripts`, `src`, `tests` or in a root
   file fails the suite. (The key that stood in `prompts/diagnostics-sentry.md` until 2026-11-14 is in the history
   for ever — which is why it was REPLACED, not merely deleted.)
2. **The collector's own nets.** Spike protection is on (the project's `quotas:spike-protection-disabled` is false);
   both keys carry a rate limit of 1 000 events / 24 h — five times one device's own daily cap, so a tester is never
   throttled by it. ⚠ Per-key rate limits are a feature of the paid plans: they work while the organization's trial
   lasts (until 2026-11-27) and may stop being enforced after it — do not count on them.
3. **The quota is watched, and its end is told truthfully.** `npm run diag -- key` prints the keys and how much of the
   period's quota is used; when the collector refuses (`429`, or `200` with the files refused), the game says «the
   receiving service is full» — never «no network» (D33) — and the report stays on the device until the limit renews.
4. **A key that is abused is replaced in minutes** — nothing else stops a flood on the free plan:

   ```bash
   npm run diag -- key rotate          # a NEW key; prints its DSN. The old one still works.
   #   GitHub → Settings → Secrets and variables → Actions → Secrets → TM_SENTRY_DSN = that DSN   (by hand: no token here)
   #   push anything → the release bakes it in → installed games update themselves
   npm run diag -- selftest            # after the box updated and ran «Проверка связи»: the events arrive
   npm run diag -- key retire <old id> # only now the collector stops accepting the old key
   ```

   Retiring is refused while the key is the only active one. A game that has not updated yet keeps its reports on
   the device (the outbox + the report folders) and loses its automatic events of that window — the price of a rotation.

   ⚠ **THE INGEST ANSWERS `200` TO ANY KEY** — a retired one, a mistyped one, thirty-two zeroes (measured 2026-11-14:
   three real event envelopes, each answered `200 {"id": …}`, none of them stored). It accepts first and judges the
   key afterwards. Two consequences: ① a game that still carries a retired key SAYS «отправлен» / «Доставлено» and
   nothing arrives — the hub cannot know; its report folders on the device are the only copy; ② the in-game
   connection check proves the ROAD to the collector, and only `npm run diag -- selftest` (which reads what Sentry
   STORED) proves the arrival. After a rotation and after any change of the secret, the second one is the check.
   (A limit is different: the collector says `429` / the rate-limit header — D33 stands on that.)

   **The first rotation — 2026-11-14.** The key that had been written into the prompt document (`2181c05e…`) was
   replaced by `52658725…`: the owner set the secret and deleted the variable; release 1.2.3248 had been built before
   that and still carried the old key (read out of its package on the box), 1.2.3249 carries the new one (the same
   reading; the probe's three events RESOLVED in Sentry); the old key is retired — events sent with it are not stored.
   ⚠ `sentry api` answers a GET from its own cache: right after the retirement it still listed the key as active, and
   the first `key retire` announced a success it had not checked. The key commands read past the cache now
   (`apiFresh`) and `key retire` re-reads the key before it says anything.

**What would close it for good** (not built — the owner's call, a new piece of infrastructure): a relay of our own (a
small serverless function is enough) that holds the real key, accepts envelopes from the game and applies limits per
address and per day before forwarding. The game would then carry the relay's address instead of a Sentry key, and a
flood could cost no more than the relay lets through. The hub needs one change for it — the envelope URL — and the
seam is `hubConfig.ts` (`parseDsn`).
