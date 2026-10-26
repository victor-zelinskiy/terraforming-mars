# «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the card-reaction scene (as built, 2026-10-26)

A printed effect of a card on the player's table fired because of something the player did — a green card with
a tile was played (TR80 Hartlan Heating), a city landed (Tharsis Republic, Rover Construction, Immigrant City,
Pets), a tag was played (Point Luna) — and the player SEES which card answered and where the resources came from:
the card comes forward, its tokens are born on the printed icons of ITS effect row, they fly to the rail, the
counters tick on the touchdowns, the card recedes. Fast, in groups, under a wall-clock ceiling, and never slowing
the scene of the play itself. Before this iteration the console had three «rises» that did not know each other
(the assembly scene's trigger, the banner stage, the asker's plate), a fourth inside the receiving stage, and the
table's answer was born anywhere but on the card that paid: on the played card's TAG (T06), on the composer's
«Сработает» CHIP (PL-220), on the scale's marker, or it simply ticked (a board placement, a single-trigger draw,
every corporation in most hosts). The owner, 2026-10-26: «стандартизировать под новый фреймворк».

## The laws (a violation is a bug)

1. **The record is the SERVER's — `GameModel.cardReactions`.** The event recorder publishes ONE
   `CardReactionRecord` per passive-effect scope that produced an impact (`EventRecorder.recordReaction`, on the
   FIRST impact; every later impact of the same scope — a deferred gain restored under it — is appended): the
   reacting card and its kind, the channel the hook fired on (= the forecast fact's `source.channel`), the root
   (the chain's `correlationId` — the SAME id a draw batch's `actionId` carries), WHAT WOKE IT (`cause`: the played
   card, the tile and its cell, the tag, the scale — stated by the trigger site through `withEffect(…, cause)`), and
   what landed in order with its recipient. The `scaleStepRewards` ring law: bounded (16), never serialized,
   consumed once by `seq`. A hook that only logged leaves no record. The client never infers «Hartlan fired» from
   a counter's delta, and every viewer reads the SAME record (the rival sees the same scene on their screen when
   their own table reacts). The forecast stays what it is — the PROMISE before the press («Сработает», the R3
   layer, the prewarmed faces); the record is the TRUTH after it.
2. **ONE predicate for «a card that places a tile»** — `server/cards/cardPlacesTile.ts`: a declarative
   `behavior.tile / city / greenery / ocean` ∪ the co-located `placesTile: true` of a bespoke placement. Hartlan's
   live hook, its forecast twin and the worklist guard (`tests/cards/greenTilePlacers.spec.ts` — every playable
   card of the scope, the predicate ⇔ the play preview's placing step) read the same function, so the promise and
   the gain agree BY CONSTRUCTION. Never the forecast's `ctx.tiles` (the OPERATION's tiles: clamped at the ocean
   ceiling, split by branch).
3. **ONE rise primitive** — `console/cardReaction/cardReactionStage.ts` `riseReactor` / `recedeReactor` (alpha
   0 → .94, y +14 → 0, `power2.out`; the recede the reverse) with the assembly scene's numbers byte for byte
   (260 / 150 / 220, overlap 140; reduced 140 / 60 / 120 / 60 — pinned against `intakeAssemblyTimings` in
   `cardReactionModel.spec`). The assembly scene's trigger rises through it too (`intakeAssemblyDirector`). A card
   that stands in the RECEIVING STAGE rises OUT OF ITS PLACE instead (`emergeTarget` — TR53 «the card comes out of
   its PLACE»; the stage publishes `holdsCard` / `emergedFaceEl` through its hooks); everything else surfaces at a
   SEAT of the app-level layer (`ConsoleCardReactionLayer.vue`, `.con-reaction__face[data-reaction-card]`).
   Invariant 15: transform and opacity only — no halo, no filter, no breathing.
4. **The token is born on the REACTOR's effect row** — `effectIconEnds.resolveEffectIconEnds(face, printedEffect,
   specs)`: the declared block (the card file's `printedEffect`, the n-th EFFECT frame in print order — never an
   action frame), else the frame that PRINTS the token's resource, else the whole face; the icons by the ONE icon
   grammar of every commit beat (`resolveGainIconEnds` — the k-th token on the k-th icon, a production step on its
   plate), as OBJECT ends re-measured at the birth (T06). A face that prints no such icon births nothing — that
   token ticks, by name (`cardReactionState.degraded`). THE CAUSE IS MARKED, NOT A BIRTH PLACE (the owner's
   decision 2): the played card's tag / the composer's chip wears a one-shot kant (`[data-reaction-cause]`,
   `con-reaction-cause` — a `@keyframes` that ends on its own) while the token is born on the reactor.
5. **The seat is beside the RECEIVER** (the owner's decision 7) — `reactionSeatRect(stage, receiver, avoid, height,
   slot)`: right of the rail (the left hull member), centred on the receiving row (a holder's satellite cell for a
   card resource), a card-shaped box of a reading size (≤ 22 % of the stage, ≤ 320 px × uiScale), sliding past the
   hero, the composer's focus card, the reveal's row, the start stage and the emergence layer (down, then up),
   the top-right corner at a reduced size when nothing is clear; the second seat stands below the first.
6. **Two shapes, one director** (`cardReactionDirector.ts`): **ATTACHED** — a host already HOLDS the reaction's
   rows (the play scene's rail half, the action commit's — the table's answer promised by the forecast and
   verified against the two views) **and DECLARED them** (`declareHeldAnswers` in the same apply block — the rail
   module's `seedRailReward` for its verified reactions, the hero's PL-035 `holdHeroAnswers`; the seeder takes the
   ledger once per block): a host's OWN promise on the same row is never mistaken for the reaction's share (the
   first field run: a standard project's +1 M€ production absorbed Tharsis Republic's, which then ticked unseen
   under the placement scene's release — `cardReactionDirector.spec` § own promise). A holder's cell keeps the
   raw-hold attribution (the hero's card half and the board's cell scene hold AND fly those themselves). The host
   asks `cardReactionAnswerFlight()` and gets a `RailAnswerFlight` whose
   `prepare` rises every claimed reactor (out of its place or at a seat, 80 ms apart), whose `tokensOf` splits a
   held row into the RECORDS' shares (a wave of six off the printed heat — `reactionTokensOf`, cap 6; what no
   record names keeps the tick), whose `originOf` births each on its group's effect row, whose `onDone` recedes
   the faces; the rail module keeps its holds, its order and its release (`answerRailReward` awaits `prepare`,
   re-holds the split tokens, calls `onDone` once). A host composes it over its old flight
   (`composeAnswerFlights(reactor, tag | chip)`): the hero's `heroAnswerFlight` and `answerHeroAfterWave`, the
   action rail's `flyActionCommitRail`. **STANDALONE** — nobody holds the rows (a standard project's city, a
   reaction with no host scene): `seedCardReactionHolds` (LAST in `gameTransport.seedRewardHolds`, after every
   host, with the rail holds snapshotted BEFORE them — `snapshotRailHolds`) holds the viewer's own rows and the
   holders' cells in the apply block and plays the chain after the board's own story (`waitRewardPayoutQuiet`):
   rise → hold → birth on the effect row → fly → tick on touchdown → recede, group after group.
7. **The chain is a PLAN with a ceiling** (`planReactionChain`, the owner's decision 4): groups in the server's
   order; the next rises `overlapMs` before the previous group's last landing on the OTHER seat (two faces never
   share a box — two seats from the second group on); from THREE groups the chain quickens (`pace` 1.35); a group
   whose rise would start past `REACTION_CHAIN_CEILING_MS` (1.8 s) is not risen: its counters tick at once and its
   name stands on the state (`data-reaction-summarized`); the play's own scene never waits for the chain beyond
   its own tempo (the attached flight is the hero's answer beat; the standalone chain plays after the board's
   story). **A / B hurries** (`hurryCardReactions` — the hero's result skip calls it): whatever is left ticks at
   once, the faces let go.
8. **The hold is notification-only and bounded** (`card-reaction`, the registry's ceiling with `expire` → abort):
   a reaction never holds a question. Reduced motion claims the records and holds nothing (the counters tick with
   the commit). **And the chain's rows SURVIVE a foreign scene's belt-and-braces clear** — the tile scene's
   `clearPanelRewardHold()` «safety» at its end (the start bonus's, the hydro marker's, the nomads' too) drops every
   hold on the board, and on the first field run it ticked Tharsis Republic's 3 M€ a beat before its tokens were
   born: the director is a `registerRewardHoldKeeper` (the `vpHoldKeeper` precedent, TR55) — the clear re-seeds
   what the chain still holds, held TOKEN BY TOKEN (`entry.held` is exactly what has not touched down), released
   by each touchdown, by A / B (the queue AND the batch in flight) or by the ceiling.
9. **PL-124 on the framework**: a holder that pays ITSELF on its own hook (Decomposers' microbe) has emerged — its
   token is born on ITS effect row (`originsOnHolder`), the woken tag marked; a holder whose face prints no such
   icon keeps the T06 birth on the tag.
10. **A single hook's draw rises its trigger too** (the owner's decision 5): `intakeAssemblyPresentsBatch` — a
    one-cause batch whose cause is a card NOT on the stage goes through the assembly scene (the trigger surfaces
    beside the row and deals from its printed draw icon) instead of degrading to the deck; the claims and the parks
    keep judging by `intakeAssemblyOwnsBatch`.

## What this iteration did NOT migrate (named, honest)

**A STAGED play's reactor rises at a SEAT, never out of its place.** Every green card that places a tile — every
card Hartlan Heating answers — is a staged play (the cell pick is the last reversible step): the hand's landing
ritual runs BEFORE the cell confirm with no reward beat (`runStagedPlayedLanding` / `finishStagedPlayedLanding`),
the card is SEALED on the board, and the response's hero is inactive — so nobody declares the table's answer and
the record goes STANDALONE: Hartlan surfaces at the seat beside the rail after the seal wave (`BOARD` / `MANY` on
the box). «Out of its place on the receiving stage» is reached only by a play that lands on the receiving stage
(a non-tile play waking a corporation — Point Luna's Earth tag). With FOUR rail groups off one staged play (MANY:
Tharsis · Rover · Immigrant City, then Hartlan's DEFERRED gain last in the server's order) the fourth rise starts
past the 1.8 s ceiling and is summarized — the reactor the forecast PROMISED is the one that ticks without a face
(PL-1059, the owner's call: the promised group first / a 2.4 s ceiling from four groups / leave the law).

The scale step's reward (TR24 — the marker is the law), the Parliament's ledger, Pristar's income mark, the banner
stage (TR77 — its own law), a reaction on a RIVAL's screen (their own reactors play on their screen; a reactor of
the VIEWER's woken by a rival's play stands as a notification — the compact rise in a rival's place is the next
iteration), the hero's `holdHeroAnswers` path for a card-resource answer with no record, and **the board's cell
scene for a holder's answer**: a standard-project city's animal for Pets is held by the placement scene and flown
FROM THE CELL to the holder (`cell:24 → recv:Pets` on the first field run) — the raw-hold attribution leaves that
family where it is; Pets rising and the animal born on its printed animal is the next iteration. A `card-resource`
group with NO scene holding it is held and flown by the standalone chain to the holder's satellite cell.

## Files

Server: `common/models/CardReactionModel.ts`, `server/events/EventRecorder.ts` (`recordReaction`, the `cause`
parameter of `withEffect`), `Game.publishCardReaction`, `ServerModel`, `cards/cardPlacesTile.ts`,
`cards/turmoilRedux/HartlanHeating.ts`. Client: `console/cardReaction/{cardReactionModel,cardReactionStage,
effectIconEnds,cardReactionDirector}.ts`, `components/console/cardReaction/ConsoleCardReactionLayer.vue`,
`styles/console_card_reaction.less`; hosts: `resourceTransfer/railReward.ts` (`RailAnswerFlight.prepare /
tokensOf / onDone`), `played/consolePlayedHero.ts`, `consoleActionCommitRail.ts`, `transport/gameTransport.ts`,
`cardIntake/intakeAssemblyDirector.ts` + `intakeAssemblyPlan.ts`, `deckDraw/ConsoleDeckDrawLayer.vue`,
`played/ConsolePlayedReceivingStage.vue`. Guards: `tests/events/CardReactionRecord.spec.ts`,
`tests/console/cardReactionModel.spec.ts`, `tests/client/console/{cardReactionDirector,effectIconEnds,railReward}.spec.ts`,
`tests/console/intakeAssemblyPlan.spec.ts`; e2e `console-hartlan-heating` (B · C · A), `console-card-reaction`
(MANY · BOARD) — TIMING class, fixtures `hartlan-heating` / `card-reaction-many`; the witness anchor
`reactor:<card>:<sprite>` (`transferWitness.ts`).
