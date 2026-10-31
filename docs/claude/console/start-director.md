# The START DIRECTOR — «правда сервера → одно состояние → один владелец экрана»

The owner, 2026-10-29: the game start must be RELIABLE by construction, not by a growing set of guards. Today the
start's screen is decided by a dozen independent latches (`queueReleased` / `playedDockReleased` →
`effectReturnPending`, the seat chain, `firstAct.stage`, the yields) and enumerated «may the next stage start»
predicates. Each is right on its own; a chain nobody thought of walks between them — PL-1110 («Наследие» in one
predicate and not the other) and the field hang of 2026-10-28 (Strategic Base Planning → Triton, PL-1112) are one
class.

The target: ONE pure function decides WHO serves the screen from the server's one question (+ the presentation's
bounded debts); the motion layer keeps deciding HOW. Every latch that today delays a transition so a beat can finish
becomes an explicit, bounded DEBT — never deleted silently (that is what would cut the motion and cost the premium
feel).

## Phase 0 — SHADOW (shipped 2026-10-29)

`src/client/console/startDirector.ts` (pure, `tests/console/startDirector.spec.ts`):

| Piece | What it answers |
| --- | --- |
| `expectedStartOwner(truth)` | who MUST serve: `waiting` · `wizard` · `queue` · `firstAction` · `bonusAction` · `board` · `step` · `game` — from `waitingFor` alone (start-prompt kind, the bonus marker, the action menu, `space`, the task kind) |
| `actualStartOwner(signals)` | who the latches PUT there: the scene's own `data-start-serves`, the board, a prompt surface (`shell` / `step`), the player's park, a beat |
| `startShadowVerdict` | `agree` · `disagree` · `held` — a beat / park is never judged; a step may be the start's or the shell's; a prompt HELD behind an admission block is judged only over a screen with nothing to do (a reveal to take is the player's own wait) |

`ConsoleShell.startShadowNow` / `startShadowSig` + the `startShadowSig` watcher: a disagreement standing
`START_SHADOW_CONFIRM_MS` (3 s) unchanged, or a hold over an empty screen for `START_SHADOW_HELD_MS` (10 s), is
logged ONCE per (kind, owners, prompt) as `[start-shadow]` with the scene's `__conStartDiag`. **Nothing on screen
changes.** `window.__conStartShadow()` reads the findings; the field export carries the warnings.

e2e: the harness's `startShadowHarvest` files every test's findings under `test-results/start-shadow/` and annotates
the test — DATA, never red. `node scripts/start-shadow-report.mjs <task> [--detail]` groups a run's findings.

**First reading (2026-10-29, the start suite on the box, 101 tests):** zero disagreements; three `held` — all a
reveal standing for the player's take (the rule was narrowed for them). The latches agree with the table on every
path the suite walks; the field's failures live on paths it does not. The shadow ships in the product so the next
field exports name them.

## Phase 1 — THE SHADOW ACTS (shipped 2026-10-31)

The owner (2026-10-31): «не стоит ли тот подход расширить и сделать не только диагностическим, а фактическим, чтобы
убрать другие зависания и неправильные переходы между состояниями?» — yes, in the narrow form that costs the motion
nothing: a CONFIRMED finding is CURED through the doors that already exist, by name, and only when the player is
provably stuck. No latch is replaced (that stays phase 3, under storyboards).

| Piece | What it does |
| --- | --- |
| `startDirectorCure(finding)` (pure) | `heal` — the START must serve (`startOwnsOwner`) and nobody does (`actual: none`): the scene's own doors, `healStrand` (queue / shelf return, the first-action seat, the bonus stage); a door that opens nothing YIELDS. `yield` — the SHELL's surface must serve (`step` / `board`) or the game has begun (`game`) and the start scene still stands: the strand's yield (`startStrandYield`, released on the next prompt). `none` — a `held-long` finding (an admission block's own ledgered debt), and any disagreement the player can act on (a shell surface standing for a start question, a live placement). |
| `ConsoleShell.runStartDirectorCure(finding, by)` | runs it; logs `[start-shadow] cure «heal|yield» by shadow|liveness — …: <did>` (the SAME prefix, so the e2e harvest files it with the findings); idempotent — a cure that changes nothing reports nothing. |
| the shadow's confirmation | the `startShadowSig` watcher cures right after it logs a finding (3 s unchanged, once per finding). |
| the ladder's rung `start-director` (rank 15) | the liveness arbiter re-asks the cure on a STALL with a standing disagreement — before the flows are released with force (20) and long before the stack is sent home (30). |

The first run of the start suite with the director in (2026-10-31, 19 files): ONE finding, no cure — «firstAction → bonusAction» on `console-bonus-nested-first-action` (the corporation's mandatory move INSIDE the bonus window is the bonus stage's own sub-stage); the agreement table now knows it (`startOwnersAgree`). Beware the snapshot trap of that run: a neighbour's `make:css` mid-compress left a 0-byte `styles.css.br` in the snapshot — 22 reds with no CSS at all, none the director's.

What it deliberately does NOT do: undo a yield the strand already made (`actual: shell` — the shell is serving), tear
down a live placement, touch a held prompt (the block's ledger degrades it), or move anything while the shadow agrees.

**Reading a cure in a run**: a `cure` line in `test-results/start-shadow/` is DATA in phase 1 — a latch bug the director
papered over on a spec path; it becomes the next stand (phase 2) before the latch is touched. The start suite's first
run after this phase: see the ledger row PL-1265.

## Next phases

1. **Field data**: the owner's games log `[start-shadow]`; every new shape becomes a stand (a field save → a fixture,
   the recipe in `start-polish-reliability-1` memory) BEFORE any latch moves.
2. **Debts named**: list every latch that delays a transition (room / shelf return, the seat chain, the excursion
   barrier, the stage's off-flush confirms) as a bounded debt the director reads — still in shadow.
3. **Switch one owner at a time**: the director's answer drives `startSceneVisible` / the stage entry for ONE owner
   class per step; each step is closed by the 4K GPU storyboards A/B (before / after) — a visible motion difference
   is a bug, never «by design».
