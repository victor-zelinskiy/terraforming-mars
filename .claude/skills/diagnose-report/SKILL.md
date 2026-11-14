---
name: diagnose-report
description: Triage a player's problem report (a code like TM-K7QW3D), a Sentry issue, or «what broke on the box» for this Terraforming Mars fork — fetch the evidence with `npm run diag`, read it in the right order, find the cause in the code, and say what to fix. Use when the user gives a report code, asks what failed on the box / in Sentry, or asks to pull diagnostics from the Steam Machine.
---

# Diagnose a report — Terraforming Mars (vize1215 fork)

The game records every error and every stall of the screen in its own journal, sends what failed to Sentry (EU), and
lets a player send a REPORT — a package of everything needed to understand and reproduce a problem — that ends in a
code like `TM-K7QW3D`. This skill is how an agent turns that into a cause. Contract of the subsystem:
`docs/claude/diagnostics.md` (read § 2–4 once: the record, the kinds, the package).

Everything is ONE tool: `npm run diag -- <command>` (`scripts/diag.mjs`; it uses the authorised `sentry` CLI of this
laptop, or `SENTRY_AUTH_TOKEN`). In the Bash tool first: `export PATH="$APPDATA/fnm/node-versions/v24.20.0/installation:$PATH"`.

## 1. Get the evidence

| the user said | run | you get |
| --- | --- | --- |
| «разбери отчёт TM-XXXXXX» | `npm run diag -- report TM-XXXXXX` | `.diagnostics/reports/TM-XXXXXX/` — every file of the package + `SUMMARY.md` (printed) |
| «разбери последний отчёт» | `npm run diag -- report latest` | the same, for the newest report |
| «что упало на боксе за сегодня» | `npm run diag -- issues --env box --since 24h` | the issues, newest first; then `npm run diag -- issue <shortId>` for each that matters |
| «что падает у игроков» | `npm run diag -- issues --env production --since 7d` (add `--kind error` / `--kind stall` / `--family liveness`) | the same |
| «вытащи диагностику с бокса» | `npm run diag -- box pull --since 24h` | `.diagnostics/box/<stamp>/` — logs, report folders, field log, console exports, hang traces — with a digest |
| «проверка связи дошла?» | `npm run diag -- selftest` | per runtime: arrived? stack resolved to sources? |
| an automatic event names `seat_ref p#…` and you need the save | `npm run diag -- box resolve p#…` | the seat id and the save file on the box (only for games the box hosts) |

`.diagnostics/` is git-ignored. A report package may hold the players' names and the game's save — treat it as
private: never paste a save or a name into anything that leaves the laptop.

## 2. Read it in THIS order (stop when you have the cause)

1. **`SUMMARY.md`** — the category the player chose, their words, the record the report was opened from, the journal's
   digest. The player's words say what they SAW; the journal says what the game KNEW.
2. **`journal.json`** — every record with its full text. Kinds: `error` (an exception — read its `stack`; frames are
   resolved to `src/…:line` for release builds), `stall` (the screen stood: a liveness `episode` has `steps` — what the
   arbiter released, in order — and `state` healed / unhealed), `integrity` (the picture disagreed with the truth),
   `perf`, `note`. Each record's `screen` is what the screen was doing at that moment (the server's question, the
   workspace stack, what was in flight, what held the question).
   - An `error` shortly BEFORE a stall is usually its cause (an exception in an async beat leaves its flow half-way).
   - A liveness episode names the owner in the rung's own words — fix THAT module, never add a rung
     (`.claude/rules/console-flow.md`; `docs/claude/console/liveness-arbiter.md`).
3. **`field_record.json`** — the heartbeat ring: the screen second by second before the press (`prompt`, `accepting`,
   `inFlight`, `frames`, `quietS`, `block`, `flow` — the kernel's tree once the picture stood 2 s). A scope whose age is
   out of proportion to its name IS the finding (`docs/claude/console/architecture-v2/REVIEW.md` § 6).
4. **`console_export.txt`** — opens with three digests: ERRORS, STALLS (each with its time-to-cure), SCREEN. Read the
   digests, then search the body around the timestamps the journal gave you.
5. **`screen.jpg`** — the frame BEFORE the menu covered the game: what the player was looking at.
6. **`save.json`** (only when the reporting device hosted the game) — the game's state. To reproduce: load it through
   the dev loader (`POST /api/dev/load-game`, the road `bootFixture` uses — `.claude/rules/tests.md` § STATE IS
   DECLARED) and drive the same prompt. `report.json` has `saveGameId` and the seat's id.
7. **`log_*.txt`**, **`hang_trace.json`** — the main process and the game server (a `server-error` record's stack is in
   the journal already); the trace opens in ui.perfetto.dev and matters only for a `renderer-hang`.

## 3. From evidence to cause

- Resolve the frame to the file and READ the code there before forming a theory. `head` (a tag, and in `report.json`)
  is the commit of the build — `git show <head>:<path>` when the line no longer matches.
- Reproduce cheaply first: a unit / integration spec at the failing function with the state from the save; an e2e only
  when the bug cannot be reproduced otherwise — and then on the Steam Machine (`npm run e2e:remote`), never a local
  browser.
- Check whether it is one incident or a class: `npm run diag -- issues --family <family> --since 14d`.

## 4. Answer the user

Lead with the cause in one or two sentences, then: the evidence that proves it (the record, the frame, the heartbeat —
quote the few lines that matter), where it is in the code (`file:line`), what the fix is and what guards it, and what
you could NOT establish. If the evidence does not reach a cause, say exactly which piece is missing (no save because
the game was hosted elsewhere; an unresolved stack because the build was local) and how to get it.
