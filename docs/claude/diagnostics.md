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
| **shared, pure** | `src/common/diagnostics/` | `DiagnosticModel` (the record), `classify` (tag → kind), `journal` (lines → records, episodes), `stackFrames` (a V8 stack parsed), `privacy` (the scrub), `protocol` (page ↔ hub), `debugIds` |
| **the page** | `src/client/diagnostics/`, `src/client/components/console/diagnostics/`, `src/styles/console_diagnostics.less` | the interceptor, the journal's reactive face, the transport seam, the surface's controller and view-model, the notice, the components |
| **the hub** | `src/server/diagnostics/hub/` (a plain Node module, bundled to `build/electron/diagnostics-hub.js` by `webpack.diagnostics.config.js`) + its host `electron/diagnosticsMain.ts` | the mirror, the policy, the scrub, the sender with its outbox, the report package, the connection check |
| **the server** | `src/server/diagnostics/serverDiagnostics.ts` | a facade with one sink; embedded → posts to the main process |

**No SDK runs in the page.** The hub is the one sender; it uses only `@sentry/core`'s envelope serialiser. Nothing
installs a second set of global handlers beside the game's own interceptor (guard: `diagnosticsClassification.spec` § the
page runs no SDK).

---

## 2. The record — `DiagEntry`

One console line (or one episode) = one record: `kind` · `family` (the tag) · `level` · `runtime` (`page | main | server`)
· `title` · **`text` — verbatim what the console received, an `Error` as its whole stack** · `stack` · `count` ·
`episode?` · `screen?` (what the screen was doing: the field recorder's heartbeat reduced) · `build` · `delivery?`.

### 2.1 Every tagged line has a class
`classify.ts` is the ONE table: tag → `error | stall | integrity | perf | note`. The journal's filters, the notice and
the hub's policy all decide by the kind. **A new `console.warn('[new-tag] …')` is a new row** — the guard
`tests/console/diagnosticsClassification.spec.ts` reads `src/client` and `electron` and fails with the LIST of tags that
have no row; a site whose first argument is not a literal is declared in the spec's `INDIRECT` table.

An untagged `console.error` is an `error` of the family `console`; an untagged `console.warn` a `note`.

### 2.2 Three rules of the journal (`journal.ts`)
1. **ONE THROW — ONE RECORD.** A repeat inside `DIAG_COALESCE_MS` (30 s) grows `count`.
2. **A LIVENESS STALL IS AN EPISODE.** The arbiter prints `[liveness] stall …` once per rung (≥ 2 s apart) and
   `[liveness] recovered after Ns`. The lines between are ONE record: `episode.state` = `open → healed` (with the
   arbiter's own duration) or `unhealed` (no line for `DIAG_EPISODE_SILENCE_MS`, or the page left under it).
   **The arbiter's line has three readers** — `readLivenessLine` (here), `buildStallDigest` (the console export) and the
   e2e harness's `livenessGuard`; the classification spec pins the line's fixed words in the supervisor's source, so
   changing the wording moves all of them in one diff.
3. **BOUNDED.** `DIAG_JOURNAL_MAX` records, `DIAG_TEXT_MAX` characters each (head + newest tail).

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

---

## 3. What is sent by itself — the hub's policy (`hub.ts` `autoDecision`)

| kind | when | as |
| --- | --- | --- |
| `error`, `integrity` | when the record is born | an EXCEPTION with frames + debug ids (a stack), else a MESSAGE with an explicit fingerprint |
| `stall` — a liveness episode | when it ENDS, or once it has stood 30 s | ONE message: «the screen stood still (reason, asked …) — cured after N s / NOT cured» |
| `stall` — other families | when the record is born | a message |
| `perf`, `note` | never | they ride the next event as its breadcrumbs (the journal's last 30 records) |

Budgets (one loop must not spend the quota): 40 events per app run · 2 per defect key · 8 per family · 200 per device per
day (kept on disk). On the box (`environment: box`) an automatic event carries the console's dump, scrubbed, at most once
in 10 minutes.

**Tags of every event** (what an agent filters by): `kind` · `family` · `runtime` (`page | main | server`) · `app_mode`
(`host | remote | web`) · `screen` · `section` · `profile` · `prompt_type` · `locale` · `seat_ref` (a fingerprint) · `head` ·
`episode` · `selftest`; a report adds `report_code` · `report_category` · `entry_kind`; the collector derives `os` /
`os.name` from the context. Contexts: `screen`, `episode`, `os`, `device`, `host_runtime` (Electron and its version —
never a context named `runtime`: the collector would derive a `runtime` tag from it and overwrite ours), `app`.
**Where the player is, is not said**: `sdk.settings.infer_ip = never` keeps the sender's address out, and the event
brings `user.geo = {region: 'not collected'}` — without it the collector still derives a CITY from the connection
(measured with `scripts/diag-probe.mjs`).

### 3.1 Whether anything is sent at all (`hubConfig.ts`)
**Only a packaged release BUILT with a destination sends.** The DSN is baked into `settings.json` (`sentryDsn`) by
`make:json` from the Actions variable `TM_SENTRY_DSN`; a local build, a fork's build, a development run have none. A
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

1. `build:desktop` with `TM_SENTRY_DSN` (an Actions variable) → `settings.json` carries the DSN.
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
| `diagnostics/state.json` | the consent, the day's counter |
| `diagnostics/outbox/*.env.gz` | envelopes waiting for the network |
| `diagnostics/reports/TM-XXXXXX/` | report packages (the newest 20) |
| `logs/main.log`, `logs/main.prev.log` | the main process's log — on every platform (a packaged Windows build had none) |
| `embedded/embedded-server.log`, `…prev.log` | the game server's log; the previous run is kept (it used to be truncated at launch) |

---

## 9. Checks

```bash
npx mocha --import=tsx --require tests/testing/setup.ts \
  tests/common/diagnostics/diagnosticsCore.spec.ts tests/server/diagnostics/diagnosticsHub.spec.ts \
  tests/console/diagnosticsClassification.spec.ts tests/electron/diagnosticsHubConform.spec.ts tests/console/fieldRecorder.spec.ts
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

## 11. Как позже добавить канал связи
Одно значение — константа `DIAG_CONTACT` в `src/common/diagnostics/protocol.ts` (сейчас `''`). Пока оно пустое, строки
о контакте нет нигде (ни на этапе «ГОТОВО», ни в гайде); с непустым значением этап «ГОТОВО» печатает его под кодом
(`[data-diag-contact]`), а в гайд игроков добавляется одна строка. `DISCORD_INVITE` из `src/common/constants.ts` — сообщество
оригинального проекта, его не использовать.
