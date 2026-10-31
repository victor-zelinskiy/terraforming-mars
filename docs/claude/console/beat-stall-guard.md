# The beat stall guard — a machine beat with nothing in flight is a stall

Introduced 2026-10-31 after the owner's field freeze: the law «Финансирование исследований» (RX26 R&D Funding) used
to repeat the action of «Защита от астероидов» (Asteroid Deflection System) froze the screen. The pad was absorbed and
no prompt appeared. Only a reload got the player out, and the F12 export logged nothing.

Code: `src/client/console/workspaceBeatStall.ts` (pure rule + surface reports) · `ConsoleShell.checkBeatStall` /
`recoverStalledBeat` (1 Hz sampler + recovery) · `ConsoleCardActions` `'workspacePhase'` watcher (report).
Guards: `tests/console/workspaceBeatStall.spec.ts` (the rule), the e2e harness fixture `beatStallGuard`
(`tests/e2e/consoleTest.ts` — every spec is red on `[workspace-stall] beat`).

## 1. The freeze, root cause

A copied action reaches the card-actions workspace through two doors. One is a card's (Viron, in `onComposerConfirm`).
The other is a law's (R&D Funding, in `confirmPoliticalAction`). Each door wrote its own outcome claim:

- **Viron's door:** a copied deck-check went to `beginRepeatReveal`. That opens the in-frame verdict stage with the
  composer re-pointed at the copy, because `lastReveal.action` names the card that RAN.
- **The law's door:** it took `branchOutcomeClaimPlan`'s kinds whole. That is `['deck-check']` for a reveal branch. It
  then opened the PENDING stage, and the pending stage can only present drawn cards.

So the verdict was CLAIMED, which kept the standalone presenter away, and drawn NOWHERE. Every net looked away:

| net | why it did not fire |
| --- | --- |
| claim backstop (20 s) | refused by the release funnel: the claim serves an unacknowledged verdict |
| owed-conclusion force net | arms only once the flow REPORTED finished; its ghost gate demands «nothing served» |
| leak detector | `.con-cardactions` counts as a serving surface |
| foreground watchdog | acts only on the board home |
| awaiting-handoff safety (6 s) | the «claimed in frame» path clears it, so the claim's nets are all that is left |

Reproduced on the box before the fix (`console-parliament-rdfunding` § DECK-CHECK, fixture
`parliament-rdfunding-reveal`): «ДОБОР КАРТ · Берём карты из колоды…» forever.

**Fix.** ONE function, `ConsoleCardActions.claimRepeatOutcome`, serves both doors. It decides the claim and the
stage TOGETHER:

- a copied deck-check goes through the reveal door;
- copied cards go to the pending stage, scope `chain`;
- a deck-check is never claimed into the pending beat.

The same mismatch one door over was found by the audit and fixed there too: **Dutch Mountains** claiming Hydronetwork
stage 7 to copy Search For Life / Asteroid Deflection used to merge the stage's `deck-check` into a pending claim. It
now takes the reveal door as well. Client unit guards are in `consoleRepeatPickFrame.spec.ts` § one claim for every
repeat door.

## 2. The rule (the class, not the case)

A TRANSIENT beat (`executing` / `completing`) is honest only while something is IN FLIGHT behind it:

- the transport's request,
- a blocking animation hold (every cinematic registers one, with its own named ceiling),
- the awaiting handoff,
- an owed commit fold.

A beat that stands `WORKSPACE_BEAT_STALL_MS` (12 s) with nothing in flight and the same server prompt is a stall,
whatever its cause.

- **Only the DEEPEST live frame is judged.** The guard does not judge a stack that is parked or yielded to the board,
  a live placement, or a frame with a step nested above it.
- **`committed` / `verdict` are never judged.** The player acts on them.
- **Where the phase comes from:** the stack frame's phase, or a surface report for a workspace whose phase is
  DERIVED inside the component. Card-actions reports through `reportSurfaceBeat`. A new surface with a component-local
  phase reports the same way.

**Recovery names itself.** The shell warns:

`[workspace-stall] beat «<kind>:<phase>» stood Ns (… last in flight …) — claim: host/card [kinds] stage scope; serving; prompt — forcing teardown`

It then tears the workspace down through the force path the owed-conclusion net already used
(`forceRecoverStuckWorkspace`). The claim is released with force, so a held verdict falls to the standalone
«Результат вскрытия» overlay: the result is still SEEN. Finally the player gets one notice: «The screen was stuck and
has been released». This was proven on the box against the unfixed door: the stall was caught at 12 s, the verdict was
shown standalone, and `A ОК` worked.

## 3. The audit (2026-10-31)

**Outcome claim vs stage — every `claimWorkspaceOutcome` site.** On card-actions a `deck-check` claim needs
`outcomeFlow = 'deck-check'` on the acting card. Every other host re-homes the shared overlay. Results:

- CONFIRMED and fixed: the two items in §1 (R&D Funding, Dutch Mountains stage 7).
- PLAUSIBLE, not a hang: RX36 Live Experiments playing a card through the law's play slot claims nothing for the
  card's draws or a Project Inspection verdict. They arrive standalone, which breaks the «result inside the
  workspace» rule but does not freeze.
- PLAUSIBLE, cosmetic: the repeat/political doors open `pending` at once, even where the direct path waits for the
  rail half (`armedRailLandsOnRow`).
- OK: Viron, Project Inspection from the hand, staged plays, every hydro door, colonies, start, adoption.

**States that absorb input without a ceiling.** The new guard now covers card-actions `pending` / `deck-check`
without a payload, `composerExecuting`, and the stack frames' `executing` / `completing`. It still does NOT cover:

1. **The transport.** `isServerSideRequestInProgress` has no ceiling. The submit `fetch` has no timeout, and about 20
   awaited cinematic gates have no outer bound. While it stands, a submit is DROPPED with only
   `console.warn('Server request in progress')` (the owner's log of 2026-10-31 has one at 00:54:59), and the
   mid-prompt refresh and the `view-freshness` witness are suppressed. The next iteration: a named, bounded ceiling
   per gate.
2. The Parliament's parked submit (it inherits the transport's lack of a ceiling).
3. The shell's own `handleIntent` gates (scenes, alert, colony locks, played hero, deck draw) are each bounded by
   their own safety, unverified one by one. A cheap catch-all would count swallowed presses while the transport is
   idle and no hold stands.
4. A composer-local `submitting` while the phase still reads `configure`.
