---
description: Diagnostics — the page's interceptor and journal, the hub (the one sender), the report package, the diagnostics surface and the developer's notice.
paths:
  - "src/common/diagnostics/**"
  - "src/client/diagnostics/**"
  - "src/client/components/console/diagnostics/**"
  - "src/server/diagnostics/**"
  - "src/styles/console_diagnostics.less"
  - "electron/diagnosticsMain.ts"
  - "electron/diagnosticsHost.ts"
  - "scripts/diag.mjs"
  - "tests/common/diagnostics/**"
  - "tests/server/diagnostics/**"
  - "tests/client/diagnostics/**"
  - "tests/console/diagnosticsClassification.spec.ts"
  - "tests/e2e/console-diagnostics.spec.ts"
---

# Diagnostics rules

Contract, picture, decision journal: **`docs/claude/diagnostics.md`** — read it before changing anything here. Triage of
a report or a Sentry issue is the skill `diagnose-report` (`npm run diag -- …`).

## The laws (each has a guard)
1. **A NEW TAG IS A NEW ROW.** Every `console.warn('[tag] …')` / `console.error('[tag] …')` of `src/client` and
   `electron` has a row in `src/common/diagnostics/classify.ts` (`error · stall · integrity · perf · note`). A site
   whose first argument is not a literal is declared in the guard's `INDIRECT` table. Guard:
   `tests/console/diagnosticsClassification.spec.ts` — it fails with the LIST.
2. **THE ARBITER'S LINE HAS THREE READERS** — `readLivenessLine` (the journal's episode), `buildStallDigest`
   (`electron/consoleExport.ts`), the e2e `livenessGuard`. Change the wording of `[liveness] stall …` / `recovered …`
   only together with all three; the same guard pins the line's fixed words in the supervisor's source.
3. **ONE EXCEPTION — ONE PRINTED LINE AND ONE RECORD.** A caught or uncaught error goes through
   `reportDiagnosticError(line, err)` (`diagnosticsCapture.ts`): it prints through the ORIGINAL console and records
   once, with the error's own stack. Never `console.error(line, err)` for an error you also report; never a second
   `window 'error'` / `unhandledrejection` listener.
4. **THE PAGE RUNS NO SDK AND SENDS NOTHING ITSELF.** Its records go to the HUB over `diagnosticsTransport.ts`; the hub
   (`src/server/diagnostics/hub`, bundled into the main process) decides, scrubs and sends. Nothing under `src/client`
   imports `@sentry/*` (guarded).
5. **NOTHING IS SENT FROM A BUILD WITH NO DESTINATION, AND NOTHING AUTOMATIC AGAINST THE PLAYER'S CHOICE.**
   `resolveHubConfig` is the one decision (packaged + a DSN baked in by the release; never a test run); the consent is
   the hub's. Do not add a second «should I send» anywhere. Guard: `tests/server/diagnostics/diagnosticsHub.spec.ts`.
6. **AN AUTOMATIC EVENT CARRIES NO KEY AND NO NAME.** Every automatic payload — the event AND any attachment — goes
   through `scrubDeep` before the sender. A participant / game id is a KEY (fingerprint it); a name is a name. Only an
   explicit report (the player pressed «Отправить» on a surface that listed its parts) carries the full package. A new
   field of an event: ask «can it hold an id, a name, a path, an address?» — if yes it is scrubbed by construction
   (it is a string of the event), never exempted.
7. **A STALL IS NEVER SHOWN TO A PLAYER** (the owner, 2026-11-07). The developer's notice is an opt-in, OFF by default;
   nothing else may surface a `[liveness]` line on the game screen.
8. **THE HUB'S TWO TYPES ARE DECLARED TWICE** (`hubTypes.ts` and `electron/diagnosticsHost.ts` — the Electron lane
   compiles without `src/`). Change both in one diff; `tests/electron/diagnosticsHubConform.spec.ts` (via
   `npm run build:test`) fails otherwise.
9. **THE SURFACE IS ONE CARD THAT NEVER MOVES.** A new step of `ConsoleDiagnostics` is laid into `.con-diag`'s cell
   (`position: absolute; inset: 0`), reserves the lines whose words change, adds a segment to the crumb (the tail only
   grows) and its row to the controller's `handleDiagnosticsIntent` (B = one level; a beat absorbs the pad). The e2e
   `console-diagnostics.spec.ts` measures the card's and the cell's box across every step — extend it in the same diff.
10. **LOGIC LIVES IN `diagnosticsSurface.ts` / `diagnosticsNotice.ts` / `diagnosticsView.ts`** — the components are
    templates. Waits are the kernel's (`consoleAppScope()` — the surface is the PAGE's, never a game session's).
    Every string the view-model returns is an English i18n key (+ params); RU lives in `src/locales/ru/diagnostics.json`.
11. **A REPORT PART HAS A BUDGET AND A HUMAN NAME.** A new part is a row of `REPORT_BUDGET` + `gatherReportParts`
    (`reportPackage.ts`), a row of `reportAttachRows` / `PART_LABEL` (`diagnosticsView.ts` — the player is told BEFORE
    the press, in a person's words) and of the table in `docs/claude/diagnostics.md` § 4 and `scripts/diag.mjs`'s summary.

## Where a signal comes from (do not add a fourth road)
| runtime | the road |
| --- | --- |
| the page | `diagnosticsBoot.ts` is the FIRST import of `main.ts` → the interceptor → `DiagJournal` → the transport |
| the main process | `electron/diagnosticsMain.ts` wraps its `console.warn/error`, `uncaughtException`, `unhandledRejection`, `child-process-gone` → `hub.note('main', …)` |
| the game server | `reportServerError` / `installServerDiagnostics` (`serverDiagnostics.ts`) → ONE sink → (embedded) `{type: 'diag'}` to the main process → `hub.note('server', …)` |

## Checks
```bash
npx mocha --import=tsx --require tests/testing/setup.ts tests/common/diagnostics/diagnosticsCore.spec.ts \
  tests/server/diagnostics/diagnosticsHub.spec.ts tests/console/diagnosticsClassification.spec.ts \
  tests/electron/diagnosticsHubConform.spec.ts tests/console/fieldRecorder.spec.ts
npm run test:client:one -- tests/client/diagnostics/diagnosticsClient.spec.ts
npm run build:diagnostics          # the hub's bundle (after touching src/server/diagnostics or src/common/diagnostics)
npm run e2e:remote -- <task> tests/e2e/console-diagnostics.spec.ts
```
