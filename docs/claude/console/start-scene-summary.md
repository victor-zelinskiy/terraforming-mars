<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. Verbatim, unedited. -->

## Console native mode — the start-scene SUMMARY is the setup's waiting room

The start wizard's final step (`ConsoleStartScene`, mode `wizard`, `currentStep === undefined`) is not just a review: it is where the player SITS while the other players finish their initial picks. Its side rail therefore carries ONE slot (`.con-start__launch`) that morphs (`con-start-launch`, out-in) between two honest states, driven by the PURE `startLaunchState(view, waitingOnPlayers)` (`consoleStartState.ts`):

- **WAITING** (`launches === false`) — somebody else still owes a setup pick: a live per-player readout (`.con-start__wait` — orbit mark + scan sweep + a row per opponent with an animated «выбирает…» ellipsis).
- **LAUNCH** (`launches === true`) — nobody else owes anything, so the viewer's press is the LAST input the game needs and earns the CTA plate `.con-start__beginline`.

**The load-bearing invariants:**
- **The confirm is NEVER hard-gated on the other players — only its VERB changes** («Submit your choice» → «Begin the game»). Two humans sitting on their summaries are BOTH pending *for each other*, so a gate would leave them waiting on one another forever. `startLaunchState` says so in its own doc comment; the guard is `consoleStartState.spec.ts` ("two humans on their summaries are BOTH pending").
- **The launch is A (`primary`), never a trigger.** RT/RB stay STEP navigation and deliberately stop AT the summary — the biggest press of the setup must sit on the control every other console surface confirms with. The zero-projects `armedSkip` warning still arms on the first press.
- **`waitingOnPlayers` is threaded App → ConsoleShell → the scene / the status strip** (mirroring the desktop DraftFlowOverlay / StartGameFlowOverlay). It is load-bearing: while the viewer holds the `initialCards` prompt the playerView is deliberately NOT refreshed (it would drop their partial picks), so the model's `isWaitingForInput` snapshot goes stale and ONLY the poll can tell that an opponent has since submitted.
- **⚠️ An EMPTY live list means "the poll has not landed yet", NOT "the server is waiting on nobody".** The poll is timer-armed (and stretched to `LONG_POLL_MS` = 20 s while the realtime socket is healthy), so every consumer holds its `[]` default for the first seconds — and `actionLabelForPlayer` cannot tell that apart from "everyone is done", which flashed the launch CTA while everyone was still choosing. **Normalize through the shared `liveWaitingSignal(list)` (`playerLabels.ts`) at every call site that passes the poll into `actionLabelForPlayer`.** Consequence: the waiting→CTA morph is only as fresh as that poll (≤20 s WS-healthy) — acceptable precisely BECAUSE the confirm is never gated.
- **Status text is the SHARED brain** (`actionLabelForPlayer` + `presentPlayerStatus` — the same one the top strip reads, which is why the strip takes the poll too now). The rail and the strip must never disagree about who is still choosing; the rows reuse the existing `Initial pick` / `Done` keys rather than coining new ones.
- MarsBot is never given a `waitingFor`, so it is ready from the first frame: a bot game opens straight on the CTA and the waiting state correctly never shows.

Guards: `consoleStartState.spec.ts` (the launch readout: bot / solo / another human / un-landed poll / live-poll-wins / the no-gate invariant) + `tests/e2e/console-start-summary.spec.ts` (drives a real bot game AND a real two-human game: the A CTA, the zero-buy double-confirm, the waiting readout naming the opponent, and the live morph).


## The buy price that is not 3 M€ — a hint names WHO set it (R14 Terralabs Research, 2026-10-23)

Every purchase surface prints the honest number — the start scene's quick chip «Проекты N × цена» and the summary's «Проекты: N × цена» (`cardCostForCorp` + the campaign's `cardCostDelta`, i.e. `ClientCard.cardCost`), the draft / research wallet «N × цена = −M» and the fallback buy sum (the server's `thisPlayer.cardCost`). None of them used to say WHY the number is not 3. The answer is a `data-hint` on the «× N» those rows already print (`.con-price-hint` — `.premium-tooltip()` on an element the row already had: no box, no line, no geometry), present ONLY when a source exists — «Цена покупки карты: 1 M€ · TerraLabs Research» (Polyphemos 5 · Quantum Research −1 · two corporations by Merger are both named).

- **One module, two readings** — `console/purchasePriceSource.ts`: in play the sources are the SERVER's (`PublicPlayerModel.cardCostSources` ← `IPlayer.cardCostSources`: every corporation whose printed price replaced the base + every tableau card with a purchase discount — Quantum Research's −1 is a server hook the client cannot see); before the corporation is played (the start scene) they are the pick and the campaign lineage whose `ClientCard.cardCost` is not 3. The client computes no price — it names the cards behind the number it was given.
- **Never a line**: the corporation's face already prints «[карта] : 1 M€», and the reading row never repeats the face (`status-line-no-face-restatement`). The hint is the one place the source is said.
- ⚠ A hint is a hover / `.gp-focus` affordance, and the wallet is not a cursor stop — a pad player sees the number, not its source. Raised with the owner (decision 3 of the R14 prompt).

Guards: `tests/client/console/purchasePriceSource.spec.ts`, `draftReadingModel.spec` § the wallet, `tests/cards/turmoil/TerralabsResearch.spec.ts` § rule 2 / 3 (the sources on the model); e2e `console-terralabs-research` (A the start scene · B the research buy · C the buy after a draft).
