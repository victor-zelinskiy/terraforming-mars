# THE COMPOSER PRE-SELECT — one cursor rule, the commit arrives, a sole target is seeded, shown and marked

T14 Supported Research · ledger section **CC** (2026-10-22). The owner's words: «after a choice the focus must go to the
next element waiting for a choice, or to the play / activate button — and the player must SEE that the next press
launches the move»; «when the target has ONE option there is no choice — the composer pre-selects it, the player sees
where the resource goes and what changes, can press and see the one option; mark it, premium, quietly». The law's
short form: `.claude/rules/console-ui.md` § A COMPOSER PRE-SELECT. Applies to the THREE composers — the card play
(`ConsolePlayCardConfirm`), the card action (`ConsoleActionComposer`), the party / law action
(`parliament/ConsolePartyActionComposer`). The task host, the wheel, the standard projects and the bot's turn review
keep their own grammars.

## Why (the diagnosis, file:line on `2e15e0f06d`)

* **Three composers, three landing rules.** The play composer walked to the first open row (`firstActionableIndex`)
  except after a VARIANT, where the cursor stayed on the tile; the action composer re-seated the cursor on open
  (`commitCursorTarget`) and in four hand-written `focusIdx = ctaIndex` bridge callbacks — one of them stood the cursor
  past the last row while another question still waited — and left it on the answered row after its seven sub-pickers
  (`sub = undefined` → `scrollFocused` only); the party composer counted its own `cursorRow`. «Smart focus works in
  some cases» was exactly that.
* **The commit never arrived.** The cursor landing on the commit row was the same ring as a walk onto it; nothing said
  «the next press is the move», and a press by inertia (a double press, a held button through a transition) went
  straight through — the rule «choose and play are two presses» rested on the cursor NOT moving after a variant.
* **A decision with nothing to decide cost two presses.** A target with ONE candidate opened empty (`seedChoice` —
  «NEVER auto-selected — not even a lone candidate»): A → a step / album / list of one → A → back. Invariant 3 («no
  auto-select») is about the SERVER applying a target silently; a composer row the player sees is a pre-select.

## 1 · ONE CURSOR RULE (`consoleCommitGate.nextCursorAfterAnswer`)

```
nextCursorAfterAnswer(gate, commitIndex, offered?) → CursorLanding | undefined
  incomplete / stale  → {question, blocking.index}     a requirement holds the commit
  ready / blocked     → {offered, offered}             a deferrable question not yet visited (play composer only)
  ready               → {commit, commitIndex}          nothing left to ask, the commit runs — the ARMED arrival
  blocked             → {held, commitIndex}            nothing left to ask, the commit cannot run — the row says why
  submitting          → undefined                      frozen while the press is in flight
```

Every composer has ONE `landCursor()` and calls it from every answer: a pick from a list / the album / the table / a
player; a variant (decision 3 — the variant is an answer like any other); «Далее» on a dial; the payment's «Готово»; a
decline (RT); a bridge's answer (repeat, Hydronetwork reward, blockade, landing, espionage); the open (with
`opening: true`); a refetched preview that moved a seed. B never lands — it is one level back, and the cursor returns
to the row it opened. A pointer click places the cursor where it clicked (`pointCursorAt`) — a placement, not a
landing.

Per composer:
* **Play** — the gate's questions OUTRANK a payment that does not cover yet (`cursorLanding`: the landing is asked of
  the requirements first; the shortfall is fixed ON the commit row — A opens the editor — so it is the commit row's
  reading only once nothing is left to ask); the table question that may wait for a draw is the `offered` row.
* **Action** — a REFUSED branch is no requirement any more (the play composer's rule): the first landing is a tile the
  player can press. The `commitGateKind` watcher re-lands through the same rule (a stale target, a variant switch) but
  never moves the cursor for a `held` landing.
* **Party** — `pactGate` (its decision rows, the commit last) feeds the same function; the d-pad no longer reaches the
  commit row while a decision is open (`commitAcceptsCursor`, the other two composers' law). A law's SLOT row is
  answered by its bridge, a law's «resource onto a card» rows by their picks (`rowAnswered` — the slot reading had
  left RX37's kind row «open»).

## 2 · THE COMMIT ARRIVES (`console/commitArrival.ts`)

A landing of kind `commit` is an ARRIVAL: `arriveAtCommit(record, root, {opening})`.

* **Painted, not assumed.** The pose may still be held by an arrival gate — the composer's root (a late preview's
  cascade) or the band around it (its entry) wears `[data-cursor-pending]`. The record watches that attribute leave
  (`MutationObserver` on the gate — the release IS the signal, never a timer) and stamps `paintedAt` one probe tick
  later.
* **The inertia gate.** A deciding press on the commit row is ABSORBED (`commitArrivalAbsorbs`) before the paint,
  within `COMMIT_ARRIVAL_ABSORB_MS` (200 — the ring's clock and a frame) after it, and — on an open whose every answer
  was seeded — inside the decision family's first settle (`SETTLE_FIRST_MS`, 300: the A that opened the composer is
  never the A that plays the card). The input observer has already posed the cursor by then (`releaseCursorsOnInput`
  runs before the handler) — the press IS the arrival. Only the PAD is gated: a mouse click on the commit row is a
  deliberate press. The cursor walking onto the commit row by the d-pad is no arrival and absorbs nothing.
* **One breath — «взведено».** On the paint the commit row's `data-composer-armed` stands for one breath: the ring
  layer's halo inhales and settles (`@keyframes con-commit-armed` — the keyframe names only the middle, the state's own
  paint is both ends and the list keeps its [inset, outer] shape, so it interpolates); the attribute leaves on its own
  `animationend`. The party composer breathes its hand-painted ready ring (`con-pact-commit-armed`, the Reds' red row
  does not breathe). Reduced motion: no breath, the inertia gate stays.
* **One verb.** The bar reads the commit row's own verb: the play's `playCommitVerb(door)` («Разыграть карту» ·
  «Разыграть на поле» · «Выбрать резолюцию») — the bar's «Разыграть» was a shorter second promise; the action's
  `commitVerbKey` («Подтвердить выполнение» — the bar's «Подтвердить» likewise).
* **The harness waits it out.** `__conCommitArrival()` publishes the window (`commitArrivalDiag`); the e2e driver's
  `awaitDecisionSettled` waits for it before any deciding key, as it waits for the decision settle — a driver press
  inside it is a press the player could not have made. A spec that ASSERTS the absorption presses raw.

## 3 · THE SOLE CANDIDATE (`consoleActionComposer.soleCandidateOf`)

| The step | Seeded? | Why |
| --- | --- | --- |
| a card target with ONE enabled candidate (on the table, in the hand, inline) | **yes** | the server offers one answer |
| a self-target (the hero is the only candidate) | **yes** | the handle row («↰» + the tag) |
| one enabled beside a disabled one (Pharmacy Union's grey) | **yes** — the enabled one | the grey one is shown with its reason |
| a player target with ONE candidate (an attack with one rival) | **yes** | the row reads who loses what (`current → resulting`) |
| the party / law «resource onto a card» with ONE holder | **yes** (after the kind) | `seedSoleTarget` |
| TWO+ enabled candidates | no | a choice |
| an OPTIONAL choice (the `skip` marker, a card pick of `min 0`) | no | declining is the second real answer (RT) |
| a lone candidate that is DISABLED | no | its reason holds the commit |
| a RANGE / multi pick (`max > 1`, a multi-select's count) | no | how many is a decision |
| a table question (`reaction`) | no | another card asks; its row has its own deferral states |
| a repeat slot (Viron, Project Inspection, R&D Funding) | no | its answer is ANOTHER card's composed action |
| a Hydronetwork landing / stage reward / blockade / espionage | no | not a target of this card |
| an `or` door (a list of options) | no | (a lone-leaf door is a documented gap — see §6) |
| a board placement | never a composer row | the follow-up stays |
| a hand pick whose only candidate is the card being played | — | 0 candidates: the follow-up, as before |

The seed is the SAME capture a press would write (`{type: 'card', cards: [name]}` / `{type: 'player', player}`; a
played-target seed also writes the `PlayedTargetResult` off the same step model), plus `seeded[choiceId] = 'sole'`.
The batch posts it ADDRESSED like any pre-select (`preselectWitness` turns a re-ask red). It is re-read when the
candidate set moves: a refetch of the SAME shape (`samePreviewShape`) runs `reseatSeeds` — a seed whose candidate left,
or is no longer alone, lets go (the row is open again, the cursor goes to it); a row that has just become a sole
candidate is seeded. A variant switch keeps the play's own `pre#` seeds (`keepPlayAnswers`). The staged-play round
trip carries `seeded` in its draft.

**The row is SHOWN answered** — the target row's miniature, owner, tag and readings; a player row's name and its
change — and **MARKED**: «ЕДИНСТВЕННАЯ ЦЕЛЬ» / «ЕДИНСТВЕННАЯ КАРТА» (a hand pick) / «ЕДИНСТВЕННЫЙ ИГРОК» in the row's
tail (`.con-tgtrow__sole` / `.con-composer__sole` — tracked caps a step under the row's words, a hairline mint kant, no
ring of its own; `data-hint` «Других целей нет» through `.premium-tooltip()`). **A on the row still opens the choice**
(the step / album / list of one); B keeps the seed. The cursor goes past it — a seeded row holds nothing up.

## 4 · Hooks (e2e contract)

`[data-seeded="sole"]` on the seeded row (target row root, generic row, the party's target row) · `[data-seeded-mark]`
on the mark · `[data-composer-armed]` on the commit row during its breath · `__conCommitArrival()` on the window.

## 5 · Guards

* `tests/client/components/console/consoleCommitGate.spec.ts` § nextCursorAfterAnswer (the table) · § commitPressAbsorbed.
* `tests/client/components/console/consoleActionComposer.spec.ts` § soleCandidateOf (one `it` per row of §3).
* `tests/client/components/console/composerRender.spec.ts` § one cursor rule… (seeded + marked + the arrival; the
  inertia press; A opens the one-card list, B keeps the seed; two candidates; two questions; a variant with nothing
  after it; a seed that leaves on a refetch).
* `tests/client/components/console/ConsolePartyActionComposerResource.spec.ts` (one kind + one holder: both seeded).
* `tests/console/composerCursorRule.spec.ts` (server runner) — no composer lands on its commit row by hand; each one
  routes through `nextCursorAfterAnswer` / `landCursor` / `arriveAtCommit` / `commitArrivalAbsorbs`.
* e2e `tests/e2e/console-composer-preselect.spec.ts` (TIMING — the stand: K · A · B · C · D · F · G · H).

## 6 · Gaps (named, not silent)

* **A door `or` with one hostable leaf that is itself a sole pick** is not seeded (the composers' or-descent writes
  three records — `orDescents`, `picks`, the nested capture — and a seed through it is its own change). The leaf is one
  press away; logged in the ledger.
* **The colony pick of a staged colony door** (`SelectColony` beside the composer) is the colony workspace's own stage,
  not a composer row — out of this iteration's scope.
* **A repeat slot with one repeatable card** stays a slot: its answer is the repeated card's composed action.

## 7 · A TABLE'S ANSWER TO A WALK OF THE CAREER is ONE row — seeded, laid out, or not asked at all (TR78 Arwind Inc., 2026-10-28)

A table question is never seeded (it is routinely optional — a decline beside it) — EXCEPT a corporation's answer to the walk of the
Career the card being played makes (`agendaWalkPrompt` on the prompt — the pick's `SelectCard` or the layout's `and`): a MANDATORY
target, ONE row for the WHOLE walk (the owner, 2026-10-28 — never one row per step):
- the corporation ALONE holds the kind → no row at all: the forecast is `exact` («+N [fighter] on this card»), the server lands the units
  with the play, the walk's answer stage plays the receipt;
- a second holder and ONE unit → the pick's row, seeded with its sole holder exactly like the card's own target (`soleCandidateOf` reads
  the marker) — a real choice of two opens unanswered;
- a second holder and SEVERAL units → the LAYOUT row (`ComposerChoice.kind === 'distribute'`, `distributionLanesOf`): a lane per holder
  (its miniature, its count «current → resulting», the units placed), ←→ between lanes, LB/RB one unit, RT the rest — the row holds the
  commit until the sum is exact (the layout opens EMPTY: a filled default is an auto-select) and captures ONE `and` answer
  (`cardResourceDistributionResponse`), addressed to the corporation.
The batch carries the one addressed answer; the server lands it on its own prompt. e2e: `console-arwind-inc` (A · A2).
